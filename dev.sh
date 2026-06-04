#!/usr/bin/env bash
#
# dev.sh — launch the full ninjasset stack for local testing.
#
# Brings up everything needed to exercise the app end-to-end:
#   - Docker:   postgres        [infra]
#   - Backend:  Hapi API (:3001) via `npm run dev`
#   - Frontend: React Router (:3000) via `npm run dev`
#
# Idempotent: any piece already running is detected, logged, and skipped —
# the script never fails just because something is already up. Ctrl+C stops
# only the processes this script started; docker infra is left running
# (stop it with `docker compose down`).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/.dev/logs"
mkdir -p "$LOG_DIR"
# Pre-create the known log files so the live `tail` always has something to
# follow even when every service was already running and got skipped.
touch "$LOG_DIR"/{docker,backend,frontend}.log

# ---- logging ---------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BLUE=$'\033[34m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_DIM=$'\033[2m'
else
  C_RESET=''; C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_DIM=''
fi
info() { printf '%s[dev]%s %s\n' "$C_BLUE"   "$C_RESET" "$*"; }
ok()   { printf '%s[dev]%s %s\n' "$C_GREEN"  "$C_RESET" "$*"; }
warn() { printf '%s[dev]%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()  { printf '%s[dev]%s %s\n' "$C_RED"    "$C_RESET" "$*"; }

# PIDs of host processes we start, so we can stop exactly those on exit.
STARTED_PIDS=()
STARTED_NAMES=()

cleanup() {
  printf '\n'
  info "Shutting down services started by this script…"
  for i in "${!STARTED_PIDS[@]}"; do
    local_pid="${STARTED_PIDS[$i]}"
    if kill -0 "$local_pid" 2>/dev/null; then
      info "  stopping ${STARTED_NAMES[$i]} (pid $local_pid)"
      # Kill children first (npm/tsx-watch spawn the real server), then parent.
      pkill -P "$local_pid" 2>/dev/null
      kill "$local_pid" 2>/dev/null
    fi
  done
  ok "Done. Docker infra left running — \`docker compose down\` to stop it."
  exit 0
}
trap cleanup INT TERM

# ---- helpers ---------------------------------------------------------------

# port_in_use PORT -> 0 if something is already listening on it.
port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# have CMD -> 0 if the command exists on PATH.
have() { command -v "$1" >/dev/null 2>&1; }

# start_service NAME PORT LOGFILE DIR CMD...  — launch a host service in the
# background unless its port is already taken. Never fails the script.
start_service() {
  local name="$1" port="$2" logfile="$3" dir="$4"; shift 4
  if port_in_use "$port"; then
    warn "$name already running on :$port — skipping (not restarting it)."
    return 0
  fi
  info "Starting $name on :$port  ${C_DIM}(log: ${logfile#"$ROOT"/})${C_RESET}"
  ( cd "$dir" && exec "$@" ) >"$logfile" 2>&1 &
  local pid=$!
  STARTED_PIDS+=("$pid")
  STARTED_NAMES+=("$name")
}

# ---- 0. preflight ----------------------------------------------------------
info "Repo root: $ROOT"

if [ ! -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    warn "Root .env was missing — created it from .env.example. Review its values."
  else
    err "No root .env and no .env.example — backend/infra config will be incomplete."
  fi
fi

# ---- 1. docker infra -------------------------------------------------------
if have docker && docker info >/dev/null 2>&1; then
  info "Ensuring docker infra is up (postgres)…"
  # `up -d` is itself idempotent: already-running containers are left as-is.
  if docker compose -f "$ROOT/docker-compose.yml" --env-file "$ROOT/.env" \
       up -d postgres >>"$LOG_DIR/docker.log" 2>&1; then
    ok "Docker infra ready."
  else
    err "docker compose failed — see ${LOG_DIR#"$ROOT"/}/docker.log. Continuing anyway."
  fi

  # Wait for Postgres to accept connections before migrating / starting backend.
  info "Waiting for Postgres to be ready…"
  pg_ready=false
  for _ in $(seq 1 30); do
    if docker exec ninjasset-dev-postgres pg_isready -U postgres >/dev/null 2>&1; then
      pg_ready=true; break
    fi
    sleep 1
  done
  if $pg_ready; then ok "Postgres is accepting connections."
  else warn "Postgres did not report ready in time — backend may need a moment."; fi
else
  warn "docker not available/running — skipping infra. Postgres must be"
  warn "reachable some other way or downstream services will not work."
fi

# ---- 2. backend deps + migrations + frontend deps --------------------------
if have npm; then
  if [ ! -d "$ROOT/backend/node_modules" ]; then
    info "Installing backend dependencies (first run)…"
    ( cd "$ROOT/backend" && npm install ) >>"$LOG_DIR/backend.log" 2>&1 \
      && ok "Backend deps installed." \
      || err "Backend npm install failed — see ${LOG_DIR#"$ROOT"/}/backend.log"
  fi
  info "Applying database migrations (no-op if already current)…"
  if ( cd "$ROOT/backend" && npm run migrate ) >>"$LOG_DIR/backend.log" 2>&1; then
    ok "Migrations up to date."
  else
    warn "Migrations failed — see ${LOG_DIR#"$ROOT"/}/backend.log. Continuing."
  fi
  if [ ! -d "$ROOT/frontend/node_modules" ]; then
    info "Installing frontend dependencies (first run)…"
    ( cd "$ROOT/frontend" && npm install ) >>"$LOG_DIR/frontend.log" 2>&1 \
      && ok "Frontend deps installed." \
      || err "Frontend npm install failed — see ${LOG_DIR#"$ROOT"/}/frontend.log"
  fi
else
  err "npm not found — backend and frontend cannot start."
fi

# ---- 3. start host services ------------------------------------------------
# Backend API (loads root .env via DOTENV_CONFIG_PATH in its npm script).
if have npm; then
  start_service "backend" 3001 "$LOG_DIR/backend.log" "$ROOT/backend" \
    npm run dev
fi

# Frontend (React Router dev server).
if have npm; then
  start_service "frontend" 3000 "$LOG_DIR/frontend.log" "$ROOT/frontend" \
    npm run dev
fi

# ---- 4. summary + live logs ------------------------------------------------
printf '\n'
ok "Stack is launching:"
printf '   %sFrontend%s  http://localhost:3000\n' "$C_GREEN" "$C_RESET"
printf '   %sBackend %s  http://localhost:3001   (health: /api/__health/readiness)\n' "$C_GREEN" "$C_RESET"
printf '   %sPostgres%s  localhost:${DB_PORT:-5432}\n' \
  "$C_GREEN" "$C_RESET"
printf '\n'

if [ "${#STARTED_PIDS[@]}" -eq 0 ]; then
  ok "Everything was already running — nothing new to start."
  info "Tailing existing logs in ${LOG_DIR#"$ROOT"/}/ (Ctrl+C to exit)."
else
  info "Streaming combined logs below. Ctrl+C stops the services this script started."
fi
printf '%s──────────────────────────────────────────────────────────────%s\n' \
  "$C_DIM" "$C_RESET"

# Follow whatever log files exist; prefix is the filename so lines are
# attributable. `tail` runs in the foreground; the INT trap handles cleanup.
tail -n 0 -F "$LOG_DIR"/*.log 2>/dev/null &
TAIL_PID=$!
STARTED_PIDS+=("$TAIL_PID")
STARTED_NAMES+=("log-tail")
wait "$TAIL_PID"
