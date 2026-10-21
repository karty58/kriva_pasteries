import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

// Session client double: who is signed in, and are they in admin_users?
const session: { user: { id: string; email: string } | null; isAdmin: boolean; writes: string[] } = { user: null, isAdmin: false, writes: [] };
vi.mock("@/lib/supabase/server", () => ({
  createSessionClient: async () => ({
    auth: { getUser: async () => ({ data: { user: session.user }, error: session.user ? null : new Error("no session") }) },
    from: (table: string) => {
      const q = {
        select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => ({ data: table === "admin_users" && session.isAdmin ? { user_id: session.user!.id } : null }),
        single: async () => ({ data: null }),
        update: () => { session.writes.push(table); return q; },
        insert: () => { session.writes.push(table); return q; },
        delete: () => { session.writes.push(table); return q; },
      };
      return q;
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }); },
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));

const { getAdmin, requireAdminAction, requireAdminPage, NotAuthorisedError } = await import("@/lib/auth");
const { saveProduct, deleteProduct, quickUpdateProduct } = await import("@/app/admin/actions/products");
const { updateOrderStatus, recordOfflinePayment } = await import("@/app/admin/actions/orders");
const { saveSettings } = await import("@/app/admin/actions/settings");
const { proxy } = await import("@/proxy");
const { NextRequest } = await import("next/server");

const ID = "6f1d2c1e-1111-4222-8333-944445555666";
const fd = (o: Record<string, string>) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.set(k, v)); return f; };

beforeEach(() => {
  session.user = null;
  session.isAdmin = false;
  session.writes = [];
});

describe("owner authorisation", () => {
  it("unauthenticated users have no admin access", async () => {
    expect(await getAdmin()).toBeNull();
    await expect(requireAdminAction()).rejects.toBeInstanceOf(NotAuthorisedError);
    await expect(requireAdminPage()).rejects.toMatchObject({ url: "/admin/login?error=not-authorised" });
  });

  it("signed-in non-owners are refused", async () => {
    session.user = { id: ID, email: "customer@example.com" };
    expect(await getAdmin()).toBeNull();
    await expect(requireAdminAction()).rejects.toBeInstanceOf(NotAuthorisedError);
  });

  it("owners are allowed", async () => {
    session.user = { id: ID, email: "owner@example.com" };
    session.isAdmin = true;
    expect((await getAdmin())?.user.id).toBe(ID);
  });

  it("protected server actions reject non-owners before touching data", async () => {
    session.user = { id: ID, email: "customer@example.com" };
    const calls: Promise<unknown>[] = [
      saveProduct(null, fd({ name: "Hack", lead_time_hours: "1", max_per_order: "1", stock_status: "in_stock", max_message_length: "10", variants: "[]" })),
      deleteProduct(fd({ id: ID, confirm: "DELETE" })),
      quickUpdateProduct(fd({ id: ID, field: "is_featured", value: "true" })),
      updateOrderStatus(null, fd({ id: ID, to: "confirmed" })),
      recordOfflinePayment(null, fd({ id: ID, to: "paid" })),
      saveSettings(null, fd({ whatsapp_number: "911234567890" })),
    ];
    for (const c of calls) await expect(c).rejects.toBeInstanceOf(NotAuthorisedError);
    expect(session.writes).toEqual([]);
  });
});

describe("admin proxy", () => {
  it("redirects signed-out visitors from /admin to the login page", async () => {
    const res = await proxy(new NextRequest("http://localhost/admin/orders"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/admin/login");
  });
  it("lets the login page through", async () => {
    const res = await proxy(new NextRequest("http://localhost/admin/login"));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("product management validation (owner)", () => {
  const base = { name: "Truffle Cake", lead_time_hours: "24", max_per_order: "5", stock_status: "in_stock", max_message_length: "40", flavours: "[]" };
  beforeEach(() => {
    session.user = { id: ID, email: "owner@example.com" };
    session.isAdmin = true;
  });
  it("requires at least one size and a valid price", async () => {
    expect(await saveProduct(null, fd({ ...base, variants: "[]" }))).toMatchObject({ error: "Add at least one size and price." });
    expect(await saveProduct(null, fd({ ...base, variants: JSON.stringify([{ label: "1 kg", price: "12.345" }]) }))).toMatchObject({ error: expect.stringMatching(/amount like/) });
    expect(await saveProduct(null, fd({ ...base, variants: JSON.stringify([{ label: "1 kg", price: "0" }]) }))).toMatchObject({ error: "Prices must be more than ₹0." });
    expect(session.writes).toEqual([]);
  });
  it("rejects duplicate size names, bad slugs and bad stock counts", async () => {
    const two = JSON.stringify([{ label: "1 kg", price: "999" }, { label: "1 KG", price: "1099" }]);
    expect(await saveProduct(null, fd({ ...base, variants: two }))).toMatchObject({ error: "Size names must be different." });
    const one = JSON.stringify([{ label: "1 kg", price: "999" }]);
    expect(await saveProduct(null, fd({ ...base, variants: one, slug: "Bad Slug!" }))).toMatchObject({ error: expect.stringMatching(/Slug/) });
    expect(await saveProduct(null, fd({ ...base, variants: one, stock_quantity: "-2" }))).toMatchObject({ error: expect.stringMatching(/Stock quantity/) });
    expect(session.writes).toEqual([]);
  });
  it("only lets owners record payment for offline orders (online is gateway-controlled)", async () => {
    // order lookup returns nothing in this double, so the action stops safely
    expect(await recordOfflinePayment(null, fd({ id: ID, to: "paid" }))).toMatchObject({ error: "Order not found." });
  });
});
