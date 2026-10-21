# Production deployment

Recommended: **Vercel** (built by the Next.js team) + **Supabase**. Any Node.js 20.9+ host that runs `next start` also works.

## 1. Prerequisites

- Supabase project set up per [SUPABASE_SETUP.md](SUPABASE_SETUP.md) (migrations applied, owner created, sample products replaced)
- Logo at `public/brand/kriva-logo.png`; real Open Graph image at `public/brand/og-image.png` (1200×630) — the current one is a plain placeholder
- `npm run check` passes

## 2. Vercel

1. Push the repository to GitHub (private).
2. In Vercel: *Add New → Project →* import the repo. Framework is detected as Next.js.
3. *Settings → Environment Variables* (Production; use separate values for Preview):
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-domain>`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server-only)
   - `PAYMENTS_MODE`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
   - Preview deployments should use **Razorpay test keys** and ideally a separate Supabase project.
4. *Settings → Functions → Region*: choose Mumbai (`bom1`) if available on your plan, close to customers and to Supabase.
5. Deploy.

## 3. Domain

1. *Settings → Domains*: add the domain (e.g. `kriva.in` and `www.kriva.in`), then add the DNS records Vercel shows at your registrar. HTTPS is issued automatically.
2. Update `NEXT_PUBLIC_SITE_URL` and redeploy.
3. Supabase → *Authentication → URL Configuration*: set Site URL to the domain.

## 4. Payments

Follow the "Going live" checklist in [PAYMENTS.md](PAYMENTS.md). Register the **live** webhook URL `https://<your-domain>/api/payments/razorpay/webhook`.

## 5. Post-deploy verification

- [ ] Home, collection, a product page, cart, contact load on mobile and desktop
- [ ] `/admin` redirects to login; owner can sign in; a non-owner account is refused
- [ ] Edit a product price in the dashboard → the website shows the new price
- [ ] Upload a product photo from a phone
- [ ] Place a "pay with KRIVA" order → appears in dashboard → confirm → record payment
- [ ] Place a Google Pay/UPI order in test mode (Preview) or a small live payment (Production) → *Paid*; refund it
- [ ] WhatsApp button opens the correct number with the order text
- [ ] `/sitemap.xml` and `/robots.txt` use the production domain
- [ ] Submit the sitemap in Google Search Console

## 6. Operations

- **Backups:** Supabase takes daily backups on paid plans; consider enabling Point-in-Time Recovery once orders are live.
- **Monitoring:** check Vercel function logs for `webhook processing failed` and Razorpay's webhook dashboard for non-200 deliveries.
- **Schema changes:** add a new file in `supabase/migrations/` and apply with `supabase db push` — never edit applied migrations.
- **Intro video:** host a licensed, compressed MP4 (6–10 s, under ~4 MB, 1080p or less) — e.g. upload to a public Supabase Storage bucket — and paste its URL in Settings → Homepage. No video is bundled because no licensed footage was supplied.
