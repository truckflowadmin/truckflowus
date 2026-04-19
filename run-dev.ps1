# TruckFlow — Windows dev bootstrap
# Usage: from this folder, run: .\run-dev.ps1
# Prereqs: Node 20+, Docker Desktop running.

$ErrorActionPreference = 'Stop'
# Don't let native-command stderr (warnings) abort the script in PS 7.3+
$PSNativeCommandUseErrorActionPreference = $false

Set-Location -Path $PSScriptRoot

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments)] $ComposeArgs)
    if ($script:UseComposeV2) {
        & docker compose @ComposeArgs
    } else {
        & docker-compose @ComposeArgs
    }
}

Write-Host "==> Checking prerequisites" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js not found. Install Node 20+ from https://nodejs.org and re-run."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker not found. Install Docker Desktop and make sure it is running."
}

# Detect compose v2 vs legacy
$script:UseComposeV2 = $true
try {
    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) { $script:UseComposeV2 = $false }
} catch {
    $script:UseComposeV2 = $false
}
if (-not $script:UseComposeV2) {
    if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
        throw "Neither 'docker compose' nor 'docker-compose' is available."
    }
}

Write-Host "==> Ensuring .env exists" -ForegroundColor Cyan
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "   Created .env from .env.example. Review it if you want to tweak secrets." -ForegroundColor Yellow
}

Write-Host "==> Installing npm dependencies" -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }

Write-Host "==> Starting Postgres via docker compose" -ForegroundColor Cyan
Invoke-Compose up -d db
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed (exit $LASTEXITCODE)" }

Write-Host "==> Waiting for Postgres to accept connections" -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Invoke-Compose exec -T db pg_isready -U truckflow *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "Postgres did not become ready in 60 seconds." }
Write-Host "   Postgres is ready." -ForegroundColor Green

Write-Host "==> Running Prisma migrations" -ForegroundColor Cyan
npx prisma migrate dev --name init
if ($LASTEXITCODE -ne 0) { throw "prisma migrate failed (exit $LASTEXITCODE)" }

Write-Host "==> Seeding database" -ForegroundColor Cyan
npm run db:seed
if ($LASTEXITCODE -ne 0) { throw "db:seed failed (exit $LASTEXITCODE)" }

Write-Host "==> Starting Next.js dev server on http://localhost:3000" -ForegroundColor Green
Write-Host "    Login: admin@acmehauling.example / admin123" -ForegroundColor Green
npm run dev
