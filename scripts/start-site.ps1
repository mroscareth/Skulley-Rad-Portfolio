$ErrorActionPreference = 'Stop'

# 1) Mitigar crash de PSReadLine en PowerShell 5.1
try { Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue } catch {}

# 2) Ubicar raíz del proyecto (este script vive en ./scripts)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-NodeVersionOk {
  param([string]$version)
  if (-not $version) { return $false }
  $v = $version.Trim()
  if ($v.StartsWith('v')) { $v = $v.Substring(1) }
  $parts = $v.Split('.')
  if ($parts.Count -lt 2) { return $false }
  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  if ($major -gt 22) { return $true }
  if ($major -eq 22 -and $minor -ge 12) { return $true }
  if ($major -gt 20) { return $true }
  if ($major -eq 20 -and $minor -ge 19) { return $true }
  return $false
}

# 3) Asegurar Node 20.19.0+ o 22.12.0+
$nodeVersion = ""
try { $nodeVersion = & node -v 2>$null } catch { $nodeVersion = "" }

if (-not (Test-NodeVersionOk -version $nodeVersion)) {
  $nvmAvailable = $false
  try { & nvm version | Out-Null; $nvmAvailable = $true } catch { $nvmAvailable = $false }
  if ($nvmAvailable) {
    try { & nvm install 20.19.0 | Write-Host } catch {}
    & nvm use 20.19.0 | Write-Host
    $nodeVersion = & node -v
    if (-not (Test-NodeVersionOk -version $nodeVersion)) {
      Write-Error "Node version $nodeVersion incompatible. Expected 20.19.0+ or 22.12.0+."
      exit 1
    }
  } else {
    Write-Error "Node incompatible and nvm not found. Install nvm-windows or activate Node 20.19.0 manually."
    exit 1
  }
}

# 4) Limpiar NODE_OPTIONS en este proceso (evita flags heredadas que rompan Vite)
$env:NODE_OPTIONS = ""

# 5) Instalar dependencias si faltan
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host "Installing dependencies (npm ci)..."
  & npm ci
}

# 6) Iniciar servidor de desarrollo Vite
Write-Host "Starting Vite dev server..."
& npm run dev


