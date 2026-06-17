import { cn } from "@/lib/utils";

export function StickyTableShell({
  children,
  className,
  maxHeight = "min(70vh, 800px)",
}: {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/90 shadow-elevated ring-1 ring-black/5 dark:ring-white/5",
        className
      )}
    >
      <div
        className="overflow-x-auto overflow-y-auto scrollbar-thin"
        style={{ maxHeight }}
      >
        {children}
      </div>
    </div>
  );
}
