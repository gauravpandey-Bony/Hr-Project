import { cn } from "@/lib/utils";
import { getCategoryStyle } from "@/lib/category-style";

export function CategoryBadge({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const style = getCategoryStyle(category);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
      {category}
    </span>
  );
}
