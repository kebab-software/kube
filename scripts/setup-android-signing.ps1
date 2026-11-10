# One-time setup. Secret values are neither printed nor included in command arguments.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$runtime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
$node = if (Test-Path "$runtime/bin/node.exe") { "$runtime/bin/node.exe" } else { (Get-Command node).Source }
$npm = Join-Path (Get-Location) '.tools/npm/package/bin/npm-cli.js'
if (!(Test-Path $npm)) { throw 'Run scripts/workspace.ps1 install before signing setup.' }
$env:PATH = "$(Split-Path $node);$env:PATH"
$lines = "protocol=https`nhost=github.com`n`n" | git -c safe.directory=D:/James/Projects/kube credential fill
if ($LASTEXITCODE -ne 0) { throw 'Sign into GitHub with Git Credential Manager first.' }
$credential = @{}
foreach ($line in $lines) { $pair = $line -split '=', 2; if ($pair.Count -eq 2) { $credential[$pair[0]] = $pair[1] } }
if (!$credential.password) { throw 'No GitHub credential available.' }
$headers = @{ Authorization = 'Bearer ' + $credential.password; Accept = 'application/vnd.github+json' }
try {
  $existing = Invoke-RestMethod -Uri 'https://api.github.com/repos/getkube/kube/actions/secrets?per_page=100' -Headers $headers
  $names = @($existing.secrets.name)
  if (($names -contains 'KUBE_ANDROID_KEYSTORE_BASE64') -and ($names -contains 'KUBE_ANDROID_KEYSTORE_PASSWORD')) {
    Write-Output 'Android signing secrets already exist; preserving them.'
    exit 0
  }
  if (($names -contains 'KUBE_ANDROID_KEYSTORE_BASE64') -and !(Test-Path '.secrets/android-signing.json')) { throw 'A remote signing key already exists without its password. Restore its original password; do not generate a replacement.' }
  New-Item -ItemType Directory -Force '.secrets' | Out-Null
  $owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls (Join-Path (Get-Location) '.secrets') /inheritance:r /grant:r "${owner}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not restrict signing-key directory permissions.' }
  $keystore = Join-Path (Get-Location) '.secrets/kube-release.jks'
  if (!(Test-Path '.secrets/android-signing.json')) {
    if (Test-Path $keystore) { throw 'Keystore exists without its password record. Restore the original record rather than replacing the key.' }
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(36)
    $password = [Convert]::ToBase64String($bytes)
    @{ password = $password; alias = 'kube' } | ConvertTo-Json | Set-Content '.secrets/android-signing.json'
  }
  $record = Get-Content '.secrets/android-signing.json' -Raw | ConvertFrom-Json
  if (!(Test-Path $keystore)) {
    $env:KUBE_LOCAL_SIGNING_PASSWORD = $record.password
    $keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
    & $keytool -genkeypair -keystore $keystore -storetype JKS -storepass:env KUBE_LOCAL_SIGNING_PASSWORD -keypass:env KUBE_LOCAL_SIGNING_PASSWORD -alias kube -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Kube' -noprompt
    if ($LASTEXITCODE -ne 0) { throw 'Android signing-key generation failed.' }
  }
  & $node $npm install --prefix .tools/github-secrets --no-save --package-lock=false libsodium-wrappers
  if ($LASTEXITCODE -ne 0) { throw 'Secret-encryption dependency installation failed.' }
  $payload = @{ token = $credential.password; values = @{ KUBE_ANDROID_KEYSTORE_BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore)); KUBE_ANDROID_KEYSTORE_PASSWORD = $record.password } } | ConvertTo-Json -Depth 4 -Compress
  $payload | & $node scripts/upload-github-secrets.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Uploading signing secrets failed. Keep .secrets and retry to preserve the signing key.' }
  Write-Output 'Persistent Android signing configured. Keep a private backup of the .secrets directory; it contains the signing key and password.'
} finally {
  $credential.Clear(); $headers.Clear(); $payload = $null; $lines = $null; $record = $null; $password = $null
  Remove-Item Env:KUBE_LOCAL_SIGNING_PASSWORD -ErrorAction SilentlyContinue
}
