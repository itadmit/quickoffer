import { customAlphabet } from "nanoid";

// No look-alikes (0/O, 1/l/I) — these ids get read off a phone screen.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/** 10-char public id for /q/{publicId} (PRODUCT.md §8.2) */
export const newPublicId = customAlphabet(alphabet, 10);
