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
  /** Right-to-left 3D flip once on mount / every page refresh */
  flipOnLoad = false,
}: {
  size?: keyof typeof SIZE;
  variant?: "mark" | "full";
  className?: string;
  priority?: boolean;
  flipOnLoad?: boolean;
}) {
  const s = SIZE[size];

  if (variant === "full") {
    return (
      <span className={cn("inline-flex shrink-0 [perspective:520px]", className)}>
        <span
          className={cn(
            "inline-flex",
            flipOnLoad && "animate-logo-flip-rtl"
          )}
          style={flipOnLoad ? { transformStyle: "preserve-3d" } : undefined}
        >
          <Image
            src={COMPANY.logoFullPath}
            alt={COMPANY.brandName}
            width={s.size}
            height={Math.round(s.size * 1.05)}
            priority={priority}
            className="h-auto w-auto object-contain"
            style={{ width: s.size, height: "auto" }}
          />
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 [perspective:520px]", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]",
          s.box,
          flipOnLoad && "animate-logo-flip-rtl"
        )}
        style={flipOnLoad ? { transformStyle: "preserve-3d" } : undefined}
      >
        <Image
          src={COMPANY.logoMarkPath}
          alt={COMPANY.brandName}
          width={s.size}
          height={s.size}
          priority={priority}
          className="h-full w-full scale-[1.08] object-cover object-center"
        />
      </span>
    </span>
  );
}
