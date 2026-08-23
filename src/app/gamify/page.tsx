import { getGamifyDashboardData } from "@/app/actions/gamify-dashboard";
import { GamifyView } from "@/components/gamify/gamify-view";
import "./gamify.css";

export const dynamic = "force-dynamic";

export default async function GamifyPage() {
  const data = await getGamifyDashboardData();
  return <GamifyView data={data} />;
}
