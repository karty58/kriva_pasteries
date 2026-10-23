import "server-only";
/**
 * OWNER DASHBOARD PREVIEW MODE — sample data only.
 *
 * Active ONLY when Supabase is NOT configured AND KRIVA_DEMO_ADMIN=1.
 * It lets people look around the owner dashboard with KRIVA's menu and a
 * few clearly labelled SAMPLE orders, held in memory (nothing is saved).
 * In a real deployment Supabase is configured, so this can never switch on.
 */
import { randomUUID } from "node:crypto";
import { isDemoMode } from "./env";
import { DEFAULT_SETTINGS, DEMO_CATEGORIES, DEMO_PRODUCTS } from "./demo-data";

export function isDemoAdmin(): boolean {
  return isDemoMode() && process.env.KRIVA_DEMO_ADMIN === "1";
}

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const day = (offsetDays: number, hh: number, mm = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hh - 5, mm - 30, 0, 0); // IST -> UTC
  return d.toISOString();
};

function seed(): Tables {
  const t: Tables = {
    admin_users: [{ user_id: "demo-owner" }],
    site_settings: [{ id: 1, ...DEFAULT_SETTINGS }],
    categories: DEMO_CATEGORIES.map((c) => ({ ...c })),
    products: [],
    product_variants: [],
    product_flavours: [],
    product_images: [],
    orders: [],
    order_items: [],
    order_status_history: [],
    payment_transactions: [],
  };
  for (const p of DEMO_PRODUCTS) {
    const { variants, flavours, images, category, ...row } = p;
    void category;
    t.products.push({ ...row });
    variants.forEach((v) => t.product_variants.push({ ...v, product_id: p.id }));
    flavours.forEach((f) => t.product_flavours.push({ ...f, product_id: p.id }));
    images.forEach((i) => t.product_images.push({ ...i, product_id: p.id }));
  }

  const bySlug = (s: string) => DEMO_PRODUCTS.find((p) => p.slug === s)!;
  const samples: {
    ref: string; name: string; status: string; pay: string; method: "online" | "offline"; when: string; created: string;
    items: [string, number, string?][]; notes?: string; reason?: string;
  }[] = [
    { ref: "KRV-SAMPLE-A1B2C3", name: "Sample Customer A", status: "pending", pay: "paid", method: "online", when: day(1, 17), created: day(0, 11, 5),
      items: [["tiramisu", 2], ["chocolate-eclair", 4]], notes: "Sample order — eggless tiramisu please." },
    { ref: "KRV-SAMPLE-D4E5F6", name: "Sample Customer B", status: "pending", pay: "pending", method: "offline", when: day(2, 18, 30), created: day(0, 10, 20),
      items: [["custom-glazed-entremet", 1, "Happy Anniversary"]], notes: "Sample order — blush pink glaze with gold leaf." },
    { ref: "KRV-SAMPLE-G7H8J9", name: "Sample Customer C", status: "confirmed", pay: "paid", method: "online", when: day(0, 19), created: day(-1, 16, 40),
      items: [["marble-mirror-glazed-entremet", 1], ["lotus-biscoff-cheesecake", 2]] },
    { ref: "KRV-SAMPLE-K2L3M4", name: "Sample Customer D", status: "ready", pay: "paid", method: "offline", when: day(0, 15, 30), created: day(-1, 12, 10),
      items: [["classic-opera", 3], ["coffee-tart", 2]] },
    { ref: "KRV-SAMPLE-N5P6Q7", name: "Sample Customer E", status: "completed", pay: "paid", method: "online", when: day(-2, 16), created: day(-3, 18, 0),
      items: [["red-velvet-cupcake", 6], ["banoffee", 1]] },
    { ref: "KRV-SAMPLE-R8S9T2", name: "Sample Customer F", status: "cancelled", pay: "refunded", method: "online", when: day(-1, 20), created: day(-2, 13, 15),
      items: [["honey-medovik", 2]], reason: "Sample: requested time was outside opening hours." },
  ];
  samples.forEach((s, n) => {
    const id = randomUUID();
    let subtotal = 0;
    for (const [slug, qty, msg] of s.items) {
      const p = bySlug(slug);
      const v = p.variants[0];
      subtotal += v.price_paise * qty;
      t.order_items.push({
        id: randomUUID(), order_id: id, product_id: p.id, variant_id: v.id, flavour_id: null,
        product_name: p.name, variant_label: v.label, flavour_name: null, unit_price_paise: v.price_paise,
        quantity: qty, line_total_paise: v.price_paise * qty, custom_message: msg ?? null, instructions: null,
      });
    }
    t.orders.push({
      id, reference: s.ref, customer_name: s.name, customer_phone: `90000000${String(n + 1).padStart(2, "0")}`,
      customer_email: null, fulfilment_method: "pickup", delivery_address: null, delivery_area: null,
      requested_for: s.when, special_instructions: s.notes ?? null, subtotal_paise: subtotal, delivery_fee_paise: 0,
      total_paise: subtotal, currency: "INR", payment_method: s.method, requires_approval: slugHasApproval(s.items[0][0]),
      status: s.status, payment_status: s.pay, rejection_reason: s.reason ?? null, created_at: s.created, updated_at: s.created,
    });
    t.order_status_history.push({ id: randomUUID(), order_id: id, from_status: null, to_status: "pending", payment_status: "pending", note: "Order request received", created_at: s.created });
    if (s.status !== "pending") {
      t.order_status_history.push({ id: randomUUID(), order_id: id, from_status: "pending", to_status: s.status, payment_status: s.pay, note: s.reason ?? null, created_at: day(0, 9) });
    }
    if (s.method === "online") {
      t.payment_transactions.push({
        id: randomUUID(), order_id: id, provider_order_id: `order_SAMPLE${n}`, provider_payment_id: s.pay === "pending" ? null : `pay_SAMPLE${n}`,
        amount_paise: subtotal, currency: "INR", status: s.pay === "refunded" ? "refunded" : s.pay === "paid" ? "captured" : "created",
        method: "upi", error_description: null, refund_id: s.pay === "refunded" ? `rfnd_SAMPLE${n}` : null, duplicate_payment_ids: [], created_at: s.created,
      });
    }
  });
  return t;
}

