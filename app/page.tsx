"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Hill, Title } from "@/components/Decor";
import { errorText, getActiveGame, readPlayerId, readToken, saveSession } from "@/lib/game";
import { getSupabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const pinRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [gameName, setGameName] = useState<string | null>(null);
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (readPlayerId() && readToken()) {
      router.replace("/kort");
      return;
    }
    setReady(true);
    (async () => {
      try {
        const g = await getActiveGame();
        setGameName(g?.name ?? null);
        if (!g) return;
        const { data, error } = await getSupabase()
          .from("players")
          .select("id, name")
          .eq("game_id", g.id)
          .order("name");
        if (error) throw error;
        setPlayers(data);
      } catch (e) {
        setError(errorText(e));
      }
    })();
  }, [router]);

  const trimmed = name.trim();
  const existing = players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());

  function pick(playerName: string) {
    setName(playerName);
    setPin("");
    setError(null);
    pinRef.current?.focus();
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || pin.length !== 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await getSupabase().rpc("join_game", {
        p_name: trimmed,
        p_pin: pin,
      });
      if (error) throw error;
      const { player_id, token } = data as { player_id: string; token: string };
      saveSession(player_id, token);
      router.push("/kort");
    } catch (err) {
      setError(errorText(err));
      setPin("");
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <Title>Pubgolf</Title>

      <form onSubmit={join} className="mt-6 flex flex-col gap-3 px-4">
        {gameName && (
          <p className="self-start bg-kort px-4 py-2 text-lg font-semibold">{gameName}</p>
        )}
        <label htmlFor="name" className="mt-1 font-display text-2xl uppercase text-brun">
          Ditt namn
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          autoComplete="username"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="t.ex. Maxo Paxo"
          className="h-14 border-2 border-linje bg-kort px-4 font-mono text-xl outline-none placeholder:text-linje/40 focus:border-brun focus:ring-4 focus:ring-cream"
        />
        <label htmlFor="pin" className="mt-1 font-display text-2xl uppercase text-brun">
          {existing ? "Din PIN-kod" : "Välj en PIN-kod"}
        </label>
        <input
          id="pin"
          ref={pinRef}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={existing ? "current-password" : "new-password"}
          enterKeyHint="go"
          placeholder="4 siffror"
          className="h-14 border-2 border-linje bg-kort px-4 font-mono text-2xl tracking-[0.5em] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-linje/40 focus:border-brun focus:ring-4 focus:ring-cream"
        />
        <p className="-mt-1 text-sm text-linje/70">
          {existing
            ? "Namnet finns redan. Skriv PIN-koden du valde."
            : "Kom ihåg den. Du behöver den om du byter telefon."}
        </p>
        <button
          type="submit"
          disabled={!trimmed || pin.length !== 4 || busy}
          className="h-14 bg-brun font-display text-2xl uppercase tracking-wide text-cream transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Ett ögonblick…" : existing ? "Logga in" : "Gå med"}
        </button>
        {error && (
          <p role="alert" className="bg-cream px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </form>

      {players.length > 0 && (
        <section className="mt-8 px-4">
          <h2 className="font-display text-xl uppercase text-brun">Redan med? Tryck på dig</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p.name)}
                className={`h-11 rounded-full border-2 border-linje px-4 font-semibold active:scale-95 ${
                  p.name.toLowerCase() === trimmed.toLowerCase() ? "bg-sol" : "bg-kort"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <Hill>
        <p className="text-center font-display text-xl uppercase tracking-wide">
          9 hål · lägst antal klunkar vinner
        </p>
      </Hill>
    </>
  );
}
