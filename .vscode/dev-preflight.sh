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

if [ ! -f "$ROOT/backend/.env" ]; then
  if [ -f "$ROOT/backend/.env.example" ]; then
    cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
    warn "Created backend/.env from backend/.env.example — review its values."
  else
    err "No backend/.env and no backend/.env.example."
    exit 1
  fi
fi

if have docker && docker info >/dev/null 2>&1; then
  info "Starting docker infra (postgres)…"
  if ! docker compose -f "$ROOT/docker-compose.yml" --env-file "$ROOT/backend/.env" \
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

if [ -f "$ROOT/aiagent/pyproject.toml" ]; then
  if ! have uv; then
    warn "uv not found — install from https://docs.astral.sh/uv/ then run: cd aiagent && uv sync"
  elif [ ! -d "$ROOT/aiagent/.venv" ]; then
    info "Installing aiagent dependencies (uv sync)…"
    ( cd "$ROOT/aiagent" && uv sync ) >>"$LOG_DIR/aiagent.log" 2>&1 || exit 1
  fi
fi

info "Preflight complete."
