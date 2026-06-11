import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Styling App",
    short_name: "Styling",
    description: "Your virtual closet",
    start_url: "/closet",
    display: "standalone",
    background_color: "#faf9f7",
    theme_color: "#2b2b2e",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
