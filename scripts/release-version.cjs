function releaseVersion(tag) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag || '');
  if (!match) throw new Error('Use a stable release tag such as v0.2.0 (major.minor.patch).');
  const [major, minor, patch] = match.slice(1).map(Number);
  if (major > 2000 || minor > 999 || patch > 999) throw new Error('Version components exceed Android version-code limits.');
  const versionCode = major * 1000000 + minor * 1000 + patch;
  if (versionCode < 1) throw new Error('The first version must be greater than 0.0.0.');
  return { version: `${major}.${minor}.${patch}`, versionCode };
}
module.exports = { releaseVersion };
