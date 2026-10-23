-- =====================================================================
-- KRIVA — dietary tags (eggless / sugar-free) shown as badges and filters
-- =====================================================================
alter table public.products
  add column dietary_tags text[] not null default '{}'
  constraint products_dietary_tags_valid check (dietary_tags <@ array['eggless', 'sugar-free']::text[]);

create index products_dietary_idx on public.products using gin (dietary_tags);
