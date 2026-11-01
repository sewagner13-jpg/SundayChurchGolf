import { notFound } from "next/navigation";
import { PlayerNameContrastFixture } from "@/components/player-name-contrast-fixture";

export default function PlayerNameContrastPage() {
  if (process.env.E2E_FIXTURES !== "1") notFound();
  return <PlayerNameContrastFixture />;
}
