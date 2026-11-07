"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorText, getActiveGame } from "./game";
import { getSupabase } from "./supabase";

export type Row = { id: string; name: string; played: number; total: number; toPar: number };

// Live leaderboard for the active game. Refetches on any change to scores/players.
export function useLeaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [holeCount, setHoleCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const sb = getSupabase();
      const game = await getActiveGame();
      if (!game) throw new Error("Inget aktivt spel hittades.");
      const [h, p] = await Promise.all([
        sb.from("holes").select("number, par").eq("game_id", game.id),
        sb.from("players").select("id, name").eq("game_id", game.id),
      ]);
      if (h.error) throw h.error;
      if (p.error) throw p.error;
      const ids = p.data.map((x) => x.id);
      const s = ids.length
        ? await sb.from("scores").select("player_id, hole_number, sips").in("player_id", ids)
        : { data: [], error: null };
      if (s.error) throw s.error;

      const par = new Map(h.data.map((x) => [x.number, x.par]));
      const byPlayer = new Map<string, Row>(
        p.data.map((x) => [x.id, { id: x.id, name: x.name, played: 0, total: 0, toPar: 0 }]),
      );
      for (const sc of s.data ?? []) {
        const row = byPlayer.get(sc.player_id);
        if (!row) continue;
        row.played += 1;
        row.total += sc.sips;
        row.toPar += sc.sips - (par.get(sc.hole_number) ?? 0);
      }
      const sorted = [...byPlayer.values()].sort(
        (a, b) =>
          Number(a.played === 0) - Number(b.played === 0) ||
          a.total - b.total ||
          b.played - a.played ||
          a.name.localeCompare(b.name, "sv"),
      );
      setHoleCount(h.data.length);
      setRows(sorted);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  const refresh = useCallback(() => {
    clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(load, 250);
  }, [load]);

  useEffect(() => {
    load();
    const sb = getSupabase();
    const channel = sb
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, refresh)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    // Phones pause sockets in the background; refresh when the tab comes back.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(refetchTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(channel);
    };
  }, [load, refresh]);

  return { rows, holeCount, error, live, refresh };
}

export function rankOf(rows: Row[] | null, id: string | null) {
  if (!rows || !id) return null;
  const i = rows.findIndex((r) => r.id === id);
  return i >= 0 && rows[i].played > 0 ? i + 1 : null;
}
