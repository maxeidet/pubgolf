"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Hill, Title } from "@/components/Decor";
import { Leaderboard, LiveDot } from "@/components/Leaderboard";
import { Sheet } from "@/components/Sheet";
import {
  clearPlayerId,
  errorText,
  formatToPar,
  readPlayerId,
  readToken,
  type Hole,
  type Player,
} from "@/lib/game";
import { getSupabase } from "@/lib/supabase";
import { rankOf, useLeaderboard } from "@/lib/useLeaderboard";

type Status = "saving" | "saved" | "error";

const PENALTIES = [
  ["+2", "Vattenhinder (toabesök)"],
  ["+4", "Sparka bollen (spiller drinken)"],
  ["+5", "I ruffen (kräks)"],
  ["+7", "Tappad tee (hoppar över ett hål)"],
];
const BONUSES = [
  ["−3", "Snyggast klädd"],
  ["−2", "Dubbeltrubbel (dubbel drink)"],
];

export default function Kort() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const board = useLeaderboard();
  const refreshBoard = board.refresh;

  const playerId = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<number, string>());
  const inputs = useRef(new Map<number, HTMLInputElement>());

  useEffect(() => {
    const id = readPlayerId();
    const token = readToken();
    if (!id || !token) {
      clearPlayerId();
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabase();
        const { data: p, error } = await sb
          .from("players")
          .select("id, name, game_id")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!p) {
          clearPlayerId();
          router.replace("/");
          return;
        }
        const [h, s] = await Promise.all([
          sb.from("holes").select("number, bar, par").eq("game_id", p.game_id).order("number"),
          sb.from("scores").select("hole_number, sips").eq("player_id", id),
        ]);
        if (h.error) throw h.error;
        if (s.error) throw s.error;
        if (cancelled) return;
        playerId.current = id;
        tokenRef.current = token;
        setPlayer(p);
        setHoles(h.data);
        setValues(Object.fromEntries(s.data.map((r) => [r.hole_number, String(r.sips)])));
      } catch (e) {
        if (!cancelled) setLoadError(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const save = useCallback(async (hole: number, raw: string) => {
    const pid = playerId.current;
    if (!pid) return;
    setStatus((s) => ({ ...s, [hole]: "saving" }));
    const { error } = await getSupabase().rpc("set_score", {
      p_player: pid,
      p_token: tokenRef.current,
      p_hole: hole,
      p_sips: raw === "" ? null : Number(raw),
    });
    if (error?.code === "28000") {
      // Session no longer valid: log in again with PIN.
      clearPlayerId();
      router.replace("/");
      return;
    }
    setStatus((s) => ({ ...s, [hole]: error ? "error" : "saved" }));
    if (!error) refreshBoard();
  }, [refreshBoard, router]);

  // Send any debounced saves right away (when leaving the page or hiding the tab).
  const flush = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    pending.current.forEach((raw, hole) => save(hole, raw));
    pending.current.clear();
  }, [save]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  // Coming back after a while: pick up anything saved from another device.
  useEffect(() => {
    const onVisible = async () => {
      const pid = playerId.current;
      if (document.visibilityState !== "visible" || !pid || pending.current.size) return;
      const { data, error } = await getSupabase()
        .from("scores")
        .select("hole_number, sips")
        .eq("player_id", pid);
      if (error || pending.current.size) return;
      setValues(Object.fromEntries(data.map((r) => [r.hole_number, String(r.sips)])));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  function onChange(hole: number, input: string) {
    const raw = input.replace(/\D/g, "").slice(0, 2);
    setValues((v) => ({ ...v, [hole]: raw }));
    pending.current.set(hole, raw);
    clearTimeout(timers.current.get(hole));
    timers.current.set(
      hole,
      setTimeout(() => {
        timers.current.delete(hole);
        pending.current.delete(hole);
        save(hole, raw);
      }, 400),
    );
  }

  function leave() {
    flush();
    clearPlayerId();
    router.replace("/");
  }

  if (loadError) {
    return (
      <div className="p-6">
        <Title>Scorekort</Title>
        <p className="mt-6 bg-cream p-4 text-red-800">{loadError}</p>
        <button onClick={leave} className="mt-4 underline">
          Börja om
        </button>
      </div>
    );
  }
  if (!player) {
    return <p className="p-8 text-center font-display text-2xl text-brun">Laddar…</p>;
  }

  const played = holes.filter((h) => (values[h.number] ?? "") !== "");
  const totalSips = played.reduce((sum, h) => sum + Number(values[h.number]), 0);
  const parPlayed = played.reduce((sum, h) => sum + h.par, 0);
  const parTotal = holes.reduce((sum, h) => sum + h.par, 0);
  const rank = rankOf(board.rows, player.id);
  const hasError = Object.values(status).includes("error");

  return (
    <>
      <Title size="sm">Scorekort</Title>

      <div className="flex items-baseline justify-between gap-3 px-4 pb-1.5 pt-2">
        <p className="truncate text-lg font-bold text-brun">{player.name}</p>
        <button onClick={leave} className="shrink-0 py-1 text-sm text-linje/70 underline">
          Inte du?
        </button>
      </div>

      <div className="px-3">
        <table className="w-full border-collapse overflow-hidden rounded-xl bg-kort font-mono text-[15px] shadow-[0_0_0_2px_var(--color-linje)]">
          <thead>
            <tr className="bg-linje text-left text-xs uppercase tracking-wide text-cream">
              <th className="w-8 py-1.5 text-center font-bold">#</th>
              <th className="px-2 py-1.5 font-bold">Bar</th>
              <th className="w-10 py-1.5 text-center font-bold">Par</th>
              <th className="w-[4.5rem] py-1.5 text-center font-bold">Klunkar</th>
            </tr>
          </thead>
          <tbody>
            {holes.map((h, i) => {
              const st = status[h.number];
              const v = values[h.number] ?? "";
              const diff = v === "" ? null : Number(v) - h.par;
              return (
                <tr key={h.number} className="border-t border-linje/25">
                  <td className="text-center font-bold text-linje/60">{h.number}</td>
                  <td className="px-2 py-0.5 leading-tight">{h.bar}</td>
                  <td className="text-center">{h.par}</td>
                  <td className="relative py-[3px] pr-1.5">
                    <input
                      ref={(el) => {
                        if (el) inputs.current.set(h.number, el);
                        else inputs.current.delete(h.number);
                      }}
                      aria-label={`Klunkar på hål ${h.number}, ${h.bar}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      enterKeyHint={i < holes.length - 1 ? "next" : "done"}
                      value={v}
                      onChange={(e) => onChange(h.number, e.target.value)}
                      onFocus={(e) => {
                        setEditing(true);
                        e.currentTarget.select();
                      }}
                      onBlur={() => setEditing(false)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const next = holes[i + 1];
                        if (next) inputs.current.get(next.number)?.focus();
                        else e.currentTarget.blur();
                      }}
                      className={`h-9 w-full rounded-lg border-2 text-center text-lg font-bold outline-none transition-colors focus:border-brun focus:ring-4 focus:ring-sol/70 ${
                        diff === null
                          ? "border-linje/15 bg-white"
                          : diff <= 0
                            ? "border-gron/60 bg-[#eef5e4]"
                            : "border-sol bg-[#fdf3d7]"
                      }`}
                    />
                    {st && st !== "saved" && (
                      <span
                        className={`absolute right-2.5 top-2 h-2 w-2 rounded-full ${
                          st === "saving" ? "bg-sol" : "bg-red-600"
                        }`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-linje font-bold">
              <td colSpan={2} className="px-2 py-2 text-right uppercase">
                Totalt
              </td>
              <td className="text-center">{parTotal}</td>
              <td className="pr-1.5 text-center text-2xl">{totalSips}</td>
            </tr>
          </tfoot>
        </table>

        {hasError && (
          <p role="alert" className="mt-2 rounded-lg bg-cream p-2 text-center text-sm text-red-800">
            Ett hål kunde inte sparas. Kolla uppkopplingen och ändra siffran igen.
          </p>
        )}
      </div>

      {/* Bottom dock: score summary + opens the leaderboard sheet */}
      <div
        className={`sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 mx-3 mt-3 transition-transform duration-300 ${
          editing ? "translate-y-[150%]" : ""
        }`}
      >
        <button
          onClick={() => setSheetOpen(true)}
          className="flex h-14 w-full items-center gap-3 rounded-2xl bg-brun px-4 text-left text-cream shadow-[0_8px_30px_rgba(0,0,0,0.3)] active:scale-[0.98]"
        >
          <div className="flex flex-col leading-none">
            <span className="text-[11px] uppercase tracking-wider text-cream/60">
              {played.length}/{holes.length} hål
            </span>
            <span className="mt-1 font-display text-2xl">
              {totalSips}
              <span className="ml-2 text-base text-sol">
                {played.length ? formatToPar(totalSips - parPlayed) : ""}
              </span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {rank && (
              <span className="rounded-full bg-cream/15 px-3 py-1 font-display text-lg">
                #{rank}
              </span>
            )}
            <span className="font-display text-xl uppercase tracking-wide">Topplista</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>
      </div>

      <Hill>
        <h2 className="text-center font-display text-3xl font-bold uppercase">Regler</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 font-mono text-xs leading-snug">
          <RuleList title="Straff" rows={PENALTIES} />
          <RuleList title="Bonus" rows={BONUSES} />
        </div>
      </Hill>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        header={
          <div className="flex items-center justify-between">
            <h2 className="font-display text-3xl font-bold uppercase text-brun">Topplista</h2>
            <div className="flex items-center gap-3">
              <LiveDot live={board.live} />
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Stäng"
                className="grid h-9 w-9 place-items-center rounded-full bg-linje/10 text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>
        }
      >
        <Leaderboard
          rows={board.rows}
          holeCount={board.holeCount}
          me={player.id}
          error={board.error}
        />
      </Sheet>
    </>
  );
}

function RuleList({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div>
      <h3 className="mb-1 font-display text-2xl">{title}</h3>
      <ul className="space-y-1">
        {rows.map(([pts, text]) => (
          <li key={text}>
            {pts}: {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
