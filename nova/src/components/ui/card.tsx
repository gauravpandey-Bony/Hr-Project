import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-5 text-card-foreground shadow-soft transition-shadow duration-200 hover:shadow-elevated",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-sm font-medium text-muted-foreground", className)}>
      {children}
    </h3>
  );
}

export function CardValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-1 text-2xl font-semibold tracking-tight text-foreground", className)}>
      {children}
    </p>
  );
}
