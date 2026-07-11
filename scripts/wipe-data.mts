import { del, list } from "@vercel/blob";
import { getDb } from "../lib/db/client";
import { basePhotos, items } from "../lib/db/schema";

const db = getDb();
const deletedItems = await db.delete(items).returning({ id: items.id });
const deletedPhotos = await db.delete(basePhotos).returning({ id: basePhotos.id });
let blobCount = 0;
if (process.env.BLOB_READ_WRITE_TOKEN) {
  const { blobs } = await list();
  await Promise.all(blobs.map((b) => del(b.url)));
  blobCount = blobs.length;
} else {
  console.log("no BLOB_READ_WRITE_TOKEN — skipping blob cleanup");
}
console.log(
  `wiped ${deletedItems.length} items, ${deletedPhotos.length} base photos, ${blobCount} blobs`,
);
