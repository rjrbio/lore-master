import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottleExceptionFilter } from './common/filters/throttle-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Confiar en el proxy (nginx) para obtener la IP real del cliente
  app.set('trust proxy', 1);

  app.use(helmet());

  // Limits de body para prevenir DoS
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true });

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl && process.env.NODE_ENV === 'production') {
    logger.error('FRONTEND_URL es obligatoria en producción');
    process.exit(1);
  }

  app.enableCors({
    origin: frontendUrl || 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  app.useGlobalFilters(new ThrottleExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Servidor iniciado en puerto ${port}`);
}
bootstrap();