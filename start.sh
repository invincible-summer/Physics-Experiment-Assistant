#!/usr/bin/env bash
# 物理实验小助手 一键启动
#   ./start.sh             生产模式：按需构建并启动（源码有更新时自动清理重建 dist/）
#   ./start.sh dev         开发模式：vite dev 热更新
#   ./start.sh rebuild     仅清理并重新构建（dist/、.vite 缓存、tsbuildinfo）
#   ./start.sh stop        停止本脚本启动的实例（含残留的旧实例）
#   PORT=8080 ./start.sh   指定首选端口（被占用时自动顺延到候选端口）
#   REBUILD=1 ./start.sh   强制重新构建（忽略产物新旧）
#   AUTO_OPEN=0 ./start.sh 禁止自动打开浏览器
#   VITE_BASE=/ ./start.sh 覆盖部署子路径（默认 /Physics-Experiment-Assistant/，与 GitHub Pages 一致）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

bold=$'\033[1m'; dim=$'\033[2m'; reset=$'\033[0m'
PID_FILE=/tmp/pea_run_pid
PORT_FILE=/tmp/pea_run_port
MODE_FILE=/tmp/pea_run_mode
BASE_PATH="${VITE_BASE:-/Physics-Experiment-Assistant/}"

if ! command -v node >/dev/null 2>&1; then
  echo "错误：未找到 Node.js，请先安装 Node.js 18 或更高版本（https://nodejs.org）" >&2
  exit 1
fi
NODE_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "错误：需要 Node.js >= 18，当前为 $(node -v)" >&2
  exit 1
fi

# ---- 通用工具（借鉴 Edu_Agent / myBlog start.sh，按 Vite 单进程架构适配） ----

# 依次探测候选端口，返回第一个可用的
pick_port() {
  local port candidates=("$@")
  for port in "${candidates[@]}"; do
    if node -e "const n=require('net').createServer();n.once('error',()=>process.exit(1));n.listen(${port},'0.0.0.0',()=>{n.close();process.exit(0)})" 2>/dev/null; then
      echo "$port"; return 0
    fi
  done
  echo "${candidates[0]}"
}

# 杀掉 cwd 在本仓库内且命令行属于本项目已知服务进程的实例（含旧版脚本
# 未写 PID 文件时启动的）。匹配同时限定 cwd 与命令行，绝不误杀同机其他项目。
kill_owned_processes() {
  local proc pid cwd cmd
  for proc in /proc/[0-9]*; do
    pid="${proc##*/}"
    [ "$pid" = "$$" ] && continue
    cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"
    [[ "$cwd" == "$ROOT"* ]] || continue
    cmd="$(tr '\0' ' ' < "$proc/cmdline" 2>/dev/null || true)"
    case "$cmd" in
      *vite\ preview*|*vite\ *dev*|*vite$|\
      sh\ -c\ npm\ run\ preview*|npm\ run\ preview*|\
      sh\ -c\ npm\ run\ dev*|npm\ run\ dev*|\
      sh\ -c\ vite*|node\ *vite*)
        kill "$pid" 2>/dev/null || true ;;
    esac
  done
  sleep 1
}

