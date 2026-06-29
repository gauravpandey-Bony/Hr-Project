"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadKraWorkbookModal } from "./upload-kra-workbook-modal";
import { cn } from "@/lib/utils";

export function UploadKraWorkbookButton({
  className,
  variant = "default",
  label = "Upload Excel",
  plantUnitKey,
}: {
  className?: string;
  variant?: "default" | "outline" | "hero" | "hero-outline";
  label?: string;
  plantUnitKey?: string | null;
}) {
  const [open, setOpen] = useState(false);

  const variantClass =
    variant === "hero"
      ? "inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-400"
      : variant === "hero-outline"
        ? "inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
        : undefined;

  if (variant === "hero" || variant === "hero-outline") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(variantClass, className)}
        >
          <Upload className="h-4 w-4" />
          {label}
        </button>
        <UploadKraWorkbookModal
          open={open}
          onClose={() => setOpen(false)}
          plantUnitKey={plantUnitKey}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={variant === "outline" ? "outline" : "default"}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Upload className="h-4 w-4" />
        {label}
      </Button>
      <UploadKraWorkbookModal
        open={open}
        onClose={() => setOpen(false)}
        plantUnitKey={plantUnitKey}
      />
    </>
  );
}
