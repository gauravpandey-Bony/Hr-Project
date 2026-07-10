"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/company";

const SIZE = {
  sm: { box: "h-10 w-10", px: 40 },
  md: { box: "h-12 w-12", px: 48 },
  lg: { box: "h-14 w-14", px: 56 },
} as const;

/**
 * Bony mark with a slow right→left 3D flip on every mount / page refresh.
 */
export function BonyLogoFlip({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const s = SIZE[size];

  return (
    <div
      className={cn("inline-flex shrink-0", className)}
      style={{ perspective: 900 }}
    >
      <motion.div
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-black/10",
          s.box
        )}
        style={{ transformStyle: "preserve-3d", transformOrigin: "center center" }}
        initial={{ rotateY: 95, opacity: 0.35, scale: 0.86 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{
          duration: 2.6,
          ease: [0.22, 0.8, 0.2, 1],
        }}
      >
        <Image
          src={COMPANY.logoMarkPath}
          alt={COMPANY.brandName}
          width={s.px}
          height={s.px}
          priority
          className="h-full w-full object-contain object-center"
        />
      </motion.div>
    </div>
  );
}
