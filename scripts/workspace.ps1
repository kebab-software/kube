param([ValidateSet('install','check','probe','diagnose','android-add','android-sync','desktop-build','android-build','dev','e2e','inspect','audit')][string]$Task = 'check')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$runtime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
if (Test-Path "$runtime/bin/node.exe") {
  $env:PATH = "$runtime/bin;$env:PATH"
  $node = "$runtime/bin/node.exe"
  $npm = Join-Path (Get-Location) '.tools/npm/package/bin/npm-cli.js'
  if (!(Test-Path $npm)) {
    New-Item -ItemType Directory -Force '.tools/npm' | Out-Null
    $metadata = Invoke-RestMethod 'https://registry.npmjs.org/npm/latest'
    Invoke-WebRequest $metadata.dist.tarball -OutFile '.tools/npm.tgz'
    & tar -xzf '.tools/npm.tgz' -C '.tools/npm'
  }
  New-Item -ItemType Directory -Force '.tools/bin' | Out-Null
  Set-Content -LiteralPath '.tools/bin/npm.cmd' -Value ('@"' + $node + '" "' + $npm + '" %*')
  $env:PATH = "$(Join-Path (Get-Location) '.tools/bin');$env:PATH"
} else {
  $node = (Get-Command node).Source
  $npm = Join-Path (Split-Path $node) 'node_modules/npm/bin/npm-cli.js'
}
switch ($Task) {
  install { & $node $npm install }
  check { & $node $npm run check }
  probe { & $node scripts/smoke-live.mjs }
  diagnose { & $node scripts/diagnose-stream.mjs }
  android-add { & $node node_modules/@capacitor/cli/bin/capacitor add android }
  android-sync { & $node $npm run android:sync }
  desktop-build { & $node $npm run build:desktop }
  android-build {
    if (Test-Path 'D:/OpenJDK/jdk-24') { $env:JAVA_HOME = 'D:/OpenJDK/jdk-24'; $env:PATH = "$env:JAVA_HOME/bin;$env:PATH" }
    if (Test-Path 'D:/Android/Sdk') { $env:ANDROID_HOME = 'D:/Android/Sdk' }
    $env:GRADLE_USER_HOME = Join-Path (Get-Location) '.tools/gradle'
    & $node $npm run build:android
  }
  dev { & $node $npm run dev }
  e2e { & $node $npm run test:e2e }
  audit { & $node $npm audit }
  inspect {
    & $node --version
    & $node $npm --version
    Get-ChildItem 'D:/Java','D:/' -Directory | ForEach-Object { $_.FullName }
    Get-ChildItem Env: | Where-Object Name -Match 'ANDROID|JAVA' | Format-Table -AutoSize
    & git -c safe.directory=D:/James/Projects/kube status --short
  }
}
if ($LASTEXITCODE) { exit $LASTEXITCODE }
