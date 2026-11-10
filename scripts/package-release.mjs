import { mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { releaseVersion } = createRequire(import.meta.url)('./release-version.cjs');
const tag = process.env.RELEASE_TAG;
const { version, versionCode } = releaseVersion(tag);
const repo = process.env.GITHUB_REPOSITORY;
if (repo !== 'getkube/kube') throw new Error('Unexpected release repository');
await mkdir('release-assets', { recursive: true });
async function files(directory) { const entries = await readdir(directory, { withFileTypes: true }); const result = []; for (const entry of entries) { const name = path.join(directory, entry.name); if (entry.isDirectory()) result.push(...await files(name)); else if (entry.isFile()) result.push(name); } return result; }
const all = await files('build-artifacts');
const apk = all.filter(f => f.endsWith('.apk') && f.includes('kube-android-release'));
if (apk.length !== 1) throw new Error('Expected exactly one signed release APK');
const apkName = 'Kube-v' + version + '.apk';
await copyFile(apk[0], path.join('release-assets', apkName));
for (const file of all.filter(f => /\.(exe|dmg|AppImage|zip|blockmap|aab|sig|tar\.gz)$/.test(f) || /latest[^/\\]*\.yml$/.test(f))) {
  const destination = path.join('release-assets', path.basename(file));
  if ((await readdir('release-assets')).includes(path.basename(file))) throw new Error(`Duplicate release filename: ${path.basename(file)}`);
  await copyFile(file, destination);
}
for (const extension of ['.exe','.dmg','.AppImage','.zip','.aab']) if (!(await readdir('release-assets')).some(f => f.endsWith(extension))) throw new Error(`Missing release format ${extension}`);
for (const file of ['latest.yml','latest-linux.yml','latest-mac.yml']) if (!(await readdir('release-assets')).includes(file)) throw new Error(`Missing update feed ${file}`);
const webName = 'Kube-v' + version + '.html';
await copyFile(path.join('build-artifacts/kube-web', webName), path.join('release-assets', webName));
const hash = data => createHash('sha256').update(data).digest('hex');
await writeFile('release-assets/android-update.json', JSON.stringify({ version, versionCode, url: `https://github.com/kebab-software/kube/releases/download/${encodeURIComponent(tag)}/${apkName}`, sha256: hash(await readFile(apk[0])) }, null, 2));
await writeFile('release-assets/build-info.json', JSON.stringify({ version, tag, commit: process.env.GITHUB_SHA, run: `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`, android: 'Persistent release signing key', macAutomaticUpdates: 'Requires Developer ID signing credentials' }, null, 2));
const platforms = {};
for (const file of await readdir('release-assets')) {
  const signature = file.match(/^Kube-Desktop-v[\d.]+-(windows|darwin|linux)-(x86_64|aarch64)\.(?:exe|app\.tar\.gz|AppImage)\.sig$/);
  if (!signature) continue;
  const binary = file.slice(0, -4);
  platforms[signature[1] + '-' + signature[2]] = {
    signature: (await readFile(path.join('release-assets', file), 'utf8')).trim(),
    url: 'https://github.com/' + repo + '/releases/download/' + encodeURIComponent(tag) + '/' + binary,
  };
}
if (Object.keys(platforms).length !== 3) throw new Error('Expected three signed Tauri desktop packages');
await writeFile('release-assets/tauri-update.json', JSON.stringify({ version, platforms }, null, 2));
const sums = [];
for (const file of (await readdir('release-assets')).sort()) sums.push(`${hash(await readFile(path.join('release-assets', file)))}  ${file}`);
await writeFile('release-assets/SHA256SUMS.txt', sums.join('\n') + '\n');
console.log('Packaged versioned installers, update feeds, and checksums.');
