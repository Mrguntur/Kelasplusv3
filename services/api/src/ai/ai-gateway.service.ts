import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * Server-side boundary for all model traffic.
 *
 * Deliberately fail-closed while provider due diligence is pending. Do not add
 * a provider adapter or populate an approval registry until legal/privacy,
 * school, retention, transfer and child-access reviews are recorded.
 */
@Injectable()
export class AiGatewayService {
  assertProviderRouteApproved(): void {
    // No provider/model route is approved for KELAS+ school data yet.
    // This guard runs before context construction and before usage reservation.
    throw new ServiceUnavailableException(
      'Layanan AI sementara dinonaktifkan sampai penyedia dan rute model KELAS+ disetujui.',
    );
  }
}
