# Testing report

**Date:** 21 October 2026 · **Environment:** Linux, Node.js 22.22, Next.js 16.4.2, Vitest 5.0.5

## Results

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | ✅ 0 errors, 0 warnings |
| Type check | `npm run typecheck` | ✅ no errors |
| Automated tests | `npm test` | ✅ **90 / 90 passed** (7 files) |
| Production build | `npm run build` | ✅ compiled; 29 routes + proxy |
| Smoke test (preview mode) | `next start` + Playwright/Chromium | ✅ see below |

Run everything with `npm run check`.

## What the tests cover

### Database, constraints & Row Level Security — `tests/db/database.test.ts` (18)
Runs the **real migration and seed SQL** inside PGlite (in-process PostgreSQL 18) with stand-ins for Supabase's `anon`, `authenticated` and `service_role` roles and `auth.uid()`.
- Seed creates 9 categories; all seeded products are flagged as samples
- Constraints reject bad slugs and zero prices
- `create_order` writes order + items + history; rejects mismatched subtotal; reserves tracked stock and refuses to oversell; cancellation returns stock; duplicate idempotency key rejected
- Status transitions enforced; totals immutable
- RLS: public reads catalogue but no orders/payments; `payment_events` permission denied; inactive products hidden; anon and non-owner users can't modify products/settings/orders or grant themselves admin; anon can't call `create_order`; owners can manage products and read orders; owners **cannot** set online payment status or totals; owners can record offline payments (history records the user); service role can record verified payments
- Rate limiter allows up to the limit per window

### Pricing & catalogue rules — `tests/unit/pricing.test.ts` (11)
Quantities and subtotals; size-specific prices; flavour surcharges; delivery fee and free-delivery threshold; injected browser prices ignored; sold-out/inactive/unknown products rejected; options from other products or disabled options rejected; flavour required when offered; invalid quantities; tracked stock across lines; cake message rules; minimum order; disabled fulfilment; approval flag and longest lead time.

### Money, scheduling, validation, references, status wording — `tests/unit/misc.test.ts` (13)
Rupee → paise parsing without float errors; INR formatting (lakh grouping); IST interpretation; lead time, opening hours, closed days, booking window, daily cutoff; checkout schema accepts valid input and rejects bad name/phone/email/address/empty cart/honeypot/negative quantity; slugs; **image upload validation by type, size and magic bytes** (HTML disguised as PNG and SVG rejected); 500 unique order references; access-token matching; customer wording never says "confirmed" for an unconfirmed request.

### WhatsApp — `tests/unit/whatsapp.test.ts` (5)
Product details, options, quantities, line totals and subtotal in the message; wording asks KRIVA to confirm rather than claiming an order or payment; URL encoding round-trips exactly (`&`, `#`, quotes, newlines, ₹); uses only a configured valid number; enquiry reference format.

### Payment logic — `tests/unit/payments.test.ts` (13)
Checkout and webhook HMAC verification (tampered ids, wrong secret, malformed, raw-body changes); payment decisions for success, amount/currency/order mismatch, offline orders, failure, abandoned, duplicate webhooks, second captured payment, out-of-order/delayed events, full vs partial refunds; when customers may pay (approval workflow); key/mode mismatch protection; Razorpay client sends integer paise with Basic auth and rejects path-injection ids.

### End-to-end server flows — `tests/integration/checkout-payments.test.ts` (21)
Calls the real route handlers (`/api/checkout`, `/api/payments/start|verify|reconcile`, webhook) with an in-memory database double and a mocked Razorpay API:
- Order created with server prices; only token hash stored
- **Altered browser total → 409, no order**; injected price fields ignored
- Unavailable products / incompatible options / invalid customer info / missing address / past date rejected
- **Duplicate concurrent submissions → one order**
- Cross-origin requests rejected; checkout rate limit returns 429
- Custom (approval) orders can't be paid until confirmed
- Gateway order created server-side for the trusted amount, reused on retry, no secrets in response; wrong token → 404
- **Successful test payment** → paid, fulfilment status unchanged
- **Invalid signature** → rejected, not paid
- **Client claims success but Razorpay says failed** → failed, not paid
- **Redirect/status check without verified payment** → stays pending
- **Failed/cancelled payment** → failed, retry allowed
- **Invalid webhook signature** → 401
- **Duplicate webhook** → processed once
- **Delayed payment notification** settles order; stale failure afterwards doesn't regress it
- **Incorrect amount / unknown order reference** → rejected
- Second captured payment flagged for refund
- **Refund**: pending until provider confirms, then refunded

### Authorisation — `tests/integration/auth.test.ts` (9)
Unauthenticated users and signed-in non-owners are refused by `getAdmin`/`requireAdminAction`/`requireAdminPage`; six protected server actions (product save/delete/quick-update, order status, offline payment, settings) reject non-owners **before any write**; `/admin` proxy redirects signed-out visitors and lets the login page through; owner product form validation (sizes, prices, duplicate names, slugs, stock).

### Smoke test of the built site (preview mode, Chromium)
- All public routes return 200; unknown product 404; `/admin` redirects; sitemap and robots served
- No horizontal scrolling at 390 px and 1440 px; no JavaScript errors (the only console error was the logo file not yet supplied — a fallback is shown)
- Intro overlay appears on first visit and closes with *Skip intro*; skipped under reduced motion
- Add to cart with a flavour surcharge → cart shows server-verified total (₹999 + ₹150 = ₹1,149)

## Not completed (requires credentials or services not available here)

| Item | Why | How to complete |
| --- | --- | --- |
| Real Razorpay test-mode payment, including Google Pay/UPI UI | No Razorpay account/keys supplied | PAYMENTS.md → "Test mode" step 5 |
| Webhook delivery from Razorpay's servers | Needs a public URL + webhook secret | Register webhook; check Razorpay webhook logs show 200 |
| Hosted Supabase (PostgREST + Auth + Storage) | No project supplied. RLS/constraints were tested on real Postgres via PGlite with role stand-ins, not on Supabase itself | After setup, run the DEPLOYMENT.md verification list |
| Image upload to Supabase Storage | Storage service unavailable; upload validation is unit-tested | Upload a photo from desktop and phone in /admin |
| Owner creating/editing products through the dashboard against a live database | Same; DB rules and form validation tested separately | Edit a product and confirm the change appears on the site |
| Browser-automated checkout against a live backend | Needs Supabase | Manual run through the post-deploy checklist |

No live payment credentials were used. No payments, deployments or domain configurations were performed or claimed.
