import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity.js';
import { KafkaConsumerController } from './kafka-consumer.controller.js';
import { KafkaProducerService } from './kafka-producer.service.js';

const brokers = (process.env.KAFKA_BROKERS ?? 'kafka:9092')
  .split(',')
  .map((broker) => broker.trim())
  .filter(Boolean);

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: { clientId: 'db-pipeline', brokers },
          consumer: { groupId: 'db-pipeline-group' },
        },
      },
    ]),
  ],
  controllers: [KafkaConsumerController],
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
