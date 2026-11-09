// Invidious exposes the category and licensed song credits in video details.
export function hasMusicMetadata(raw: Record<string, unknown>) {
  if (typeof raw.genre === 'string' && raw.genre.trim().toLowerCase() === 'music') return true;
  return Array.isArray(raw.musicTracks) && raw.musicTracks.some(credit =>
    typeof credit?.song === 'string' && credit.song.trim().length > 0
  );
}

export async function mapMusicPage<T, R>(items: T[], lookup: (item: T) => Promise<R>, signal?: AbortSignal) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      signal?.throwIfAborted();
      const index = cursor++;
      results[index] = await lookup(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  return results;
}

