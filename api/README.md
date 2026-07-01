# BatchFit API

Node + Express + TypeScript + Prisma (SQLite). This is the **Phase-3 backend seed**
(the eventual home for accounts + cloud sync). The MVP mobile app in `../app` is
offline/local-first and does **not** depend on this service yet.

Scope so far: the batch-cooking differentiator — reference **foods**, and **batches**
(a cook with snapshotted ingredient amounts + a live portion-inventory count).
Per-portion macros are computed server-side in `src/macros.ts`.

## Setup

```bash
npm install
npx prisma migrate dev --name init   # create the SQLite db + client
npm run db:seed                       # optional: sample foods + a batch
npm run dev                           # http://localhost:4000
```

## Endpoints

| Method | Path               | Purpose                                          |
| ------ | ------------------ | ------------------------------------------------ |
| GET    | `/health`          | Liveness check                                   |
| GET    | `/foods`           | List reference foods (macros per 100g)           |
| POST   | `/foods`           | Create a food                                    |
| GET    | `/batches`         | Inventory: batches with total + per-portion macros |
| GET    | `/batches/:id`     | One batch with computed macros                   |
| POST   | `/batches`         | Record a cook (snapshots ingredient amounts)     |
| POST   | `/batches/:id/eat` | Eat a portion (decrements remaining)             |

## Scripts

- `npm run dev` — watch-mode server (tsx)
- `npm run build` / `npm start` — compile to `dist/` and run
- `npm run typecheck` — type-check without emitting
- `npm run prisma:migrate` — create/apply a migration
- `npm run db:seed` — load sample data
