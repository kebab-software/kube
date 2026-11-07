import { spawnSync } from 'node:child_process';
const release = process.argv[2] === 'release';
const result = spawnSync(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [release ? 'bundleRelease' : 'assembleDebug', '--no-daemon'], { cwd: 'android', stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
