# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A tiny static website (no build step) that lets users create a “surrender letter” JSON locally in the browser, compute its SHA-256 hash, and request an OpenTimestamps (OTS) proof for that hash.

Key idea: the serverless function never receives the letter content—only `{ filename, sha256 }`—so the proof can be generated without collecting user data.

## Common commands

### Install dependencies

This repo uses npm (has `package-lock.json`).

```bash
npm ci
```

### Local development (static site + Netlify Functions)

Requires Netlify CLI (not included in `package.json`; see `.vscode/launch.json`).

```bash
netlify dev
```

Serve only functions:

```bash
netlify functions:serve
```

### OTS tooling (manual)

The README documents how to upgrade and verify OTS proofs using the Python client:

```bash
pip3 install opentimestamps-client
ots upgrade <file>.ots
ots verify <file>.ots <file>.json
```

There is also a helper script:

```bash
./verify.sh [en|zh|ja] <filename>
```

Note: `verify.sh` expects files under `signatures/` and `ots/`. If verification fails, double-check the argument order expected by `ots verify`.

### Tests / lint

No test runner or lint scripts are defined in `package.json` currently.

## Architecture (big picture)

### Static frontend (root)

- `index.html`: single-page UI + submission logic.
  - Builds the “signature” JSON in-browser.
  - Computes SHA-256 via `crypto.subtle.digest`.
  - Calls the Netlify function at `/.netlify/functions/sign` with `{ filename, sha256 }`.
  - Always offers the JSON for download locally; optionally offers an OTS file download based on server response.
- `i18n.js` + `locales/*.json`: very small i18n layer using `data-i18n` attributes.

### Serverless backend (Netlify)

- `netlify/functions/sign.js`: Netlify Function that:
  1) Creates an OpenTimestamps detached proof for the provided SHA-256 hash.
  2) Attempts to commit the generated `.ots` bytes into this GitHub repo under `ots/<filename>.ots` via Octokit.
  3) Returns either:
     - `200 { ots_url }` when upload succeeded, or
     - `202 { otsFile }` when upload failed (OTS returned to the client for manual download/upgrade).

Netlify config:
- `netlify.toml`: publishes the repo root (`publish = "."`) and functions live in `netlify/functions`.
  - Also provides a redirect `/api/* -> /.netlify/functions/:splat` (status 200).

### OTS proof lifecycle automation (GitHub Actions)

- `.github/workflows/ots.yml`: scheduled + on-push workflow that runs `ots upgrade` over `ots/**/*.ots`, then commits and pushes any upgraded proofs.

## Environment / secrets

- Netlify Function `sign.js` depends on these env vars:
  - `GITHUB_TOKEN` (repo write access)
  - `GITHUB_OWNER`, `GITHUB_REPO`
  - `GITHUB_BRANCH` (defaults to `main` in code)

- There is a `local.env` file in the repo root that contains a GitHub token.
  - Treat it as a local-only dev file.
  - It is **not** covered by the current `.gitignore` pattern (`*.env`), so be careful not to commit it.

## Key paths to know

- Frontend entry: `index.html`
- Netlify function: `netlify/functions/sign.js`
- Stored proofs: `ots/` (committed)
- Translations: `locales/`
