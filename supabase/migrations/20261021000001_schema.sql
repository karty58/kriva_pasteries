-- =====================================================================
-- KRIVA — core schema
-- Money is stored as integer paise (1 INR = 100 paise). Never floats.
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+; no extension needed.

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.order_status as enum
  ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');

create type public.payment_status as enum
  ('pending', 'paid', 'failed', 'cancelled', 'refunded');

create type public.stock_status as enum ('in_stock', 'sold_out', 'unavailable');

-- ---------------------------------------------------------------------
-- Owner / admin accounts
-- Rows are added manually (SQL editor) — never from the public site.
-- ---------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

create table public.products (
  id                     uuid primary key default gen_random_uuid(),
  category_id            uuid references public.categories (id) on delete set null,
  name                   text not null check (char_length(name) between 1 and 120),
  slug                   text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description            text check (char_length(description) <= 4000),
  allows_custom_message  boolean not null default false,
  max_message_length     integer not null default 40 check (max_message_length between 1 and 120),
  allows_instructions    boolean not null default true,
  lead_time_hours        integer not null default 24 check (lead_time_hours between 0 and 720),
  stock_status           public.stock_status not null default 'in_stock',
  stock_quantity         integer check (stock_quantity is null or stock_quantity >= 0),
  max_per_order          integer not null default 10 check (max_per_order between 1 and 100),
  requires_approval      boolean not null default false,
  is_active              boolean not null default true,
  is_featured            boolean not null default false,
  is_bestseller          boolean not null default false,
  is_signature           boolean not null default false,
  ingredients            text check (char_length(ingredients) <= 2000),
  allergens              text check (char_length(allergens) <= 1000),
  is_sample              boolean not null default false,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index products_category_idx on public.products (category_id) where is_active;
create index products_featured_idx on public.products (is_featured) where is_active;
create index products_created_idx  on public.products (created_at desc);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Every product has at least one variant. A fixed-price product has one
-- variant (e.g. "Standard"); size-priced cakes have one per size.
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 60),
  price_paise integer not null check (price_paise > 0 and price_paise <= 10000000),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  -- deferred so the owner can swap two labels in one save
  unique (product_id, label) deferrable initially deferred
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_flavours (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 60),
  extra_price_paise integer not null default 0 check (extra_price_paise >= 0 and extra_price_paise <= 1000000),
  sort_order        integer not null default 0,
  is_active         boolean not null default true,
  unique (product_id, name) deferrable initially deferred
);
create index product_flavours_product_idx on public.product_flavours (product_id);

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt_text     text check (char_length(alt_text) <= 200),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- ---------------------------------------------------------------------
-- Site settings (single row, id = 1). All fields here are PUBLIC
-- business information — never put secrets in this table.
-- ---------------------------------------------------------------------
create table public.site_settings (
  id                          integer primary key default 1 check (id = 1),
  shop_name                   text not null default 'KRIVA',
  tagline                     text,
  address                     text,
  city                        text not null default 'Coimbatore',
  region                      text not null default 'Tamil Nadu',
  country                     text not null default 'India',
  maps_url                    text,
  phone                       text,
  whatsapp_number             text check (whatsapp_number is null or whatsapp_number ~ '^[1-9][0-9]{9,14}$'),
  email                       text,
  instagram_url               text,
  facebook_url                text,
  our_story                   text,
  business_hours              jsonb,         -- {"mon":{"open":"10:00","close":"21:00"}, "tue": null (closed), ...}
  pickup_enabled              boolean not null default true,
  delivery_enabled            boolean not null default false,
  delivery_areas              text[] not null default '{}',
  delivery_fee_paise          integer not null default 0 check (delivery_fee_paise >= 0),
  free_delivery_above_paise   integer check (free_delivery_above_paise is null or free_delivery_above_paise > 0),
  min_order_paise             integer not null default 0 check (min_order_paise >= 0),
  default_lead_time_hours     integer not null default 24 check (default_lead_time_hours between 0 and 720),
  order_cutoff_time           time,          -- orders after this (IST) count from the next day
  max_advance_days            integer not null default 45 check (max_advance_days between 1 and 365),
  online_payments_enabled     boolean not null default false,
  offline_payments_enabled    boolean not null default true,
  approval_mode               text not null default 'pay_immediately'
                                check (approval_mode in ('pay_immediately', 'approve_then_pay')),
  intro_enabled               boolean not null default true,
  intro_video_url             text,
  intro_poster_url            text,
  seasonal_note               text,
  testimonials                jsonb not null default '[]'::jsonb, -- genuine reviews ONLY: [{"quote":"...","name":"..."}]
  timezone                    text not null default 'Asia/Kolkata',
  currency                    text not null default 'INR' check (currency = 'INR'),
  updated_at                  timestamptz not null default now()
);
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();
insert into public.site_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique check (reference ~ '^KRV-[0-9]{6}-[A-Z0-9]{6}$'),
  access_token_hash    text not null,
  idempotency_key      uuid not null unique,
  customer_name        text not null check (char_length(customer_name) between 2 and 80),
  customer_phone       text not null check (customer_phone ~ '^[6-9][0-9]{9}$'),
  customer_email       text check (customer_email is null or char_length(customer_email) <= 200),
  fulfilment_method    text not null check (fulfilment_method in ('pickup', 'delivery')),
  delivery_address     text check (char_length(delivery_address) <= 500),
  delivery_area        text check (char_length(delivery_area) <= 100),
  requested_for        timestamptz not null,
  special_instructions text check (char_length(special_instructions) <= 1000),
  subtotal_paise       integer not null check (subtotal_paise > 0),
  delivery_fee_paise   integer not null default 0 check (delivery_fee_paise >= 0),
  total_paise          integer not null check (total_paise > 0),
  currency             text not null default 'INR' check (currency = 'INR'),
  payment_method       text not null check (payment_method in ('online', 'offline')),
  requires_approval    boolean not null default false,
  status               public.order_status not null default 'pending',
  payment_status       public.payment_status not null default 'pending',
  rejection_reason     text check (char_length(rejection_reason) <= 500),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint orders_total_matches check (total_paise = subtotal_paise + delivery_fee_paise),
  constraint orders_delivery_address check (fulfilment_method = 'pickup' or delivery_address is not null)
);
create index orders_created_idx  on public.orders (created_at desc);
create index orders_status_idx   on public.orders (status);
create index orders_phone_idx    on public.orders (customer_phone);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  variant_id        uuid references public.product_variants (id) on delete set null,
  flavour_id        uuid references public.product_flavours (id) on delete set null,
  -- Snapshot of what was bought, at the price paid:
  product_name      text not null,
  variant_label     text not null,
  flavour_name      text,
  unit_price_paise  integer not null check (unit_price_paise > 0),
  quantity          integer not null check (quantity between 1 and 100),
  line_total_paise  integer not null,
  custom_message    text check (char_length(custom_message) <= 120),
  instructions      text check (char_length(instructions) <= 500),
  constraint order_items_line_total check (line_total_paise = unit_price_paise * quantity)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  from_status    public.order_status,
  to_status      public.order_status not null,
  payment_status public.payment_status not null,
  note           text,
  changed_by     uuid,
  created_at     timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------
-- Payments (written only by the server with the service role)
-- ---------------------------------------------------------------------
create table public.payment_transactions (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete restrict,
  provider            text not null default 'razorpay' check (provider in ('razorpay')),
  provider_order_id   text not null unique,
  provider_payment_id text unique,
  amount_paise        integer not null check (amount_paise > 0),
  currency            text not null default 'INR',
  status              text not null default 'created'
                        check (status in ('created', 'authorized', 'captured', 'failed', 'refund_pending', 'refunded', 'duplicate')),
  method              text,
  error_description   text,
  refund_id           text,
  duplicate_payment_ids text[] not null default '{}', -- extra captured payments to refund
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index payment_transactions_order_idx on public.payment_transactions (order_id);
create trigger payment_transactions_touch before update on public.payment_transactions
  for each row execute function public.touch_updated_at();

-- Webhook idempotency log (x-razorpay-event-id)
create table public.payment_events (
  provider_event_id text primary key,
  event_type        text not null,
  payload           jsonb not null,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  result            text
);

-- Simple fixed-window rate limiter used by checkout/payment endpoints
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);
