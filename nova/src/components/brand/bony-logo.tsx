import Image from "next/image";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/company";

const SIZE = {
  xs: { box: "h-8 w-8", size: 28 },
  sm: { box: "h-9 w-9", size: 32 },
  md: { box: "h-10 w-10", size: 36 },
  lg: { box: "h-12 w-12", size: 42 },
  xl: { box: "h-16 w-16", size: 56 },
  hero: { box: "h-24 w-24", size: 84 },
} as const;

export function BonyLogo({
  size = "md",
  variant = "mark",
  className,
  priority,
}: {
  size?: keyof typeof SIZE;
  variant?: "mark" | "full";
  className?: string;
  priority?: boolean;
}) {
  const s = SIZE[size];

  if (variant === "full") {
    return (
      <Image
        src={COMPANY.logoFullPath}
        alt={COMPANY.brandName}
        width={s.size}
        height={Math.round(s.size * 1.05)}
        priority={priority}
        className={cn("h-auto w-auto object-contain", className)}
        style={{ width: s.size, height: "auto" }}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-black/[0.06]",
        s.box,
        className
      )}
    >
      <Image
        src={COMPANY.logoMarkPath}
        alt={COMPANY.brandName}
        width={s.size}
        height={s.size}
        priority={priority}
        className="h-full w-full object-contain object-center"
      />
    </span>
  );
}
