/**
 * Data shown when Supabase is not connected (preview mode). Mirrors supabase/seed.sql.
 *
 * Shop details and menu item names come from KRIVA Patisserie (supplied 23 Oct 2026).
 * PRICES AND SIZES ARE PLACEHOLDERS (is_sample = true) until KRIVA
 * confirms them; the site labels them as placeholders. Most images are
 * illustrations; photos supplied by KRIVA are in /public/photos. Descriptions state only
 * what KRIVA has said — no invented ingredients.
 */
import { buildCategories, buildProducts, type ProductDef } from "./catalogue-builder";
import type { SiteSettings } from "./types";

const OPEN = { open: "14:00", close: "22:00" };

export const DEFAULT_SETTINGS: SiteSettings = {
  shop_name: "KRIVA Patisserie",
  tagline: "French and European-style desserts and pastries in Coimbatore",
  address: "61, Red Fields Rd, near Race Course, Puliakulam, Coimbatore, Tamil Nadu 641045",
  city: "Coimbatore",
  region: "Tamil Nadu",
  country: "India",
  maps_url:
    "https://www.google.com/maps/place/KRIVA+Patisserie/@11.0045838,76.9889161,17z/data=!3m1!4b1!4m6!3m5!1s0x3ba859bb0dabcfe9:0x3edae094a1ee8495!8m2!3d11.0045838!4d76.9889161!16s%2Fg%2F11nvyzwnyg",
  phone: "+91 82705 70052",
  whatsapp_number: null, // not yet confirmed — set in Admin → Shop settings
  email: null,
  instagram_url: "https://www.instagram.com/kriva_patisserie/",
  facebook_url: null,
  our_story:
    "KRIVA Patisserie is a French and European-style dessert and pastry shop in Coimbatore, near the Race Course.\n\nAlongside our signature entremets and pastries we make eggless and sugar-free choices, and glazed entremets and mini cakes in the colours and designs you choose.",
  business_hours: { mon: null, tue: OPEN, wed: OPEN, thu: OPEN, fri: OPEN, sat: OPEN, sun: OPEN },
  pickup_enabled: true,
  delivery_enabled: false,
  delivery_areas: [],
  delivery_fee_paise: 0,
  free_delivery_above_paise: null,
  min_order_paise: 0,
  default_lead_time_hours: 0,
  order_cutoff_time: null,
  max_advance_days: 45,
  online_payments_enabled: false,
  offline_payments_enabled: true,
  approval_mode: "pay_immediately",
  intro_enabled: true,
  intro_video_url: null,
  intro_poster_url: null,
  seasonal_note: null,
  // Genuine Google reviews of KRIVA Patisserie (supplied 23 Oct 2026), quoted as written
  testimonials: [
    { quote: "The pastries are fresh, perfectly balanced in sweetness and high quality of baking. Absolutely must-try spot for dessert lovers!!", name: "Suhail I" },
    { quote: "A very good place to try out something new! People who love chocolate must try their place once! Not too over powering and everything in a perfect balance! Loved it! Their TIRAMISU is a MUSTT TRY 🫶🏻🫶🏻", name: "Vyuha" },
    { quote: "The dessert was really delicious and fresh. The presentation was excellent. The texture was smooth and enjoyable, Overall, a lovely dessert experience—definitely worth trying!", name: "Thatchina Moorthy" },
    { quote: "Kriva-la desserts romba tasty-ah irundhuchu 😍✨ Quality, taste, presentation ellame super! Staff-um friendly-ah receive pannanga. Sweet lovers kandippa try pannunga! ❤️🍰", name: "Anjali Papa" },
    { quote: "I had their blueberry cheesecake. It’s amazing", name: "Shruti Suresh" },
    { quote: "If you are looking for Premium authentic Desserts and Pastries KRIVA PATTISERRIE is the place❤️✨", name: "Navinesh" },
  ],
  timezone: "Asia/Kolkata",
  currency: "INR",
};

export const DEMO_CATEGORIES = buildCategories();

// Prices are PLACEHOLDERS in paise (49000 = ₹490). Replace from /admin.
const PH = (rupees: number): [string, number][] => [["Regular", rupees * 100]];

