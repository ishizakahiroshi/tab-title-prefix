# Builds a Firefox xpi (a zip archive) from src/extension/ for AMO submission
# or self-hosted distribution.
#
# Usage: pwsh scripts/build_firefox.ps1 [-OutDir dist]

param(
  [string]$OutDir = "dist"
)

$ErrorActionPreference = 'Stop'

$repoRoot = (& git rev-parse --show-toplevel).Trim()
Set-Location $repoRoot

$srcDir = Join-Path $repoRoot "src\extension"
if (-not (Test-Path $srcDir)) {
  throw "src/extension not found: $srcDir"
}

$manifestPath = Join-Path $srcDir "manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$version = $manifest.version
if (-not $version) {
  throw "manifest.json に version がありません"
}

$outDirPath = Join-Path $repoRoot $OutDir
if (-not (Test-Path $outDirPath)) {
  New-Item -ItemType Directory -Path $outDirPath | Out-Null
}

$xpiName = "tab-title-prefix-v$version.xpi"
$xpiPath = Join-Path $outDirPath $xpiName

if (Test-Path $xpiPath) {
  Remove-Item -LiteralPath $xpiPath -Force
}

# xpi はルートに manifest.json を置いた zip。src/extension 配下をそのまま zip 化する。
Compress-Archive -Path (Join-Path $srcDir "*") -DestinationPath $xpiPath -CompressionLevel Optimal

Write-Host "OK: $xpiPath ($((Get-Item $xpiPath).Length) bytes)"
