"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Title } from "@/components/Decor";
import { Leaderboard, LiveDot } from "@/components/Leaderboard";
import { readPlayerId } from "@/lib/game";
import { useLeaderboard } from "@/lib/useLeaderboard";

// Full-page leaderboard (handy on a big screen). On phones it opens as a sheet from the card.
export default function Overview() {
  const { rows, holeCount, error, live } = useLeaderboard();
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => setMe(readPlayerId()), []);

  return (
    <>
      <Title size="sm">Topplista</Title>
      <div className="flex items-center justify-between px-4 py-3">
        <Link href={me ? "/kort" : "/"} className="font-semibold text-brun underline">
          ← {me ? "Mitt kort" : "Gå med"}
        </Link>
        <LiveDot live={live} />
      </div>
      <div className="mx-4 mb-8 rounded-2xl border-2 border-linje bg-kort py-3">
        <Leaderboard rows={rows} holeCount={holeCount} me={me} error={error} />
      </div>
    </>
  );
}
