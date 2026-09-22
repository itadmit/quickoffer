/**
 * Logical → visual reordering for the OG image.
 *
 * Satori (which renders `next/og`) does not implement the bidi algorithm: it
 * lays characters out in logical order, so Hebrew comes out mirrored and mixed
 * Hebrew/number strings come out scrambled. Verified against the real renderer,
 * not assumed - a pure-Hebrew string passed in reverse renders correctly, and a
 * digit run passed as-is renders correctly.
 *
 * So we do the reordering ourselves: split into directional runs, put the runs
 * in visual (left-to-right) order for a right-to-left paragraph, and reverse
 * the characters inside the right-to-left ones.
 *
 * Only used for the OG card. The web pages are real HTML and the browser does
 * this properly on its own.
 */

const RTL_CHAR = /[֐-׿؀-ۿ܀-ݏיִ-ﭏ]/;
const LTR_CHAR = /[A-Za-z0-9]/;

type Dir = "R" | "L" | "N";

const MIRROR: Record<string, string> = {
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "{": "}",
  "}": "{",
  "<": ">",
  ">": "<",
};

function classify(ch: string): Dir {
  if (RTL_CHAR.test(ch)) return "R";
  if (LTR_CHAR.test(ch)) return "L";
  return "N";
}

/**
 * Reorder `text` from logical to visual order, assuming a right-to-left
 * paragraph. Neutrals (spaces, punctuation, ₪) join the run on either side when
 * both agree, and otherwise go with the paragraph direction.
 */
export function toVisual(text: string): string {
  if (!text) return "";
  const chars = [...text];
  const dirs = chars.map(classify);

  // Resolve every neutral to R or L before grouping.
  for (let i = 0; i < dirs.length; i++) {
    if (dirs[i] !== "N") continue;
    let end = i;
    while (end + 1 < dirs.length && dirs[end + 1] === "N") end++;
    const before = i > 0 ? dirs[i - 1] : "R";
    const after = end + 1 < dirs.length ? dirs[end + 1] : "R";
    const resolved: Dir = before === after ? before : "R";
    for (let j = i; j <= end; j++) dirs[j] = resolved;
    i = end;
  }

  // Group into runs of one direction.
  const runs: { dir: Dir; text: string }[] = [];
  for (let i = 0; i < chars.length; i++) {
    const last = runs[runs.length - 1];
    if (last && last.dir === dirs[i]) last.text += chars[i];
    else runs.push({ dir: dirs[i], text: chars[i] });
  }

  // Right-to-left paragraph: the first logical run sits rightmost.
  return runs
    .reverse()
    .map((run) =>
      run.dir === "R"
        ? [...run.text].reverse().map((c) => MIRROR[c] ?? c).join("")
        : run.text,
    )
    .join("");
}
