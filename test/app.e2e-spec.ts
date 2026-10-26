import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { createKeyv } from '@keyv/redis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { KafkaProducerService } from '../src/kafka/kafka-producer.service.js';
import { Order } from '../src/orders/entities/order.entity.js';
import { OrdersModule } from '../src/orders/orders.module.js';

/**
 * HTTP-level end-to-end tests for the orders API. External infrastructure
 * (MongoDB, Redis, Kafka) is mocked so the tests run without Docker.
 */
describe('Orders API (HTTP e2e)', () => {
  let app: INestApplication<App>;

  const orderRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn(),
  };

  const producer = {
    emitOrderCreated: vi.fn(),
    emitOrderUpdated: vi.fn(),
  };

  const cache = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        OrdersModule,
        CacheModule.register({
          isGlobal: true,
          stores: [createKeyv('redis://localhost:6379')],
          ttl: 30_000,
        }),
      ],
    })
      .overrideProvider(getRepositoryToken(Order))
      .useValue(orderRepo)
      .overrideProvider(KafkaProducerService)
      .useValue(producer)
      .overrideProvider(CACHE_MANAGER)
      .useValue(cache)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /orders queues an order and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ productId: 'prod-1', quantity: 2 })
      .expect(201);

    expect(res.body).toEqual({ message: 'Order queued for processing' });
    expect(producer.emitOrderCreated).toHaveBeenCalledWith({
      productId: 'prod-1',
      quantity: 2,
    });
  });

  it('POST /orders rejects an invalid payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({ productId: '', quantity: 0 })
      .expect(400);
  });

  it('GET /orders returns the list with an X-Cache header', async () => {
    const res = await request(app.getHttpServer()).get('/orders').expect(200);

    expect(res.headers['x-cache']).toBe('MISS');
    expect(res.body).toEqual([]);
  });

  it('GET /orders/:orderId returns 404 when the order is missing', async () => {
    await request(app.getHttpServer()).get('/orders/missing').expect(404);
  });

  it('PATCH /orders/:orderId returns 404 when the order is missing', async () => {
    await request(app.getHttpServer())
      .patch('/orders/missing')
      .send({ status: 'shipped' })
      .expect(404);
  });
});
