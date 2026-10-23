/**
 * Procedural 3D cake on a cake stand, rendered with three.js.
 *
 * Framework-free on purpose: the Next.js component and the static preview
 * both call createCakeScene(THREE, canvas, design). The cake is built from
 * primitives (no model files to download), so changing an option rebuilds
 * it instantly.
 */
import type * as ThreeNS from "three";
import { FROSTINGS, type CakeDesign } from "./design";

type THREE = typeof ThreeNS;

export interface CakeSceneHandle {
  setDesign(design: CakeDesign): void;
  dispose(): void;
}

export interface CakeSceneOptions {
  /** Slowly turn the cake when nobody is dragging it. */
  autoRotate?: boolean;
}

/** Small seeded random generator so the cake looks the same on every load. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIER_SPECS: Record<1 | 2 | 3, { r: number; h: number }[]> = {
  1: [{ r: 1.25, h: 0.82 }],
  2: [{ r: 1.3, h: 0.9 }, { r: 0.88, h: 0.78 }],
  3: [{ r: 1.32, h: 0.8 }, { r: 0.98, h: 0.7 }, { r: 0.66, h: 0.6 }],
};

/** Two-tone buttercream cakes are tall and straight-sided, like a modern celebration cake. */
function tierSpecs(d: CakeDesign) {
  if (d.drip !== "ombre") return TIER_SPECS[d.tiers];
  if (d.tiers === 1) return [{ r: 1.0, h: 1.8 }];
  return TIER_SPECS[d.tiers].map((t) => ({ r: t.r * 0.95, h: t.h * 1.25 }));
}

const PLATE_R = 1.75;
const STAND_TOP = 0.62;

export function createCakeScene(
  T: THREE,
  canvas: HTMLCanvasElement,
  initial: CakeDesign,
  options: CakeSceneOptions = {},
): CakeSceneHandle | null {
  let renderer: ThreeNS.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null; // WebGL unavailable: caller keeps its fallback image
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 100);

  // Soft studio reflections (built in code, nothing to download) so gold and glaze read as shiny
  const pmrem = new T.PMREMGenerator(renderer);
  const envScene = buildStudio(T);
  const envMap = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.55;
  disposeTree(envScene);
  pmrem.dispose();

  // Lighting: warm key from the front-right, soft fill, burgundy-tinted bounce, cool rim
  scene.add(new T.HemisphereLight(0xfff4e8, 0x8a3a4a, 0.9));
  const key = new T.DirectionalLight(0xfff1df, 2.6);
  key.position.set(3.5, 7, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -2;
  key.shadow.radius = 4;
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new T.DirectionalLight(0xffd9e0, 1.4);
  rim.position.set(-4, 4, -5);
  scene.add(rim);
  const fill = new T.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, 2, 4);
  scene.add(fill);

  // Soft contact shadow on the "table"
  const ground = new T.Mesh(new T.PlaneGeometry(12, 12), new T.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const turntable = new T.Group(); // rotates with the user's drag
  scene.add(turntable);
  turntable.add(buildStand(T));
  let cake = new T.Group();
  turntable.add(cake);

  let design = initial;
  let cakeHeight = 0;

  function rebuild(next: CakeDesign) {
    turntable.remove(cake);
    disposeTree(cake);
    const built = buildCake(T, next);
    cake = built.group;
    cakeHeight = built.height;
    turntable.add(cake);
    design = next;
    fitCamera();
  }

  // ---- Camera framing -------------------------------------------------
  let width = 1;
  let height = 1;
  function fitCamera() {
    const top = STAND_TOP + cakeHeight + 0.25;
    const target = new T.Vector3(0, top * 0.5, 0);
    const vHalf = T.MathUtils.degToRad(camera.fov / 2);
    const halfH = top / 2 + 0.35;
    const halfW = PLATE_R + 0.3;
    const dist = Math.max(halfH / Math.tan(vHalf), halfW / (Math.tan(vHalf) * camera.aspect)) + PLATE_R * 0.6;
    const elev = T.MathUtils.degToRad(15);
    camera.position.set(0, target.y + Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(target);
  }
  function resize() {
    const parent = canvas.parentElement;
    width = Math.max(1, parent?.clientWidth ?? canvas.clientWidth);
    height = Math.max(1, parent?.clientHeight ?? canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fitCamera();
    requestRender();
  }

  // ---- Interaction: drag / swipe / arrow keys to turn --------------------
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const autoRotate = (options.autoRotate ?? true) && !reduceMotion;
  let yaw = -0.5;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let idleFor = 10;

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    velocity = 0;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
    requestRender();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    const delta = (dx / Math.max(width, 1)) * Math.PI * 1.6;
    yaw += delta;
    velocity = delta * 60;
    idleFor = 0;
    requestRender();
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
    canvas.style.cursor = "grab";
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      yaw += e.key === "ArrowLeft" ? -0.25 : 0.25;
      idleFor = 0;
      requestRender();
    }
  };
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "pan-y"; // vertical swipes still scroll the page
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("keydown", onKey);

  // ---- Render loop (pauses when off-screen or the tab is hidden) -------
  let raf = 0;
  let visible = true;
  let last = performance.now();
  let pop = 1; // small scale "pop" when the design changes

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    idleFor += dt;
    if (!dragging) {
      yaw += velocity * dt;
      velocity *= Math.pow(0.04, dt); // inertia
      if (Math.abs(velocity) < 0.002) velocity = 0;
      if (autoRotate && idleFor > 2.5) yaw += 0.22 * dt;
    }
    turntable.rotation.y = yaw;
    if (pop < 1) {
      pop = Math.min(1, pop + dt * 3.5);
      const s = 0.94 + 0.06 * easeOutBack(pop);
      cake.scale.setScalar(s);
    }
    renderer.render(scene, camera);
    const moving = dragging || velocity !== 0 || pop < 1 || (autoRotate && idleFor > 2.5);
    if (visible && moving) raf = requestAnimationFrame(frame);
  }
  function requestRender() {
    if (!raf && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  const io = typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting && !document.hidden;
        if (visible) requestRender();
      })
    : null;
  io?.observe(canvas);
  const onVisibility = () => {
    visible = !document.hidden;
    if (visible) requestRender();
  };
  document.addEventListener("visibilitychange", onVisibility);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(canvas.parentElement ?? canvas);

  rebuild(design);
  resize();

  return {
    setDesign(next) {
      if (JSON.stringify(next) === JSON.stringify(design)) return;
      rebuild(next);
      if (!reduceMotion) pop = 0;
      requestRender();
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("keydown", onKey);
      disposeTree(scene);
      envMap.dispose();
      renderer.dispose();
    },
  };
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function disposeTree(root: ThreeNS.Object3D) {
  root.traverse((o) => {
    const m = o as ThreeNS.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        (mat as ThreeNS.MeshStandardMaterial | undefined)?.map?.dispose();
        mat?.dispose();
      });
    }
  });
}

