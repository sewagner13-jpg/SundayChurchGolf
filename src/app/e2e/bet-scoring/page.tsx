import {notFound} from "next/navigation";
import {BetScoringFixture} from "@/components/bet-scoring-fixture";
export default function Page(){if(process.env.E2E_FIXTURES!=="1") notFound();return <BetScoringFixture/>;}
