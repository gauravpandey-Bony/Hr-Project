import { formatDepartmentDisplayName } from "@/lib/masters/department-master-sync";
import { cn } from "@/lib/utils";

export function DepartmentLabel({
  name,
  className,
  fallback = "—",
}: {
  name?: string | null;
  className?: string;
  fallback?: string;
}) {
  if (!name?.trim()) {
    return <span className={cn("dept-name", className)}>{fallback}</span>;
  }
  return (
    <span className={cn("dept-name", className)}>
      {formatDepartmentDisplayName(name)}
    </span>
  );
}
