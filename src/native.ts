import { registerPlugin } from '@capacitor/core';
export type NativeStatus = { playing: boolean; position: number; duration: number; ended: boolean; id: string; error?: string };
export const NativePlayer = registerPlugin<{
  play(options: { url: string; title: string; artist: string; id: string }): Promise<void>;
  upcoming(options: { tracks: { url: string; title: string; artist: string; id: string }[] }): Promise<void>;
  repeat(options: { mode: 'off' | 'all' | 'one' }): Promise<void>;
  resume(): Promise<void>; pause(): Promise<void>; stop(): Promise<void>;
  seek(options: { seconds: number }): Promise<void>;
  volume(options: { value: number }): Promise<void>;
  status(): Promise<NativeStatus>;
  exportBackup(options: { content: string }): Promise<void>;
}>('KubePlayer');