/** A small light-box: warm walls with a few bright panels, used only for reflections. */
function buildStudio(T: THREE) {
  const env = new T.Scene();
  const room = new T.Mesh(new T.BoxGeometry(10, 8, 10), new T.MeshBasicMaterial({ color: 0xb59a88, side: T.BackSide }));
  room.position.y = 3;
  env.add(room);
  const panel = (w: number, h: number, color: number, intensity: number, pos: [number, number, number]) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(intensity) }));
    m.position.set(...pos);
    m.lookAt(0, 1, 0);
    env.add(m);
  };
  panel(4, 2.5, 0xfff3e2, 6, [0, 6.5, 2]); // soft box overhead
  panel(2.5, 3, 0xffffff, 4, [4.5, 3, 3]); // key side
  panel(2, 3, 0xffe2e6, 2.5, [-4.5, 2.5, -2]); // pink rim
  panel(3, 1.2, 0xfff8ee, 2, [0, 1, 4.8]); // front fill
  return env;
}

/** Irregular little polygon, like a torn flake of gold leaf. */
function flakeGeometry(T: THREE, rand: () => number, size: number) {
  const shape = new T.Shape();
  const n = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = size * (0.55 + rand() * 0.6);
    const x = Math.cos(a) * r * 1.3;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new T.ShapeGeometry(shape);
}

// ---------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------

function buildStand(T: THREE) {
  const g = new T.Group();
  const ceramic = new T.MeshPhysicalMaterial({ color: 0xf8f2e8, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const gold = new T.MeshStandardMaterial({ color: 0xd8b56e, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.5 });

  // Pedestal: foot + stem, turned as one lathe profile
  const profile = [
    [0, 0], [0.82, 0], [0.86, 0.03], [0.8, 0.07], [0.3, 0.14], [0.2, 0.22],
    [0.17, 0.45], [0.22, 0.52], [0.5, 0.56], [0, 0.56],
  ].map(([x, y]) => new T.Vector2(x, y));
  const pedestal = new T.Mesh(new T.LatheGeometry(profile, 72), ceramic);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  g.add(pedestal);

  const plate = new T.Mesh(new T.CylinderGeometry(PLATE_R, PLATE_R - 0.04, 0.07, 96), ceramic);
  plate.position.y = STAND_TOP - 0.035;
  plate.castShadow = true;
  plate.receiveShadow = true;
  g.add(plate);

  const rimRing = new T.Mesh(new T.TorusGeometry(PLATE_R, 0.022, 12, 128), gold);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = STAND_TOP;
  g.add(rimRing);
  return g;
}

/** Cylinder with softly rounded top and bottom edges, like a frosted tier. */
function tierGeometry(T: THREE, r: number, h: number) {
  const bev = 0.07;
  const pts: ThreeNS.Vector2[] = [new T.Vector2(0, 0), new T.Vector2(r - bev, 0)];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    pts.push(new T.Vector2(r - bev + Math.cos(a) * bev, bev + Math.sin(a) * bev));
  }
  for (let i = 1; i < 8; i++) pts.push(new T.Vector2(r, bev + ((h - 2 * bev) * i) / 8));
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new T.Vector2(r - bev + Math.cos(a) * bev, h - bev + Math.sin(a) * bev));
  }
  pts.push(new T.Vector2(0, h));
  return new T.LatheGeometry(pts, 96);
}

