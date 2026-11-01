"use client";
import { SundayChurchYellowBallScoring } from "@/components/sunday-church-yellow-ball-scoring";

export function PlayerNameContrastFixture() {
  return <section aria-label="Yellow Ball player contrast">
    <SundayChurchYellowBallScoring roundId="fixture" teamId="fixture" teamLabel="Fixture group"
      currentHole={18} handicapRank={18} holes={Array.from({length: 18}, (_, i) => ({holeNumber: i + 1, handicapRank: i + 1}))}
      players={[{playerId: "a", name: "Alex"}, {playerId: "b", name: "Bill"}, {playerId: "c", name: "Chris"}, {playerId: "d", name: "Dave"}]}
      teamFormatConfig={{yellowBallOrder: ["a", "b", "c", "d"]}}
      playerHandicapIndexes={{a: 0, b: 1, c: 2, d: 3}} useYellowBallHandicaps
      existingHoleData={null} hole17CarrierId="a" blocked={false} onSaved={() => {}} />
  </section>;
}
