# Builds Firefox and Chrome packages from src/extension/.
#
# Usage: pwsh scripts/build.ps1 [-Browser firefox|chrome|all] [-OutDir dist]

param(
  [ValidateSet("firefox", "chrome", "all")]
  [string]$Browser = "all",
  [string]$OutDir = "dist"
)

$ErrorActionPreference = 'Stop'

$repoRoot = (& git rev-parse --show-toplevel).Trim()
Set-Location $repoRoot

$srcDir = Join-Path $repoRoot "src\extension"
$outDirPath = Join-Path $repoRoot $OutDir
$tmpRoot = Join-Path $repoRoot "build\packages"

if (-not (Test-Path $srcDir)) {
  throw "src/extension not found: $srcDir"
}
if (-not (Test-Path $outDirPath)) {
  New-Item -ItemType Directory -Path $outDirPath | Out-Null
}
if (Test-Path $tmpRoot) {
  Remove-Item -LiteralPath $tmpRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $tmpRoot | Out-Null

function New-ExtensionPackage {
  param(
    [ValidateSet("firefox", "chrome")]
    [string]$Target
  )

  $manifestSource = Join-Path $srcDir "manifest.$Target.json"
  $manifest = Get-Content -Raw -LiteralPath $manifestSource | ConvertFrom-Json
  $version = $manifest.version
  if (-not $version) {
    throw "$manifestSource に version がありません"
  }

  $workDir = Join-Path $tmpRoot $Target
  New-Item -ItemType Directory -Path $workDir | Out-Null

  Get-ChildItem -LiteralPath $srcDir -Force | Where-Object {
    $_.Name -notin @("manifest.firefox.json", "manifest.chrome.json")
  } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $workDir -Recurse
  }
  Copy-Item -LiteralPath $manifestSource -Destination (Join-Path $workDir "manifest.json")

  $extension = if ($Target -eq "firefox") { "xpi" } else { "zip" }
  $packagePath = Join-Path $outDirPath "tab-title-prefix-$Target-v$version.$extension"
  if (Test-Path $packagePath) {
    Remove-Item -LiteralPath $packagePath -Force
  }
  Compress-Archive -Path (Join-Path $workDir "*") -DestinationPath $packagePath -CompressionLevel Optimal
  Write-Host "OK: $packagePath ($((Get-Item $packagePath).Length) bytes)"
}

if ($Browser -in @("firefox", "all")) {
  New-ExtensionPackage -Target "firefox"
}
if ($Browser -in @("chrome", "all")) {
  New-ExtensionPackage -Target "chrome"
}
