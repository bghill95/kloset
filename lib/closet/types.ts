import type { Category } from "./categories";

export type ClosetItem = {
  id: string;
  name: string;
  category: Category;
  colors: string[];
  styleTags: string[];
  imageUrl: string;
  originalImageUrl: string;
  createdAt: Date;
};

// ClosetItem as it crosses a JSON boundary (Date serializes to an ISO string).
export type SerializedClosetItem = Omit<ClosetItem, "createdAt"> & { createdAt: string };
