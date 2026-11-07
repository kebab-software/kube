import { describe, expect, it } from 'vitest';
import { defaultLibrary, type Track, tracksFrom } from '../src/model';
import { rankRecommendations } from '../src/recommendations';
import { instanceOrigin } from '../src/api';
import { parseBackup } from '../src/storage';
const track = (id: string, authorId = 'artist-a'): Track => ({ videoId: id.padEnd(11, '0'), title: `Song ${id}`, author: authorId, authorId, lengthSeconds: 200, videoThumbnails: [] });
describe('recommendation ranking', () => {
  it('removes duplicates, hidden tracks, live streams and unsuitable lengths', () => {
    const lib = defaultLibrary(); const hidden = track('hidden'); lib.hidden = [hidden.videoId];
    const keep = track('keep');
    expect(rankRecommendations([hidden, keep, keep, { ...track('short'), lengthSeconds: 10 }, { ...track('live'), liveNow: true }], lib).map(r => r.track.videoId)).toEqual([keep.videoId]);
  });
  it('learns from completed listening and penalizes early skips', () => {
    const lib = defaultLibrary(); const now = Date.now(); lib.settings.discovery = 0;
    lib.history = [{ track: track('seed', 'loved'), at: now, seconds: 190, completed: true }, { track: track('skip', 'skipped'), at: now, seconds: 7, completed: false }];
    const ranked = rankRecommendations([track('new-skip', 'skipped'), track('new-love', 'loved')], lib, new Set(), now);
    expect(ranked[0].track.authorId).toBe('loved');
  });
  it('avoids replaying a track immediately', () => {
    const lib = defaultLibrary(); const seed = track('recent'); const now = Date.now();
    lib.history = [{ track: seed, at: now, seconds: 180, completed: true }];
    expect(rankRecommendations([seed, track('fresh')], lib, new Set(), now)[0].track.videoId).toBe(track('fresh').videoId);
  });
  it('diversifies consecutive artists', () => {
    const lib = defaultLibrary(); lib.settings.discovery = 0;
    const result = rankRecommendations([track('a'), track('b'), track('c', 'artist-b'), track('d', 'artist-b')], lib);
    expect(result[0].track.authorId).not.toBe(result[1].track.authorId);
  });
  it('excludes hidden tracks even when they are liked or related', () => {
    const lib = defaultLibrary(); const seed = track('hidden'); lib.liked = [seed]; lib.hidden = [seed.videoId];
    expect(rankRecommendations([seed], lib, new Set([seed.videoId]))).toEqual([]);
  });
});
describe('untrusted data and backups', () => {
  it('accepts valid Invidious tracks and rejects malformed results', () => {
    expect(tracksFrom([{ videoId: '<script>', title: 'bad' }, track('valid'), { type: 'channel' }])).toHaveLength(1);
  });
  it('round trips a full library', () => { const lib = defaultLibrary(); lib.liked = [track('liked')]; expect(parseBackup(JSON.stringify(lib))).toEqual(lib); });
  it('rejects incompatible versions and insecure backup instances', () => {
    expect(() => parseBackup('{"version":99}')).toThrow();
    const lib = defaultLibrary(); lib.settings.instance = 'javascript:alert(1)'; expect(() => parseBackup(JSON.stringify(lib))).toThrow();
  });
  it('allows only clean HTTPS instance origins', () => {
    expect(instanceOrigin(' https://example.com/ ')).toBe('https://example.com');
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/api', 'https://example.com?q=x']) expect(() => instanceOrigin(url)).toThrow();
  });
});
