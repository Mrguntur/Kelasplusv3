import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MindRouterSyntheticAdapter } from './mindrouter-synthetic.adapter';

describe('MindRouterSyntheticAdapter', () => {
  const configValues: Record<string, string | undefined> = {
    NODE_ENV: 'test',
    AI_MINDROUTER_SYNTHETIC_TESTS_ENABLED: 'true',
    MINDROUTER_API_KEY: 'test-only-key',
    MINDROUTER_MODEL: 'mindrouter/deepseek-v4.1-flash',
  };
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  let adapter: MindRouterSyntheticAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    Object.assign(configValues, {
      NODE_ENV: 'test',
      AI_MINDROUTER_SYNTHETIC_TESTS_ENABLED: 'true',
      MINDROUTER_API_KEY: 'test-only-key',
      MINDROUTER_MODEL: 'mindrouter/deepseek-v4.1-flash',
    });
    jest.clearAllMocks();
    adapter = new MindRouterSyntheticAdapter(config);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => fetchSpy.mockRestore());

  it('blocks production even when the synthetic flag is enabled', async () => {
    configValues.NODE_ENV = 'production';
    await expect(adapter.generateSyntheticTest({
      systemPrompt: 'Synthetic system fixture',
      userPrompt: 'Synthetic user fixture',
    })).rejects.toThrow(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks when explicit synthetic opt-in is absent', async () => {
    configValues.AI_MINDROUTER_SYNTHETIC_TESTS_ENABLED = 'false';
    await expect(adapter.generateSyntheticTest({
      systemPrompt: 'Synthetic system fixture',
      userPrompt: 'Synthetic user fixture',
    })).rejects.toThrow(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends an OpenAI-compatible request and returns normalized usage', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'mindrouter/deepseek-v4.1-flash',
        choices: [{ message: { content: '  Synthetic answer  ' } }],
        usage: { prompt_tokens: 120, completion_tokens: 45 },
      }),
    } as Response);

    await expect(adapter.generateSyntheticTest({
      systemPrompt: 'Synthetic system fixture',
      userPrompt: 'Synthetic user fixture',
      maxOutputTokens: 500,
    })).resolves.toEqual({
      answer: 'Synthetic answer',
      model: 'mindrouter/deepseek-v4.1-flash',
      inputTokens: 120,
      outputTokens: 45,
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.mindrouter.io/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-only-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'mindrouter/deepseek-v4.1-flash',
      max_tokens: 500,
    });
  });

  it('does not expose provider response details on HTTP failure', async () => {
    fetchSpy.mockResolvedValue({ ok: false, json: async () => ({ secret: 'hidden' }) } as Response);
    await expect(adapter.generateSyntheticTest({
      systemPrompt: 'Synthetic system fixture',
      userPrompt: 'Synthetic user fixture',
    })).rejects.toThrow(BadGatewayException);
  });

  it('rejects empty fixtures before network access', async () => {
    await expect(adapter.generateSyntheticTest({
      systemPrompt: ' ',
      userPrompt: 'Synthetic user fixture',
    })).rejects.toThrow(BadGatewayException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
