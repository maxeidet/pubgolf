import { formatToPar } from "@/lib/game";
import type { Row } from "@/lib/useLeaderboard";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LiveDot({ live }: { live: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-linje/70">
      <span
        className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-green-700" : "bg-linje/30"}`}
      />
      {live ? "Live" : "Ansluter"}
    </span>
  );
}

export function Leaderboard({
  rows,
  holeCount,
  me,
  error,
}: {
  rows: Row[] | null;
  holeCount: number;
  me: string | null;
  error: string | null;
}) {
  if (error) return <p className="m-3 rounded-lg bg-cream p-3 text-sm text-red-800">{error}</p>;
  if (rows === null)
    return <p className="p-6 text-center font-display text-xl text-brun">Laddar…</p>;
  if (rows.length === 0)
    return <p className="p-6 text-center text-sm">Ingen har gått med än.</p>;

  return (
    <div>
      <div className="flex items-center gap-2 px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-linje/50">
        <span className="w-7" />
        <span className="flex-1">Spelare</span>
        <span className="w-9 text-right">Hål</span>
        <span className="w-9 text-right">Tot</span>
        <span className="w-9 text-right">+/−</span>
      </div>
      <ol>
        {rows.map((r, i) => {
          const mine = r.id === me;
          return (
            <li
              key={r.id}
              className={`mx-2 flex items-center gap-2 rounded-xl px-2 py-2 ${
                mine ? "bg-sol/60" : i % 2 ? "" : "bg-white/50"
              }`}
            >
              <span className="w-7 text-center font-display text-lg leading-none text-brun">
                {r.played ? (MEDALS[i] ?? i + 1) : "–"}
              </span>
              <span className={`flex-1 truncate ${mine ? "font-bold" : "font-medium"}`}>
                {r.name}
                {mine && <span className="ml-1 text-xs font-normal text-linje/60">(du)</span>}
              </span>
              <span className="w-9 text-right font-mono text-xs text-linje/60">
                {r.played}/{holeCount}
              </span>
              <span className="w-9 text-right font-mono text-lg font-bold">{r.total}</span>
              <span className="w-9 text-right font-mono text-sm">
                {r.played ? formatToPar(r.toPar) : "–"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