/** Marble swirl texture for the mirror glaze, drawn on a canvas in the frosting colour. */
function marbleTexture(T: THREE, base: ThreeNS.Color, rand: () => number) {
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const light = hsl.l > 0.6;
  const hex = (col: ThreeNS.Color) => `#${col.getHexString()}`;
  g.fillStyle = hex(base);
  g.fillRect(0, 0, W, H);

  // A vein is a smooth, mostly vertical flow (top of the cake to the bottom)
  // built from two sine waves, so it reads as poured glaze, not zigzags.
  const vein = (x0: number, amp: number, width: number, color: string, alpha: number) => {
    const f1 = 0.006 + rand() * 0.006;
    const f2 = 0.017 + rand() * 0.01;
    const p1 = rand() * Math.PI * 2;
    const p2 = rand() * Math.PI * 2;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let y = -20; y <= H + 20; y += 8) {
      const x = x0 + Math.sin(y * f1 + p1) * amp + Math.sin(y * f2 + p2) * amp * 0.35;
      const w = width * (0.55 + 0.45 * Math.sin(y * 0.011 + p2));
      left.push([x - w / 2, y]);
      right.push([x + w / 2, y]);
    }
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.beginPath();
    left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    right.reverse().forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    g.fill();
  };
  const xs = (n: number) => Array.from({ length: n }, (_, i) => ((i + 0.5 + (rand() - 0.5) * 0.6) / n) * W);

  const deep = hex(base.clone().offsetHSL(0, 0.02, light ? -0.2 : -0.13));
  const pale = hex(base.clone().offsetHSL(0, -0.08, light ? 0.08 : 0.22));
  const canFilter = "filter" in g;

  // 1) broad soft bands for depth
  if (canFilter) g.filter = "blur(18px)";
  xs(5).forEach((x) => vein(x, 70, 90 + rand() * 70, deep, 0.55));
  xs(4).forEach((x) => vein(x + 60, 60, 70 + rand() * 50, pale, 0.5));
  // 2) cream ribbons
  if (canFilter) g.filter = "blur(3px)";
  xs(4).forEach((x) => vein(x + 30, 55, 14 + rand() * 16, "#f6eadb", 0.85));
  // 3) fine gold threads
  if (canFilter) g.filter = "blur(0.6px)";
  xs(3).forEach((x) => vein(x - 40, 45, 3 + rand() * 2, "#d8b56e", 0.9));
  g.globalAlpha = 1;
  if (canFilter) g.filter = "none";

  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = T.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Spread the texture evenly: sides use the lower 75% (wrapped around), the top is mapped flat. */
function remapGlazeUVs(geo: ThreeNS.BufferGeometry, r: number, h: number) {
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const yv = pos.getY(i);
    const z = pos.getZ(i);
    const rho = Math.hypot(x, z);
    const onTop = yv > h - 0.08 && rho < r - 0.02;
    if (onTop) {
      // Flat (planar) mapping on the top so the marble doesn't pinch at the centre
      uv.setXY(i, 0.35 + (x / r) * 0.18, 0.86 + (z / r) * 0.12);
    } else {
      uv.setY(i, (yv / h) * 0.75);
    }
  }
  uv.needsUpdate = true;
}

/**
 * Two-tone buttercream: white on top, the chosen colour on the lower part,
 * meeting in a soft, palette-knife-brushed edge. Uses the same UV layout as
 * remapGlazeUVs (side: v = 0..0.75 bottom to top; top: v ≈ 0.75..1).
 */
function ombreTexture(T: THREE, base: ThreeNS.Color, rand: () => number) {
  const W = 512;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const hex = (col: ThreeNS.Color) => `#${col.getHexString()}`;
  const white = "#fcf8f3";
  const lower = hex(base);
  const edge = H * 0.66; // ≈ 45% of the way up the side
  const canFilter = "filter" in g;

  g.fillStyle = white;
  g.fillRect(0, 0, W, H);
  const blend = g.createLinearGradient(0, edge - 5, 0, edge + 5);
  blend.addColorStop(0, white);
  blend.addColorStop(1, lower);
  g.fillStyle = blend;
  g.fillRect(0, edge - 5, W, 10);
  g.fillStyle = lower;
  g.fillRect(0, edge + 5, W, H - edge - 5);

  // Brushed strokes either side of the edge, wrapped so the seam is invisible
  if (canFilter) g.filter = "blur(4px)";
  for (let i = 0; i < 70; i++) {
    const y = edge - 4 - rand() * 16;
    const x = rand() * W;
    const w = 40 + rand() * 160;
    const h = 3 + rand() * 6;
    g.globalAlpha = 0.15 + rand() * 0.4;
    g.fillStyle = lower;
    g.fillRect(x, y, w, h);
    g.fillRect(x - W, y, w, h);
  }
  // Faint horizontal scraper lines across the whole side
  if (canFilter) g.filter = "blur(1px)";
  for (let i = 0; i < 70; i++) {
    const y = H * 0.25 + rand() * H * 0.75;
    g.globalAlpha = 0.05 + rand() * 0.06;
    g.fillStyle = rand() < 0.5 ? "#ffffff" : hex(base.clone().offsetHSL(0, 0, -0.12));
    g.fillRect(0, y, W, 1 + rand() * 2);
  }
  // A whisper of edible shimmer
  if (canFilter) g.filter = "none";
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.25 + rand() * 0.4;
    g.fillStyle = "#ffffff";
    g.fillRect(rand() * W, rand() * H, 1.2, 1.2);
  }
  g.globalAlpha = 1;

  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = T.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Classic heart curve, about `size` wide, centred on the origin. */
