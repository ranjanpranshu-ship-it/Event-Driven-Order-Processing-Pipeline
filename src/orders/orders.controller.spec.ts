import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrdersController } from './orders.controller.js';

const mockOrdersService = {
  createOrder: vi.fn(),
  findAll: vi.fn(),
  getOrderStatus: vi.fn(),
  updateOrder: vi.fn(),
};

// Mock Express Response
function mockRes() {
  return {
    setHeader: vi.fn(),
  };
}

function createController() {
  return new OrdersController(mockOrdersService as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrdersController', () => {
  describe('POST /orders', () => {
    it('should create an order', async () => {
      mockOrdersService.createOrder.mockResolvedValue({
        message: 'Order queued for processing',
      });

      const controller = createController();
      const result = await controller.create({
        productId: 'prod-1',
        quantity: 3,
      });

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith('prod-1', 3);
      expect(result).toEqual({ message: 'Order queued for processing' });
    });
  });

  describe('GET /orders', () => {
    it('should set X-Cache: HIT on cache hit', async () => {
      const orders = [{ id: '1', status: 'pending' }];
      mockOrdersService.findAll.mockResolvedValue({
        data: orders,
        cacheHit: true,
      });

      const controller = createController();
      const res = mockRes();
      const result = await controller.findAll(res as any);

      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(result).toEqual(orders);
    });

    it('should set X-Cache: MISS on cache miss', async () => {
      const orders = [{ id: '1', status: 'shipped' }];
      mockOrdersService.findAll.mockResolvedValue({
        data: orders,
        cacheHit: false,
      });

      const controller = createController();
      const res = mockRes();
      const result = await controller.findAll(res as any);

      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(result).toEqual(orders);
    });
  });

  describe('GET /orders/:orderId', () => {
    it('should return a single order', async () => {
      const order = { id: '1', status: 'pending' };
      mockOrdersService.getOrderStatus.mockResolvedValue(order);

      const controller = createController();
      const result = await controller.findOne('1');

      expect(mockOrdersService.getOrderStatus).toHaveBeenCalledWith('1');
      expect(result).toEqual(order);
    });
  });

  describe('PATCH /orders/:orderId', () => {
    it('should update order status', async () => {
      mockOrdersService.updateOrder.mockResolvedValue({
        message: 'Order updated',
        order: { id: '1', status: 'delivered' },
      });

      const controller = createController();
      const result = await controller.update('1', { status: 'delivered' });

      expect(mockOrdersService.updateOrder).toHaveBeenCalledWith(
        '1',
        'delivered',
      );
      expect(result.message).toBe('Order updated');
    });
  });
});
