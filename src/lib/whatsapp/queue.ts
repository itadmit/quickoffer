/**
 * The outbound queue.
 *
 * Two separate promises, which the previous single global chain conflated:
 *
 *  - Messages to the same recipient arrive in order and never overlap. This is
 *    a correctness property and is always on.
 *  - The shared iBot connection is not fired at faster than it tolerates. This
 *    is a risk decision, and it belongs to whoever owns the WhatsApp account.
 *
 * The defaults below reproduce exactly what the single chain did (one send at
 * a time, 400ms apart), because CLAUDE.md records that as a deliberate choice
 * about iBot, not an implementation detail. Raising `maxConcurrent` is the one
 * knob that removes the cross-recipient latency on a warm instance, where
 * several webhook invocations share one process and one professional's three
 * messages currently delay an unrelated professional's first one. It trades
 * directly against how hard an unofficial WhatsApp connection is being pushed,
 * so it is a decision to make on purpose rather than a default to drift into.
 *
 * All of it is per instance, as it always was: a second Vercel instance sends
 * in parallel regardless, so this has never been a global rate limiter.
 */

export type Queue = {
  enqueue<T>(key: string, job: () => Promise<T>): Promise<T>;
  /** Recipients with work in flight. Tests assert this returns to zero. */
  size(): number;
};

type Lane = {
  chain: Promise<unknown>;
  /** Jobs queued but not finished. At zero the lane is dropped, so the map
   *  never grows past the number of recipients being written to right now. */
  waiting: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createQueue({
  gapMs = 400,
  maxConcurrent = 1,
}: { gapMs?: number; maxConcurrent?: number } = {}): Queue {
  const lanes = new Map<string, Lane>();

  let active = 0;
  let lastStartedAt = 0;
  const waiters: Array<() => void> = [];

  async function acquire() {
    // A loop rather than a single await: waking up is permission to re-check,
    // not permission to run, so two waiters released together cannot both slip
    // past the cap.
    while (active >= maxConcurrent) {
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    active++;
    // Spacing is global, not per lane - it protects the one connection that
    // every recipient's messages go out through.
    const wait = lastStartedAt + gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastStartedAt = Date.now();
  }

  function release() {
    active--;
    waiters.shift()?.();
  }

  return {
    size: () => lanes.size,

    enqueue<T>(key: string, job: () => Promise<T>): Promise<T> {
      let lane = lanes.get(key);
      if (!lane) {
        lane = { chain: Promise.resolve(), waiting: 0 };
        lanes.set(key, lane);
      }
      const mine = lane;
      mine.waiting++;

      const run = mine.chain.then(async () => {
        await acquire();
        try {
          return await job();
        } finally {
          release();
        }
      });

      // The next send to this recipient queues behind this one whether it
      // succeeded or not; a failure must not poison the lane.
      mine.chain = run.then(
        () => undefined,
        () => undefined,
      );
      void mine.chain.then(() => {
        mine.waiting--;
        // No await between the decrement and the delete, so nothing can
        // observe a lane at zero and still hold a reference to it.
        if (mine.waiting === 0 && lanes.get(key) === mine) lanes.delete(key);
      });

      return run;
    },
  };
}
