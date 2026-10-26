import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Order Processing Pipeline')
    .setDescription(
      'Event-driven order processing with Kafka, MongoDB, and Redis',
    )
    .setVersion('1.0')
    .addTag('orders', 'Order endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 3001);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'db-pipeline',
        brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
          .split(',')
          .map((broker) => broker.trim())
          .filter(Boolean),
        retry: {
          retries: 3,
          retryDelay: 1000,
        },
      },
      consumer: {
        groupId: 'db-pipeline-group',
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`✅ App running on http://localhost:${port}`);
}

await bootstrap();
