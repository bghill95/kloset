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
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS base_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url text NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS outfits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    item_ids uuid[] NOT NULL,
    render_url text,
    source text NOT NULL DEFAULT 'studio',
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS wears (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    outfit_id uuid NOT NULL,
    worn_on date NOT NULL,
    CONSTRAINT wears_outfit_id_worn_on_unique UNIQUE (outfit_id, worn_on)
  )`;
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS pins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL DEFAULT 'pexels',
    external_id text NOT NULL,
    pexels_id bigint,
    image_url text NOT NULL,
    alt text NOT NULL DEFAULT '',
    photographer text NOT NULL DEFAULT '',
    photographer_url text NOT NULL DEFAULT '',
    pexels_url text NOT NULL DEFAULT '',
    width integer NOT NULL,
    height integer NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT pins_source_external_id_unique UNIQUE (source, external_id)
  )`;
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS pinterest_pins (
    id text PRIMARY KEY,
    board_id text NOT NULL,
    board_name text NOT NULL DEFAULT '',
    title text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    link text NOT NULL DEFAULT '',
    image_url text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    saved_at timestamp,
    synced_at timestamp NOT NULL DEFAULT now()
  )`;
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_key text NOT NULL UNIQUE,
    item_ids uuid[] NOT NULL,
    verdict text NOT NULL,
    source text NOT NULL DEFAULT 'stylist',
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  // Keep in sync with lib/db/schema.ts
  await sql`CREATE TABLE IF NOT EXISTS trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destination text NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    capsule text NOT NULL DEFAULT '[]',
    packed_ids uuid[] NOT NULL DEFAULT '{}',
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`DELETE FROM settings`;
  await sql`DELETE FROM items`;
  await sql`DELETE FROM base_photos`;
  await sql`DELETE FROM outfits`;
  await sql`DELETE FROM wears`;
  await sql`DELETE FROM pins`;
  await sql`DELETE FROM pinterest_pins`;
  await sql`DELETE FROM preferences`;
  await sql`DELETE FROM trips`;
}
