// Deterministic resizing/packaging of the repository's existing brand artwork.
import sharp from 'sharp';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const icon = await readFile('assets/favicons/dark-transparent.png');
const rounded = icon;
for (const file of ['brand/logo.png', 'brand/logo-rounded.png', 'website/assets/logo.png']) await writeFile(file, icon);
await mkdir('build/icons', { recursive: true });
await mkdir('public', { recursive: true });
const png = (input, size) => sharp(input).resize(size, size).png().toBuffer();
await writeFile('public/logo.png', await png(rounded, 192));
for (const size of [32, 180, 192, 512]) await writeFile(`public/icon-${size}.png`, await png(icon, size));
await writeFile('public/icon-maskable.png', await sharp(icon).resize(410,410).extend({top:51,bottom:51,left:51,right:51,background:'#202020'}).flatten({background:'#202020'}).png().toBuffer());
await writeFile('build/icons/icon.png', await png(icon, 512));
// ICO directory with PNG frames (supported by current Windows and Electron).
const sizes = [16, 24, 32, 48, 64, 128, 256];
const frames = await Promise.all(sizes.map(size => png(icon, size)));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, i) => { const pos = 6 + i * 16; header[pos] = sizes[i] % 256; header[pos + 1] = sizes[i] % 256; header.writeUInt16LE(1, pos + 4); header.writeUInt16LE(32, pos + 6); header.writeUInt32LE(frame.length, pos + 8); header.writeUInt32LE(offset, pos + 12); offset += frame.length; });
await writeFile('build/icons/icon.ico', Buffer.concat([header, ...frames]));
const icns = [];
for (const [type, size] of [['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]) {
  const data = await png(icon, size), chunk = Buffer.alloc(8); chunk.write(type); chunk.writeUInt32BE(data.length + 8, 4); icns.push(chunk, data);
}
const icnsHeader = Buffer.alloc(8); icnsHeader.write('icns'); icnsHeader.writeUInt32BE(8 + icns.reduce((sum, item) => sum + item.length, 0), 4);
await writeFile('build/icons/icon.icns', Buffer.concat([icnsHeader, ...icns]));
// Extract the existing emblem from its white background for adaptive/themed icons.
const { data, info } = await sharp(icon).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) { const white = Math.min(data[i], data[i + 1], data[i + 2]); if (white > 245) data[i + 3] = 0; }
const emblem = await sharp(data, { raw: info }).trim().png().toBuffer();
const res = 'android/app/src/main/res';
await mkdir(`${res}/drawable-nodpi`, { recursive: true });
await writeFile(`${res}/drawable-nodpi/kube_logo.png`, await png(rounded, 384));
for (const [density, scale] of [['mdpi',1],['hdpi',1.5],['xhdpi',2],['xxhdpi',3],['xxxhdpi',4]]) {
  const directory = `${res}/mipmap-${density}`; await mkdir(directory, { recursive: true });
  const size = 48 * scale;
  await writeFile(`${directory}/ic_launcher.png`, await png(icon, size));
  const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`);
  await sharp(icon).resize(size, size).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(`${directory}/ic_launcher_round.png`);
  const full = 108 * scale, safe = Math.round(full * 0.43);
  const foreground = await sharp({ create: { width: full, height: full, channels: 4, background: '#00000000' } }).composite([{ input: await png(emblem, safe), gravity: 'centre' }]).png().toBuffer();
  await writeFile(`${directory}/ic_launcher_foreground.png`, foreground);
  const mono = await sharp(foreground).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < mono.data.length; i += 4) mono.data[i] = mono.data[i + 1] = mono.data[i + 2] = 255;
  await sharp(mono.data, { raw: mono.info }).png().toFile(`${directory}/ic_launcher_monochrome.png`);
}
await writeFile(`${res}/values/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#202020</color></resources>\n');
for (const version of [26, 33]) {
  const directory = `${res}/mipmap-anydpi-v${version}`; await mkdir(directory, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/>${version === 33 ? '<monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>' : ''}</adaptive-icon>\n`;
  for (const name of ['ic_launcher', 'ic_launcher_round']) await writeFile(`${directory}/${name}.xml`, xml);
}
await mkdir('src-tauri/icons', { recursive: true });
for (const [size, name] of [[32, '32x32'], [128, '128x128'], [256, '128x128@2x']]) {
  await writeFile('src-tauri/icons/' + name + '.png', await sharp(icon).resize(size, size).toColourspace('srgb').ensureAlpha().png().toBuffer());
}
for (const name of ['icon.ico', 'icon.icns']) await copyFile('build/icons/' + name, 'src-tauri/icons/' + name);
console.log('Generated app icons from assets/favicons/dark-transparent.png for all app and website branding.');
