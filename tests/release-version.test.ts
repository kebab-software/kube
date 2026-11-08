import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const { releaseVersion } = createRequire(import.meta.url)('../scripts/release-version.cjs');
describe('release versioning', () => {
  it('stamps desktop and Android from one stable version', () => {
    expect(releaseVersion('v0.2.3')).toEqual({ version: '0.2.3', versionCode: 2003 });
    expect(releaseVersion('1.0.0').versionCode).toBe(1000000);
  });
  it('preserves Android update ordering across minor and major changes', () => {
    expect(releaseVersion('1.0.0').versionCode).toBeGreaterThan(releaseVersion('0.999.999').versionCode);
    expect(releaseVersion('0.3.0').versionCode).toBeGreaterThan(releaseVersion('0.2.999').versionCode);
  });
  it('rejects ambiguous, unsafe, prerelease and out-of-range tags', () => {
    for (const value of ['0.0.0','v01.2.3','v1.0','v1.2.3-beta.1','v1.1000.0','v2001.0.0','v1.2.3;echo bad','../v1.0.0']) expect(() => releaseVersion(value)).toThrow();
  });
});
