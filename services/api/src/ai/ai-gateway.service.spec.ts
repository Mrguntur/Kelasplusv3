import { ServiceUnavailableException } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';

describe('AiGatewayService', () => {
  it('fails closed while no provider/model route is approved', () => {
    const gateway = new AiGatewayService();
    expect(() => gateway.assertProviderRouteApproved()).toThrow(ServiceUnavailableException);
  });
});
