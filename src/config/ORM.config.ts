import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'mongodb',
      host: process.env.MONGODB_HOST ?? 'localhost',
      port: Number(process.env.MONGODB_PORT ?? 27017),
      database: process.env.MONGODB_DATABASE ?? 'db-pipeline',
      autoLoadEntities: true,
      synchronize: false,
      extra: {
        maxPoolSize: 10,
        minPoolSize: 2,
      },
    };
  }
}
