import { notFound } from "next/navigation";
import { PlayerWinningsList } from "@/components/player-winnings-list";
import { buildPlayerWinnings, type WinningsRound } from "@/lib/player-winnings";

export default function PlayerWinningsFixturePage() {
  if (process.env.E2E_FIXTURES !== "1") notFound();
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const round: WinningsRound = {
    format: {name:"Cross-Foursome 6-6-6-18"}, pot:240,
    formatConfig: {
      crossFoursome66618:{scoreMode:"best_ball",foursomeA:{A1:"a",A2:"b",A3:"c",A4:"d"},foursomeB:{B1:"e",B2:"f",B3:"g",B4:"h"}},
      par3Contest:{enabled:true,holes:[{holeNumber:3,contestType:"CLOSEST_TO_PIN",payoutTarget:"PLAYER"}],results:[{holeNumber:3,winnerPlayerId:"a",payoutAmount:12}]},
    },
    course:{holes:[]}, teams:[],
    roundPlayers:ids.map(playerId => ({id:`rp-${playerId}`,playerId,payoutAmount:playerId === "a" ? 42 : 30,eventHandicapIndex:null,player:{fullName:playerId === "a" ? "Albert" : playerId,nickname:null}})),
  };
  const scores = ids.flatMap(playerId => Array.from({length:18}, (_, i) => ({playerId,holeNumber:i+1,grossScore:5})));
  const rows = buildPlayerWinnings(round, scores);
  rows.push({roundPlayerId:"rp-zero",playerId:"zero",playerName:"Eddie",totalCents:0,items:[]});
  return <main className="mx-auto max-w-2xl p-4"><h1 className="mb-5 text-2xl font-bold">Money won</h1><PlayerWinningsList rows={rows} /></main>;
}
