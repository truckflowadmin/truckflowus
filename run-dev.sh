#!/usr/bin/env bash
# TruckFlow — WSL/macOS/Linux dev bootstrap
# Usage: from this folder, run: ./run-dev.sh
# Prereqs: Node 20+, Docker running.

set -euo pipefail
cd "$(dirname "$0")"

echo "==> Checking prerequisites"
command -v node >/dev/null 2>&1 || { echo "Node.js not found. Install Node 20+ (https://nodejs.org)"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker not found. Install Docker and make sure it is running."; exit 1; }

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Neither 'docker compose' nor 'docker-compose' is available."; exit 1
fi

echo "==> Ensuring .env exists"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   Created .env from .env.example. Review it if you want to tweak secrets."
fi

echo "==> Installing npm dependencies"
npm install

echo "==> Starting Postgres via docker compose"
"${COMPOSE[@]}" up -d db

echo "==> Waiting for Postgres to accept connections"
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T db pg_isready -U truckflow >/dev/null 2>&1; then
    READY=1; break
  fi
  sleep 1
done
if [ "${READY:-0}" != "1" ]; then
  echo "Postgres did not become ready in 30 seconds."; exit 1
fi

echo "==> Running Prisma migrations"
npx prisma migrate dev --name init

echo "==> Seeding database"
npm run db:seed

echo "==> Starting Next.js dev server on http://localhost:3000"
echo "    Login: admin@acmehauling.example / admin123"
npm run dev
