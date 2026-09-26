#!/usr/bin/env bash
# One-shot setup for Ubuntu / WSL2: build, test, create the GitHub repo, push, enable Pages.
# Run from inside the unzipped repo:   bash scripts/setup_ubuntu.sh
# Options (environment variables):
#   OWNER=Normansrule  REPO=transistor-odyssey  SSH_HOST=github-normansrule  SKIP_GITHUB=1
set -euo pipefail

OWNER="${OWNER:-Normansrule}"
REPO="${REPO:-transistor-odyssey}"
SSH_HOST="${SSH_HOST:-github-normansrule}"

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
if [ "$ROOT" = "$HOME" ] || [ ! -f "$ROOT/Makefile" ] || [ ! -d "$ROOT/site" ]; then
  echo "error: run this from inside the transistor-odyssey folder (found: $ROOT)" >&2
  exit 1
fi
echo "==> repo: $ROOT"

# Leave any conda env alone but make sure we build inside our own venv
if [ ! -d .venv ]; then python3 -m venv .venv; fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt

echo "==> generating figures, layouts and site data"
make figures PY=python >/dev/null
echo "==> running tests"
make test PY=python

# The zip ships with its own .git; make sure we are in *this* repo, never a parent one
if [ "$(git rev-parse --show-toplevel 2>/dev/null || true)" != "$ROOT" ]; then
  git init -q -b main
fi
git add -A
git -c user.name="${GIT_NAME:-Aleksander Norman}" -c user.email="${GIT_EMAIL:-aleksanderjnorman@gmail.com}" \
  commit -q -m "Regenerate figures and site data" || echo "==> nothing new to commit"

if [ "${SKIP_GITHUB:-0}" = "1" ]; then
  echo "==> SKIP_GITHUB=1, stopping before GitHub steps. Preview with: make serve"
  exit 0
fi

command -v gh >/dev/null || { echo "error: GitHub CLI 'gh' not installed (sudo apt install gh)" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "error: run 'gh auth login' first" >&2; exit 1; }

if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "==> $OWNER/$REPO already exists"
else
  echo "==> creating $OWNER/$REPO"
  gh repo create "$OWNER/$REPO" --public \
    --description "Interactive, simulated history of the transistor: 1947 point contact to 2 nm GAA, IBM 0.7 nm nanostack, 0.42 nm MoS2 interface, GaN/GaAs/SiC/diamond" \
    --homepage "https://$(echo "$OWNER" | tr '[:upper:]' '[:lower:]').github.io/$REPO/"
fi

git remote remove origin 2>/dev/null || true
git remote add origin "git@$SSH_HOST:$OWNER/$REPO.git"
echo "==> pushing over SSH ($SSH_HOST)"
git push -u origin main

echo "==> enabling GitHub Pages (GitHub Actions source)"
gh api -X POST "repos/$OWNER/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/$OWNER/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  || echo "   (Pages may already be enabled)"
sleep 3
gh workflow run pages.yml -R "$OWNER/$REPO" >/dev/null 2>&1 || true

echo
echo "Done. Actions:  https://github.com/$OWNER/$REPO/actions"
echo "Site (live in ~2 min): https://$(echo "$OWNER" | tr '[:upper:]' '[:lower:]').github.io/$REPO/"
