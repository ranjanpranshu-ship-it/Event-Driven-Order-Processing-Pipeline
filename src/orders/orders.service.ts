import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { KafkaProducerService } from '../kafka/kafka-producer.service.js';
import { CACHE_TTL_MS, ORDERS_CACHE_KEY, orderCacheKey } from './cache-keys.js';
import { isValidOrderId } from './order-id.js';
import { Order } from './entities/order.entity.js';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: MongoRepository<Order>,
    private readonly kafkaProducerService: KafkaProducerService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async createOrder(productId: string, quantity: number) {
    this.kafkaProducerService.emitOrderCreated({ productId, quantity });
    return { message: 'Order queued for processing' };
  }

  async findAll() {
    // Cache-aside: return cached list when available.
    const cached = await this.cache.get<Order[]>(ORDERS_CACHE_KEY);
    if (cached !== undefined) {
      return { data: cached, cacheHit: true };
    }

    const orders = await this.orderRepo.find();
    await this.cache.set(ORDERS_CACHE_KEY, orders, CACHE_TTL_MS);
    return { data: orders, cacheHit: false };
  }

  async getOrderStatus(orderId: string): Promise<Order> {
    if (!isValidOrderId(orderId)) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const key = orderCacheKey(orderId);
    const cached = await this.cache.get<Order | null>(key);
    if (cached !== undefined) {
      if (cached === null) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }
      return cached;
    }

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      // Negative caching: avoid repeated DB lookups for unknown ids.
      await this.cache.set(key, null, CACHE_TTL_MS);
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    await this.cache.set(key, order, CACHE_TTL_MS);
    return order;
  }

  async updateOrder(orderId: string, status: string) {
    if (!isValidOrderId(orderId)) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    order.status = status;
    const saved = await this.orderRepo.save(order);

    await this.invalidateCaches(orderId);
    this.kafkaProducerService.emitOrderUpdated({
      orderId: saved.id,
      status: saved.status,
      createdAt: saved.createdAt,
    });

    return { message: 'Order updated', order: saved };
  }

  private async invalidateCaches(orderId: string) {
    await Promise.all([
      this.cache.del(ORDERS_CACHE_KEY),
      this.cache.del(orderCacheKey(orderId)),
    ]);
  }
}
