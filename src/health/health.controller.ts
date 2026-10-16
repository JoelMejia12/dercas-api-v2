import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @ApiOkResponse({ schema: { type: 'object', properties: { status: { type: 'string', enum: ['alive'] } }, required: ['status'] } })
  live() {
    return this.health.live();
  }

  @Get('ready')
  @ApiOkResponse({ schema: {
    type: 'object', required: ['status', 'checks'],
    properties: {
      status: { type: 'string', enum: ['ready'] },
      checks: { type: 'object', required: ['process', 'database'], properties: {
        process: { type: 'string', enum: ['up'] }, database: { type: 'string', enum: ['up'] },
      } },
    },
  } })
  @ApiServiceUnavailableResponse({ schema: {
    type: 'object', required: ['status', 'checks'],
    properties: {
      status: { type: 'string', enum: ['not_ready'] },
      checks: { type: 'object', required: ['process', 'database'], properties: {
        process: { type: 'string', enum: ['up'] }, database: { type: 'string', enum: ['not_configured', 'unavailable'] },
      } },
    },
  } })
  async readiness(@Res() response: Response) {
    const result = await this.health.readiness();
    return response.status(result.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(result);
  }
}
