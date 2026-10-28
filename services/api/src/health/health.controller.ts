import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok'; service: 'kelasplus-api'; version: 'v2-foundation' } {
    return {
      status: 'ok',
      service: 'kelasplus-api',
      version: 'v2-foundation',
    };
  }
}
