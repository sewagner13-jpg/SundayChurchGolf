import { notFound } from "next/navigation";
import { CrossThreesomeSandbox } from "@/components/cross-threesome-sandbox";

export default function CrossThreesomeWalkthroughPage() {
  if (process.env.E2E_FIXTURES !== "1") notFound();
  return <CrossThreesomeSandbox />;
}
