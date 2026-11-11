import { librarySchema, trackSchema, type Library } from "./model";
export type SyncItem = { kind: string; id: string; value: unknown | null };
export const itemKey = (item: Pick<SyncItem, "kind" | "id">) =>
  item.kind + ":" + item.id;
export function flattenLibrary(library: Library) {
  const items = new Map<string, SyncItem>();
  const add = (kind: string, id: string, value: unknown) => {
    const item = { kind, id, value };
    items.set(itemKey(item), item);
  };
  const track = (value: Library["liked"][number]) =>
    trackSchema.parse({ ...value, videoThumbnails: [] });
  library.liked.forEach((t) => add("liked", t.videoId, track(t)));
  library.hidden.forEach((id) => add("hidden", id, true));
  library.artists.forEach((a) => add("artists", a.authorId, a));
  library.history.forEach((h) =>
    add("history", h.at + ":" + h.track.videoId, {
      ...h,
      track: track(h.track),
    }),
  );
  library.playlists.forEach((p) => {
    add("playlists", p.id, { id: p.id, name: p.name, created: p.created });
    p.tracks.forEach((t, index) =>
      add("playlistTracks", p.id + ":" + t.videoId, {
        playlistId: p.id,
        track: track(t),
        index,
      }),
    );
  });
  return items;
}
export function restoreSyncedLibrary(
  local: Library,
  items: Map<string, SyncItem>,
) {
  const values = (kind: string) =>
    Array.from(items.values())
      .filter((item) => item.kind === kind && item.value !== null)
      .map((item) => item.value);
  const playlists = values("playlists") as {
    id: string;
    name: string;
    created: number;
  }[];
  const members = values("playlistTracks") as {
    playlistId: string;
    track: Library["liked"][number];
    index: number;
  }[];
  return librarySchema.parse({
    ...local,
    liked: values("liked"),
    hidden: Array.from(items.values())
      .filter((i) => i.kind === "hidden" && i.value !== null)
      .map((i) => i.id),
    artists: values("artists"),
    history: (values("history") as Library["history"])
      .sort((a, b) => b.at - a.at)
      .slice(0, 3000),
    playlists: playlists.map((p) => ({
      ...p,
      tracks: members
        .filter((m) => m.playlistId === p.id)
        .sort((a, b) => a.index - b.index)
        .map((m) => m.track),
    })),
  });
}
export function libraryChanges(
  before: Map<string, SyncItem>,
  next: Map<string, SyncItem>,
) {
  const changes: SyncItem[] = [];
  for (const [key, item] of next)
    if (JSON.stringify(before.get(key)?.value) !== JSON.stringify(item.value))
      changes.push(item);
  for (const [key, item] of before)
    if (item.value !== null && !next.has(key))
      changes.push({ ...item, value: null });
  return changes;
}
