# Mahallu ERP — Backend

Node.js + Express + MongoDB API for the Mahallu ERP system.

Extracted from the `MAHALLU` monorepo (`apps/backend`) with full commit history preserved for
this app's files. Previously depended on nothing outside `apps/backend/` — no code changes were
needed to run standalone.

## Setup

```bash
npm install
cp .env.example .env   # fill in secrets
npm run dev
```

## Scripts

- `npm run dev` — start with hot reload (`tsx watch`)
- `npm run build` — compile `packages/shared-types`, `packages/shared-config`, then `src/` to `dist/`
- `npm start` — run the compiled build
- `npm run seed` / `npm run clear-db` / `npm run clear-remote` — database maintenance scripts
- `npm run lint` — ESLint over `src/`

There is currently no automated test suite (`npm test` references Jest but no test files exist yet).

## Local infra

```bash
docker compose up -d      # MongoDB + Redis + this API
curl localhost:5000/health
```

## Environment variables

See `.env.example` for the full list (JWT secrets, MongoDB/Redis URIs, Cloudinary, Razorpay,
WhatsApp webhook token, seed admin credentials). None of these values are committed anywhere in
this repo or its history.

## Structure

- `src/models`, `src/routes`, `src/controllers`, `src/middleware`, `src/jobs`, `src/services` —
  application code
- `packages/shared-types`, `packages/shared-config` — vendored local packages (types, RBAC,
  constants) consumed via `file:` dependencies; not published or shared with other repos
