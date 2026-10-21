// Generates the SAMPLE product illustrations in public/samples/.
// These are placeholders until KRIVA uploads real photographs from /admin.
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public/samples/", import.meta.url);
mkdirSync(out, { recursive: true });

const BG = "#F3EADB";
const PLATE = "#E9DCC6";

function frame(inner, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="${label} (sample illustration)">
  <rect width="800" height="1000" fill="${BG}"/>
  <ellipse cx="400" cy="780" rx="290" ry="42" fill="${PLATE}"/>
  ${inner}
  <text x="400" y="930" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#6A5F5C" letter-spacing="2">Sample illustration</text>
</svg>`;
}

function layerCake({ sponge, frosting, top, garnish }) {
  return `
  <rect x="190" y="470" width="420" height="300" rx="18" fill="${frosting}"/>
  <rect x="190" y="560" width="420" height="22" fill="${sponge}" opacity=".75"/>
  <rect x="190" y="660" width="420" height="22" fill="${sponge}" opacity=".75"/>
  <ellipse cx="400" cy="470" rx="210" ry="40" fill="${top}"/>
  <path d="M190 470 q20 60 40 0 q20 60 40 0 q20 60 40 0 q20 60 40 0 q20 60 40 0 q20 60 40 0 q20 60 40 0 q20 60 40 0 q20 60 40 0 q20 60 40 0 q10 40 20 0" fill="${top}"/>
  ${garnish}`;
}

const berries = (c) => [300, 350, 400, 450, 500].map((x, i) => `<circle cx="${x}" cy="${452 - (i % 2) * 10}" r="16" fill="${c}"/>`).join("");
const rosettes = (c) => [280, 340, 400, 460, 520].map((x) => `<circle cx="${x}" cy="448" r="14" fill="${c}" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>`).join("");

const cupcakes = (frost, wrap) => [250, 400, 550].map((x) => `
  <path d="M${x - 80} 600 L${x - 60} 770 L${x + 60} 770 L${x + 80} 600 Z" fill="${wrap}"/>
  <path d="M${x - 90} 600 q0 -110 90 -120 q90 10 90 120 Z" fill="${frost}"/>
  <circle cx="${x}" cy="470" r="14" fill="#8A1F2E"/>`).join("");

const art = {
  "berry-cake": frame(layerCake({ sponge: "#F5E6C8", frosting: "#FFF8EF", top: "#F7E7E9", garnish: berries("#8A1F2E") }), "Vanilla berry cake"),
  "chocolate-cake": frame(layerCake({ sponge: "#6E4434", frosting: "#4B2C22", top: "#3A1F18", garnish: rosettes("#5E372A") }), "Chocolate truffle cake"),
  "rose-cake": frame(layerCake({ sponge: "#D7E2B5", frosting: "#F6DDE0", top: "#EFC5CC", garnish: rosettes("#C9737F") }), "Rose pistachio cake"),
  "custom-cake": frame(`
    <rect x="250" y="560" width="300" height="210" rx="14" fill="#FFF8EF"/>
    <rect x="300" y="400" width="200" height="170" rx="12" fill="#F6E9D6"/>
    <ellipse cx="400" cy="400" rx="100" ry="20" fill="#E4D3AE"/>
    <path d="M370 360 q30 -60 60 0 q-30 30 -60 0z" fill="#C4A46B"/>
    <path d="M250 640 h300" stroke="#C4A46B" stroke-width="6"/>`, "Custom designer cake"),
  cheesecake: frame(`
    <path d="M200 520 L600 520 L600 740 Q400 780 200 740 Z" fill="#FBF0D9"/>
    <rect x="200" y="720" width="400" height="40" fill="#C9935B"/>
    <ellipse cx="400" cy="520" rx="200" ry="34" fill="#4E3D7A"/>
    ${[320, 370, 420, 470].map((x) => `<circle cx="${x}" cy="512" r="13" fill="#2F2560"/>`).join("")}`, "Blueberry cheesecake"),
  pastry: frame(`
    <rect x="230" y="520" width="340" height="230" rx="6" fill="#3B2219"/>
    ${[560, 610, 660, 705].map((y) => `<rect x="230" y="${y}" width="340" height="14" fill="#B98A5E"/>`).join("")}
    <rect x="230" y="510" width="340" height="24" rx="4" fill="#2A1712"/>
    <path d="M330 495 q70 -40 140 0" stroke="#C4A46B" stroke-width="6" fill="none"/>`, "Opera pastry"),
  tart: frame(`
    <ellipse cx="400" cy="640" rx="220" ry="90" fill="#D9A866"/>
    <ellipse cx="400" cy="625" rx="190" ry="70" fill="#F4D55E"/>
    <path d="M330 600 q70 -50 140 0" stroke="#FFF8EF" stroke-width="10" fill="none"/>`, "Lemon tart"),
  cupcakes: frame(cupcakes("#FFF4EE", "#9E2F3C"), "Red velvet cupcakes"),
  brownies: frame([[240, 560], [410, 560], [240, 670], [410, 670]].map(([x, y]) => `
    <rect x="${x}" y="${y}" width="150" height="95" rx="8" fill="#3E2318"/>
    <rect x="${x}" y="${y}" width="150" height="18" rx="8" fill="#5B3424"/>`).join(""), "Fudge brownies"),
  "mango-cake": frame(layerCake({ sponge: "#FBE7B5", frosting: "#FFF6E2", top: "#F6B73C", garnish: berries("#E58E1A") }), "Mango cake"),
};

for (const [name, svg] of Object.entries(art)) writeFileSync(new URL(`${name}.svg`, out), svg);

// Intro poster / hero fallback
writeFileSync(new URL("../public/brand/intro-poster.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="KRIVA">
  <defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#7A2638"/><stop offset="1" stop-color="#3B0F19"/></radialGradient></defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <g fill="none" stroke="#C4A46B" stroke-opacity=".28" stroke-width="2">
    <path d="M560 900 V420 a240 240 0 0 1 480 0 V900"/>
    <path d="M600 900 V430 a200 200 0 0 1 400 0 V900"/>
  </g>
</svg>`);
console.log("Generated", Object.keys(art).length, "sample illustrations");
