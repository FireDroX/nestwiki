import { Client } from 'minio';
import { describe, expect, it, vi } from 'vitest';
import { backfillAvatarExtensions } from './avatar-backfill.js';

describe('backfillAvatarExtensions', () => {
  it('restores the extension of users without avatar whose file is still stored, with a single listing', async () => {
    const listObjectsV2 = vi.fn(() =>
      [
        'avatars/user-1/avatar.jpg',
        'avatars/user-2/avatar.png',
        'avatars/user-3/avatar.webp',
        'avatars/user-4/avatar.gif',
        'avatars/user-5/other.jpg',
      ].map((name) => ({ name })),
    );
    const minio = { listObjectsV2 } as unknown as Client;
    const runQuery = vi.fn((query: string) =>
      Promise.resolve(
        query.startsWith('SELECT')
          ? [
              { id: 'user-1' },
              { id: 'user-4' },
              { id: 'user-5' },
              { id: 'user-9' },
            ]
          : undefined,
      ),
    );

    const restored = await backfillAvatarExtensions(runQuery, minio, 'bucket');

    expect(restored).toBe(1);
    expect(listObjectsV2).toHaveBeenCalledTimes(1);
    expect(listObjectsV2).toHaveBeenCalledWith('bucket', 'avatars/', true);
    const updates = runQuery.mock.calls.filter(([query]) =>
      query.startsWith('UPDATE'),
    );
    expect(updates).toEqual([
      [
        'UPDATE `users` SET `avatar_extension` = ? WHERE `id` = ? AND `avatar_extension` IS NULL',
        ['jpg', 'user-1'],
      ],
    ]);
  });

  it('propagates storage errors so the caller can report them', async () => {
    const minio = {
      listObjectsV2: vi.fn(() => {
        throw new Error('ECONNREFUSED');
      }),
    } as unknown as Client;

    await expect(
      backfillAvatarExtensions(vi.fn(), minio, 'bucket'),
    ).rejects.toThrow('ECONNREFUSED');
  });
});
