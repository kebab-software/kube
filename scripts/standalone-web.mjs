import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dist = name => readFileSync('dist/' + name);
const dataIcon = name => 'data:image/png;base64,' + dist(name).toString('base64');
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
let html = dist('index.html').toString();
const entry = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const sheet = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if (!entry || !sheet) throw new Error('Could not find Vite entry assets');
const script = dist(entry[1]).toString().replace(/\/\/# sourceMappingURL=.*$/m, '')
  .replaceAll('./logo.png', dataIcon('logo.png')).replace(/<\/script/gi, '<\\/script');
const digest = createHash('sha256').update(script).digest('base64');
html = html.replace("script-src 'self'", "script-src 'sha256-" + digest + "'")
  .replace(entry[0], () => '<script type="module">' + script + '</script>')
  .replace(sheet[0], () => '<style>' + dist(sheet[1]) + '</style>')
  .replace(/<link rel="manifest"[^>]*>/, '')
  .replaceAll('./icon-32.png', dataIcon('icon-32.png'))
  .replaceAll('./icon-180.png', dataIcon('icon-180.png'));
writeFileSync('dist/Kube-v' + version + '.html', html);