function heartPoints(T: THREE, size: number, scale = 1) {
  const pts: ThreeNS.Vector2[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(new T.Vector2((x / 32) * size * scale, ((y + 2.5) / 32) * size * scale));
  }
  return pts;
}

/** Mirror-gold acrylic heart: an outline (with a hole) or solid. */
function heartGeometry(T: THREE, size: number, outline: boolean) {
  const shape = new T.Shape(heartPoints(T, size));
  if (outline) shape.holes.push(new T.Path(heartPoints(T, size, 0.88)));
  const geo = new T.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -0.006);
  return geo;
}

/** A piped buttercream rosette: a star-nozzle swirl spiralling out from the centre. */
function rosetteGeometry(T: THREE, size: number) {
  const pts: ThreeNS.Vector3[] = [];
  const turns = 2.1;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const a = t * turns * Math.PI * 2;
    const rr = size * (0.06 + t * 0.78);
    pts.push(new T.Vector3(Math.cos(a) * rr, size * 0.42 * (1 - t) ** 1.4 + size * 0.2, Math.sin(a) * rr));
  }
  const star = new T.Shape();
  const n = 7;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = (i % 2 ? 0.68 : 1) * size * 0.26;
    if (i === 0) star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  star.closePath();
  return new T.ExtrudeGeometry(star, { steps: 64, bevelEnabled: false, extrudePath: new T.CatmullRomCurve3(pts) });
}

/** A rose built from rings of cupped petals; petal edges blush towards `edge`. */
function buildRose(T: THREE, size: number, inner: ThreeNS.Color, edge: ThreeNS.Color, rand: () => number) {
  const rose = new T.Group();
  const mat = new T.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.55,
    sheen: 0.7,
    sheenRoughness: 0.4,
    sheenColor: new T.Color(0xffffff),
    side: T.DoubleSide,
  });
  const rings = [
    { r: 0.28, count: 3, open: 0.22 },
    { r: 0.48, count: 5, open: 0.36 },
    { r: 0.7, count: 6, open: 0.48 },
    { r: 0.95, count: 8, open: 0.6 },
  ];
  const tmp = new T.Color();
  rings.forEach((ring, k) => {
    const rr = ring.r * size;
    const thetaStart = ring.open * Math.PI;
    const thetaEnd = Math.PI * 0.94;
    const phiLen = ((Math.PI * 2) / ring.count) * 1.3;
    const offset = rand() * Math.PI * 2;
    for (let p = 0; p < ring.count; p++) {
      const geo = new T.SphereGeometry(rr, 8, 6, -phiLen / 2, phiLen, thetaStart, thetaEnd - thetaStart);
      const pos = geo.getAttribute("position");
      const colors = new Float32Array(pos.count * 3);
      const cTop = Math.cos(thetaStart);
      const cBot = Math.cos(thetaEnd);
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) / rr - cBot) / (cTop - cBot); // 1 at the petal's edge
        const blush = Math.min(1, Math.max(0, (t - 0.62) / 0.38)) ** 1.3;
        tmp.copy(inner).lerp(edge, blush * (0.55 + k * 0.15));
        colors.set([tmp.r, tmp.g, tmp.b], i * 3);
      }
      geo.setAttribute("color", new T.BufferAttribute(colors, 3));
      const petal = new T.Mesh(geo, mat);
      petal.rotation.y = offset + (p / ring.count) * Math.PI * 2;
      petal.position.y = rr * 0.86;
      petal.scale.setScalar(1 + (rand() - 0.5) * 0.12);
      petal.castShadow = true;
      rose.add(petal);
    }
  });
  return rose;
}

/** Flat leaf with a slight fold down the middle. */
function leafGeometry(T: THREE, length: number) {
  const w = length * 0.42;
  const shape = new T.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(w, length * 0.45, 0, length);
  shape.quadraticCurveTo(-w, length * 0.45, 0, 0);
  const geo = new T.ShapeGeometry(shape, 8);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) * 0.5);
  geo.computeVertexNormals();
  return geo;
}

const UP = { x: 0, y: 1, z: 0 };

/** Point an object's local +Y along `dir` (used to tilt flowers and rosettes). */
function aim(T: THREE, obj: ThreeNS.Object3D, dir: ThreeNS.Vector3) {
  obj.quaternion.setFromUnitVectors(new T.Vector3(UP.x, UP.y, UP.z), dir.clone().normalize());
}

