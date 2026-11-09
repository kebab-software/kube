import { readdir, readFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const bundle = 'src-tauri/target/release/bundle';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const specs = {
  win32: [['nsis', '.exe']],
  darwin: [['dmg', '.dmg'], ['macos', '.app.tar.gz']],
  linux: [['appimage', '.AppImage']],
};
const target = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
const arch = process.arch === 'x64' ? 'x86_64' : process.arch === 'arm64' ? 'aarch64' : process.arch;
await mkdir('tauri-release', { recursive: true });
for (const [dir, ext] of specs[process.platform]) {
  if (ext === '.app.tar.gz' && !process.env.RELEASE_VERSION) continue;
  const root = path.join(bundle, dir);
  const matches = (await readdir(root)).filter(name => name.endsWith(ext));
  if (matches.length !== 1) throw new Error('Expected one ' + ext + ' in ' + root);
  const name = 'Kube-Desktop-v' + version + '-' + target + '-' + arch + ext;
  const from = path.join(root, matches[0]), to = path.join('tauri-release', name);
  await copyFile(from, to);
  if (process.env.RELEASE_VERSION && ext !== '.dmg') await copyFile(from + '.sig', to + '.sig');
}
