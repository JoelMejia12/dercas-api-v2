import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { NotificationListQueryDto } from './notification.dto';

describe('NotificationListQueryDto', () => {
  it('accepts only schema-defined notification state and channel filters', async () => {
    await expect(validate(Object.assign(new NotificationListQueryDto(), { state: 'LEIDA', channel: 'APP' }))).resolves.toHaveLength(0);
    expect(await validate(Object.assign(new NotificationListQueryDto(), { state: 'SENT', channel: 'WHATSAPP' }))).not.toHaveLength(0);
  });
});
