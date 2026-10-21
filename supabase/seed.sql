-- =====================================================================
-- KRIVA — development seed data
--
-- Categories below are the initial categories requested for launch.
-- EVERY PRODUCT BELOW IS SAMPLE DATA (is_sample = true): names, prices,
-- sizes, flavours and ingredients are placeholders, NOT real KRIVA
-- prices or recipes. Replace or delete them from /admin before launch.
-- =====================================================================

insert into public.categories (name, slug, description, sort_order) values
  ('Birthday Cakes',        'birthday-cakes',        'Cakes made for birthdays.', 1),
  ('Celebration Cakes',     'celebration-cakes',     'Anniversaries, engagements and milestones.', 2),
  ('Custom Cakes',          'custom-cakes',          'Designed with you, made to order.', 3),
  ('Chocolate Cakes',       'chocolate-cakes',       null, 4),
  ('Cheesecakes',           'cheesecakes',           null, 5),
  ('Pastries',              'pastries',              null, 6),
  ('Cupcakes',              'cupcakes',              null, 7),
  ('Brownies and Desserts', 'brownies-and-desserts', null, 8),
  ('Seasonal Specials',     'seasonal-specials',     null, 9)
on conflict (slug) do nothing;

-- Helper to insert a sample product with variants, flavours and an image
create or replace function pg_temp.sample_product(
  p_category text, p_name text, p_slug text, p_desc text,
  p_variants jsonb, p_flavours jsonb, p_image text,
  p_featured boolean default false, p_bestseller boolean default false,
  p_signature boolean default false, p_message boolean default false,
  p_lead integer default 24, p_approval boolean default false,
  p_stock public.stock_status default 'in_stock'
) returns void language plpgsql as $$
declare v_id uuid; v jsonb; i integer := 0;
begin
  insert into public.products (category_id, name, slug, description, allows_custom_message,
    lead_time_hours, requires_approval, is_featured, is_bestseller, is_signature, stock_status,
    ingredients, allergens, is_sample)
  values ((select id from public.categories where slug = p_category), p_name, p_slug,
    p_desc || ' (Sample product — replace with real KRIVA details.)',
    p_message, p_lead, p_approval, p_featured, p_bestseller, p_signature, p_stock,
    'Sample ingredients — to be supplied by KRIVA.', 'Sample allergen note — to be supplied by KRIVA.', true)
  on conflict (slug) do nothing
  returning id into v_id;
  if v_id is null then return; end if;

  for v in select * from jsonb_array_elements(p_variants) loop
    insert into public.product_variants (product_id, label, price_paise, sort_order)
    values (v_id, v->>'label', (v->>'price')::integer, i);
    i := i + 1;
  end loop;
  i := 0;
  for v in select * from jsonb_array_elements(coalesce(p_flavours, '[]'::jsonb)) loop
    insert into public.product_flavours (product_id, name, extra_price_paise, sort_order)
    values (v_id, v->>'name', coalesce((v->>'extra')::integer, 0), i);
    i := i + 1;
  end loop;
  insert into public.product_images (product_id, storage_path, alt_text, sort_order)
  values (v_id, p_image, p_name || ' (sample illustration)', 0);
end;
$$;

-- Prices are in paise. 89900 = ₹899.00  (SAMPLE VALUES ONLY)
select pg_temp.sample_product('birthday-cakes', 'Sample Vanilla Berry Birthday Cake', 'sample-vanilla-berry-birthday-cake',
  'Light vanilla sponge layered with berry compote and whipped cream.',
  '[{"label":"500 g","price":89900},{"label":"1 kg","price":169900},{"label":"2 kg","price":319900}]',
  '[{"name":"Vanilla"},{"name":"Strawberry"}]', '/samples/berry-cake.svg', true, true, false, true);

select pg_temp.sample_product('chocolate-cakes', 'Sample Dark Chocolate Truffle Cake', 'sample-dark-chocolate-truffle-cake',
  'Chocolate sponge with a glossy ganache finish.',
  '[{"label":"500 g","price":99900},{"label":"1 kg","price":189900}]',
  '[{"name":"Classic"},{"name":"Hazelnut","extra":15000}]', '/samples/chocolate-cake.svg', true, true, true, true);

select pg_temp.sample_product('celebration-cakes', 'Sample Rose Pistachio Celebration Cake', 'sample-rose-pistachio-celebration-cake',
  'Pistachio sponge with rose cream and a delicate floral finish.',
  '[{"label":"1 kg","price":219900},{"label":"2 kg","price":419900}]',
  null, '/samples/rose-cake.svg', true, false, true, true, 48);

select pg_temp.sample_product('custom-cakes', 'Sample Custom Designer Cake', 'sample-custom-designer-cake',
  'Tell us your theme and we will design it with you. Final price is confirmed by KRIVA before payment.',
  '[{"label":"1 kg (starting)","price":249900},{"label":"2 kg (starting)","price":459900}]',
  null, '/samples/custom-cake.svg', true, false, false, true, 72, true);

select pg_temp.sample_product('cheesecakes', 'Sample Baked Blueberry Cheesecake', 'sample-baked-blueberry-cheesecake',
  'Creamy baked cheesecake with blueberry topping.',
  '[{"label":"Slice","price":24900},{"label":"Whole (800 g)","price":149900}]',
  null, '/samples/cheesecake.svg', false, true, false, false, 24);

select pg_temp.sample_product('pastries', 'Sample Classic Opera Pastry', 'sample-classic-opera-pastry',
  'Almond sponge, coffee buttercream and chocolate glaze.',
  '[{"label":"Single","price":18900},{"label":"Box of 4","price":69900}]',
  null, '/samples/pastry.svg', true, true, true, false, 0);

select pg_temp.sample_product('pastries', 'Sample Lemon Tart', 'sample-lemon-tart',
  'Buttery tart shell with lemon curd.',
  '[{"label":"Single","price":16900}]',
  null, '/samples/tart.svg', false, false, true, false, 0, false, 'sold_out');

select pg_temp.sample_product('cupcakes', 'Sample Red Velvet Cupcakes', 'sample-red-velvet-cupcakes',
  'Red velvet cupcakes with cream cheese frosting.',
  '[{"label":"Box of 6","price":54900},{"label":"Box of 12","price":104900}]',
  '[{"name":"Red Velvet"},{"name":"Chocolate"}]', '/samples/cupcakes.svg', false, true, false, false, 24);

select pg_temp.sample_product('brownies-and-desserts', 'Sample Fudge Brownie Box', 'sample-fudge-brownie-box',
  'Dense chocolate brownies.',
  '[{"label":"Box of 4","price":39900},{"label":"Box of 9","price":84900}]',
  null, '/samples/brownies.svg', false, false, false, false, 12);

select pg_temp.sample_product('seasonal-specials', 'Sample Seasonal Mango Cake', 'sample-seasonal-mango-cake',
  'A seasonal special shown as an example of seasonal items.',
  '[{"label":"1 kg","price":179900}]',
  null, '/samples/mango-cake.svg', false, false, false, true, 24);
