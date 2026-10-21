/**
 * Test harness that runs the real Supabase migrations inside PGlite
 * (an in-process Postgres) with minimal stand-ins for Supabase's
 * `auth` and `storage` schemas and roles. This lets us test constraints,
 * triggers and Row Level Security without Docker.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "supabase");

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id), name text, owner uuid);
  alter table storage.objects enable row level security;

  -- Supabase grants these by default on the public schema
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export async function createTestDb(opts: { seed?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const migrations = readdirSync(join(ROOT, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    await db.exec(readFileSync(join(ROOT, "migrations", file), "utf8"));
  }
  if (opts.seed !== false) {
    await db.exec(readFileSync(join(ROOT, "seed.sql"), "utf8"));
  }
  return db;
}

/** Run `fn` as a given Supabase role (and optional user id), then reset. */
export async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`set request.jwt.claim.sub = '${userId ?? ""}'; set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; set request.jwt.claim.sub = '';`);
  }
}
