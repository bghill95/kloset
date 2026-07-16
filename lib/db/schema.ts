import { sql } from "drizzle-orm";
import { bigint, boolean, date, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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

// Saved Explore pins (external Pexels photos). Stored denormalized so the
// Saved view renders without re-querying Pexels; unique pexels_id makes the
// heart a clean save/unsave toggle.
export const pins = pgTable("pins", {
  id: uuid("id").primaryKey().defaultRandom(),
  pexelsId: bigint("pexels_id", { mode: "number" }).notNull().unique(),
  imageUrl: text("image_url").notNull(),
  alt: text("alt").notNull().default(""),
  photographer: text("photographer").notNull().default(""),
  photographerUrl: text("photographer_url").notNull().default(""),
  pexelsUrl: text("pexels_url").notNull().default(""),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
