import { AuthController } from './auth.controller';

describe('AuthController cookie policy', () => {
  it('uses HttpOnly cookie and SameSite=Lax outside production', () => {
    const controller = new AuthController(
      {} as never,
      { get: () => 'development' } as never,
    );
    const options = (controller as unknown as { cookieOptions: (expires: Date) => Record<string, unknown> })
      .cookieOptions(new Date('2030-01-01T00:00:00.000Z'));
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/api/v1');
  });

  it('requires Secure cookies in production', () => {
    const controller = new AuthController(
      {} as never,
      { get: () => 'production' } as never,
    );
    const options = (controller as unknown as { cookieOptions: (expires: Date) => Record<string, unknown> })
      .cookieOptions(new Date('2030-01-01T00:00:00.000Z'));
    expect(options.secure).toBe(true);
  });
});
