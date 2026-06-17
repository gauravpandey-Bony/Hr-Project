import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccessReviewAssignment } from "@/lib/access-control";
import { ReviewForm } from "@/components/reviews/review-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReviewAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const assignment = await db.reviewAssignment.findFirst({
    where: {
      id,
      cycle: { organizationId: user.organizationId },
    },
    include: {
      cycle: { include: { template: true } },
      reviewee: true,
    },
  });

  if (!assignment || !canAccessReviewAssignment(user, assignment)) notFound();

  const canEdit = assignment.reviewerId === user.id && assignment.status !== "SUBMITTED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        badge={<Badge variant="info">{assignment.reviewType}</Badge>}
        title={assignment.cycle.name}
        description={
          assignment.cycle.description ??
          "Complete this review — also available in Microsoft Teams."
        }
      />

      <Card>
        <ReviewForm
          assignmentId={assignment.id}
          formSchemaStr={assignment.cycle.template.formSchema}
          ratingScaleStr={assignment.cycle.template.ratingScale}
          revieweeName={assignment.reviewee.name}
          initialResponses={assignment.responses}
          readOnly={!canEdit}
        />
      </Card>
    </div>
  );
}
