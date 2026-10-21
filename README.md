# KRIVA — cakes & pastries, Coimbatore

Production-ready storefront and owner dashboard for KRIVA: catalogue, cart, website checkout, Google Pay / UPI payments through Razorpay, WhatsApp ordering, and order management.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, Row Level Security) · Razorpay (UPI incl. Google Pay) · Vitest

> **Status:** All code is implemented and the automated checks pass (see `docs/TESTING.md`). **Live payments are not yet operational.** They need KRIVA's Razorpay merchant account, a Supabase project and the business details in `docs/OWNER_INFO_NEEDED.md`. Every product in the seed data is a **sample** with placeholder prices.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) | Running the site on your computer |
| [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) | Database, storage, owner account |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) | Razorpay onboarding, Google Pay/UPI, webhooks, test → live |
| [docs/WHATSAPP.md](docs/WHATSAPP.md) | How WhatsApp ordering works and its limits |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploying to Vercel (or another Node host) |
| [docs/SECURITY.md](docs/SECURITY.md) | Security checklist |
| [docs/TESTING.md](docs/TESTING.md) | Testing report |
| [docs/OWNER_INFO_NEEDED.md](docs/OWNER_INFO_NEEDED.md) | Business information still required from the owner |

## Quick start (preview with sample data, no accounts needed)

```bash
npm install
npm run dev
# open http://localhost:3000
```

Without Supabase configured, the site runs in **preview mode**: sample catalogue, working cart and WhatsApp links (once a number is configured), and checkout clearly marked as not connected.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types + TypeScript |
| `npm test` | All automated tests (unit, integration, database/RLS) |
| `npm run check` | Lint + typecheck + tests + build |

## Project structure

```
supabase/
  migrations/            Version-controlled schema, functions, RLS, storage policies
  seed.sql               Initial categories + SAMPLE products
src/
  app/
    (store)/             Customer site: home, collection, product, cart, checkout, order, custom-cakes, contact, policies
    admin/               Owner login + dashboard (overview, orders, products, categories, settings)
      actions/           Server actions (all call requireAdminAction first)
    api/
      cart/quote         Server-side price quote for the cart
      checkout           Creates orders (re-prices everything server-side)
      payments/          start · verify · reconcile · razorpay/webhook
  components/            UI (storefront, cart, checkout, admin)
  lib/
    pricing.ts           Trusted cart pricing & availability rules
    orders.ts            Order creation, customer order lookup, rate limiting
    payments/            Razorpay client, signature checks, payment decision logic
    whatsapp.ts          WhatsApp message/link builder
    schedule.ts          IST lead-time / opening-hours validation
    auth.ts              Owner authorisation
  proxy.ts               Session refresh + /admin redirect (Next 16 "proxy", formerly middleware)
public/
  brand/                 Logo goes here: kriva-logo.png (not yet supplied)
  samples/               Sample product illustrations (replace with real photos)
tests/                   unit/ · integration/ · db/ (real Postgres via PGlite)
```

## Key design decisions

- **Money is integer paise** everywhere (database, server, Razorpay). No floating-point arithmetic.
- **The browser is never trusted for prices.** The cart stores only IDs and quantities; `/api/cart/quote` and `/api/checkout` re-price against the database, and checkout refuses if the shown total differs.
- **Order status and payment status are separate.** A paid order still goes pending → confirmed → preparing → ready → completed.
- **"Paid" only comes from Razorpay.** Signature-verified callbacks and webhooks trigger a server-side fetch of the payment from Razorpay's API; only that record can mark an order paid. The database itself blocks owners from editing online payment status.
- **WhatsApp orders are enquiries.** They are never stored as paid or confirmed orders.
- **Customers see their order through a private link** (`/order/<reference>?t=<secret>`); only a hash of the secret is stored.