const MENU: ProductDef[] = [
  // Celebration & custom
  { cat: "celebration-cakes", name: "Marble Mirror Glazed Entremet", slug: "marble-mirror-glazed-entremet",
    desc: "A signature KRIVA entremet finished with a marbled mirror glaze.",
    variants: PH(1450), image: "/samples/entremet.svg", featured: true, signature: true, lead: 0 },
  { cat: "celebration-cakes", name: "Honey Medovik", slug: "honey-medovik",
    desc: "A signature KRIVA honey medovik.", variants: PH(420), image: "/samples/medovik.svg", signature: true, lead: 0 },
  { cat: "custom-cakes", name: "Custom Glazed Entremet", slug: "custom-glazed-entremet",
    desc: "A glazed entremet in the colours and design you choose. Please order at least 1 day in advance — KRIVA confirms the design and price with you.",
    variants: PH(1650), image: "/samples/entremet-custom.svg", featured: true, message: true, lead: 24, approval: true },
  { cat: "custom-cakes", name: "Custom Mini Cakes", slug: "custom-mini-cakes",
    desc: "Mini cakes in the colours and design you choose. Please order at least 1 day in advance — KRIVA confirms the design and price with you.",
    variants: PH(650), image: "/samples/mini-cakes.svg", lead: 24, approval: true },
  // Cheesecakes & desserts
  { cat: "cheesecakes", name: "Lotus Biscoff Cheesecake", slug: "lotus-biscoff-cheesecake",
    desc: "A signature KRIVA Lotus Biscoff cheesecake.", variants: PH(380), image: "/samples/biscoff-cheesecake.svg", featured: true, signature: true, lead: 0 },
  { cat: "brownies-and-desserts", name: "Tiramisu", slug: "tiramisu",
    desc: "A signature KRIVA tiramisu, available eggless.", variants: PH(360), image: "/photos/tiramisu.webp", imageAlt: "KRIVA tiramisu, dusted with cocoa", featured: true, signature: true, lead: 0, diet: ["eggless"] },
  { cat: "brownies-and-desserts", name: "Dark Chocolate Mousse", slug: "dark-chocolate-mousse",
    desc: "A signature KRIVA dark chocolate mousse.", variants: PH(320), image: "/samples/mousse.svg", signature: true, lead: 0 },
  { cat: "brownies-and-desserts", name: "Banoffee", slug: "banoffee",
    desc: "KRIVA's banoffee, available eggless.", variants: PH(340), image: "/samples/banoffee.svg", lead: 0, diet: ["eggless"] },
  { cat: "chocolate-cakes", name: "Sugar-free Dark Chocolate", slug: "sugar-free-dark-chocolate",
    desc: "Sugar-free dark chocolate choices are available. Ask KRIVA what's in the counter today.",
    variants: PH(380), image: "/samples/sugar-free-chocolate.svg", lead: 0, diet: ["sugar-free"] },
  // Cupcakes
  { cat: "cupcakes", name: "Red Velvet Cupcake", slug: "red-velvet-cupcake",
    desc: "KRIVA's red velvet cupcake.", variants: PH(120), image: "/photos/red-velvet-cupcakes.webp",
    imageAlt: "Red velvet cupcakes with piped cream in the KRIVA counter", featured: true, lead: 0 },
  // Pastries
  { cat: "pastries", name: "Classic Opera", slug: "classic-opera",
    desc: "A signature KRIVA classic opera.", variants: PH(320), image: "/samples/opera.svg", signature: true, lead: 0 },
  { cat: "pastries", name: "Chocolate Éclair", slug: "chocolate-eclair",
    desc: "A signature KRIVA chocolate éclair.", variants: PH(220), image: "/samples/eclair.svg", featured: true, signature: true, lead: 0 },
  { cat: "pastries", name: "Coffee Tart", slug: "coffee-tart",
    desc: "A signature KRIVA coffee tart.", variants: PH(280), image: "/samples/coffee-tart.svg", signature: true, lead: 0 },
  { cat: "pastries", name: "Chocolate Caramel Sandwich", slug: "chocolate-caramel-sandwich",
    desc: "A signature KRIVA chocolate caramel sandwich.", variants: PH(260), image: "/samples/caramel-sandwich.svg", signature: true, lead: 0 },
  { cat: "pastries", name: "Berry Vanilla Delice", slug: "berry-vanilla-delice",
    desc: "KRIVA's berry vanilla delice, available eggless.", variants: PH(340), image: "/samples/berry-delice.svg", lead: 0, diet: ["eggless"] },
];

export const DEMO_PRODUCTS = buildProducts(MENU, DEMO_CATEGORIES);

