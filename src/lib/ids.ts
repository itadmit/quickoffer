import { customAlphabet } from "nanoid";

// No look-alikes (0/O, 1/l/I) - these ids get read off a phone screen.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Short ids that get read off a phone screen. 6 chars over a 55-char alphabet
 * ≈ 2.8×10¹⁰ combinations - unguessable in practice, short enough to be pleasant.
 */
export const SHORT_ID_LENGTH = 6;
export const newShortId = customAlphabet(alphabet, SHORT_ID_LENGTH);

/** Public id for /q/{publicId} (PRODUCT.md §8.2) */
export const newPublicId = newShortId;

/** Code for /e/{code} and /s/{code} magic links */
export const newLinkCode = newShortId;
