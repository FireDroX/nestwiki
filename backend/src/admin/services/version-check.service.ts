import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LATEST_RELEASE_CACHE_TTL_MS,
  LATEST_RELEASE_FAILURE_CACHE_TTL_MS,
  LATEST_RELEASE_TIMEOUT_MS,
  LATEST_RELEASE_URL,
} from '../../common/variables.global.js';
import type { VersionStatusResponseDto } from '../dto/out/version-status-response.dto.js';

const PACKAGE_JSON_URL = new URL('../../../package.json', import.meta.url);
const VERSION_PATTERN = /^v?(\d+\.\d+\.\d+)$/;

interface LatestRelease {
  version: string;
  url: string;
}

interface CachedRelease {
  release: LatestRelease | null;
  expiresAt: number;
}

function versionNumbers(version: string): number[] {
  return version.split('.').map(Number);
}

function isNewer(candidate: string, current: string): boolean {
  const left = versionNumbers(candidate);
  const right = versionNumbers(current);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) {
      return left[index] > right[index];
    }
  }
  return false;
}

function parseRelease(payload: unknown): LatestRelease | null {
  const { tag_name: tagName, html_url: url } = (payload ?? {}) as {
    tag_name?: unknown;
    html_url?: unknown;
  };
  if (typeof tagName !== 'string' || typeof url !== 'string') {
    return null;
  }
  const match = VERSION_PATTERN.exec(tagName);
  return match ? { version: match[1], url } : null;
}

@Injectable()
export class VersionCheckService {
  private readonly logger = new Logger(VersionCheckService.name);
  private cache: CachedRelease | null = null;
  private pending: Promise<LatestRelease | null> | null = null;

  constructor(private readonly configService: ConfigService) {}

  currentVersion(): string {
    const { version } = JSON.parse(readFileSync(PACKAGE_JSON_URL, 'utf-8')) as {
      version: string;
    };
    return version;
  }

  async getStatus(): Promise<VersionStatusResponseDto> {
    const currentVersion = this.currentVersion();
    const release = this.isEnabled() ? await this.latestRelease() : null;
    return {
      currentVersion,
      latestVersion: release?.version ?? null,
      releaseUrl: release?.url ?? null,
      updateAvailable:
        release !== null && isNewer(release.version, currentVersion),
    };
  }

  private isEnabled(): boolean {
    return (
      this.configService.get<string>('UPDATE_CHECK')?.toLowerCase() !== 'false'
    );
  }

  private async latestRelease(): Promise<LatestRelease | null> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.release;
    }
    this.pending ??= this.fetchLatestRelease().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async fetchLatestRelease(): Promise<LatestRelease | null> {
    let release: LatestRelease | null = null;
    try {
      const response = await fetch(LATEST_RELEASE_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'nestwiki-update-check',
        },
        signal: AbortSignal.timeout(LATEST_RELEASE_TIMEOUT_MS),
      });
      if (response.ok) {
        release = parseRelease(await response.json());
      }
    } catch (error) {
      this.logger.warn(
        `Could not check for a newer NestWiki release: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const ttl = release
      ? LATEST_RELEASE_CACHE_TTL_MS
      : LATEST_RELEASE_FAILURE_CACHE_TTL_MS;
    this.cache = { release, expiresAt: Date.now() + ttl };
    return release;
  }
}
