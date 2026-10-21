import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { createTestDb, asRole } from "./harness";

const ADMIN = "00000000-0000-0000-0000-00000000a001";
const STRANGER = "00000000-0000-0000-0000-00000000b002";

let db: PGlite;

async function firstVariant(slug: string) {
  const r = await db.query<{ product_id: string; variant_id: string; label: string; price_paise: number; name: string }>(
    `select p.id as product_id, v.id as variant_id, v.label, v.price_paise, p.name
       from products p join product_variants v on v.product_id = p.id
      where p.slug = $1 order by v.sort_order limit 1`,
    [slug],
  );
  return r.rows[0];
}

function ref() {
  return `KRV-261021-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

async function createOrder(opts: { qty?: number; tamperSubtotal?: boolean; slug?: string; method?: "online" | "offline" } = {}) {
  const v = await firstVariant(opts.slug ?? "sample-classic-opera-pastry");
  const qty = opts.qty ?? 2;
  const line = v.price_paise * qty;
  const order = {
    reference: ref(),
    access_token_hash: "hash",
    idempotency_key: randomUUID(),
    customer_name: "Test Customer",
    customer_phone: "9876543210",
    fulfilment_method: "pickup",
    requested_for: new Date(Date.now() + 86400000).toISOString(),
    subtotal_paise: opts.tamperSubtotal ? line - 100 : line,
    delivery_fee_paise: 0,
    total_paise: opts.tamperSubtotal ? line - 100 : line,
    payment_method: opts.method ?? "offline",
  };
  const items = [{
    product_id: v.product_id, variant_id: v.variant_id, product_name: v.name, variant_label: v.label,
    unit_price_paise: v.price_paise, quantity: qty, line_total_paise: line,
  }];
  const r = await db.query<{ create_order: string }>(`select create_order($1::jsonb, $2::jsonb)`, [
    JSON.stringify(order), JSON.stringify(items),
  ]);
  return r.rows[0].create_order;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${ADMIN}', 'owner@example.com'), ('${STRANGER}', 'x@example.com');
                 insert into admin_users (user_id) values ('${ADMIN}');`);
});

describe("migrations & seed", () => {
  it("creates initial categories and sample products marked as samples", async () => {
    const c = await db.query<{ n: number }>(`select count(*)::int as n from categories`);
    expect(c.rows[0].n).toBe(9);
    const p = await db.query<{ n: number }>(`select count(*)::int as n from products where not is_sample`);
    expect(p.rows[0].n).toBe(0);
  });

  it("rejects invalid product data via constraints", async () => {
    await expect(db.exec(`insert into products (name, slug) values ('X', 'Bad Slug')`)).rejects.toThrow();
    const prod = await db.query<{ id: string }>(`select id from products limit 1`);
    await expect(
      db.query(`insert into product_variants (product_id, label, price_paise) values ($1, 'Zero', 0)`, [prod.rows[0].id]),
    ).rejects.toThrow();
  });
});

