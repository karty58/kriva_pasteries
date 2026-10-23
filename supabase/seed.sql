-- =====================================================================
-- KRIVA Patisserie — initial data
--
-- Shop details, menu item names and the photos in /public/photos were supplied
-- for KRIVA (23 Oct 2026). Other images are illustrations.
-- PRICES AND SIZES ARE PLACEHOLDERS: every product is inserted with
-- is_sample = true, which the website labels "Placeholder price". Saving a
-- product in /admin clears the flag, so confirm the real price first.
-- =====================================================================

insert into public.categories (name, slug, description, sort_order) values
  ('Birthday Cakes',        'birthday-cakes',        null, 1),
  ('Celebration Cakes',     'celebration-cakes',     'Entremets and celebration cakes.', 2),
  ('Custom Cakes',          'custom-cakes',          'Glazed entremets and mini cakes in your colours and design. Order 1 day ahead.', 3),
  ('Chocolate Cakes',       'chocolate-cakes',       null, 4),
  ('Cheesecakes',           'cheesecakes',           null, 5),
  ('Pastries',              'pastries',              null, 6),
  ('Cupcakes',              'cupcakes',              null, 7),
  ('Brownies and Desserts', 'brownies-and-desserts', null, 8),
  ('Seasonal Specials',     'seasonal-specials',     null, 9)
on conflict (slug) do nothing;

update public.site_settings set
  shop_name = 'KRIVA Patisserie',
  tagline = 'French and European-style desserts and pastries in Coimbatore',
  address = '61, Red Fields Rd, near Race Course, Puliakulam, Coimbatore, Tamil Nadu 641045',
  maps_url = 'https://www.google.com/maps/place/KRIVA+Patisserie/@11.0045838,76.9889161,17z/data=!3m1!4b1!4m6!3m5!1s0x3ba859bb0dabcfe9:0x3edae094a1ee8495!8m2!3d11.0045838!4d76.9889161!16s%2Fg%2F11nvyzwnyg',
  phone = '+91 82705 70052',
  instagram_url = 'https://www.instagram.com/kriva_patisserie/',
  our_story = E'KRIVA Patisserie is a French and European-style dessert and pastry shop in Coimbatore, near the Race Course.\n\nAlongside our signature entremets and pastries we make eggless and sugar-free choices, and glazed entremets and mini cakes in the colours and designs you choose.',
  business_hours = '{"mon": null,
                     "tue": {"open": "14:00", "close": "22:00"}, "wed": {"open": "14:00", "close": "22:00"},
                     "thu": {"open": "14:00", "close": "22:00"}, "fri": {"open": "14:00", "close": "22:00"},
                     "sat": {"open": "14:00", "close": "22:00"}, "sun": {"open": "14:00", "close": "22:00"}}'::jsonb,
  pickup_enabled = true,
  delivery_enabled = false,
  default_lead_time_hours = 0,
  -- Genuine Google reviews (supplied 23 Oct 2026), quoted as written
  testimonials = '[{"quote": "The pastries are fresh, perfectly balanced in sweetness and high quality of baking. Absolutely must-try spot for dessert lovers!!", "name": "Suhail I"}, {"quote": "A very good place to try out something new! People who love chocolate must try their place once! Not too over powering and everything in a perfect balance! Loved it! Their TIRAMISU is a MUSTT TRY 🫶🏻🫶🏻", "name": "Vyuha"}, {"quote": "The dessert was really delicious and fresh. The presentation was excellent. The texture was smooth and enjoyable, Overall, a lovely dessert experience—definitely worth trying!", "name": "Thatchina Moorthy"}, {"quote": "Kriva-la desserts romba tasty-ah irundhuchu 😍✨ Quality, taste, presentation ellame super! Staff-um friendly-ah receive pannanga. Sweet lovers kandippa try pannunga! ❤️🍰", "name": "Anjali Papa"}, {"quote": "I had their blueberry cheesecake. It’s amazing", "name": "Shruti Suresh"}, {"quote": "If you are looking for Premium authentic Desserts and Pastries KRIVA PATTISERRIE is the place❤️✨", "name": "Navinesh"}]'::jsonb
where id = 1;
-- whatsapp_number is intentionally left empty until KRIVA confirms it.

