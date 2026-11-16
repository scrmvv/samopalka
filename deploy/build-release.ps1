# Build on Windows with Node.js 22+; do not build TypeScript on the 576 MB VPS.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $root
$stage = Join-Path ([IO.Path]::GetTempPath()) ("samopalka-build-" + [guid]::NewGuid().ToString('N'))
try {
  Write-Host 'Installing dependencies...' -ForegroundColor Cyan
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  Write-Host 'Building client, server, and shared...' -ForegroundColor Cyan
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
  $required = @('package.json', 'package-lock.json',
    'apps/client/package.json', 'apps/client/dist/index.html',
    'apps/server/package.json', 'apps/server/dist/index.js',
    'packages/shared/package.json', 'packages/shared/dist/index.js')
  foreach ($item in $required) {
    if (-not (Test-Path (Join-Path $root $item))) { throw "Missing build file: $item" }
  }
  New-Item -ItemType Directory -Path $stage -Force | Out-Null
  foreach ($item in @('apps/client','apps/server','packages/shared','deploy')) {
    New-Item -ItemType Directory -Path (Join-Path $stage $item) -Force | Out-Null
  }
  foreach ($item in @('package.json','package-lock.json',
    'apps/client/package.json','apps/server/package.json','packages/shared/package.json')) {
    Copy-Item (Join-Path $root $item) (Join-Path $stage $item)
  }
  foreach ($item in @('apps/client/dist','apps/server/dist','packages/shared/dist')) {
    Copy-Item (Join-Path $root $item) (Join-Path $stage $item) -Recurse
  }
  foreach ($item in @('install-vps.sh','samopalka.service','samopalka.nginx.conf')) {
    Copy-Item (Join-Path $PSScriptRoot $item) (Join-Path (Join-Path $stage 'deploy') $item)
  }
  $out = Join-Path $root 'samopalka-release.zip'
  if (Test-Path $out) { Remove-Item $out -Force }
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -CompressionLevel Optimal
  Write-Host "Release created: $out" -ForegroundColor Green
  Write-Host 'Upload samopalka-release.zip to /tmp/samopalka-release.zip on VPS.'
}
finally {
  Pop-Location
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
}

