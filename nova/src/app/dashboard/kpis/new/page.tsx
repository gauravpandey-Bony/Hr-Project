import { redirect } from "next/navigation";

/** /kpis/new → /kpis/create (avoids conflict with [id] dynamic route) */
export default function NewKpiRedirect() {
  redirect("/dashboard/kpis/create");
}
