import { notFound } from "next/navigation";

import { SundayChurchYellowBallSandbox } from "@/components/sunday-church-yellow-ball-sandbox";

export default function YellowBallWalkthroughPage() {
  if (process.env.E2E_FIXTURES !== "1") notFound();
  return <SundayChurchYellowBallSandbox />;
}
