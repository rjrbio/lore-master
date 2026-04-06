import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class ThrottleExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger('RateLimit');

    catch(exception: HttpException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception.getStatus();

        if (status === 429) {
            const ip = request.ip || request.socket.remoteAddress || 'unknown';
            this.logger.warn(
                `Rate limit excedido: ip=${ip}, method=${request.method}, path=${request.path}`,
            );
        }

        const body = exception.getResponse();
        response.status(status).json(body);
    }
}
