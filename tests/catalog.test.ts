
import { expect, it, vi, afterEach } from 'vitest';
import { catalogTracks } from '../src/catalog';
import { catalogFetch } from '../src/catalog-transport';
afterEach(() => vi.unstubAllGlobals());
it('keeps catalog songs and music videos and excludes podcasts and ordinary results', () => {
  const rows = [
    { item_type:'song',id:'catalogsng1',title:'Song',artists:[{name:'Artist',channel_id:'UC123'}],duration:{seconds:200}},
    { item_type:'video',id:'catalogvid1',title:'Video',artists:[{name:'Artist'}]},
    { item_type:'non_music_track',id:'catalogpod1',title:'Podcast'},
    { item_type:'unknown',id:'catalogreg1',title:'Ordinary YouTube video'},
  ];
  expect(catalogTracks({contents:rows}).map(t => [t.title,t.musicSource])).toEqual([['Song','youtube-music'],['Video','youtube-music']]);
});
it('refuses to proxy arbitrary hosts or playback downloads through the catalog', async () => {
  await expect(catalogFetch('')('https://example.com/youtubei/v1/search',{method:'POST',body:'{}'})).rejects.toThrow('Unsupported');
  await expect(catalogFetch('')('https://music.youtube.com/videoplayback',{method:'POST',body:'{}'})).rejects.toThrow('Unsupported');
});
