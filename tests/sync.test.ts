import { expect,it } from 'vitest';
import { defaultLibrary,trackSchema } from '../src/model';
import { flattenLibrary,restoreSyncedLibrary,libraryChanges,itemKey } from '../src/sync-data';
const track=trackSchema.parse({videoId:'abcdefghijk',title:'Song',musicSource:'youtube-music'});
it('round-trips playlists, songs and history while keeping connection settings local',()=>{
 const library=defaultLibrary();
 library.liked=[track];library.playlists=[{id:'mix',name:'My mix',created:1,tracks:[track]}];
 library.history=[{track,at:10,seconds:50,completed:false}];
 const device=defaultLibrary();device.settings.volume=.2;
 const restored=restoreSyncedLibrary(device,flattenLibrary(library));
 expect(restored.liked).toEqual([track]);
 expect(restored.playlists).toEqual(library.playlists);
 expect(restored.history).toEqual(library.history);
 expect(restored.settings.volume).toBe(.2);
});
it('keeps deletion markers and removes a deleted song from another device',()=>{
 const before=defaultLibrary();before.liked=[track];
 const saved=flattenLibrary(before);
 const changes=libraryChanges(saved,flattenLibrary(defaultLibrary()));
 expect(changes).toEqual([{kind:'liked',id:track.videoId,value:null}]);
 changes.forEach(item=>saved.set(itemKey(item),item));
 expect(restoreSyncedLibrary(before,saved).liked).toEqual([]);
});
it('splits playlist membership so independent additions can merge',()=>{
 const left=defaultLibrary();left.playlists=[{id:'mix',name:'Mix',created:1,tracks:[track]}];
 const right=defaultLibrary();const second={...track,videoId:'abcdefghij2',title:'Second'};
 right.playlists=[{id:'mix',name:'Mix',created:1,tracks:[second]}];
 const merged=flattenLibrary(left);flattenLibrary(right).forEach((item,key)=>merged.set(key,item));
 expect(restoreSyncedLibrary(defaultLibrary(),merged).playlists[0].tracks.map(t=>t.title)).toEqual(['Song','Second']);
});
