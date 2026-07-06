# Builds a Firefox xpi (a zip archive) for AMO submission or self-hosted distribution.
#
# Usage: pwsh scripts/build_firefox.ps1 [-OutDir dist]

param(
  [string]$OutDir = "dist"
)

& (Join-Path $PSScriptRoot "build.ps1") -Browser firefox -OutDir $OutDir
