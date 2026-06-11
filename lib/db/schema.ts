import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Keep in sync with CATEGORIES in lib/closet/categories.ts
  category: text("category", {
    enum: ["top", "bottom", "jacket", "shoes", "hat"],
  }).notNull(),
  colors: text("colors").array().notNull().default(sql`'{}'::text[]`),
  styleTags: text("style_tags").array().notNull().default(sql`'{}'::text[]`),
  imageUrl: text("image_url").notNull(),
  originalImageUrl: text("original_image_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
