import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { VersionCheckService } from './version-check.service.js';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function githubResponse(tagName: string): Promise<Response> {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        tag_name: tagName,
        html_url: `https://github.com/FireDroX/nestwiki/releases/tag/${tagName}`,
      }),
      { status: 200 },
    ),
  );
}

describe('VersionCheckService', () => {
  let env: Record<string, string>;
  let fetchMock: Mock<typeof fetch>;

  async function buildService(currentVersion = '1.0.7') {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VersionCheckService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();
    const service = moduleRef.get(VersionCheckService);
    vi.spyOn(service, 'currentVersion').mockReturnValue(currentVersion);
    return service;
  }

  beforeEach(() => {
    env = {};
    fetchMock = vi.fn<typeof fetch>(() => githubResponse('v1.1.0'));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports an available update with the release link when GitHub has a newer version', async () => {
    const service = await buildService('1.0.7');

    await expect(service.getStatus()).resolves.toEqual({
      currentVersion: '1.0.7',
      latestVersion: '1.1.0',
      releaseUrl: 'https://github.com/FireDroX/nestwiki/releases/tag/v1.1.0',
      updateAvailable: true,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.github.com/repos/FireDroX/nestwiki/releases/latest',
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('compares versions numerically, not as strings', async () => {
    fetchMock.mockImplementation(() => githubResponse('v1.0.10'));
    const service = await buildService('1.0.9');
    expect((await service.getStatus()).updateAvailable).toBe(true);

    fetchMock.mockImplementation(() => githubResponse('v1.0.9'));
    const upToDate = await buildService('1.0.10');
    expect((await upToDate.getStatus()).updateAvailable).toBe(false);
  });

  it('does not flag an update when running the latest or a newer version', async () => {
    fetchMock.mockImplementation(() => githubResponse('v1.0.7'));
    const service = await buildService('1.0.7');

    expect((await service.getStatus()).updateAvailable).toBe(false);
  });

  it('asks GitHub at most once every six hours', async () => {
    const service = await buildService();

    await service.getStatus();
    vi.setSystemTime(Date.now() + SIX_HOURS_MS - 1000);
    await service.getStatus();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 2000);
    await service.getStatus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a network error', () => Promise.reject(new Error('ECONNREFUSED'))],
    [
      'an HTTP error',
      () => Promise.resolve(new Response('rate limited', { status: 403 })),
    ],
    [
      'an unexpected payload',
      () =>
        Promise.resolve(
          new Response('{"message":"Not Found"}', { status: 200 }),
        ),
    ],
  ])(
    'never fails on %s: no latest version and no update',
    async (_label, failure) => {
      fetchMock.mockImplementation(failure);
      const service = await buildService();

      await expect(service.getStatus()).resolves.toEqual({
        currentVersion: '1.0.7',
        latestVersion: null,
        releaseUrl: null,
        updateAvailable: false,
      });
    },
  );

  it('never calls GitHub when UPDATE_CHECK=false', async () => {
    env.UPDATE_CHECK = 'false';
    const service = await buildService();

    const status = await service.getStatus();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(status.updateAvailable).toBe(false);
    expect(status.latestVersion).toBeNull();
  });

  it('reads the running version from the backend package.json', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VersionCheckService,
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    expect(moduleRef.get(VersionCheckService).currentVersion()).toMatch(
      /^\d+\.\d+\.\d+$/,
    );
  });
});