interface TierPlacement {
  r: number;
  h: number;
  y: number;
}

/**
 * "Roses, rosettes & gold hearts": piped rosettes along the top edge, a
 * posy of roses and baby's breath, a gold double-heart topper, gold outline
 * hearts on the side, roses and rosettes at the base, and gold pearls.
 */
function decorateRoses(T: THREE, group: ThreeNS.Group, placed: TierPlacement[], topY: number, rand: () => number) {
  const top = placed[placed.length - 1];
  const base = placed[0];
  const gold = new T.MeshStandardMaterial({ color: 0xffdf86, metalness: 0.85, roughness: 0.18, envMapIntensity: 2, emissive: 0xc0922f, emissiveIntensity: 0.55 });
  const pearlMat = new T.MeshStandardMaterial({ color: 0xffdc82, metalness: 0.85, roughness: 0.22, envMapIntensity: 1.8, emissive: 0xc0922f, emissiveIntensity: 0.5 });
  const piped = (hex: number) =>
    new T.MeshPhysicalMaterial({ color: hex, roughness: 0.6, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new T.Color(0xffffff) });
  const hotPink = piped(0xe2479a);
  const peach = piped(0xf6a98c);
  const lightPeach = piped(0xf9c4ab);
  const leafMat = new T.MeshStandardMaterial({ color: 0x3f6b34, roughness: 0.45, side: T.DoubleSide });
  const blossom = new T.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.8 });
  const stemMat = new T.MeshStandardMaterial({ color: 0x7d8a4e, roughness: 0.8 });
  const cream = new T.Color(0xfbf1e1);
  const butter = new T.Color(0xf6e2a4);
  const pink = new T.Color(0xe46a92);

  const around = (a: number, rr: number, y: number) => new T.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr);
  const outward = (a: number, up: number) => new T.Vector3(Math.sin(a), up, Math.cos(a));

  const rosette = (size: number, mat: ThreeNS.Material, at: ThreeNS.Vector3, dir: ThreeNS.Vector3) => {
    const m = new T.Mesh(rosetteGeometry(T, size), mat);
    m.position.copy(at);
    aim(T, m, dir);
    m.castShadow = true;
    group.add(m);
  };
  const rose = (size: number, inner: ThreeNS.Color, edge: ThreeNS.Color, at: ThreeNS.Vector3, dir: ThreeNS.Vector3) => {
    const r = buildRose(T, size, inner, edge, rand);
    r.position.copy(at);
    aim(T, r, dir);
    group.add(r);
  };
  const leaf = (len: number, at: ThreeNS.Vector3, dir: ThreeNS.Vector3, spin: number) => {
    const m = new T.Mesh(leafGeometry(T, len), leafMat);
    m.position.copy(at);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
    m.rotateY(spin);
    group.add(m);
  };
  const sprig = (from: ThreeNS.Vector3, dir: ThreeNS.Vector3, len: number) => {
    const d = dir.clone().normalize();
    const stem = new T.Mesh(new T.CylinderGeometry(0.005, 0.006, len, 5), stemMat);
    stem.position.copy(from).addScaledVector(d, len / 2);
    aim(T, stem, d);
    group.add(stem);
    const tip = from.clone().addScaledVector(d, len);
    const flower = new T.SphereGeometry(0.02, 6, 4);
    const n = 12 + Math.floor(rand() * 8);
    for (let i = 0; i < n; i++) {
      const f = new T.Mesh(flower, blossom);
      f.position.set(tip.x + (rand() - 0.5) * 0.2, tip.y + (rand() - 0.4) * 0.12, tip.z + (rand() - 0.5) * 0.2);
      group.add(f);
    }
  };
  const pearls = (count: number, place: () => ThreeNS.Vector3) => {
    const geo = new T.SphereGeometry(0.017, 8, 6);
    for (let i = 0; i < count; i++) {
      const p = new T.Mesh(geo, pearlMat);
      p.position.copy(place());
      p.castShadow = true;
      group.add(p);
    }
  };
  const heart = (size: number, outline: boolean, at: ThreeNS.Vector3, yaw: number, tilt: number) => {
    const m = new T.Mesh(heartGeometry(T, size, outline), gold);
    m.position.copy(at);
    m.rotation.set(0, yaw, tilt);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  // --- Top: rosettes along the front edge, roses and baby's breath at the back
  const edgeR = top.r - 0.2;
  const ros: [number, ThreeNS.Material, number][] = [
    [-1.25, lightPeach, 0.36], [-0.7, hotPink, 0.42], [-0.12, peach, 0.44], [0.45, lightPeach, 0.36], [0.95, peach, 0.34],
  ];
  ros.forEach(([a, mat, size]) => rosette(size, mat, around(a, edgeR, topY - 0.02), outward(a, 2.4)));
  heart(0.17, false, around(-0.42, edgeR - 0.12, topY + 0.2), -0.42, -0.25);

  const posy: [number, number, number, ThreeNS.Color, ThreeNS.Color][] = [
    [1.95, 0.45, 0.33, cream, pink], [2.7, 0.52, 0.36, cream, pink], [3.45, 0.45, 0.33, butter, butter.clone().offsetHSL(0, 0, -0.06)],
    [2.35, 0.12, 0.28, cream, pink],
  ];
  posy.forEach(([a, k, size, inner, edge]) => rose(size, inner, edge, around(a, top.r * k, topY + 0.02), outward(a, 2.2)));
  for (let i = 0; i < 11; i++) {
    const a = 1.6 + rand() * 2.3;
    sprig(around(a, top.r * 0.45, topY + 0.2), outward(a, 1.3 + rand()), 0.28 + rand() * 0.2);
  }
  leaf(0.22, around(3.0, top.r * 0.78, topY + 0.08), outward(3.0, 0.6), 0.4);

  // Gold double-heart topper on a stick, standing at the back left
  const topper = new T.Group();
  const tPos = around(-2.3, top.r * 0.42, topY);
  topper.position.copy(tPos);
  topper.rotation.y = -0.35;
  const stick = new T.Mesh(new T.BoxGeometry(0.022, 0.44, 0.012), gold);
  stick.position.y = 0.22;
  topper.add(stick);
  const big = new T.Mesh(heartGeometry(T, 0.62, true), gold);
  big.position.set(-0.08, 0.68, 0);
  big.rotation.z = 0.12;
  const small = new T.Mesh(heartGeometry(T, 0.42, true), gold);
  small.position.set(0.13, 0.57, 0.012);
  small.rotation.z = -0.15;
  big.castShadow = small.castShadow = true;
  topper.add(big, small);
  group.add(topper);

  // --- Side: gold outline hearts (flat acrylic, so they sit just off the curve)
  const side = (a: number, y: number, size: number, dx: number, dy: number, size2: number, depth = 0.012) => {
    const p = around(a, base.r + 0.012, base.y + base.h * y);
    heart(size, true, p, a, 0.08);
    const q = around(a + dx / base.r, base.r + 0.012 + depth, base.y + base.h * y + dy);
    heart(size2, true, q, a + dx / base.r, -0.12);
  };
  side(0.5, 0.6, 0.78, 0.08, -0.36, 0.58);
  side(-0.32, 0.24, 0.5, 0.07, -0.16, 0.38);

  // --- Base: a spray of roses with leaves on one side, rosettes on the other
  const baseY = base.y;
  rose(0.46, cream, pink, around(-1.1, base.r + 0.24, baseY + 0.62), outward(-1.1, 0.35));
  rose(0.4, cream, pink, around(-0.85, base.r + 0.24, baseY + 0.2), outward(-0.85, 0.6));
  rose(0.32, butter, butter.clone().offsetHSL(0, 0, -0.05), around(-1.5, base.r + 0.18, baseY + 0.18), outward(-1.5, 0.8));
  for (let i = 0; i < 6; i++) {
    const a = -0.95 + (rand() - 0.5) * 0.5;
    leaf(0.24 + rand() * 0.1, around(a, base.r + 0.05, baseY + 0.55 + rand() * 0.45), outward(a, 0.9 + rand()), rand() * Math.PI);
  }
  rosette(0.48, hotPink, around(1.0, base.r + 0.06, baseY + 0.2), outward(1.0, 0.35));
  rosette(0.38, peach, around(1.35, base.r + 0.04, baseY + 0.52), outward(1.35, 0.25));
  rosette(0.34, lightPeach, around(0.7, base.r + 0.03, baseY + 0.12), outward(0.7, 0.6));
  rosette(0.3, lightPeach, around(1.62, base.r + 0.03, baseY + 0.16), outward(1.62, 0.6));

  // --- Gold pearls: little clusters on the side and a scatter on the board
  const cluster = (a: number, y: number, n: number) =>
    pearls(n, () => around(a + (rand() - 0.5) * 0.12, base.r + 0.012, base.y + base.h * y + (rand() - 0.5) * 0.12));
  cluster(0.18, 0.8, 6);
  cluster(-0.62, 0.66, 9);
  cluster(0.85, 0.12, 7);
  pearls(46, () => {
    const a = rand() * Math.PI * 2;
    return around(a, base.r + 0.06 + rand() ** 2 * (PLATE_R - base.r - 0.14), STAND_TOP + 0.017);
  });
}

