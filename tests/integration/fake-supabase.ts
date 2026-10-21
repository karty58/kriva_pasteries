/**
 * Minimal in-memory stand-in for the parts of supabase-js used by the
 * server-side order & payment code. Lets the route handlers run end to end
 * in tests. (Database rules themselves are tested against real Postgres in tests/db.)
 */
import { randomUUID } from "node:crypto";
import { DEFAULT_SETTINGS, DEMO_PRODUCTS } from "@/lib/demo-data";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export class FakeDb {
  tables: Record<string, Row[]> = {
    site_settings: [{ id: 1, ...DEFAULT_SETTINGS, online_payments_enabled: true }],
    products: [],
    product_variants: [],
    product_flavours: [],
    product_images: [],
    orders: [],
    order_items: [],
    payment_transactions: [],
    payment_events: [],
  };
  rateHits = new Map<string, number>();

  constructor() {
    for (const p of DEMO_PRODUCTS) {
      const { variants, flavours, images, category, ...row } = p;
      void category;
      this.tables.products.push(structuredClone(row));
      variants.forEach((v) => this.tables.product_variants.push({ ...v, product_id: p.id }));
      flavours.forEach((f) => this.tables.product_flavours.push({ ...f, product_id: p.id }));
      images.forEach((i) => this.tables.product_images.push({ ...i, product_id: p.id }));
    }
  }

  from(table: string) {
    return new Query(this, table);
  }

  async rpc(fn: string, args: Row) {
    if (fn === "hit_rate_limit") {
      const n = (this.rateHits.get(args.p_key as string) ?? 0) + 1;
      this.rateHits.set(args.p_key as string, n);
      return { data: n <= (args.p_limit as number), error: null };
    }
    if (fn === "create_order") {
      const o = args.p_order as Row;
      if (this.tables.orders.some((x) => x.idempotency_key === o.idempotency_key)) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint "orders_idempotency_key_key"' } };
      }
      const items = args.p_items as Row[];
      const sum = items.reduce((s, i) => s + (i.line_total_paise as number), 0);
      if (sum !== o.subtotal_paise) return { data: null, error: { message: "SUBTOTAL_MISMATCH" } };
      const id = randomUUID();
      this.tables.orders.push({
        ...o, id, status: "pending", payment_status: "pending", currency: "INR", rejection_reason: null,
        customer_email: o.customer_email || null, created_at: new Date().toISOString(),
      });
      items.forEach((i) => this.tables.order_items.push({ ...i, id: randomUUID(), order_id: id }));
      return { data: id, error: null };
    }
    throw new Error(`rpc ${fn} not faked`);
  }
}

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private selectCols = "*";
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";
  private max: number | null = null;
  private sortKey: { col: string; asc: boolean } | null = null;
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};

  constructor(private db: FakeDb, private table: string) {}

  select(cols = "*") {
    if (this.op === "select") this.selectCols = cols;
    else this.returning = true;
    return this;
  }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  upsert(p: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert"; this.payload = p; this.upsertOpts = opts; return this;
  }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  order(col: string, o: { ascending?: boolean } = {}) { this.sortKey = { col, asc: o.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private rows() { return this.db.tables[this.table]; }

  private hydrate(r: Row): Row {
    const out = { ...r };
    if (this.table === "products" && this.selectCols.includes("variants:")) {
      out.variants = this.db.tables.product_variants.filter((v) => v.product_id === r.id);
      out.flavours = this.db.tables.product_flavours.filter((v) => v.product_id === r.id);
      out.images = this.db.tables.product_images.filter((v) => v.product_id === r.id);
    }
    if (this.table === "orders" && this.selectCols.includes("items:")) {
      out.items = this.db.tables.order_items.filter((i) => i.order_id === r.id);
    }
    return structuredClone(out);
  }

  private exec() {
    const match = (r: Row) => this.filters.every((f) => f(r));
    let result: Row[] = [];
    if (this.op === "select") {
      result = this.rows().filter(match);
      if (this.sortKey) {
        const { col, asc } = this.sortKey;
        result.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
      }
      if (this.max !== null) result = result.slice(0, this.max);
      result = result.map((r) => this.hydrate(r));
    } else if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((p) => ({
        id: randomUUID(), created_at: new Date(Date.now() + this.rows().length).toISOString(), duplicate_payment_ids: [], ...p,
      }));
      this.rows().push(...items);
      result = items;
    } else if (this.op === "update") {
      result = this.rows().filter(match);
      result.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === "upsert") {
      const key = this.upsertOpts.onConflict ?? "id";
      for (const p of Array.isArray(this.payload) ? this.payload : [this.payload!]) {
        const existing = this.rows().find((r) => r[key] === p[key]);
        if (existing) {
          if (!this.upsertOpts.ignoreDuplicates) { Object.assign(existing, p); result.push(existing); }
        } else {
          this.rows().push({ ...p }); result.push(p);
        }
      }
    } else if (this.op === "delete") {
      const keep = this.rows().filter((r) => !match(r));
      result = this.rows().filter(match);
      this.db.tables[this.table] = keep;
    }

    if (this.op !== "select" && !this.returning) return { data: null, error: null };
    if (this.mode === "single") return result.length === 1 ? { data: result[0], error: null } : { data: null, error: { message: "not single" } };
    if (this.mode === "maybe") return { data: result[0] ?? null, error: null };
    return { data: result, error: null, count: result.length };
  }

  then<T1, T2>(ok?: ((v: { data: unknown; error: unknown; count?: number }) => T1 | PromiseLike<T1>) | null, err?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve().then(() => this.exec()).then(ok, err);
  }
}
