import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoreModule } from './lore/lore.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        OPENAI_API_KEY: Joi.string().required(),
        OPENAI_CHAT_MODEL: Joi.string().default('gpt-4o'),
        OPENAI_EMBEDDING_MODEL: Joi.string().default('text-embedding-3-small'),
        MONGODB_URI: Joi.string().required(),
        FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
        PORT: Joi.number().default(3000),
        MIN_CHUNK_LENGTH: Joi.number().default(120),
        MAX_CHUNK_LENGTH: Joi.number().default(1900),
        VECTOR_SEARCH_THRESHOLD: Joi.number().min(0).max(1).default(0.72),
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 10000, limit: 10 },   // anti-burst: 10 req / 10s
      { name: 'medium', ttl: 60000, limit: 30 },   // uso normal: 30 req / min
      { name: 'long', ttl: 86400000, limit: 200 }, // diario: 200 req / día
    ]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    LoreModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule { }
