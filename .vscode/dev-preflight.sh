#!/usr/bin/env bash
# Infra + deps + migrations only (host services are started via launch.json).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.dev/logs"
mkdir -p "$LOG_DIR"

info() { printf '[dev-preflight] %s\n' "$*"; }
warn() { printf '[dev-preflight] WARN: %s\n' "$*"; }
err()  { printf '[dev-preflight] ERROR: %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

if [ ! -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    warn "Created .env from .env.example — review its values."
  else
    err "No root .env and no .env.example."
    exit 1
  fi
fi

if have docker && docker info >/dev/null 2>&1; then
  info "Starting docker infra (postgres)…"
  if ! docker compose -f "$ROOT/docker-compose.yml" --env-file "$ROOT/.env" \
       up -d postgres >>"$LOG_DIR/docker.log" 2>&1; then
    err "docker compose failed — see .dev/logs/docker.log"
    exit 1
  fi
  info "Waiting for Postgres…"
  for _ in $(seq 1 30); do
    if docker exec ninjasset-dev-postgres pg_isready -U postgres >/dev/null 2>&1; then
      info "Postgres ready."
      break
    fi
    sleep 1
  done
else
  warn "docker not available — skipping infra."
fi

if ! have npm; then
  err "npm not found."
  exit 1
fi

if [ ! -d "$ROOT/backend/node_modules" ]; then
  info "Installing backend dependencies…"
  ( cd "$ROOT/backend" && npm install ) >>"$LOG_DIR/backend.log" 2>&1 || exit 1
fi
info "Applying migrations…"
( cd "$ROOT/backend" && npm run migrate ) >>"$LOG_DIR/backend.log" 2>&1 || exit 1

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  info "Installing frontend dependencies…"
  ( cd "$ROOT/frontend" && npm install ) >>"$LOG_DIR/frontend.log" 2>&1 || exit 1
fi

info "Preflight complete."
