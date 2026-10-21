# Supabase setup

## 1. Create the project

1. Sign in at https://supabase.com and create a new project.
2. **Region:** choose the closest available region to Coimbatore (an Asia-Pacific region such as Mumbai/`ap-south-1` if offered).
3. Save the database password somewhere safe.

## 2. Run the migrations

**Option A — Supabase CLI (recommended, keeps migrations version-controlled):**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*
```

**Option B — SQL editor:** open *SQL Editor* and run, in order:

1. `supabase/migrations/20261021000001_schema.sql`
2. `supabase/migrations/20261021000002_functions_and_rls.sql`
3. `supabase/migrations/20261021000003_storage.sql`

## 3. (Optional) Load sample data

Run `supabase/seed.sql` in the SQL editor. It creates the nine initial categories and **sample products marked `is_sample`**, with placeholder prices. The dashboard highlights them so they can be replaced or deleted before launch. To start empty, run only the `insert into public.categories …` statement from the seed.

> Sample products point at `/samples/*.svg` illustrations in `public/`. Upload real photos from the dashboard.

## 4. Create the owner account

Public sign-up is **not** used. Owners are created manually:

1. *Authentication → Providers → Email*: keep Email enabled. Under *Authentication → Sign In / Providers*, **turn off "Allow new users to sign up"**.
2. *Authentication → Users → Add user → Create new user*: enter the owner's email and a strong password, and tick *Auto confirm*.
3. Copy the new user's **UID**, then in the SQL editor run:
   ```sql
   insert into public.admin_users (user_id) values ('<owner-uid>');
   ```
4. Sign in at `/admin/login`.

Repeat steps 2–3 for additional staff accounts. To remove access: `delete from public.admin_users where user_id = '<uid>';`

Recommended: enable **MFA** for owner accounts (*Authentication → Multi-Factor*) and set a strong password policy.

## 5. API keys → environment variables

*Project Settings → API Keys*:

| Supabase value | Env variable | Where it may be used |
| --- | --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Browser + server |
| Publishable key (`sb_publishable_…`) or legacy anon key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server |
| Secret key (`sb_secret_…`) or legacy service_role key | `SUPABASE_SECRET_KEY` | **Server only** |

## 6. Auth URL configuration

*Authentication → URL Configuration*: set **Site URL** to your production domain (e.g. `https://kriva.in`) and add `http://localhost:3000` to redirect URLs for development.

## 7. Storage

The migration creates a public bucket `product-images` (5 MB limit; JPEG/PNG/WebP/AVIF only). Anyone can view images (they're on the website); only owners can upload, replace or delete. The server also checks each file's signature bytes before upload.

## What the migrations create

| Table | Purpose | Public access |
| --- | --- | --- |
| `categories`, `products`, `product_variants`, `product_flavours`, `product_images` | Catalogue | Read active rows only |
| `site_settings` | Public business info (single row) | Read |
| `orders`, `order_items`, `order_status_history` | Orders + audit trail | **None** (owners read via RLS; server uses secret key) |
| `payment_transactions`, `payment_events` | Gateway records, webhook idempotency | **None** |
| `admin_users` | Who is an owner | None (owners can read their own row) |
| `rate_limits` | Abuse protection counters | None |

Database-level rules (in addition to RLS):
- Order totals must equal subtotal + delivery; each line total must equal unit price × quantity.
- Order references, idempotency keys, gateway order IDs and payment IDs are unique.
- Order status can only move forward (pending → confirmed → preparing → ready → completed, or → cancelled).
- Cancelling an order returns tracked stock.
- Totals and references can't be edited after creation.
- **Online payment status can only be changed by the server** (service role) after verifying with Razorpay.
- Every status/payment change is written to `order_status_history`.
