// Invidious exposes the category and licensed song credits in video details.
export function hasMusicMetadata(raw: Record<string, unknown>) {
  if (typeof raw.genre === 'string' && raw.genre.trim().toLowerCase() === 'music') return true;
  if (Array.isArray(raw.musicTracks) && raw.musicTracks.some(credit =>
    typeof credit?.song === 'string' && credit.song.trim().length > 0
  )) return true;
  // Some instances return only the publisher's title and keyword metadata.
  if (typeof raw.genre === 'string' && raw.genre.trim()) return false;
  if (typeof raw.title !== 'string' || !Array.isArray(raw.keywords)) return false;
  const title = raw.title;
  if (/\b(interview|reaction|review|tutorial|trailer|news|podcast|gameplay)\b/i.test(title)) return false;
  const explicitRelease = /\b(?:official\s+(?:music\s+video|audio|lyric\s+video)|lyric\s+video|visuali[sz]er)\b/i;
  if (explicitRelease.test(title)) return true;
  const releaseLabel = /\b(?:official\s+video|lyrics|live performance|remix|acoustic|music video)\b/i;
  const musicTag = /\b(?:music|pop|rock|hip[- ]hop|rap|electronic|electro|dance|r&b|jazz|classical|country|reggae|indie|metal|soundtrack|album|song|records)\b/i;
  const publisher = typeof raw.author === 'string' && /(?: - Topic|VEVO)$/i.test(raw.author);
  return (releaseLabel.test(title) || publisher) &&
    raw.keywords.some(tag => typeof tag === 'string' && musicTag.test(tag));

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

