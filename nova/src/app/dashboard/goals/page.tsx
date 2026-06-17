import { redirect } from "next/navigation";

/** Goals merged into KPI experience — redirect to KPI library */
export default function GoalsPage() {
  redirect("/dashboard/kpis");
}
