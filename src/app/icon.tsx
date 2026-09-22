import { ImageResponse } from "next/og";

/**
 * Favicon and tab icon: the same rounded-square mic mark as the site header,
 * drawn once here so the two can't drift apart.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<Mark size={32} radius={8} />, size);
}

export function Mark({ size: s, radius }: { size: number; radius: number }) {
  const stroke = Math.max(2, Math.round(s * 0.085));
  return (
    <div
      style={{
        width: s,
        height: s,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f766e",
        borderRadius: radius,
      }}
    >
      <svg
        width={s * 0.56}
        height={s * 0.56}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={stroke * (24 / s)}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <path d="M12 17v4" />
      </svg>
    </div>
  );
}
