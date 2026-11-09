// Invidious exposes the category and licensed song credits in video details.
export function hasMusicMetadata(raw: Record<string, unknown>) {
  if (typeof raw.genre === 'string' && raw.genre.trim().toLowerCase() === 'music') return true;
  if (Array.isArray(raw.musicTracks) && raw.musicTracks.some(credit =>
    typeof credit?.song === 'string' && credit.song.trim().length > 0
  )) return true;
  // Some instances return only the publisher's title and keyword metadata.
  if (typeof raw.genre === 'string' && raw.genre.trim()) return false;
  if (typeof raw.title !== 'string' || !Array.isArray(raw.keywords)) return false;
  const releaseLabel = /[(\[]\s*official (?:audio|music video|lyric video|video)\s*[)\]]/i;
  const musicTag = /^(?:music|music video|pop|rock|hip[- ]hop|rap|electronic|dance music|r&b|jazz|classical music|country music|reggae|indie pop|heavy metal|soundtrack)$/i;
  return releaseLabel.test(raw.title) && raw.keywords.some(tag => typeof tag === 'string' && musicTag.test(tag.trim()));
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

