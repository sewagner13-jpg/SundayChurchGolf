import { notFound } from "next/navigation";
import {
  HandicapPlayerScoreDetails,
  HandicapStrokeCard,
} from "@/components/handicap-stroke-card";

const playerHandicapIndexes = { albert: 6, eddie: 9, griff: 12, mike: 10 };
const holes = Array.from({ length: 18 }, (_, index) => ({
  holeNumber: index + 1,
  handicapRank: index + 1,
}));

export default function HandicapStrokeFixturePage() {
  if (process.env.E2E_FIXTURES !== "1") notFound();

  return (
    <main className="mx-auto max-w-4xl p-4">
      <HandicapStrokeCard
        players={[
          { playerId: "albert", name: "Albert" },
          { playerId: "eddie", name: "Eddie" },
          { playerId: "griff", name: "Griff" },
          { playerId: "mike", name: "Mike" },
        ]}
        playerHandicapIndexes={playerHandicapIndexes}
        holes={holes}
        currentHole={3}
      />
      <HandicapPlayerScoreDetails
        playerId="griff"
        grossScore="5"
        playerHandicapIndexes={playerHandicapIndexes}
        handicapRank={3}
      />
    </main>
  );
}
