import assert from "node:assert/strict";
import { createQueue } from "@/lib/whatsapp/queue";

/**
 * The outbound queue decides whether messages arrive, in order, without
 * burying the iBot connection. Timing-based, so it lives outside pure.test.ts.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// tsx compiles this to CJS, which has no top-level await.
async function main() {

  // ---- messages to one recipient stay in order and keep their gap
  {
    const q = createQueue({ gapMs: 50, maxConcurrent: 1 });
    const order: number[] = [];
    const at: number[] = [];
    const started = Date.now();
    await Promise.all(
      [1, 2, 3].map((n) =>
        q.enqueue("972500000001", async () => {
          at.push(Date.now() - started);
          // Deliberately out of order: a slow first message must still land first.
          await sleep(n === 1 ? 30 : 1);
          order.push(n);
        }),
      ),
    );
    assert.deepEqual(order, [1, 2, 3], "same recipient must keep send order");
    assert.ok(at[1] - at[0] >= 45, `gap 1->2 was ${at[1] - at[0]}ms, expected >= 50`);
    assert.ok(at[2] - at[1] >= 45, `gap 2->3 was ${at[2] - at[1]}ms, expected >= 50`);
    console.log("QUEUE ORDER OK");
  }

  // ---- the default paces every recipient through one connection (CLAUDE.md)
  {
    const q = createQueue({ gapMs: 40, maxConcurrent: 1 });
    let inFlight = 0;
    let peak = 0;
    const at: number[] = [];
    const started = Date.now();
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        q.enqueue(`recipient-${i}`, async () => {
          at.push(Date.now() - started);
          inFlight++;
          peak = Math.max(peak, inFlight);
          await sleep(5);
          inFlight--;
        }),
      ),
    );
    assert.equal(peak, 1, "the default must never put two sends on the wire at once");
    for (let i = 1; i < at.length; i++) {
      assert.ok(at[i] - at[i - 1] >= 35, `gap ${i} was ${at[i] - at[i - 1]}ms, expected >= 40`);
    }
    console.log("QUEUE GLOBAL PACING OK");
  }

  // ---- raising maxConcurrent is what removes cross-recipient waiting
  {
    const q = createQueue({ gapMs: 0, maxConcurrent: 3 });
    const started = Date.now();
    let fastFinishedAt = 0;
    const slow = Promise.all([1, 2, 3].map(() => q.enqueue("972500000001", () => sleep(60))));
    const fast = q.enqueue("972500000002", async () => {
      fastFinishedAt = Date.now() - started;
    });
    await Promise.all([slow, fast]);
    // Three queued sends to A take ~180ms. B must not wait behind them.
    assert.ok(fastFinishedAt < 60, `other recipient waited ${fastFinishedAt}ms behind a busy one`);
    console.log("QUEUE NO HEAD-OF-LINE BLOCKING OK");
  }

  // ---- the shared iBot connection is never hit by more than maxConcurrent
  {
    const q = createQueue({ gapMs: 0, maxConcurrent: 3 });
    let inFlight = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        q.enqueue(`recipient-${i}`, async () => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          await sleep(10);
          inFlight--;
        }),
      ),
    );
    assert.equal(peak <= 3, true, `peak concurrency was ${peak}, cap is 3`);
    assert.equal(inFlight, 0);
    console.log("QUEUE CONCURRENCY CAP OK");
  }

  // ---- a failed send must not poison the lane, and the lane must be released
  {
    const q = createQueue({ gapMs: 10, maxConcurrent: 3 });
    const boom = q.enqueue("972500000003", async () => {
      throw new Error("send failed");
    });
    await assert.rejects(boom, /send failed/);
    const after = await q.enqueue("972500000003", async () => "delivered");
    assert.equal(after, "delivered", "a throw must not block the next message to the same chat");
    console.log("QUEUE FAILURE ISOLATION OK");
  }

  // ---- lanes are dropped once idle, or a warm instance leaks one per recipient
  {
    const q = createQueue({ gapMs: 0, maxConcurrent: 5 });
    await Promise.all(
      Array.from({ length: 200 }, (_, i) => q.enqueue(`recipient-${i}`, async () => i)),
    );
    // Settle the microtask that drops each lane.
    await sleep(10);
    assert.equal(q.size(), 0, `queue kept ${q.size()} lanes after everything finished`);
    console.log("QUEUE NO LANE LEAK OK");
  }

  console.log("ALL QUEUE TESTS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
