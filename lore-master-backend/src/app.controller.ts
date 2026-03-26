import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    const dbState = this.connection.readyState;
    const dbStatus =
      dbState === ConnectionStates.connected
        ? 'connected'
        : dbState === ConnectionStates.connecting
          ? 'connecting'
          : 'disconnected';
    return {
      status: dbState === ConnectionStates.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
      },
    };
  }
}
