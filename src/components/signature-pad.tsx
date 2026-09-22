"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";

/**
 * Signature capture that looks like ink.
 *
 * A constant-width polyline is the tell of a cheap tool, and this is the moment
 * a customer commits money. So: width follows pen speed (fast = thin, like a
 * real nib), segments are smoothed through their midpoints, and strokes are
 * kept as points rather than pixels - which is what makes undo and a crisp
 * redraw after a rotate possible.
 */

export type SignaturePadHandle = {
  toDataURL: () => string;
  clear: () => void;
  isEmpty: () => boolean;
};

type Point = { x: number; y: number; w: number };
type Stroke = Point[];

// Nib width in CSS pixels. Slow strokes reach MAX, fast ones taper toward MIN.
const MIN_WIDTH = 0.9;
const MAX_WIDTH = 3.1;
/** Speed (px/ms) at which the line reaches MIN_WIDTH. */
const SPEED_AT_MIN = 1.6;
/** How quickly width follows a change in speed. Low = smooth, lagging nib. */
const WIDTH_EASING = 0.38;
const INK = "#0f172a";

export function SignaturePad({
  ref,
  onChange,
  label = "חתימה",
}: {
  ref: React.RefObject<SignaturePadHandle | null>;
  onChange?: (empty: boolean) => void;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const lastAt = useRef(0);
  const lastWidth = useRef(MAX_WIDTH);
  const [isEmpty, setEmpty] = useState(true);

  const setEmptyState = useCallback(
    (v: boolean) => {
      setEmpty(v);
      onChange?.(v);
    },
    [onChange],
  );

  /** Repaint everything from the stored points - used on resize and undo. */
  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { width, height } = c.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    for (const stroke of strokes.current) drawStroke(ctx, stroke);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    // Backing store follows the device pixel ratio, so the ink is not fuzzy on
    // a phone, and follows element size, so a rotate does not stretch it.
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = c.getBoundingClientRect();
      if (!width || !height) return;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(c);

    const at = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const down = (e: PointerEvent) => {
      // Ignore a second finger mid-stroke, and palm contact on a touchscreen.
      if (current.current) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const p = at(e);
      lastAt.current = e.timeStamp;
      lastWidth.current = MAX_WIDTH;
      current.current = [{ ...p, w: MAX_WIDTH }];
      strokes.current.push(current.current);
      if (isEmpty) setEmptyState(false);
    };

    const move = (e: PointerEvent) => {
      const stroke = current.current;
      if (!stroke) return;
      e.preventDefault();
      const p = at(e);
      const prev = stroke[stroke.length - 1];
      const dt = Math.max(1, e.timeStamp - lastAt.current);
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (dist < 0.4) return; // ignore jitter while the finger rests

      // Pressure when the hardware reports it (Apple Pencil), speed otherwise.
      const fromSpeed = 1 - Math.min(1, dist / dt / SPEED_AT_MIN);
      const t = e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : fromSpeed;
      const target = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * t;
      const w = lastWidth.current + (target - lastWidth.current) * WIDTH_EASING;

      lastWidth.current = w;
      lastAt.current = e.timeStamp;
      stroke.push({ ...p, w });

      const ctx = c.getContext("2d");
      if (ctx) drawTail(ctx, stroke);
    };

    const up = (e: PointerEvent) => {
      if (!current.current) return;
      // A tap with no movement is still a mark - give it a dot.
      if (current.current.length === 1) redrawDot(c, current.current[0]);
      current.current = null;
      if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
    };

    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("pointerleave", up);

    ref.current = {
      toDataURL: () => c.toDataURL("image/png"),
      clear: () => {
        strokes.current = [];
        current.current = null;
        redraw();
        setEmptyState(true);
      },
      isEmpty: () => strokes.current.length === 0,
    };

    return () => {
      ro.disconnect();
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      c.removeEventListener("pointerleave", up);
    };
  }, [ref, redraw, isEmpty, setEmptyState]);

  const undo = () => {
    strokes.current.pop();
    redraw();
    if (!strokes.current.length) setEmptyState(true);
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm text-muted">
        <span>{label} (באצבע)</span>
        <span className="flex gap-3">
          <button
            type="button"
            onClick={undo}
            disabled={isEmpty}
            className="inline-flex items-center gap-1 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" /> בטל
          </button>
          <button
            type="button"
            onClick={() => ref.current?.clear()}
            disabled={isEmpty}
            className="underline disabled:opacity-40"
          >
            נקה
          </button>
        </span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-label={label}
          className="w-full h-44 bg-white rounded-xl border-2 border-dashed border-line touch-none block"
          style={{ touchAction: "none" }}
        />
        {isEmpty && (
          <div className="absolute inset-x-6 bottom-8 pointer-events-none select-none">
            <div className="border-b border-dashed border-slate-300" />
            <div className="text-center text-xs text-slate-400 pt-1.5">חתום כאן</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- rendering

/**
 * Draw one segment as a quadratic through the midpoints of consecutive points.
 * Filling a tapered quad per segment (rather than stroking a polyline) is what
 * lets the width change continuously inside a single stroke.
 */
function drawSegment(ctx: CanvasRenderingContext2D, a: Point, b: Point, c: Point) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  ctx.beginPath();
  ctx.moveTo(m1.x, m1.y);
  ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
  ctx.lineWidth = b.w;
  ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.length === 1) {
    dot(ctx, stroke[0]);
    return;
  }
  for (let i = 1; i < stroke.length - 1; i++) {
    drawSegment(ctx, stroke[i - 1], stroke[i], stroke[i + 1]);
  }
  // close the gap to the final point
  const last = stroke[stroke.length - 1];
  const prev = stroke[stroke.length - 2];
  ctx.beginPath();
  ctx.moveTo((prev.x + last.x) / 2, (prev.y + last.y) / 2);
  ctx.lineTo(last.x, last.y);
  ctx.lineWidth = last.w;
  ctx.stroke();
}

/** Only the newest segment, so live drawing stays cheap on a phone. */
function drawTail(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const n = stroke.length;
  if (n < 3) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  drawSegment(ctx, stroke[n - 3], stroke[n - 2], stroke[n - 1]);
}

function dot(ctx: CanvasRenderingContext2D, p: Point) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.w / 1.6, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
}

function redrawDot(canvas: HTMLCanvasElement, p: Point) {
  const ctx = canvas.getContext("2d");
  if (ctx) dot(ctx, p);
}
