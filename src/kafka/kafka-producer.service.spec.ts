import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KafkaProducerService } from './kafka-producer.service.js';

const mockKafkaClient = {
  emit: vi.fn(),
};

function createService() {
  return new KafkaProducerService(mockKafkaClient as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('KafkaProducerService', () => {
  describe('emitOrderCreated', () => {
    it('should emit to "orders.created" topic', () => {
      const service = createService();
      const order = { productId: 'prod-1', quantity: 3 };

      service.emitOrderCreated(order);

      expect(mockKafkaClient.emit).toHaveBeenCalledWith(
        'orders.created',
        order,
      );
    });

    it('should pass the full payload', () => {
      const service = createService();
      const order = { productId: 'prod-99', quantity: 10 };

      service.emitOrderCreated(order);

      expect(mockKafkaClient.emit).toHaveBeenCalledWith(
        'orders.created',
        expect.objectContaining({ productId: 'prod-99', quantity: 10 }),
      );
    });
  });

  describe('emitOrderUpdated', () => {
    it('should emit to "orders.updated" topic', () => {
      const service = createService();
      const order = {
        orderId: '1',
        status: 'delivered',
        createdAt: new Date(),
      };

      service.emitOrderUpdated(order);

      expect(mockKafkaClient.emit).toHaveBeenCalledWith(
        'orders.updated',
        order,
      );
    });

    it('should pass orderId, status, and createdAt', () => {
      const service = createService();
      const date = new Date('2026-01-15');
      const order = { orderId: '42', status: 'cancelled', createdAt: date };

      service.emitOrderUpdated(order);

      expect(mockKafkaClient.emit).toHaveBeenCalledWith(
        'orders.updated',
        expect.objectContaining({
          orderId: '42',
          status: 'cancelled',
          createdAt: date,
        }),
      );
    });
  });
});
