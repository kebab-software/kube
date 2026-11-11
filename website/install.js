(() => {
  const releases = 'https://github.com/getkube/kube/releases/latest';
  const ua = navigator.userAgent;
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const os = android ? 'Android' : ios ? 'iOS' : /Win/i.test(platform) ? 'Windows' :
    /Mac/i.test(platform) ? 'macOS' : /Linux/i.test(platform) ? 'Linux' : '';
  const buttons = document.querySelectorAll('.install-button');
  buttons.forEach(button => {
    button.textContent = os && !ios ? 'Install for ' + os : 'Install Kube';
    button.href = releases;
  });
  // iOS currently uses the web app. Its install instructions are provided by the browser.
  if (ios || !os) return;
  fetch('https://api.github.com/repos/getkube/kube/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' }, credentials: 'omit',
    signal: AbortSignal.timeout(8000),
  }).then(response => {
    if (!response.ok) throw new Error('Release lookup unavailable');
    return response.json();
  }).then(release => {
    const suffix = { Android: '.apk', Windows: '.exe', macOS: '.dmg', Linux: '.AppImage' }[os];
    const asset = release.assets?.find(file => file.name.endsWith(suffix) &&
      (os === 'Android' || file.name.startsWith('Kube-v')));
    if (!asset) return;
    const url = new URL(asset.browser_download_url);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/getkube/kube/releases/download/')) return;
    buttons.forEach(button => {
      button.href = url.href;
      button.title = asset.name;
    });
  }).catch(() => { /* Keep the release-page fallback available when GitHub cannot be reached. */ });
})();
