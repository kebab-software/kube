import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const tag = process.env.RELEASE_TAG;
const release = JSON.parse(execFileSync('gh', ['release', 'view', tag, '--json', 'body,assets'], { encoding: 'utf8' }));
const platforms = { '.exe': 'Windows', '.dmg': 'macOS (Apple silicon)', '.AppImage': 'Linux', '.apk': 'Android', '.html': 'Web browser', '.aab': 'Android App Bundle (distribution)', '.mjs': 'Web catalog server (Node.js 22+)' };
const rows = Object.entries(platforms).map(([extension, platform]) => {
  const asset = release.assets.find(item => item.name.endsWith(extension) && (!['.exe', '.dmg', '.AppImage'].includes(extension) || item.name.startsWith('Kube-v')));
  if (!asset) throw new Error('Missing download for ' + platform);
  return '| ' + platform + ' | [' + asset.name + '](' + asset.url + ') |';
});
const marker = '<!-- kube-downloads -->';
const notes = release.body.split(marker)[0].trimEnd();
writeFileSync('release-notes.md', [notes, '', marker, '## Downloads', '', '| Platform | Download |', '| --- | --- |', ...rows, ''].join('\n'));
execFileSync('gh', ['release', 'edit', tag, '--notes-file', 'release-notes.md'], { stdio: 'inherit' });
