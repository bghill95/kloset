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
