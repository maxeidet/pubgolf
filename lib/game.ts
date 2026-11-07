import { getSupabase } from "./supabase";

export const PLAYER_KEY = "pubgolf_player_id";
export const TOKEN_KEY = "pubgolf_token";

export type Hole = { number: number; bar: string; par: number };
export type Player = { id: string; name: string; game_id: string };

export function readPlayerId(): string | null {
  try {
    return localStorage.getItem(PLAYER_KEY);
  } catch {
    return null;
  }
}

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveSession(id: string, token: string) {
  try {
    localStorage.setItem(PLAYER_KEY, id);
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearPlayerId() {
  try {
    localStorage.removeItem(PLAYER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function getActiveGame() {
  const { data, error } = await getSupabase()
    .from("games")
    .select("id, name")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string } | null;
}

export function formatToPar(n: number) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

export function errorText(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return "Något gick fel.";
}
