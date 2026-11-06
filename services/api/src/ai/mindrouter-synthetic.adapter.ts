import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}

export interface AiProviderResult {
  answer: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * OpenAI-compatible MindRouter adapter for synthetic development fixtures only.
 *
 * This adapter is deliberately not wired into AiService. It refuses production
 * execution and requires an explicit local/test opt-in. The main AI gateway
 * remains fail-closed until provider, legal, school, retention and budget gates
 * are approved. Never pass real school/student data to this method.
 */
@Injectable()
export class MindRouterSyntheticAdapter {
  private static readonly endpoint = 'https://api.mindrouter.io/v1/chat/completions';

  constructor(private readonly config: ConfigService) {}

  async generateSyntheticTest(request: AiProviderRequest): Promise<AiProviderResult> {
    const environment = this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development';
    const enabled = this.config.get<string>('AI_MINDROUTER_SYNTHETIC_TESTS_ENABLED');

    if (environment === 'production' || enabled !== 'true') {
      throw new ServiceUnavailableException('Adapter MindRouter hanya tersedia untuk pengujian sintetis non-produksi yang diaktifkan secara eksplisit.');
    }

    const apiKey = this.config.get<string>('MINDROUTER_API_KEY');
    const model = this.config.get<string>('MINDROUTER_MODEL');
    if (!apiKey || !model) {
      throw new ServiceUnavailableException('Konfigurasi pengujian MindRouter belum lengkap.');
    }

    if (!request.systemPrompt.trim() || !request.userPrompt.trim()) {
      throw new BadGatewayException('Fixture pengujian AI tidak valid.');
    }

    let response: Response;
    try {
      response = await fetch(MindRouterSyntheticAdapter.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          temperature: 0.2,
          max_tokens: request.maxOutputTokens ?? 700,
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BadGatewayException('Koneksi pengujian ke penyedia AI gagal.');
    }

    if (!response.ok) {
      throw new BadGatewayException('Penyedia AI menolak permintaan pengujian.');
    }

    let payload: {
      choices?: Array<{ message?: { content?: string | null } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new BadGatewayException('Respons pengujian penyedia AI tidak valid.');
    }

    const answer = payload.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new BadGatewayException('Penyedia AI tidak mengembalikan jawaban pengujian.');
    }

    return {
      answer,
      model: payload.model || model,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
    };
  }
}
