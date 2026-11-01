import {RoundDayScoreboard} from "@/components/round-day-scoreboard";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RoundDayScoreboard roundId={id}/>;}
