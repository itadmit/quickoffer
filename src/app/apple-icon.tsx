import { ImageResponse } from "next/og";
import { Mark } from "./icon";

/**
 * Home-screen icon. iOS applies its own mask, so this one is a full-bleed
 * square with the mark centred rather than a rounded card inside a card.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<Mark size={180} radius={0} />, size);
}
