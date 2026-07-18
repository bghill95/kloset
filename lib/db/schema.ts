import { sql } from "drizzle-orm";
import { bigint, boolean, date, doublePrecision, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Keep in sync with CATEGORIES in lib/closet/categories.ts
  category: text("category", {
    enum: ["top", "bottom", "dress", "jacket", "shoes", "hat", "accessory"],
  }).notNull(),
  colors: text("colors").array().notNull().default(sql`'{}'::text[]`),
  styleTags: text("style_tags").array().notNull().default(sql`'{}'::text[]`),
  imageUrl: text("image_url").notNull(),
  originalImageUrl: text("original_image_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const basePhotos = pgTable("base_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: text("image_url").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const outfits = pgTable("outfits", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Plain id array, no FK — deleted items drop out of collages at read time.
  itemIds: uuid("item_ids").array().notNull(),
  renderUrl: text("render_url"),
  source: text("source", { enum: ["studio", "stylist", "today"] })
    .notNull()
    .default("studio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const wears = pgTable(
  "wears",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Plain id, no FK (house pattern) — DELETE /api/outfits/[id] sweeps its wears.
    outfitId: uuid("outfit_id").notNull(),
    // date column ⇒ "YYYY-MM-DD" strings, matching the client's local dateKey.
    wornOn: date("worn_on").notNull(),
  },
  // Same outfit + same day is a toggle, never a duplicate. Name pinned here,
  // in the e2e mirror, and in the live DB so all three agree and db:push
  // never tries to recreate it (residual DROP/ADD churn on every push is a
  // separate upstream drizzle-kit bug, see CLAUDE.md learned rule).
  (t) => [unique("wears_outfit_id_worn_on_unique").on(t.outfitId, t.wornOn)],
);

// Saved Explore pins (hearted from the feed). Stored denormalized so the
// Saved view renders without re-querying the source; unique (source,
// external_id) makes the heart a clean save/unsave toggle. Column names
// photographer/photographer_url/pexels_url are legacy Pexels-era names —
// they now hold credit/credit_url/source_url for any source.
export const pins = pgTable(
  "pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source", { enum: ["pexels", "pinterest"] })
      .notNull()
      .default("pexels"),
    externalId: text("external_id").notNull(),
    // ponytail: dead Pexels-era column — kept nullable to avoid drizzle-kit
    // rename prompts on push; drop manually whenever convenient.
    pexelsId: bigint("pexels_id", { mode: "number" }),
    imageUrl: text("image_url").notNull(),
    alt: text("alt").notNull().default(""),
    photographer: text("photographer").notNull().default(""),
    photographerUrl: text("photographer_url").notNull().default(""),
    pexelsUrl: text("pexels_url").notNull().default(""),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("pins_source_external_id_unique").on(t.source, t.externalId)],
);

// Cache of pins pulled from the user's selected Pinterest boards. Replaced
// wholesale per board on each sync; the Explore feed reads only this table.
export const pinterestPins = pgTable("pinterest_pins", {
  id: text("id").primaryKey(), // Pinterest pin id — numeric string, can exceed 2^53
  boardId: text("board_id").notNull(),
  boardName: text("board_name").notNull().default(""),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  link: text("link").notNull().default(""),
  imageUrl: text("image_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  savedAt: timestamp("saved_at"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

// Outfit-combo feedback (👍/👎 on suggestion cards). item_key is the
// canonical sorted id list — one vote per distinct combo, so re-voting
// toggles or flips in place. No FK (house pattern): deleted items simply
// stop matching at aggregation time.
export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemKey: text("item_key").notNull().unique(),
  itemIds: uuid("item_ids").array().notNull(),
  verdict: text("verdict", { enum: ["like", "dislike"] }).notNull(),
  source: text("source", { enum: ["studio", "stylist", "today"] })
    .notNull()
    .default("stylist"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Trips with an AI packing capsule. capsule = JSON-encoded {itemId, role}[]
// (deleted items drop out at read time); packed_ids = the ticked subset.
export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  destination: text("destination").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  capsule: text("capsule").notNull().default("[]"),
  packedIds: uuid("packed_ids").array().notNull().default(sql`'{}'::uuid[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
