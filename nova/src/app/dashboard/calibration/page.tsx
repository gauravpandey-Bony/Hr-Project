import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { NineBoxGrid } from "@/components/calibration/nine-box-grid";
import { parseJson } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

export default async function CalibrationPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const session = await db.calibrationSession.findFirst({
    where: { organizationId: user.organizationId },
    include: {
      placements: {
        include: {
          user: { select: { id: true, name: true, department: true, title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const quotas = parseJson<Record<string, number>>(session?.quotaRules ?? null, {});

  return (
    <div className="space-y-8">
      <PageHeader
        title="9-Box Calibration"
        description="Drag-and-drop talent placement with quota-based distribution guidance."
      />

      {session ? (
        <>
          <Card>
            <h2 className="font-semibold">{session.name}</h2>
            {Object.keys(quotas).length > 0 && (
              <p className="mt-2 text-sm text-slate-500">
                Target distribution:{" "}
                {Object.entries(quotas)
                  .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
                  .join(" · ")}
              </p>
            )}
          </Card>
          <Card>
            <NineBoxGrid
              sessionId={session.id}
              placements={session.placements}
              readOnly={user.role === "EMPLOYEE"}
            />
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-slate-500">No calibration session yet.</p>
        </Card>
      )}
    </div>
  );
}
