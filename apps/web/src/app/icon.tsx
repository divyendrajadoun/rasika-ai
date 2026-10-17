import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon: a gold palace arch on the maroon stage. */
export default function Icon() {
  const c = brand.colors;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: c.stage,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          width: 30,
          height: 44,
          marginBottom: 8,
          borderRadius: "15px 15px 4px 4px",
          border: `4px solid ${c.gold}`,
          background: c.terracotta,
        }}
      />
    </div>,
    size,
  );
}
