import { z } from 'zod';

export const trackSchema = z.object({
  videoId: z.string().regex(/^[\w-]{11}$/), title: z.string().max(2000),
  author: z.string().max(1000).default('Unknown artist'), authorId: z.string().max(200).default(''),
  musicVerified: z.boolean().optional(), musicSource: z.literal('youtube-music').optional(),
  lengthSeconds: z.number().nonnegative().default(0),
  videoThumbnails: z.array(z.object({ url: z.string(), width: z.number().optional(), quality: z.string().optional() })).default([]),
  viewCount: z.number().optional(), liveNow: z.boolean().optional(),
});
export type Track = z.infer<typeof trackSchema>;
export type Artist = { author: string; authorId: string };
export const artistSchema = z.object({ author: z.string().max(1000), authorId: z.string().max(200) });
export const settingsSchema = z.object({
  instance: z.string().url().refine(x => { try { return new URL(x).protocol === 'https:' && new URL(x).origin === x; } catch { return false; } }),
  catalogProxy: z.string().default(''),
  region: z.string().regex(/^[A-Z]{2}$/),
  rememberHistory: z.boolean(), autoplay: z.boolean(), discovery: z.number().min(0).max(1),
  volume: z.number().min(0).max(1),
});
export const librarySchema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
  liked: z.array(trackSchema).max(20000),
  hidden: z.array(z.string()).max(20000),
  artists: z.array(artistSchema).max(5000),
  playlists: z.array(z.object({ id: z.string(), name: z.string().min(1).max(120), tracks: z.array(trackSchema).max(20000), created: z.number() })).max(1000),
  history: z.array(z.object({ track: trackSchema, at: z.number(), seconds: z.number().nonnegative(), completed: z.boolean() })).max(3000),
});
export type Library = z.infer<typeof librarySchema>;
export type Settings = Library['settings'];
export type Listen = Library['history'][number];
export const defaultLibrary = (): Library => ({
  version: 1,
  settings: { instance: import.meta.env.VITE_INVIDIOUS_INSTANCE || 'https://yt.chocolatemoo53.com', region: 'GB', catalogProxy: '', rememberHistory: true, autoplay: true, discovery: 0.35, volume: 0.8 },
  liked: [], hidden: [], artists: [], playlists: [], history: [],
});
export function tracksFrom(value: unknown): Track[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => { const parsed = trackSchema.safeParse(item); return parsed.success && !parsed.data.liveNow ? [parsed.data] : []; });
}
export const uniqueTracks = (tracks: Track[]) => [...new Map(tracks.map(t => [t.videoId, t])).values()];
export function duration(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export function artistKey(track: Pick<Track, 'author' | 'authorId'>) { return track.authorId || track.author.toLocaleLowerCase(); }
