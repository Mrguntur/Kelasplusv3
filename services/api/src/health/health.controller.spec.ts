import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns liveness metadata without exposing infrastructure secrets', () => {
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'kelasplus-api',
      version: 'v2-foundation',
    });
  });
});
