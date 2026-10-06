import { useCabinetDesign } from "@/lib/use-cabinet-design";
import { AuroraRoulette } from "./aurora/aurora-roulette";
import { StealthRoulette } from "./stealth/stealth-roulette";

export function ClientRoulettePage() {
  const design = useCabinetDesign();
  if (design === "stealth") {
    return <StealthRoulette />;
  }
  return <AuroraRoulette />;
}
