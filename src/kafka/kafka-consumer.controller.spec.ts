import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KafkaConsumerController } from './kafka-consumer.controller.js';

const VALID_ID = '64b7f0000000000000000001';
const OTHER_ID = '64b7f0000000000000000002';

const mockRepo = {
  create: vi.fn((data) => ({ ...data })),
  save: vi.fn((order) => Promise.resolve({ id: VALID_ID, ...order })),
  findOne: vi.fn(),
};

const mockCache = {
  del: vi.fn().mockResolvedValue(true),
};

function createController() {
  return new KafkaConsumerController(mockRepo as any, mockCache as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('KafkaConsumerController', () => {
  describe('handleOrderCreated (orders.created)', () => {
    it('should create and save a pending order', async () => {
      const controller = createController();
      const data = { productId: 'prod-1', quantity: 2 };

      await controller.handleOrderCreated(data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        productId: 'prod-1',
        quantity: 2,
        status: 'pending',
        createdAt: expect.any(Date),
      });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should invalidate the list and order caches', async () => {
      const controller = createController();

      await controller.handleOrderCreated({ productId: 'p1', quantity: 1 });

      expect(mockCache.del).toHaveBeenCalledWith('orders:all');
      expect(mockCache.del).toHaveBeenCalledWith(`order:${VALID_ID}`);
    });
  });

  describe('handleOrderUpdated (orders.updated)', () => {
    it('should update order status and invalidate caches', async () => {
      const existingOrder = {
        id: VALID_ID,
        status: 'pending',
        productId: 'p1',
        quantity: 1,
      };
      mockRepo.findOne.mockResolvedValue(existingOrder);

      const controller = createController();
      const data = {
        orderId: VALID_ID,
        status: 'shipped',
        createdAt: new Date(),
      };

      await controller.handleOrderUpdated(data);

      expect(existingOrder.status).toBe('shipped');
      expect(mockRepo.save).toHaveBeenCalledWith(existingOrder);
      expect(mockCache.del).toHaveBeenCalledWith('orders:all');
      expect(mockCache.del).toHaveBeenCalledWith(`order:${VALID_ID}`);
    });

    it('should return early for a malformed order id', async () => {
      const controller = createController();
      const data = {
        orderId: 'not-an-object-id',
        status: 'shipped',
        createdAt: new Date(),
      };

      await controller.handleOrderUpdated(data);

      expect(mockRepo.findOne).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should return early if order not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const controller = createController();
      const data = {
        orderId: OTHER_ID,
        status: 'shipped',
        createdAt: new Date(),
      };

      await controller.handleOrderUpdated(data);

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockCache.del).not.toHaveBeenCalled();
    });
  });
});
