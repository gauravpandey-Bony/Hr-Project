import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessUnitPicker, roleHomeRedirect } from "@/lib/access-control";
import { UnitTilePicker } from "@/components/dashboard/unit-tile-picker";

export default async function DashboardHomePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (!canAccessUnitPicker(user.role)) {
    redirect(roleHomeRedirect(user.role));
  }

  return <UnitTilePicker isAdmin={user.role === "ADMIN"} />;
}
