-- =====================================================================
-- KRIVA — functions, triggers, privileges and Row Level Security
-- =====================================================================

-- True when running as the server (service role) or a DB superuser,
-- i.e. NOT a browser session using the anon key or a user JWT.
create or replace function public.is_privileged()
returns boolean
language sql
stable
as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin');
$$;

-- ---------------------------------------------------------------------
-- Order status rules + stock restoration + payment-status guard
-- ---------------------------------------------------------------------
-- NOTE: deliberately SECURITY INVOKER so is_privileged() sees the real caller.
create or replace function public.orders_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed boolean;
begin
  -- Immutable fields (only the server may rotate the access token)
  if new.reference <> old.reference
     or new.idempotency_key <> old.idempotency_key
     or new.total_paise <> old.total_paise
     or new.subtotal_paise <> old.subtotal_paise
     or new.delivery_fee_paise <> old.delivery_fee_paise
     or new.payment_method <> old.payment_method then
    raise exception 'ORDER_FIELDS_IMMUTABLE';
  end if;
  if new.access_token_hash <> old.access_token_hash and not public.is_privileged() then
    raise exception 'ORDER_FIELDS_IMMUTABLE';
  end if;

  -- Fulfilment status transitions
  if new.status <> old.status then
    allowed := case old.status
      when 'pending'   then new.status in ('confirmed', 'cancelled')
      when 'confirmed' then new.status in ('preparing', 'cancelled')
      when 'preparing' then new.status in ('ready', 'cancelled')
      when 'ready'     then new.status in ('completed', 'cancelled')
      else false
    end;
    if not allowed then
      raise exception 'INVALID_STATUS_TRANSITION:%->%', old.status, new.status;
    end if;

    -- Return tracked stock when an order is cancelled
    if new.status = 'cancelled' then
      update public.products p
         set stock_quantity = p.stock_quantity + x.qty
        from (select product_id, sum(quantity) as qty
                from public.order_items
               where order_id = new.id and product_id is not null
               group by product_id) x
       where p.id = x.product_id and p.stock_quantity is not null;
    end if;
  end if;

  -- Online payment status is owned by verified gateway records only.
  if new.payment_status <> old.payment_status and not public.is_privileged() then
    if old.payment_method = 'online' then
      raise exception 'ONLINE_PAYMENT_STATUS_IS_GATEWAY_CONTROLLED';
    end if;
    if new.payment_status not in ('pending', 'paid', 'cancelled', 'refunded') then
      raise exception 'INVALID_OFFLINE_PAYMENT_STATUS';
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_guard before update on public.orders
  for each row execute function public.orders_guard();