function buildCake(T: THREE, d: CakeDesign) {
  const rand = seeded(20261023);
  const group = new T.Group();
  const frostHex = FROSTINGS.find((f) => f.value === d.frosting)!.hex;
  const frostColor = new T.Color(frostHex);
  const isDark = d.frosting === "chocolate" || d.frosting === "burgundy";

  const frosting = new T.MeshPhysicalMaterial({
    color: frostColor,
    roughness: 0.62,
    sheen: 0.6,
    sheenRoughness: 0.5,
    sheenColor: new T.Color(0xffffff),
    clearcoat: isDark ? 0.25 : 0.08,
  });
  const piping = new T.MeshPhysicalMaterial({
    color: isDark ? frostColor.clone().offsetHSL(0, 0, 0.06) : new T.Color(0xfffaf2),
    roughness: 0.55,
    sheen: 0.5,
    sheenColor: new T.Color(0xffffff),
  });
  const dripMat =
    d.drip === "gold"
      ? new T.MeshStandardMaterial({ color: 0xe3bd6a, metalness: 0.9, roughness: 0.22, envMapIntensity: 1.6 })
      : new T.MeshPhysicalMaterial({ color: 0x3a1c13, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 });
  const mirror = d.drip === "mirror";
  const ombre = d.drip === "ombre";
  const glaze = mirror
    ? new T.MeshPhysicalMaterial({
        map: marbleTexture(T, frostColor, rand),
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.3,
      })
    : ombre
      ? new T.MeshPhysicalMaterial({
          map: ombreTexture(T, frostColor, rand),
          roughness: 0.66,
          sheen: 0.5,
          sheenRoughness: 0.6,
          sheenColor: new T.Color(0xffffff),
          clearcoat: 0.04,
        })
      : null;
  const roses = d.topping === "roses";
  const goldTrim = new T.MeshStandardMaterial({ color: 0xd8b56e, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.5 });
  // Flat flakes mostly mirror the walls, so a little warm glow keeps them reading as gold
  const goldLeaf = new T.MeshStandardMaterial({ color: 0xf3d27e, metalness: 0.6, roughness: 0.3, emissive: 0xa9792a, emissiveIntensity: 0.55, side: T.DoubleSide });

  const tiers = tierSpecs(d);
  const placed: TierPlacement[] = [];
  let y = STAND_TOP;
  tiers.forEach((t, i) => {
    const geo = tierGeometry(T, t.r, t.h);
    if (glaze) remapGlazeUVs(geo, t.r, t.h);
    const tier = new T.Mesh(geo, glaze ?? frosting);
    tier.position.y = y;
    tier.castShadow = true;
    tier.receiveShadow = true;
    group.add(tier);
    placed.push({ r: t.r, h: t.h, y });

    // Mirror-glazed tiers get a thin gold band at the base instead of piping
    if (mirror) {
      const band = new T.Mesh(new T.TorusGeometry(t.r + 0.004, 0.018, 10, 128), goldTrim);
      band.rotation.x = Math.PI / 2;
      band.position.y = y + 0.03;
      group.add(band);
    }
    // Piped bead border around the base of each tier
    const beads = mirror || (ombre && roses) ? 0 : Math.round(t.r * 34);
    const beadGeo = new T.SphereGeometry(0.055, 14, 10);
    for (let b = 0; b < beads; b++) {
      const a = (b / beads) * Math.PI * 2;
      const bead = new T.Mesh(beadGeo, piping);
      bead.position.set(Math.cos(a) * (t.r + 0.01), y + 0.045, Math.sin(a) * (t.r + 0.01));
      bead.scale.set(1, 0.85, 1);
      bead.castShadow = true;
      group.add(bead);
    }

    const isTop = i === tiers.length - 1;

    // Drip runs down the top tier only, for a clean look
    if (isTop && (d.drip === "chocolate" || d.drip === "gold")) {
      const cap = new T.Mesh(new T.CylinderGeometry(t.r + 0.012, t.r + 0.012, 0.045, 96), dripMat);
      cap.position.y = y + t.h - 0.005;
      cap.castShadow = true;
      group.add(cap);
      const count = Math.round(t.r * 24);
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + rand() * 0.08;
        const radius = 0.035 + rand() * 0.025;
        const len = t.h * (0.12 + rand() * rand() * 0.55);
        const drip = new T.Mesh(new T.CapsuleGeometry(radius, len, 6, 12), dripMat);
        drip.position.set(Math.cos(a) * (t.r + radius * 0.35), y + t.h - len / 2 - 0.01, Math.sin(a) * (t.r + radius * 0.35));
        drip.castShadow = true;
        group.add(drip);
      }
    }

    // Gold leaf flakes on the side of every tier when chosen
    if (d.topping === "gold-leaf") {
      for (let k = 0; k < 7; k++) {
        const a = rand() * Math.PI * 2;
        const leaf = new T.Mesh(flakeGeometry(T, rand, 0.06 + rand() * 0.05), goldLeaf);
        leaf.position.set(Math.cos(a) * (t.r + 0.006), y + t.h * (0.35 + rand() * 0.45), Math.sin(a) * (t.r + 0.006));
        leaf.lookAt(leaf.position.x * 2, leaf.position.y, leaf.position.z * 2);
        leaf.rotateZ(rand() * Math.PI);
        group.add(leaf);
      }
    }

    y += t.h;
  });

  const top = tiers[tiers.length - 1];
  const topY = y + (d.drip === "chocolate" || d.drip === "gold" ? 0.02 : 0);
  let extra = 0;

  if (d.topping === "berries") {
    const raspberry = new T.MeshPhysicalMaterial({ color: 0x9c1f33, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const blueberry = new T.MeshPhysicalMaterial({ color: 0x2e2a5a, roughness: 0.3, clearcoat: 0.6, sheen: 0.4, sheenColor: new T.Color(0x9aa0d0) });
    const leaf = new T.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.5, side: T.DoubleSide });
    // A crescent of berries over one side of the top
    const n = Math.round(top.r * 14);
    for (let k = 0; k < n; k++) {
      const a = -0.4 + (k / n) * Math.PI * 1.25;
      const rr = top.r * (0.55 + rand() * 0.3);
      const isBlue = k % 3 === 1;
      const size = isBlue ? 0.07 : 0.09 + rand() * 0.025;
      const berry = new T.Mesh(new T.SphereGeometry(size, 18, 14), isBlue ? blueberry : raspberry);
      berry.position.set(Math.cos(a) * rr, topY + size * 0.85, Math.sin(a) * rr);
      if (!isBlue) berry.scale.set(1, 1.12, 1);
      berry.castShadow = true;
      group.add(berry);
      if (k % 4 === 0) {
        const mint = new T.Mesh(new T.CircleGeometry(0.07, 12), leaf);
        mint.scale.set(0.6, 1.3, 1);
        mint.position.set(Math.cos(a + 0.08) * (rr + 0.1), topY + 0.05, Math.sin(a + 0.08) * (rr + 0.1));
        mint.rotation.set(-Math.PI / 2 + 0.5, 0, a);
        group.add(mint);
      }
    }
    extra = 0.22;
  } else if (d.topping === "rosettes") {
    const n = Math.max(8, Math.round(top.r * 12));
    const swirl = new T.ConeGeometry(0.1, 0.17, 8, 1);
    const base = new T.SphereGeometry(0.1, 16, 10);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = top.r - 0.16;
      const r1 = new T.Mesh(base, piping);
      r1.position.set(Math.cos(a) * rr, topY + 0.06, Math.sin(a) * rr);
      r1.scale.set(1, 0.7, 1);
      const r2 = new T.Mesh(swirl, piping);
      r2.position.set(Math.cos(a) * rr, topY + 0.16, Math.sin(a) * rr);
      r2.rotation.y = a * 3;
      r1.castShadow = r2.castShadow = true;
      group.add(r1, r2);
    }
    const cherry = new T.Mesh(
      new T.SphereGeometry(0.12, 24, 18),
      new T.MeshPhysicalMaterial({ color: 0x8a1f2e, roughness: 0.2, clearcoat: 1 }),
    );
    cherry.position.set(0, topY + 0.12, 0);
    cherry.castShadow = true;
    group.add(cherry);
    extra = 0.3;
  } else if (roses) {
    decorateRoses(T, group, placed, topY, rand);
    extra = 1.05;
  } else if (d.topping === "gold-leaf") {
    for (let k = 0; k < 9; k++) {
      const a = rand() * Math.PI * 2;
      const rr = rand() * top.r * 0.8;
      const flake = new T.Mesh(flakeGeometry(T, rand, 0.07 + rand() * 0.06), goldLeaf);
      flake.position.set(Math.cos(a) * rr, topY + 0.012, Math.sin(a) * rr);
      flake.rotation.set(-Math.PI / 2 + (rand() - 0.5) * 0.3, 0, rand() * Math.PI);
      group.add(flake);
    }
  }

  return { group: mergeByMaterial(T, group), height: y - STAND_TOP + extra };
}

