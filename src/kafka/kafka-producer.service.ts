import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import type { Observable } from 'rxjs';

@Injectable()
export class KafkaProducerService {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  emitOrderCreated(order: {
    productId: string;
    quantity: number;
  }): Observable<unknown> {
    this.logger.log(`Emitting to "orders.created": ${JSON.stringify(order)}`);
    return this.kafkaClient.emit('orders.created', order);
  }

  emitOrderUpdated(order: {
    orderId: string;
    status: string;
    createdAt: Date;
  }): Observable<unknown> {
    this.logger.log(`Emitting to "orders.updated": ${JSON.stringify(order)}`);
    return this.kafkaClient.emit('orders.updated', order);
  }
}
