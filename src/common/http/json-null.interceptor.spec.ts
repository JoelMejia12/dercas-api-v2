import { describe, expect, it } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { JsonNullInterceptor, JsonNullResponse } from './json-null.interceptor';

describe('JsonNullInterceptor', () => {
  it('serializes a nullable result as a JSON null value instead of an empty HTTP body', async () => {
    const result = await firstValueFrom(new JsonNullInterceptor().intercept(
      {} as never,
      { handle: () => of(null) },
    ));

    expect(result).toBeInstanceOf(JsonNullResponse);
    expect(JSON.stringify(result)).toBe('null');
  });

  it('leaves non-null responses unchanged', async () => {
    const value = { id: '5' };
    await expect(firstValueFrom(new JsonNullInterceptor().intercept(
      {} as never,
      { handle: () => of(value) },
    ))).resolves.toBe(value);
  });
});
