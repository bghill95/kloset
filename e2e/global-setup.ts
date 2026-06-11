import { config } from "dotenv";
config({ path: ".env.local" });

export default async function globalSetup() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL)`;
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text NOT NULL,
    colors text[] NOT NULL DEFAULT '{}',
    style_tags text[] NOT NULL DEFAULT '{}',
    image_url text NOT NULL,
    original_image_url text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`DELETE FROM settings`;
  await sql`DELETE FROM items`;
}
