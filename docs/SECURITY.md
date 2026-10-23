# Security checklist

✅ = implemented in code and covered by tests where noted. ☐ = action needed during setup/launch.

## Secrets & configuration
- ✅ Supabase secret key and Razorpay key secret / webhook secret are read only in server modules (`server-only` imports); none use the `NEXT_PUBLIC_` prefix.
- ✅ The browser receives only the Razorpay **key id** and gateway order id (tested: start-payment response contains no secret).
- ✅ Startup refuses mismatched key/mode (live key with `PAYMENTS_MODE=test` and vice versa).
- ✅ `.env*` is git-ignored; `.env.example` contains placeholders only.
- ☐ Set secrets only in the hosting provider; use test keys for Preview deployments.
- ☐ Rotate any key that is ever pasted into chat, email or a ticket.

## Authentication & authorisation
- **Owner dashboard preview mode** (`KRIVA_DEMO_ADMIN=1`) shows /admin with sample orders and no login, for demonstrations only. It switches on **only** when Supabase is not configured (tested), saves nothing, and must never be set in production.
- ✅ Owners are listed in `admin_users`; there is no public sign-up path to admin access. ☐ Disable "Allow new users to sign up" in Supabase.
- ✅ Every admin page calls `requireAdminPage()` and every admin server action calls `requireAdminAction()` — verified with `supabase.auth.getUser()` against the Auth server (tested: unauthenticated and non-owner users are rejected before any write).
- ✅ The `/admin` proxy redirect is a convenience only; authorisation never depends on hidden buttons or routes.
- ✅ Login is rate-limited per IP and per email.
- ☐ Enable MFA for owner accounts.

## Database (Row Level Security)
- ✅ RLS enabled on every table (tested against real Postgres):
  - public can read only active catalogue rows and public settings;
  - public and non-owner users can't read orders, items, history or payments, and can't write anything;
  - `payment_events` and `rate_limits` are inaccessible to browser roles;
  - `create_order` is executable only by the service role.
- ✅ Owners may update only order workflow columns (`status`, `payment_status`, `rejection_reason`); totals/references are immutable (trigger + column grants).
- ✅ Online payment status can only be changed by the service role (trigger; tested).
- ✅ Status transitions are enforced in the database; all changes are logged with the acting user.

## Orders & pricing
- ✅ Browser prices are ignored; server re-prices from the database and rejects changed totals (tested).
- ✅ Unavailable products, wrong options, invalid quantities, over-stock and over-long messages are rejected (tested).
- ✅ Idempotency key prevents duplicate orders from double-submits (tested); unique reference per order.
- ✅ Checkout and payment endpoints are rate-limited and same-origin only; honeypot field against bots; request size capped.
- ✅ Customers see only their own order through an unguessable token (192-bit); only its SHA-256 hash is stored; constant-time comparison.

## Payments
- ✅ Gateway orders created server-side with the database amount (integer paise).
- ✅ Checkout signature verified (HMAC-SHA256 with our stored gateway order id) **and** payment re-fetched from Razorpay before any change.
- ✅ Webhook signature verified over the raw body; events de-duplicated by `x-razorpay-event-id`; failures return 500 so Razorpay retries.
- ✅ Amount, currency and order matching enforced; duplicate captures flagged for refund; stale/out-of-order events can't regress a paid order (tested).
- ✅ No UPI PIN, OTP, card or bank credentials are ever collected by KRIVA's site.

## Uploads
- ✅ Owner-only uploads (server action + storage RLS); bucket restricted to JPEG/PNG/WebP/AVIF, 5 MB.
- ✅ Server checks declared type, size and magic bytes; random file names; SVG uploads are not accepted.

## Web hardening
- ✅ Security headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, HSTS; `X-Powered-By` removed.
- ✅ Admin, cart, checkout and order pages are `noindex` and disallowed in robots.txt.
- ✅ React escapes all user content; no `dangerouslySetInnerHTML`.
- ☐ Optional: add a Content-Security-Policy once the final set of third-party origins (Razorpay, analytics, video host) is known — Razorpay Checkout needs `checkout.razorpay.com` and `api.razorpay.com` allowed for scripts/frames.

## Privacy
- ✅ Only data needed for orders is collected; rate-limit keys use hashed IPs.
- ☐ Complete the privacy policy template and decide a retention period for old orders.
