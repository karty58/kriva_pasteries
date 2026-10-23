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
  1: [{ r: 1.25, h: 1.0 }],
  2: [{ r: 1.3, h: 0.9 }, { r: 0.88, h: 0.78 }],
  3: [{ r: 1.32, h: 0.8 }, { r: 0.98, h: 0.7 }, { r: 0.66, h: 0.6 }],
};

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
      mats.forEach((mat) => mat?.dispose());
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
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new T.Vector2(r - bev + Math.cos(a) * bev, h - bev + Math.sin(a) * bev));
  }
  pts.push(new T.Vector2(0, h));
  return new T.LatheGeometry(pts, 96);
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
  // Flat flakes mostly mirror the walls, so a little warm glow keeps them reading as gold
  const goldLeaf = new T.MeshStandardMaterial({ color: 0xf3d27e, metalness: 0.6, roughness: 0.3, emissive: 0xa9792a, emissiveIntensity: 0.55, side: T.DoubleSide });

  const tiers = TIER_SPECS[d.tiers];
  let y = STAND_TOP;
  tiers.forEach((t, i) => {
    const tier = new T.Mesh(tierGeometry(T, t.r, t.h), frosting);
    tier.position.y = y;
    tier.castShadow = true;
    tier.receiveShadow = true;
    group.add(tier);

    // Piped bead border around the base of each tier
    const beads = Math.round(t.r * 34);
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
    if (isTop && d.drip !== "none") {
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
  const topY = y + (d.drip !== "none" ? 0.02 : 0);
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

  return { group, height: y - STAND_TOP + extra };
}