stop_all() {
  local pid port cwd
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  port="$(cat "$PORT_FILE" 2>/dev/null || true)"
  if [ -n "$pid" ] && [ -d "/proc/$pid" ]; then
    cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    if [[ "$cwd" == "$ROOT"* ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  fi
  kill_owned_processes
  # 只释放自己实例记录的端口（兜底，进程清扫通常已覆盖）
  if [ -n "$port" ] && command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" "$PORT_FILE" "$MODE_FILE"
}

RUN_PID=""; RUN_PORT=""
cleanup() {
  # Ctrl+C / TERM / 异常退出：杀子进程与本仓库残留服务进程并释放端口，
  # 避免孤儿进程占住端口。仅在 run/dev 分支挂载——rebuild/stop 退出时
  # 不得影响正在运行的实例。
  [ -n "$RUN_PID" ] && kill "$RUN_PID" 2>/dev/null || true
  kill_owned_processes
  if [ -n "$RUN_PORT" ] && command -v fuser >/dev/null 2>&1; then
    fuser -k "${RUN_PORT}/tcp" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" "$PORT_FILE" "$MODE_FILE"
}

# ---- 依赖 ----
ensure_deps() {
  # node_modules 不存在，或 lockfile 比已装依赖新（项目更新后），则重新安装
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    echo "${dim}==> 安装/更新依赖…${reset}"
    npm install
    # 依赖变化后清掉 vite 预构建缓存，避免过期产物（类似 .next 陈旧缓存）
    rm -rf node_modules/.vite
  fi
}

# ---- 过期产物清理（Vite 版的 ".next 清理"） ----
clean_stale() {
  # dist/ 整体重建；tsc 增量信息与 vite 预构建缓存一并清理
  rm -rf dist tsconfig.tsbuildinfo node_modules/.vite
}

# ---- 构建是否需要（源码/配置比产物新即重建；REBUILD=1 强制） ----
build_needed() {
  [ ! -f dist/index.html ] && return 0
  [ "${REBUILD:-0}" = "1" ] && return 0
  [ -n "$(find src index.html package.json package-lock.json vite.config.ts tsconfig.json \
      -type f -newer dist/index.html -print -quit 2>/dev/null)" ] && return 0
  return 1
}

build_site() {
  echo "${dim}==> 清理过期构建产物（dist/、.vite、tsbuildinfo）…${reset}"
  clean_stale
  echo "${dim}==> 构建生产版本（typecheck + vite build）…${reset}"
  npm run build
}

# ---- 就绪后自动打开浏览器（WSL2 感知，AUTO_OPEN=0 关闭） ----
open_browser() {
  [ "${AUTO_OPEN:-1}" = "0" ] && return 0
  local url="$1"
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null && break
    sleep 1
  done
  echo "${dim}==> 打开浏览器 $url${reset}"
  if [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; then
    # WSL2：explorer.exe 把 URL 交给 Windows 默认浏览器
    if command -v explorer.exe >/dev/null 2>&1; then
      explorer.exe "$url" &>/dev/null || true
    elif command -v powershell.exe >/dev/null 2>&1; then
      powershell.exe /c start "$url" &>/dev/null || true
    fi
  elif command -v wslview >/dev/null 2>&1; then
    wslview "$url" &>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" &>/dev/null || true
  fi
}

banner() {
  local mode="$1" url="$2"
  echo
  echo "${bold}============================================================${reset}"
  echo "${bold}  物理实验小助手已就绪（${mode}）${reset}"
  echo "  ----------------------------------------------------------"
  echo "  地址  ${bold}${url}${reset}"
  echo "  ----------------------------------------------------------"
  echo "  停止  ${dim}./start.sh stop 或 Ctrl+C${reset}"
  echo "============================================================"
  echo
}

case "${1:-run}" in
  stop)
    stop_all
    echo "已停止。"
    exit 0
    ;;
  rebuild)
    ensure_deps
    build_site
    echo "构建完成 → dist/"
    exit 0
    ;;
  dev)
    ensure_deps
    stop_all
    DEV_PORT="$(pick_port "${PORT:-5173}" 5173 5174 5175 5176)"
    banner "开发模式 · 热更新" "http://localhost:${DEV_PORT}${BASE_PATH}"
    npm run dev -- --port "$DEV_PORT" --strictPort &
    RUN_PID=$!
    echo "$RUN_PID" > "$PID_FILE"
    echo "$DEV_PORT" > "$PORT_FILE"
    echo "dev" > "$MODE_FILE"
    trap cleanup INT TERM EXIT
    open_browser "http://localhost:${DEV_PORT}${BASE_PATH}" &
    wait
    ;;
  run)
    ensure_deps
    stop_all
    RUN_PORT="$(pick_port "${PORT:-4173}" 4173 4174 4175 4176)"
    if build_needed; then
      build_site
    else
      echo "${dim}==> 复用现有构建 dist/（REBUILD=1 可强制重建）${reset}"
    fi
    banner "生产模式" "http://localhost:${RUN_PORT}${BASE_PATH}"
    npm run preview -- --port "$RUN_PORT" --strictPort &
    RUN_PID=$!
    echo "$RUN_PID" > "$PID_FILE"
    echo "$RUN_PORT" > "$PORT_FILE"
    echo "run" > "$MODE_FILE"
    trap cleanup INT TERM EXIT
    open_browser "http://localhost:${RUN_PORT}${BASE_PATH}" &
    wait
    ;;
  *)
    echo "用法：$0 [run|dev|rebuild|stop]"
    echo "  run（默认） 生产模式：源码/配置有更新时自动清理重建 dist/"
    echo "  dev        开发模式：vite dev 热更新（默认 5173，占用则顺延）"
    echo "  rebuild    仅清理并重新构建（dist/、.vite、tsbuildinfo）"
    echo "  stop       停止本地运行实例"
    echo "  环境变量   PORT 首选端口 · REBUILD=1 强制重建 · AUTO_OPEN=0 不开浏览器 · VITE_BASE 覆盖子路径"
    exit 1
    ;;
esac
