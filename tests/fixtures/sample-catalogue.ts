/**
 * TEST FIXTURE ONLY — invented products with sizes, flavours, a sold-out item
 * and an approval-required item, so pricing and checkout rules can be tested
 * independently of KRIVA's real menu.
 */
import { buildCategories, buildProducts, type ProductDef } from "@/lib/catalogue-builder";

const defs: ProductDef[] = [
  { cat: "birthday-cakes", name: "Sample Vanilla Berry Birthday Cake", slug: "sample-vanilla-berry-birthday-cake", desc: "Fixture.",
    variants: [["500 g", 89900], ["1 kg", 169900], ["2 kg", 319900]], flavours: [["Vanilla", 0], ["Strawberry", 0]],
    image: "/samples/berry-cake.svg", featured: true, bestseller: true, message: true },
  { cat: "chocolate-cakes", name: "Sample Dark Chocolate Truffle Cake", slug: "sample-dark-chocolate-truffle-cake", desc: "Fixture.",
    variants: [["500 g", 99900], ["1 kg", 189900]], flavours: [["Classic", 0], ["Hazelnut", 15000]],
    image: "/samples/chocolate-cake.svg", featured: true, bestseller: true, signature: true, message: true },
  { cat: "custom-cakes", name: "Sample Custom Designer Cake", slug: "sample-custom-designer-cake", desc: "Fixture.",
    variants: [["1 kg (starting)", 249900], ["2 kg (starting)", 459900]], image: "/samples/custom-cake.svg",
    featured: true, message: true, lead: 72, approval: true },
  { cat: "pastries", name: "Sample Classic Opera Pastry", slug: "sample-classic-opera-pastry", desc: "Fixture.",
    variants: [["Single", 18900], ["Box of 4", 69900]], image: "/samples/opera.svg", signature: true, lead: 0 },
  { cat: "pastries", name: "Sample Lemon Tart", slug: "sample-lemon-tart", desc: "Fixture.",
    variants: [["Single", 16900]], image: "/samples/coffee-tart.svg", lead: 0, stock: "sold_out" },
];

export const FIXTURE_CATEGORIES = buildCategories();
export const FIXTURE_PRODUCTS = buildProducts(defs, FIXTURE_CATEGORIES);