/**
 * The decorated cakes are made of hundreds of small pieces (petals, pearls,
 * blossoms). Drawing each one separately is slow on phones, so bake them
 * into one mesh per material: a handful of draw calls instead of hundreds.
 */
function mergeByMaterial(T: THREE, root: ThreeNS.Group) {
  root.updateMatrixWorld(true);
  const buckets = new Map<ThreeNS.Material, ThreeNS.BufferGeometry[]>();
  root.traverse((o) => {
    const mesh = o as ThreeNS.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as ThreeNS.Material;
    const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat)!.push(geo);
  });
  const out = new T.Group();
  for (const [mat, geos] of buckets) {
    const m = mat as ThreeNS.MeshStandardMaterial;
    const names = ["position", "normal", ...(m.map ? ["uv"] : []), ...(m.vertexColors ? ["color"] : [])];
    const merged = new T.BufferGeometry();
    for (const name of names) {
      const size = geos[0].getAttribute(name).itemSize;
      const total = geos.reduce((n, g) => n + g.getAttribute(name).count * size, 0);
      const arr = new Float32Array(total);
      let offset = 0;
      for (const g of geos) {
        const a = g.getAttribute(name) as ThreeNS.BufferAttribute;
        arr.set(a.array as Float32Array, offset);
        offset += a.count * size;
      }
      merged.setAttribute(name, new T.BufferAttribute(arr, size));
    }
    geos.forEach((g) => g.dispose());
    const mesh = new T.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  disposeGeometries(root);
  return out;
}

function disposeGeometries(root: ThreeNS.Object3D) {
  root.traverse((o) => (o as ThreeNS.Mesh).geometry?.dispose());
}
