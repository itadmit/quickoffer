/**
 * How long a voice note actually is.
 *
 * This used to be guessed from the file size at a fixed 1.2 KB/s, measured
 * once from a WhatsApp note. Opus is variable bitrate, so the guess is only
 * right for recordings that happen to match that sample: a real 10.3 second
 * note from the Blob measured 20.7 by the estimate, and Groq - which bills the
 * true duration - charged for 10.
 *
 * Being wrong by a factor of two mattered twice. The three minute ceiling was
 * really rejecting at about ninety seconds while the bot said "up to three
 * minutes", and every transcription cost we reported was double.
 *
 * Ogg carries the answer exactly: the granule position on the final page is a
 * sample count. Reading it is a backwards scan of a few kilobytes.
 */

/** Opus always reports granule positions at 48kHz, whatever it was recorded at. */
const OPUS_RATE = 48_000;

/** Fallback only, for a container we cannot read. Conservative for Opus voice. */
const ASSUMED_BYTES_PER_SECOND = 1200;

/**
 * Duration in seconds, or null when the container is not one we can read.
 *
 * Never throws on a malformed file: callers treat null as "unknown" and fall
 * back, because refusing a quote over a header we failed to parse is worse
 * than transcribing something slightly too long.
 */
export function audioDurationSeconds(buf: Buffer): number | null {
  return oggDuration(buf) ?? wavDuration(buf);
}

/**
 * The last Ogg page's granule position, in samples. Pages are found by their
 * "OggS" capture pattern, scanning back from the end because the final page is
 * the one carrying the total.
 */
function oggDuration(buf: Buffer): number | null {
  if (buf.length < 27 || buf.toString("latin1", 0, 4) !== "OggS") return null;
  // A page header is 27 bytes plus the segment table, so anything past the
  // last few pages is irrelevant - bound the scan rather than walk the file.
  const from = Math.max(0, buf.length - 65_536);
  const idx = buf.lastIndexOf("OggS", buf.length, "latin1");
  if (idx < from || idx + 14 > buf.length) return null;
  // Read as two 32-bit halves rather than BigInt: the tsconfig target predates
  // BigInt literals, and a granule count never approaches 2^53 anyway (that is
  // five thousand years of audio).
  const lo = buf.readUInt32LE(idx + 6);
  const hi = buf.readInt32LE(idx + 10);
  // -1 across both halves means "no packet finishes on this page"; a header
  // page reports 0.
  if (hi < 0) return null;
  const granule = hi * 2 ** 32 + lo;
  if (granule <= 0) return null;
  const seconds = granule / OPUS_RATE;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** RIFF/WAVE: data chunk size over the byte rate. Used by the TTS test files. */
function wavDuration(buf: Buffer): number | null {
  if (buf.length < 44) return null;
  if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WAVE") return null;
  let pos = 12;
  let byteRate = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("latin1", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    // byteRate sits at +16 in the fmt chunk; +12 is the sample rate, and
    // reading that instead doubles every duration on 16-bit mono.
    if (id === "fmt " && pos + 20 <= buf.length) byteRate = buf.readUInt32LE(pos + 16);
    if (id === "data" && byteRate > 0) return size / byteRate;
    pos += 8 + size + (size % 2);
  }
  return null;
}

/**
 * What the ceiling and the cost estimate use: the real duration when the
 * container gives it up, and the old guess when it does not.
 */
export function audioSeconds(buf: Buffer): number {
  return audioDurationSeconds(buf) ?? buf.length / ASSUMED_BYTES_PER_SECOND;
}