-- Automatic audit trail
create or replace function public.orders_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, payment_status, note, changed_by)
    values (new.id, null, new.status, new.payment_status, 'Order request received', auth.uid());
  elsif new.status <> old.status or new.payment_status <> old.payment_status then
    insert into public.order_status_history (order_id, from_status, to_status, payment_status, note, changed_by)
    values (new.id, old.status, new.status, new.payment_status,
            case when new.status = 'cancelled' and new.rejection_reason is not null
                 then new.rejection_reason end,
            auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_history after insert or update on public.orders
  for each row execute function public.orders_history();

-- ---------------------------------------------------------------------
-- Atomic order creation. Prices are computed and verified by the
-- application server BEFORE calling this; this function also re-checks
-- arithmetic via table constraints and reserves tracked stock.
-- Callable only by the service role.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_sum integer := 0;
  v_updated integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;

  insert into public.orders (
    reference, access_token_hash, idempotency_key, customer_name, customer_phone, customer_email,
    fulfilment_method, delivery_address, delivery_area, requested_for, special_instructions,
    subtotal_paise, delivery_fee_paise, total_paise, payment_method, requires_approval
  ) values (
    p_order->>'reference', p_order->>'access_token_hash', (p_order->>'idempotency_key')::uuid,
    p_order->>'customer_name', p_order->>'customer_phone', nullif(p_order->>'customer_email', ''),
    p_order->>'fulfilment_method', nullif(p_order->>'delivery_address', ''), nullif(p_order->>'delivery_area', ''),
    (p_order->>'requested_for')::timestamptz, nullif(p_order->>'special_instructions', ''),
    (p_order->>'subtotal_paise')::integer, (p_order->>'delivery_fee_paise')::integer,
    (p_order->>'total_paise')::integer, p_order->>'payment_method',
    coalesce((p_order->>'requires_approval')::boolean, false)
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_id, product_id, variant_id, flavour_id, product_name, variant_label, flavour_name,
      unit_price_paise, quantity, line_total_paise, custom_message, instructions
    ) values (
      v_order_id, (v_item->>'product_id')::uuid, (v_item->>'variant_id')::uuid,
      nullif(v_item->>'flavour_id', '')::uuid, v_item->>'product_name', v_item->>'variant_label',
      nullif(v_item->>'flavour_name', ''), (v_item->>'unit_price_paise')::integer,
      (v_item->>'quantity')::integer, (v_item->>'line_total_paise')::integer,
      nullif(v_item->>'custom_message', ''), nullif(v_item->>'instructions', '')
    );
    v_sum := v_sum + (v_item->>'line_total_paise')::integer;

    -- Reserve tracked stock atomically (untracked = NULL quantity)
    update public.products
       set stock_quantity = stock_quantity - (v_item->>'quantity')::integer
     where id = (v_item->>'product_id')::uuid
       and stock_quantity is not null
       and stock_quantity >= (v_item->>'quantity')::integer;
    get diagnostics v_updated = row_count;
    if v_updated = 0 and exists (
         select 1 from public.products
          where id = (v_item->>'product_id')::uuid and stock_quantity is not null) then
      raise exception 'OUT_OF_STOCK:%', v_item->>'product_id';
    end if;
  end loop;

  if v_sum <> (p_order->>'subtotal_paise')::integer then
    raise exception 'SUBTOTAL_MISMATCH';
  end if;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Rate limiter: returns true when the call is allowed.
-- ---------------------------------------------------------------------
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------
revoke all on function public.create_order(jsonb, jsonb) from public;
revoke all on function public.hit_rate_limit(text, integer, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_order(jsonb, jsonb) from anon, authenticated;
    revoke all on function public.hit_rate_limit(text, integer, integer) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.create_order(jsonb, jsonb) to service_role;
    grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.admin_users          enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_variants     enable row level security;
alter table public.product_flavours     enable row level security;
alter table public.product_images       enable row level security;
alter table public.site_settings        enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_events       enable row level security;
alter table public.rate_limits          enable row level security;

-- admin_users: an owner can see their own row (used for the admin check)
create policy admin_users_self_read on public.admin_users
  for select to authenticated using (user_id = auth.uid());

-- Catalogue: public reads active rows; owners manage everything
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active or public.is_admin());
create policy categories_admin_write on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy products_public_read on public.products
  for select to anon, authenticated using (is_active or public.is_admin());
create policy products_admin_write on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy variants_public_read on public.product_variants
  for select to anon, authenticated using (
    public.is_admin() or (is_active and exists (
      select 1 from public.products p where p.id = product_id and p.is_active)));
create policy variants_admin_write on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy flavours_public_read on public.product_flavours
  for select to anon, authenticated using (
    public.is_admin() or (is_active and exists (
      select 1 from public.products p where p.id = product_id and p.is_active)));
create policy flavours_admin_write on public.product_flavours
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy images_public_read on public.product_images
  for select to anon, authenticated using (
    public.is_admin() or exists (
      select 1 from public.products p where p.id = product_id and p.is_active));
create policy images_admin_write on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Settings: public business info is readable; owners update
create policy settings_public_read on public.site_settings
  for select to anon, authenticated using (true);
create policy settings_admin_update on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Orders & items & history: owners only. Customers never query these
-- tables directly — the server looks orders up by reference + secret token.
create policy orders_admin_read on public.orders
  for select to authenticated using (public.is_admin());
create policy orders_admin_update on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy order_items_admin_read on public.order_items
  for select to authenticated using (public.is_admin());

create policy history_admin_read on public.order_status_history
  for select to authenticated using (public.is_admin());

create policy payments_admin_read on public.payment_transactions
  for select to authenticated using (public.is_admin());

-- payment_events and rate_limits: no policies => no browser access at all.

-- Column-level privileges: owners may only change workflow fields on orders.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke insert, update, delete on public.orders from anon, authenticated;
    grant update (status, payment_status, rejection_reason) on public.orders to authenticated;
    revoke insert, update, delete on public.order_items, public.order_status_history,
      public.payment_transactions, public.payment_events, public.rate_limits from anon, authenticated;
    revoke select on public.payment_events, public.rate_limits from anon, authenticated;
    revoke insert, update, delete on public.admin_users from anon, authenticated;
  end if;
end;
$$;
