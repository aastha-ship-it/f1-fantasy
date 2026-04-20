import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Test helpers for RLS integration tests. Each test constructs clients as needed,
 * resets state between runs, and gets a per-user anon-session client for RLS checks.
 */

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function resetTestData(): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql`delete from public.predictions where true`;
    await sql`delete from public.scores where true`;
    await sql`delete from public.results where true`;
    await sql`delete from public.events where season = 9999`;
    await sql`delete from public.admins where true`;
    await sql`delete from public.users where email like 'test+%@f1fantasy.test'`;
    await sql`delete from auth.users where email like 'test+%@f1fantasy.test'`;
  } finally {
    await sql.end();
  }
}

export async function createTestUser(
  tag: string,
  password = "test-password-12345",
): Promise<{ id: string; email: string; client: SupabaseClient }> {
  const svc = serviceClient();
  const email = `test+${tag}@f1fantasy.test`;

  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser(${tag}) failed: ${error?.message}`);
  }
  const userId = data.user.id;

  // Mirror into public.users (would happen in /auth/callback in normal flow).
  const { error: upsertErr } = await svc.from("users").upsert({
    id: userId,
    email,
    display_name: tag,
  });
  if (upsertErr) throw new Error(`users.upsert(${tag}) failed: ${upsertErr.message}`);

  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw new Error(`signIn(${tag}) failed: ${signInErr.message}`);

  return { id: userId, email, client };
}

export async function createTestEvent(
  opts: { lockInFuture?: boolean } = {},
): Promise<{ id: string }> {
  const svc = serviceClient();
  const futureStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const pastStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await svc
    .from("events")
    .insert({
      season: 9999,
      round: Math.floor(Math.random() * 1000) + 1,
      name: "Test Grand Prix",
      circuit: "Testopolis",
      session_type: "race",
      session_start_at: opts.lockInFuture === false ? pastStart : futureStart,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`createTestEvent failed: ${error?.message}`);
  return { id: data.id };
}

export async function ensureTestDrivers(): Promise<void> {
  const svc = serviceClient();
  const rows = [
    { id: 901, code: "AAA", full_name: "Driver A", team: "Test Racing", active: true },
    { id: 902, code: "BBB", full_name: "Driver B", team: "Test Racing", active: true },
    { id: 903, code: "CCC", full_name: "Driver C", team: "Test Racing", active: true },
  ];
  const { error } = await svc.from("drivers").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`ensureTestDrivers failed: ${error.message}`);
}
