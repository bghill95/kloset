import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kloset",
    short_name: "Kloset",
    description: "Your virtual closet",
    start_url: "/today",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
