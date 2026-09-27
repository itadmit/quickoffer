import type { Block } from "@/lib/blog";

/**
 * Renders a post's typed blocks. Server component: these pages exist to be
 * crawled, so everything that matters has to be in the HTML that arrives.
 *
 * Tables get their own horizontal scroll container - the price tables are wider
 * than a phone, and the alternative is a page that scrolls sideways as a whole.
 */
export function Blocks({ blocks }: { blocks: readonly Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "p":
            return (
              <p key={i} className="text-ink/90 leading-8">
                {block.text}
              </p>
            );

          case "list":
            return (
              <ul key={i} className="space-y-2">
                {block.items.map((item) => (
                  <li key={item} className="relative pr-6 text-ink/90 leading-8">
                    <span
                      aria-hidden
                      className="absolute right-0 top-[0.95rem] h-1.5 w-1.5 rounded-full bg-brand"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            );

          case "steps":
            return (
              <ol key={i} className="space-y-3 counter-reset">
                {block.items.map((item, n) => (
                  <li key={item} className="flex gap-3 text-ink/90 leading-8">
                    <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                      {n + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );

          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[32rem] border-collapse text-right text-sm">
                  <thead>
                    <tr className="bg-card">
                      {block.head.map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="border-b border-line px-4 py-3 font-semibold text-ink"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.join("|")} className="odd:bg-card/50">
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            className={`border-b border-line px-4 py-3 align-top leading-7 ${
                              c === 0 ? "font-medium text-ink" : "text-ink/80"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "note":
            return (
              <aside
                key={i}
                className="rounded-xl border-r-4 border-brand bg-brand-soft/40 px-5 py-4 leading-8 text-ink"
              >
                {block.text}
              </aside>
            );
        }
      })}
    </>
  );
}
