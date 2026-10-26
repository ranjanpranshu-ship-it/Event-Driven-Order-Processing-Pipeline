import { Controller, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ORDERS_CACHE_KEY, orderCacheKey } from '../orders/cache-keys.js';
import { isValidOrderId } from '../orders/order-id.js';
import { Order } from '../orders/entities/order.entity.js';

@Controller()
export class KafkaConsumerController {
  private readonly logger = new Logger(KafkaConsumerController.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: MongoRepository<Order>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @EventPattern('orders.created')
  async handleOrderCreated(
    @Payload() data: { productId: string; quantity: number },
  ) {
    this.logger.log(`Order created: ${JSON.stringify(data)}`);

    const order = this.orderRepository.create({
      productId: data.productId,
      quantity: data.quantity,
      status: 'pending',
      createdAt: new Date(),
    });
    const savedOrder = await this.orderRepository.save(order);
    this.logger.log(`Order saved: id = ${savedOrder.id}`);

    await this.invalidateCaches(savedOrder.id);
  }

  @EventPattern('orders.updated')
  async handleOrderUpdated(
    @Payload() data: { orderId: string; status: string; createdAt: Date },
  ) {
    this.logger.log(`Order updated: ${JSON.stringify(data)}`);

    if (!isValidOrderId(data.orderId)) {
      this.logger.warn(`Invalid order id for update: ${data.orderId}`);
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: data.orderId },
    });

    if (!order) {
      this.logger.warn(`Order not found for update: ${data.orderId}`);
      return;
    }

    order.status = data.status;
    await this.orderRepository.save(order);
    await this.invalidateCaches(data.orderId);
  }

  private async invalidateCaches(orderId: string) {
    await Promise.all([
      this.cacheManager.del(ORDERS_CACHE_KEY),
      this.cacheManager.del(orderCacheKey(orderId)),
    ]);
  }
}
