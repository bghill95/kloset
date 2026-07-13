import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kloset",
    short_name: "Kloset",
    description: "Your virtual closet",
    start_url: "/today",
    display: "standalone",
    background_color: "#1c1017",
    theme_color: "#1c1017",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