create or replace function pg_temp.menu_item(
  p_category text, p_name text, p_slug text, p_desc text, p_price_rupees integer, p_image text,
  p_featured boolean default false, p_signature boolean default false, p_lead integer default 0,
  p_approval boolean default false, p_diet text[] default '{}'
) returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.products (category_id, name, slug, description, lead_time_hours, requires_approval,
    is_featured, is_signature, dietary_tags, is_sample, allows_custom_message)
  values ((select id from public.categories where slug = p_category), p_name, p_slug, p_desc, p_lead, p_approval,
    p_featured, p_signature, p_diet, true, p_approval)
  on conflict (slug) do nothing
  returning id into v_id;
  if v_id is null then return; end if;
  -- PLACEHOLDER price, single "Regular" size
  insert into public.product_variants (product_id, label, price_paise) values (v_id, 'Regular', p_price_rupees * 100);
  insert into public.product_images (product_id, storage_path, alt_text)
  values (v_id, p_image, p_name || ' (illustration)');
end;
$$;

select pg_temp.menu_item('celebration-cakes', 'Marble Mirror Glazed Entremet', 'marble-mirror-glazed-entremet',
  'A signature KRIVA entremet finished with a marbled mirror glaze.', 1450, '/samples/entremet.svg', true, true);
select pg_temp.menu_item('celebration-cakes', 'Honey Medovik', 'honey-medovik',
  'A signature KRIVA honey medovik.', 420, '/samples/medovik.svg', false, true);
select pg_temp.menu_item('custom-cakes', 'Custom Glazed Entremet', 'custom-glazed-entremet',
  'A glazed entremet in the colours and design you choose. Please order at least 1 day in advance — KRIVA confirms the design and price with you.',
  1650, '/samples/entremet-custom.svg', true, false, 24, true);
select pg_temp.menu_item('custom-cakes', 'Custom Mini Cakes', 'custom-mini-cakes',
  'Mini cakes in the colours and design you choose. Please order at least 1 day in advance — KRIVA confirms the design and price with you.',
  650, '/samples/mini-cakes.svg', false, false, 24, true);
select pg_temp.menu_item('cheesecakes', 'Lotus Biscoff Cheesecake', 'lotus-biscoff-cheesecake',
  'A signature KRIVA Lotus Biscoff cheesecake.', 380, '/samples/biscoff-cheesecake.svg', true, true);
select pg_temp.menu_item('brownies-and-desserts', 'Tiramisu', 'tiramisu',
  'A signature KRIVA tiramisu, available eggless.', 360, '/photos/tiramisu.webp', true, true, 0, false, '{eggless}');
select pg_temp.menu_item('brownies-and-desserts', 'Dark Chocolate Mousse', 'dark-chocolate-mousse',
  'A signature KRIVA dark chocolate mousse.', 320, '/samples/mousse.svg', false, true);
select pg_temp.menu_item('brownies-and-desserts', 'Banoffee', 'banoffee',
  'KRIVA''s banoffee, available eggless.', 340, '/samples/banoffee.svg', false, false, 0, false, '{eggless}');
select pg_temp.menu_item('chocolate-cakes', 'Sugar-free Dark Chocolate', 'sugar-free-dark-chocolate',
  'Sugar-free dark chocolate choices are available. Ask KRIVA what''s in the counter today.', 380,
  '/samples/sugar-free-chocolate.svg', false, false, 0, false, '{sugar-free}');
select pg_temp.menu_item('cupcakes', 'Red Velvet Cupcake', 'red-velvet-cupcake',
  'KRIVA''s red velvet cupcake.', 120, '/photos/red-velvet-cupcakes.webp', true);
select pg_temp.menu_item('pastries', 'Classic Opera', 'classic-opera',
  'A signature KRIVA classic opera.', 320, '/samples/opera.svg', false, true);
select pg_temp.menu_item('pastries', 'Chocolate Éclair', 'chocolate-eclair',
  'A signature KRIVA chocolate éclair.', 220, '/samples/eclair.svg', true, true);
select pg_temp.menu_item('pastries', 'Coffee Tart', 'coffee-tart',
  'A signature KRIVA coffee tart.', 280, '/samples/coffee-tart.svg', false, true);
select pg_temp.menu_item('pastries', 'Chocolate Caramel Sandwich', 'chocolate-caramel-sandwich',
  'A signature KRIVA chocolate caramel sandwich.', 260, '/samples/caramel-sandwich.svg', false, true);
select pg_temp.menu_item('pastries', 'Berry Vanilla Delice', 'berry-vanilla-delice',
  'KRIVA''s berry vanilla delice, available eggless.', 340, '/samples/berry-delice.svg', false, false, 0, false, '{eggless}');