describe("create_order", () => {
  it("creates an order with items and an initial history row", async () => {
    const id = await createOrder();
    const o = await db.query<{ status: string; payment_status: string }>(`select status, payment_status from orders where id = $1`, [id]);
    expect(o.rows[0]).toEqual({ status: "pending", payment_status: "pending" });
    const h = await db.query<{ n: number }>(`select count(*)::int as n from order_status_history where order_id = $1`, [id]);
    expect(h.rows[0].n).toBe(1);
  });

  it("rejects a subtotal that does not match the line items", async () => {
    await expect(createOrder({ tamperSubtotal: true })).rejects.toThrow(/SUBTOTAL_MISMATCH/);
  });

  it("reserves tracked stock and refuses to oversell", async () => {
    await db.exec(`update products set stock_quantity = 3 where slug = 'sample-fudge-brownie-box'`);
    await createOrder({ slug: "sample-fudge-brownie-box", qty: 2 });
    const s = await db.query<{ q: number }>(`select stock_quantity as q from products where slug = 'sample-fudge-brownie-box'`);
    expect(s.rows[0].q).toBe(1);
    await expect(createOrder({ slug: "sample-fudge-brownie-box", qty: 2 })).rejects.toThrow(/OUT_OF_STOCK/);
  });

  it("returns stock when an order is cancelled", async () => {
    await db.exec(`update products set stock_quantity = 5 where slug = 'sample-fudge-brownie-box'`);
    const id = await createOrder({ slug: "sample-fudge-brownie-box", qty: 2 });
    await db.query(`update orders set status = 'cancelled' where id = $1`, [id]);
    const s = await db.query<{ q: number }>(`select stock_quantity as q from products where slug = 'sample-fudge-brownie-box'`);
    expect(s.rows[0].q).toBe(5);
  });

  it("enforces unique idempotency keys (duplicate submission)", async () => {
    const key = randomUUID();
    const base = { access_token_hash: "h", idempotency_key: key, customer_name: "AB", customer_phone: "9876543210",
      fulfilment_method: "pickup", requested_for: new Date().toISOString(), subtotal_paise: 18900,
      delivery_fee_paise: 0, total_paise: 18900, payment_method: "offline" };
    const v = await firstVariant("sample-classic-opera-pastry");
    const items = JSON.stringify([{ product_id: v.product_id, variant_id: v.variant_id, product_name: "x",
      variant_label: "y", unit_price_paise: 18900, quantity: 1, line_total_paise: 18900 }]);
    await db.query(`select create_order($1::jsonb, $2::jsonb)`, [JSON.stringify({ ...base, reference: ref() }), items]);
    await expect(
      db.query(`select create_order($1::jsonb, $2::jsonb)`, [JSON.stringify({ ...base, reference: ref() }), items]),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("order status rules", () => {
  it("allows the normal workflow and blocks invalid jumps", async () => {
    const id = await createOrder();
    await expect(db.query(`update orders set status = 'completed' where id = $1`, [id])).rejects.toThrow(/INVALID_STATUS_TRANSITION/);
    for (const s of ["confirmed", "preparing", "ready", "completed"]) {
      await db.query(`update orders set status = $2 where id = $1`, [id, s]);
    }
    await expect(db.query(`update orders set status = 'pending' where id = $1`, [id])).rejects.toThrow(/INVALID_STATUS_TRANSITION/);
  });

  it("does not allow totals to be changed after creation", async () => {
    const id = await createOrder();
    await expect(db.query(`update orders set subtotal_paise = 1, total_paise = 1 where id = $1`, [id])).rejects.toThrow(/IMMUTABLE/);
  });
});

describe("row level security", () => {
  it("public visitors can read the active catalogue but not orders or payments", async () => {
    await asRole(db, "anon", null, async () => {
      const p = await db.query<{ n: number }>(`select count(*)::int as n from products`);
      expect(p.rows[0].n).toBeGreaterThan(0);
      const o = await db.query<{ n: number }>(`select count(*)::int as n from orders`);
      expect(o.rows[0].n).toBe(0);
      const t = await db.query<{ n: number }>(`select count(*)::int as n from payment_transactions`);
      expect(t.rows[0].n).toBe(0);
      await expect(db.query(`select * from payment_events`)).rejects.toThrow(/permission denied/);
    });
  });

  it("hides deactivated products from the public", async () => {
    await db.exec(`update products set is_active = false where slug = 'sample-lemon-tart'`);
    await asRole(db, "anon", null, async () => {
      const r = await db.query(`select 1 from products where slug = 'sample-lemon-tart'`);
      expect(r.rows.length).toBe(0);
    });
    await db.exec(`update products set is_active = true where slug = 'sample-lemon-tart'`);
  });

  it("public visitors cannot modify products or call create_order", async () => {
    await asRole(db, "anon", null, async () => {
      const r = await db.query(`update products set name = 'Hacked' returning id`);
      expect(r.rows.length).toBe(0);
      await expect(db.query(`select create_order('{}'::jsonb, '[]'::jsonb)`)).rejects.toThrow(/permission denied/);
    });
  });

  it("signed-in non-owners cannot modify products, settings or orders", async () => {
    await asRole(db, "authenticated", STRANGER, async () => {
      const r = await db.query(`update products set name = 'Hacked' returning id`);
      expect(r.rows.length).toBe(0);
      const s = await db.query(`update site_settings set shop_name = 'Hacked' returning id`);
      expect(s.rows.length).toBe(0);
      const o = await db.query<{ n: number }>(`select count(*)::int as n from orders`);
      expect(o.rows[0].n).toBe(0);
      await expect(db.exec(`insert into admin_users (user_id) values ('${STRANGER}')`)).rejects.toThrow();
    });
  });

  it("owners can manage products and read orders", async () => {
    await asRole(db, "authenticated", ADMIN, async () => {
      const r = await db.query(`update products set is_featured = true where slug = 'sample-lemon-tart' returning id`);
      expect(r.rows.length).toBe(1);
      const o = await db.query<{ n: number }>(`select count(*)::int as n from orders`);
      expect(o.rows[0].n).toBeGreaterThan(0);
    });
  });

  it("owners cannot change online payment status or order totals", async () => {
    const id = await createOrder({ method: "online" });
    await asRole(db, "authenticated", ADMIN, async () => {
      await expect(db.query(`update orders set payment_status = 'paid' where id = $1`, [id])).rejects.toThrow(/GATEWAY_CONTROLLED/);
      await expect(db.query(`update orders set total_paise = 1 where id = $1`, [id])).rejects.toThrow(/permission denied/);
    });
  });

  it("owners can record offline payments and update fulfilment", async () => {
    const id = await createOrder({ method: "offline" });
    await asRole(db, "authenticated", ADMIN, async () => {
      await db.query(`update orders set status = 'confirmed', payment_status = 'paid' where id = $1`, [id]);
    });
    const h = await db.query<{ changed_by: string }>(
      `select changed_by from order_status_history where order_id = $1 order by created_at desc limit 1`, [id]);
    expect(h.rows[0].changed_by).toBe(ADMIN);
  });

  it("the server (service role) can record verified online payments", async () => {
    const id = await createOrder({ method: "online" });
    await asRole(db, "service_role", null, async () => {
      await db.query(`update orders set payment_status = 'paid' where id = $1`, [id]);
    });
    const r = await db.query<{ payment_status: string }>(`select payment_status from orders where id = $1`, [id]);
    expect(r.rows[0].payment_status).toBe("paid");
  });
});

describe("rate limiter", () => {
  it("allows up to the limit within a window", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await db.query<{ ok: boolean }>(`select hit_rate_limit('test-key', 3, 60) as ok`);
      results.push(r.rows[0].ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
