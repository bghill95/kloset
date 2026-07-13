import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  const font = await readFile(
    path.join(process.cwd(), "assets/fonts/GreatVibes-Regular.ttf"),
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#a85a72",
          color: "#ffffff",
          fontFamily: "Great Vibes",
          fontSize: 360,
          paddingBottom: 40,
        }}
      >
        K
      </div>
    ),
    { ...size, fonts: [{ name: "Great Vibes", data: font, style: "normal" }] },
  );
}
