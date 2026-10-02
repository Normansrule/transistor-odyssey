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
command -v node >/dev/null || echo "    (Node.js not found: the JS-vs-Python parity test will be skipped; 'sudo apt install nodejs' to enable it)"
make test PY=python

# Release zips ship without .git. Start a repo here (never reuse a parent one) and, when GitHub
# already has the project, build this version on top of its history so the log stays linear.
FRESH=0
if [ "$(git rev-parse --show-toplevel 2>/dev/null || true)" != "$ROOT" ]; then
  git init -q -b main
  FRESH=1
fi
VERSION="$(sed -n 's/^version: *//p' CITATION.cff | head -1)"
TITLE="$(sed -n 's/^## v[0-9.]* — //p' CHANGELOG.md 2>/dev/null | head -1)"
MSG="v${VERSION%.0}: ${TITLE:-update}"
if [ "$FRESH" = "1" ] && [ "${SKIP_GITHUB:-0}" != "1" ]; then
  git remote add origin "git@$SSH_HOST:$OWNER/$REPO.git" 2>/dev/null || true
  if git fetch -q origin main 2>/dev/null; then
    git reset -q --soft origin/main
    echo "==> building on GitHub's history ($(git rev-parse --short origin/main))"
  fi
fi
git add -A
git -c user.name="${GIT_NAME:-Aleksander Norman}" -c user.email="${GIT_EMAIL:-aleksanderjnorman@gmail.com}" \
  commit -q -m "$MSG" || echo "==> nothing new to commit"
echo "==> committed: $MSG"

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
# If GitHub already has an earlier version, keep its history and put this version on top
if git fetch -q origin main 2>/dev/null; then
  if ! git merge-base --is-ancestor origin/main HEAD; then
    echo "==> GitHub has an earlier version; merging its history (this version's files win)"
    git -c user.name="${GIT_NAME:-Aleksander Norman}" -c user.email="${GIT_EMAIL:-aleksanderjnorman@gmail.com}" \
      merge -q -s ours --allow-unrelated-histories origin/main -m "Merge earlier GitHub history; keep this version's files"
  fi
fi
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