function slugHasApproval(slug: string) {
  return DEMO_PRODUCTS.find((p) => p.slug === slug)?.requires_approval ?? false;
}

const g = globalThis as unknown as { __krivaDemoAdmin?: Tables };
function tables(): Tables {
  if (!g.__krivaDemoAdmin) g.__krivaDemoAdmin = seed();
  return g.__krivaDemoAdmin;
}

type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number };

class Query implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private cols = "*";
  private head = false;
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";
  private max: number | null = null;
  private sorts: { col: string; asc: boolean }[] = [];
  private upsertKey = "id";

  constructor(private table: string) {}

  select(cols = "*", opts: { count?: string; head?: boolean } = {}) {
    if (this.op === "select") {
      this.cols = cols;
      this.head = !!opts.head;
    } else this.returning = true;
    return this;
  }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  upsert(p: Row | Row[], o: { onConflict?: string } = {}) { this.op = "upsert"; this.payload = p; this.upsertKey = o.onConflict ?? "id"; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  not(c: string, op: string, v: string) {
    const list = v.replace(/[()]/g, "").split(",");
    this.filters.push((r) => (op === "in" ? !list.includes(String(r[c])) : r[c] !== v));
    return this;
  }
  ilike(c: string, pattern: string) {
    const needle = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((r) => String(r[c] ?? "").toLowerCase().includes(needle));
    return this;
  }
  or(expr: string) {
    const parts = expr.split(",").map((p) => p.split(".ilike."));
    this.filters.push((r) => parts.some(([c, pat]) => String(r[c] ?? "").toLowerCase().includes((pat ?? "").replace(/%/g, "").toLowerCase())));
    return this;
  }
  order(col: string, o: { ascending?: boolean } = {}) { this.sorts.push({ col, asc: o.ascending !== false }); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private rows() { return (tables()[this.table] ??= []); }

  private hydrate(r: Row): Row {
    const t = tables();
    const out: Row = { ...r };
    if (this.table === "products") {
      if (this.cols.includes("variants:")) {
        out.variants = t.product_variants.filter((v) => v.product_id === r.id);
        out.flavours = t.product_flavours.filter((v) => v.product_id === r.id);
        out.images = t.product_images.filter((v) => v.product_id === r.id);
      }
      if (this.cols.includes("category:")) {
        const c = t.categories.find((c) => c.id === r.category_id);
        out.category = c ? { id: c.id, name: c.name, slug: c.slug } : null;
      }
    }
    if (this.table === "orders" && this.cols.includes("items:")) out.items = t.order_items.filter((i) => i.order_id === r.id);
    return structuredClone(out);
  }

  private exec(): Result {
    const match = (r: Row) => this.filters.every((f) => f(r));
    let result: Row[] = [];
    if (this.op === "select") {
      result = this.rows().filter(match);
      for (const s of [...this.sorts].reverse()) {
        result.sort((a, b) => (String(a[s.col] ?? "") < String(b[s.col] ?? "") ? -1 : String(a[s.col] ?? "") > String(b[s.col] ?? "") ? 1 : 0) * (s.asc ? 1 : -1));
      }
      const count = result.length;
      if (this.max !== null) result = result.slice(0, this.max);
      if (this.head) return { data: null, error: null, count };
      result = result.map((r) => this.hydrate(r));
    } else if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((p) => ({
        id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...p,
      }));
      this.rows().push(...items);
      result = items;
    } else if (this.op === "update") {
      result = this.rows().filter(match);
      for (const r of result) {
        const before = { status: r.status, payment_status: r.payment_status };
        Object.assign(r, this.payload, { updated_at: new Date().toISOString() });
        if (this.table === "orders" && (before.status !== r.status || before.payment_status !== r.payment_status)) {
          tables().order_status_history.push({
            id: randomUUID(), order_id: r.id, from_status: before.status, to_status: r.status,
            payment_status: r.payment_status, note: r.status === "cancelled" ? r.rejection_reason : null, created_at: new Date().toISOString(),
          });
        }
      }
    } else if (this.op === "upsert") {
      for (const p of Array.isArray(this.payload) ? this.payload : [this.payload!]) {
        const existing = this.rows().find((r) => r[this.upsertKey] === p[this.upsertKey]);
        if (existing) Object.assign(existing, p);
        else this.rows().push({ ...p });
        result.push(p);
      }
    } else {
      result = this.rows().filter(match);
      tables()[this.table] = this.rows().filter((r) => !match(r));
    }
    if (this.op !== "select" && !this.returning) return { data: null, error: null };
    if (this.mode === "single") return result.length === 1 ? { data: result[0], error: null } : { data: null, error: { message: "Not found" } };
    if (this.mode === "maybe") return { data: result[0] ?? null, error: null };
    return { data: result, error: null, count: result.length };
  }

  then<A, B>(ok?: ((v: Result) => A | PromiseLike<A>) | null, err?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.exec()).then(ok, err);
  }
}

const UPLOAD_MSG = "Photo uploads work once the shop's Supabase storage is connected.";

/** Minimal stand-in for the Supabase client used by the owner dashboard. */
export const demoAdminClient = {
  from: (table: string) => new Query(table),
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: { message: UPLOAD_MSG } }),
      remove: async () => ({ data: null, error: null }),
    }),
  },
  auth: { signOut: async () => ({ error: null }) },
};

export const DEMO_OWNER = { id: "demo-owner", email: "owner-preview@kriva (sample)" };
