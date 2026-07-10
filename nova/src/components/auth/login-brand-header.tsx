"use client";

import { motion } from "framer-motion";
import { BonyLogoFlip } from "@/components/brand/bony-logo-flip";

/**
 * Scrut-style brand row: animated Bony mark + stacked product / company name.
 */
export function LoginBrandHeader({
  productName,
  companyName,
}: {
  productName: string;
  companyName: string;
}) {
  return (
    <motion.div
      className="mb-6 flex items-center gap-2.5"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 0.8, 0.2, 1] }}
    >
      <BonyLogoFlip size="md" />
      <div className="min-w-0 leading-tight">
        <p className="text-base font-bold tracking-tight text-slate-900">
          {productName}
          <span className="font-semibold text-slate-500"> · {companyName}</span>
        </p>
      </div>
    </motion.div>
  );
}
