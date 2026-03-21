import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // src/main.ts
  app.enableCors(); // <--- ESTO ES VITAL
  await app.listen(3000);
}
bootstrap();