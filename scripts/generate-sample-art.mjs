// Generates PLACEHOLDER illustrations for KRIVA's menu in public/samples/.
// They are labelled "Illustration — photo to come" and should be replaced
// with real photographs from /admin → Products.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const out = new URL("../public/samples/", import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const BG = "#EEF0E5";
const PLATE = "#DCE2D2";
const CHOC = "#3B1F16";
const CHOC2 = "#5B3426";
const CREAM = "#FFF8EE";
const GOLD = "#D2AD62";
const BERRY = "#9C1F33";

const frame = (inner, label, plate = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="${label} (illustration)">
  <defs>
    <linearGradient id="gloss" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".35" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
  </defs>
  <rect width="800" height="1000" fill="${BG}"/>
  ${plate ? `<ellipse cx="400" cy="780" rx="300" ry="44" fill="${PLATE}"/><ellipse cx="400" cy="772" rx="300" ry="40" fill="#E6EADF"/>` : ""}
  ${inner}
  <text x="400" y="930" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#5B655D" letter-spacing="1">Illustration — photo to come</text>
</svg>`;

const marble = (id, base, veins) => `<pattern id="${id}" width="420" height="300" patternUnits="userSpaceOnUse">
  <rect width="420" height="300" fill="${base}"/>
  ${veins.map((c, i) => `<path d="M-20 ${60 + i * 70} C 80 ${10 + i * 70}, 160 ${130 + i * 60}, 260 ${70 + i * 60} S 400 ${30 + i * 80}, 460 ${90 + i * 60}" stroke="${c}" stroke-width="${18 - i * 4}" fill="none" stroke-linecap="round" opacity=".85"/>`).join("")}
</pattern>`;

const art = {
  entremet: frame(`
    <defs>${marble("m1", "#6B1F2E", ["#F3E6D8", "#B5475A", "#2E0B13", GOLD])}</defs>
    <path d="M190 560 Q190 470 400 465 Q610 470 610 560 L610 745 Q400 790 190 745 Z" fill="url(#m1)"/>
    <path d="M190 560 Q190 470 400 465 Q610 470 610 560 L610 745 Q400 790 190 745 Z" fill="url(#shade)"/>
    <path d="M230 520 Q300 480 400 478" stroke="#fff" stroke-opacity=".5" stroke-width="10" fill="none" stroke-linecap="round"/>
    <rect x="200" y="560" width="70" height="180" fill="url(#gloss)" opacity=".6"/>
    ${[[340, 470], [380, 462], [430, 466]].map(([x, y]) => `<path d="M${x} ${y} l18 -14 l14 10 l-10 18 z" fill="${GOLD}"/>`).join("")}
    <circle cx="470" cy="458" r="14" fill="${BERRY}"/>`, "Marble mirror glazed entremet"),
  "entremet-custom": frame(`
    <defs>${marble("m2", "#EFC9CD", ["#FFFFFF", "#D88A97", "#C4A46B"])}</defs>
    <path d="M200 580 Q200 495 400 490 Q600 495 600 580 L600 745 Q400 785 200 745 Z" fill="url(#m2)"/>
    <path d="M200 580 Q200 495 400 490 Q600 495 600 580 L600 745 Q400 785 200 745 Z" fill="url(#shade)"/>
    <path d="M240 540 Q310 505 400 503" stroke="#fff" stroke-opacity=".6" stroke-width="10" fill="none" stroke-linecap="round"/>
    ${[...Array(9)].map((_, i) => `<circle cx="${250 + i * 37.5}" cy="${746 + Math.sin(i) * 2}" r="11" fill="${CREAM}"/>`).join("")}
    <path d="M370 470 q30 -60 60 0 q-30 25 -60 0z" fill="${GOLD}"/>`, "Custom glazed entremet"),
  "mini-cakes": frame([[250, "#7B2335", "#F3E6D8"], [400, "#EFC9CD", "#FFFFFF"], [550, "#CFDCAE", "#FFF8EE"]].map(([x, base, vein], i) => `
    <defs>${marble(`mc${i}`, base, [vein, GOLD])}</defs>
    <path d="M${x - 62} 650 Q${x - 62} 600 ${x} 597 Q${x + 62} 600 ${x + 62} 650 L${x + 62} 760 Q${x} 778 ${x - 62} 760 Z" fill="url(#mc${i})"/>
    <path d="M${x - 62} 650 Q${x - 62} 600 ${x} 597 Q${x + 62} 600 ${x + 62} 650 L${x + 62} 760 Q${x} 778 ${x - 62} 760 Z" fill="url(#shade)"/>
    <circle cx="${x}" cy="590" r="10" fill="${i === 0 ? GOLD : BERRY}"/>`).join(""), "Custom mini cakes"),
  medovik: frame(`
    <path d="M220 470 L580 470 L580 760 L220 760 Z" fill="#E8B96E"/>
    ${[...Array(9)].map((_, i) => `<rect x="220" y="${492 + i * 30}" width="360" height="9" fill="${CREAM}" opacity=".9"/>`).join("")}
    <rect x="220" y="455" width="360" height="22" rx="6" fill="#C98E45"/>
    <rect x="220" y="470" width="360" height="290" fill="url(#shade)"/>
    ${[...Array(30)].map((_, i) => `<circle cx="${232 + ((i * 53) % 340)}" cy="${448 + ((i * 7) % 12)}" r="4" fill="#B57532"/>`).join("")}`, "Honey medovik"),
  "biscoff-cheesecake": frame(`
    <path d="M200 520 L600 520 L600 740 Q400 772 200 740 Z" fill="#FBF0D9"/>
    <rect x="200" y="716" width="400" height="34" fill="#B97B3F"/>
    <path d="M200 520 Q400 488 600 520 L600 552 Q400 520 200 552 Z" fill="#B0682A"/>
    <path d="M220 548 Q260 600 250 640 M330 540 Q350 590 340 610 M470 538 Q490 600 480 650 M560 545 Q575 585 570 600" stroke="#B0682A" stroke-width="12" stroke-linecap="round" fill="none"/>
    ${[290, 400, 510].map((x) => `<g transform="translate(${x} 488) rotate(-12)"><rect x="-38" y="-24" width="76" height="48" rx="6" fill="#C98B4A"/><rect x="-30" y="-16" width="60" height="32" rx="4" fill="none" stroke="#A86D33" stroke-width="3"/></g>`).join("")}
    <rect x="200" y="520" width="400" height="230" fill="url(#shade)"/>`, "Lotus Biscoff cheesecake"),
  tiramisu: frame(`
    <rect x="220" y="490" width="360" height="270" rx="10" fill="#F7EBD8"/>
    <rect x="220" y="560" width="360" height="40" fill="#8A5A3B"/>
    <rect x="220" y="660" width="360" height="40" fill="#8A5A3B"/>
    <rect x="220" y="478" width="360" height="26" rx="8" fill="#6B4430"/>
    ${[...Array(60)].map((_, i) => `<circle cx="${226 + ((i * 37) % 350)}" cy="${476 + ((i * 11) % 22)}" r="3" fill="#4A2C1E"/>`).join("")}
    <rect x="220" y="490" width="360" height="270" fill="url(#shade)"/>`, "Tiramisu"),
  mousse: frame(`
    <path d="M285 470 L515 470 L495 760 L305 760 Z" fill="#FFFFFF" opacity=".55" stroke="#E2D3BE" stroke-width="4"/>
    <path d="M292 560 L508 560 L496 750 L304 750 Z" fill="${CHOC2}"/>
    <path d="M296 520 L504 520 L508 560 L292 560 Z" fill="#7A4A36"/>
    <ellipse cx="400" cy="505" rx="80" ry="26" fill="${CHOC}"/>
    <path d="M360 495 q40 -40 80 0" stroke="${GOLD}" stroke-width="6" fill="none"/>
    <rect x="300" y="480" width="26" height="270" fill="#fff" opacity=".35"/>`, "Dark chocolate mousse", true),
  banoffee: frame(`
    <path d="M200 560 L600 560 L585 745 Q400 775 215 745 Z" fill="#C88A4A"/>
    <path d="M205 600 L595 600 L590 660 L210 660 Z" fill="#A45F25"/>
    <path d="M200 520 Q400 470 600 520 L600 565 Q400 540 200 565 Z" fill="${CREAM}"/>
    ${[260, 330, 400, 470, 540].map((x, i) => `<circle cx="${x}" cy="${515 - (i % 2) * 8}" r="22" fill="#F4E3A1" stroke="#E2CC7C" stroke-width="4"/>`).join("")}
    <path d="M240 505 Q300 490 360 500 Q420 510 480 495 Q530 485 560 500" stroke="#A45F25" stroke-width="6" fill="none"/>`, "Banoffee"),
  "sugar-free-chocolate": frame(`
    ${[[260, 560], [400, 540], [540, 560], [330, 680], [470, 680]].map(([x, y]) => `
      <rect x="${x - 60}" y="${y - 40}" width="120" height="80" rx="10" fill="${CHOC}"/>
      <rect x="${x - 48}" y="${y - 30}" width="96" height="60" rx="6" fill="none" stroke="${CHOC2}" stroke-width="5"/>
      <path d="M${x - 40} ${y - 26} l70 0" stroke="#fff" stroke-opacity=".25" stroke-width="6" stroke-linecap="round"/>`).join("")}`, "Sugar-free dark chocolate"),
  opera: frame(`
    <rect x="230" y="520" width="340" height="230" rx="6" fill="#3B2219"/>
    ${[575, 625, 675, 718].map((y) => `<rect x="230" y="${y}" width="340" height="14" fill="#B98A5E"/>`).join("")}
    <rect x="230" y="508" width="340" height="26" rx="4" fill="#24130E"/>
    <path d="M330 492 q70 -40 140 0" stroke="${GOLD}" stroke-width="6" fill="none"/>
    <path d="M370 470 l14 -10 l12 8 l-8 14 z" fill="${GOLD}"/>`, "Classic opera"),
  eclair: frame(`
    <g transform="rotate(-8 400 640)">
      <rect x="170" y="600" width="460" height="110" rx="55" fill="#D9A15C"/>
      <rect x="170" y="590" width="460" height="62" rx="31" fill="${CHOC}"/>
      <path d="M200 604 Q400 590 600 604" stroke="#fff" stroke-opacity=".3" stroke-width="8" fill="none" stroke-linecap="round"/>
      ${[260, 330, 400, 470, 540].map((x) => `<circle cx="${x}" cy="${590}" r="5" fill="${GOLD}"/>`).join("")}
    </g>`, "Chocolate éclair"),
  "coffee-tart": frame(`
    <ellipse cx="400" cy="650" rx="230" ry="95" fill="#D9A866"/>
    <ellipse cx="400" cy="632" rx="200" ry="74" fill="#8C5A3C"/>
    <ellipse cx="400" cy="628" rx="200" ry="70" fill="#B9845F"/>
    ${[...Array(9)].map((_, i) => { const a = (i / 9) * Math.PI * 2; return `<circle cx="${400 + Math.cos(a) * 140}" cy="${622 + Math.sin(a) * 46}" r="18" fill="${CREAM}"/>`; }).join("")}
    ${[[370, 600], [430, 640], [400, 615]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="14" ry="9" fill="${CHOC}" transform="rotate(30 ${x} ${y})"/>`).join("")}`, "Coffee tart"),
  "caramel-sandwich": frame(`
    <rect x="230" y="660" width="340" height="70" rx="12" fill="${CHOC2}"/>
    <rect x="236" y="612" width="328" height="52" rx="10" fill="#C77B2E"/>
    <path d="M250 664 q20 30 40 0 M350 664 q14 24 28 0 M470 664 q18 28 36 0" fill="#C77B2E"/>
    <rect x="230" y="555" width="340" height="66" rx="12" fill="${CHOC2}"/>
    ${[...Array(12)].map((_, i) => `<circle cx="${262 + (i % 6) * 55}" cy="${575 + Math.floor(i / 6) * 26}" r="5" fill="${CHOC}"/>`).join("")}
    <path d="M260 566 l220 0" stroke="#fff" stroke-opacity=".2" stroke-width="6" stroke-linecap="round"/>`, "Chocolate caramel sandwich"),
  "berry-delice": frame(`
    <path d="M250 560 Q250 520 400 518 Q550 520 550 560 L550 745 Q400 770 250 745 Z" fill="#F6E9F0"/>
    <path d="M250 640 L550 640 L550 670 L250 670 Z" fill="#C2405A" opacity=".85"/>
    <path d="M250 560 Q250 520 400 518 Q550 520 550 560 L550 745 Q400 770 250 745 Z" fill="url(#shade)"/>
    ${[[350, 515, BERRY], [390, 505, "#2E2A5A"], [430, 512, BERRY], [410, 524, BERRY], [370, 526, "#2E2A5A"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="16" fill="${c}"/>`).join("")}
    <path d="M440 500 q16 -18 30 -4 q-14 14 -30 4z" fill="#4F7A3A"/>`, "Berry vanilla delice"),
};

for (const [name, svg] of Object.entries(art)) writeFileSync(new URL(`${name}.svg`, out), svg);

writeFileSync(new URL("../public/brand/intro-poster.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="KRIVA Patisserie">
  <defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#5E7563"/><stop offset="1" stop-color="#2E3C32"/></radialGradient></defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <g fill="none" stroke="#C4A46B" stroke-opacity=".28" stroke-width="2">
    <path d="M560 900 V420 a240 240 0 0 1 480 0 V900"/>
    <path d="M600 900 V430 a200 200 0 0 1 400 0 V900"/>
  </g>
</svg>`);
console.log("Generated", readdirSync(out).length, "menu illustrations");
