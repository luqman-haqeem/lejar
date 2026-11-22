<img src="public/icon-192.png" alt="Lejar icon: a violet rubber stamp reading LEJAR" width="96" align="right">

# Lejar

A digital service book for Malaysian car and motorbike owners. *Lejar* is Malay for "ledger".

**Live app:** https://lejar.luqmanhaqeem.workers.dev

Lejar replaces the paper service book and the shoebox of receipts. Snap a workshop receipt at the counter, check what it read, and save it. The dashboard shows what's due next: oil change, road tax and insurance. When you sell the vehicle, print its full history as a PDF for the buyer.

- **Receipt scan:** a vision model reads the receipt into the service form. You check and correct every field before saving.
- **Due dates:** each vehicle has its own service intervals, by km or by date, with the mileage estimated between services.
- **Several vehicles:** cars and motorbikes side by side, each with its own history.
- **Private:** sign in with Google. Each user sees only their own vehicles, services and photos.

## Stack

Cloudflare Workers, [Hono](https://hono.dev) with server-rendered JSX, D1 (SQLite) for data, and R2 for receipt and vehicle photos. Receipt reading goes through OpenRouter. There's no client framework and no build step beyond what Wrangler does.

## Run it locally

```sh
npm install
cp .dev.vars.example .dev.vars   # fill in the values; DEV_LOGIN=1 skips Google on localhost
npx wrangler d1 migrations apply lejar --local
npm run dev                      # http://localhost:8787
```

Checks:

```sh
npm test            # vitest, running inside the Workers runtime
npm run typecheck
```

## Deploy your own

`./scripts/go-live.sh` is an interactive wizard. It walks you through the Cloudflare sign-in, the D1 database and R2 bucket, the Google OAuth client, the secrets and the first deploy. After that, every push to `master` runs the tests, applies migrations and deploys (`.github/workflows/deploy.yml`).

## Docs

- `PRODUCT.md`: who it's for and what it must do
- `DESIGN.md`: the "stamped service book" design system
- `GLOSSARY.md`: domain terms
- `docs/superpowers/specs/`: design specs, starting with the original (written when the app was called Kereta)
