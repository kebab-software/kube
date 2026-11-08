// Receives credentials and values over stdin; never logs secret values.
const sodium = require('../.tools/github-secrets/node_modules/libsodium-wrappers');
(async () => {
  let input = ''; for await (const chunk of process.stdin) input += chunk;
  const { token, values } = JSON.parse(input); input = '';
  await sodium.ready;
  const base = 'https://api.github.com/repos/kebab-software/kube/actions/secrets';
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const keyResponse = await fetch(`${base}/public-key`, { headers });
  if (!keyResponse.ok) throw new Error(`Could not read repository public key: HTTP ${keyResponse.status}`);
  const { key, key_id } = await keyResponse.json();
  for (const [name, value] of Object.entries(values)) {
    const encrypted_value = sodium.to_base64(sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key, sodium.base64_variants.ORIGINAL)), sodium.base64_variants.ORIGINAL);
    const r = await fetch(`${base}/${name}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ key_id, encrypted_value }) });
    if (!r.ok) throw new Error(`Could not set ${name}: HTTP ${r.status}`);
    console.log(`Configured GitHub Actions secret ${name}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
