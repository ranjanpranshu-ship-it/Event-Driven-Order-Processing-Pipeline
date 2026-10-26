import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service.js';

const mockOrderRepo = {
  find: vi.fn(),
  findOne: vi.fn(),
  save: vi.fn(),
  create: vi.fn(),
};

const mockKafka = {
  emitOrderCreated: vi.fn(),
  emitOrderUpdated: vi.fn(),
};

const mockCache = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};

const VALID_ID = '64b7f0000000000000000001';
const OTHER_ID = '64b7f0000000000000000002';

function createService() {
  return new OrdersService(
    mockOrderRepo as any,
    mockKafka as any,
    mockCache as any,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCache.set.mockResolvedValue(undefined);
  mockCache.del.mockResolvedValue(undefined);
});

describe('OrdersService', () => {
  describe('createOrder', () => {
    it('should emit event and return success message', async () => {
      const service = createService();
      const result = await service.createOrder('prod-1', 2);

      expect(mockKafka.emitOrderCreated).toHaveBeenCalledWith({
        productId: 'prod-1',
        quantity: 2,
      });
      expect(result).toEqual({ message: 'Order queued for processing' });
    });

    it('should handle different quantities', async () => {
      const service = createService();
      const result = await service.createOrder('prod-2', 10);

      expect(mockKafka.emitOrderCreated).toHaveBeenCalledWith({
        productId: 'prod-2',
        quantity: 10,
      });
      expect(result.message).toBe('Order queued for processing');
    });
  });

  describe('findAll', () => {
    it('should return cached data on cache hit', async () => {
      const cachedOrders = [
        { id: '1', productId: 'p1', status: 'pending' },
        { id: '2', productId: 'p2', status: 'shipped' },
      ];
      mockCache.get.mockResolvedValue(cachedOrders);

      const service = createService();
      const result = await service.findAll();

      expect(result).toEqual({ data: cachedOrders, cacheHit: true });
      expect(mockOrderRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache on cache miss', async () => {
      const dbOrders = [{ id: '1', productId: 'p1', status: 'pending' }];
      mockCache.get.mockResolvedValue(undefined);
      mockOrderRepo.find.mockResolvedValue(dbOrders);

      const service = createService();
      const result = await service.findAll();

      expect(result).toEqual({ data: dbOrders, cacheHit: false });
      expect(mockOrderRepo.find).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        'orders:all',
        dbOrders,
        30_000,
      );
    });
  });

  describe('getOrderStatus', () => {
    it('should return cached order on cache hit', async () => {
      const cachedOrder = { id: VALID_ID, status: 'shipped' };
      mockCache.get.mockResolvedValue(cachedOrder);

      const service = createService();
      const result = await service.getOrderStatus(VALID_ID);

      expect(result).toEqual(cachedOrder);
      expect(mockOrderRepo.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException on explicit null cache', async () => {
      mockCache.get.mockResolvedValue(null);

      const service = createService();

      await expect(service.getOrderStatus(VALID_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockOrderRepo.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from DB on cache miss', async () => {
      const order = { id: VALID_ID, status: 'pending' };
      mockCache.get.mockResolvedValue(undefined);
      mockOrderRepo.findOne.mockResolvedValue(order);

      const service = createService();
      const result = await service.getOrderStatus(VALID_ID);

      expect(result).toEqual(order);
      expect(mockOrderRepo.findOne).toHaveBeenCalledWith({
        where: { id: VALID_ID },
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        `order:${VALID_ID}`,
        order,
        30_000,
      );
    });

    it('should throw NotFoundException for a malformed id without querying', async () => {
      const service = createService();

      await expect(service.getOrderStatus('not-an-object-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockOrderRepo.findOne).not.toHaveBeenCalled();
    });

    it('should cache null and throw when DB has no record', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockOrderRepo.findOne.mockResolvedValue(null);

      const service = createService();

      await expect(service.getOrderStatus(OTHER_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        `order:${OTHER_ID}`,
        null,
        30_000,
      );
    });
  });

  describe('updateOrder', () => {
    it('should update order, invalidate caches and emit event', async () => {
      const order = {
        id: VALID_ID,
        status: 'pending',
        createdAt: new Date('2026-01-01'),
      };
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockOrderRepo.save.mockResolvedValue({ ...order, status: 'shipped' });

      const service = createService();
      const result = await service.updateOrder(VALID_ID, 'shipped');

      expect(order.status).toBe('shipped');
      expect(mockOrderRepo.save).toHaveBeenCalledWith(order);
      expect(mockCache.del).toHaveBeenCalledWith('orders:all');
      expect(mockCache.del).toHaveBeenCalledWith(`order:${VALID_ID}`);
      expect(mockKafka.emitOrderUpdated).toHaveBeenCalledWith({
        orderId: VALID_ID,
        status: 'shipped',
        createdAt: new Date('2026-01-01'),
      });
      expect(result.message).toBe('Order updated');
    });

    it('should throw NotFoundException for a malformed id without querying', async () => {
      const service = createService();

      await expect(
        service.updateOrder('not-an-object-id', 'shipped'),
      ).rejects.toThrow(NotFoundException);
      expect(mockOrderRepo.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      const service = createService();

      await expect(service.updateOrder(OTHER_ID, 'shipped')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockOrderRepo.save).not.toHaveBeenCalled();
      expect(mockKafka.emitOrderUpdated).not.toHaveBeenCalled();
    });
  });
});
