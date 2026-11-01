import { notFound } from "next/navigation";
import { CrossFoursomePhoneFixture } from "@/components/cross-foursome-phone-fixture";

export default function CrossFoursomePhonePage() {
  if (process.env.E2E_FIXTURES !== "1") notFound();
  return <CrossFoursomePhoneFixture />;
}
