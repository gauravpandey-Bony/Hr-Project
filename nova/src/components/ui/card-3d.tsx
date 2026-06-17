"use client";

import { useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type Card3DProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  as?: "div" | "button";
  disabled?: boolean;
  tilt?: boolean;
  shine?: boolean;
  floatIndex?: number;
};

const FLOAT_CLASS = ["animate-float", "animate-float-delay-1", "animate-float-delay-2"] as const;

export function Card3D({
  children,
  className,
  style,
  onClick,
  as = "div",
  disabled,
  tilt = true,
  shine = true,
  floatIndex,
}: Card3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [9, -9]), {
    stiffness: 380,
    damping: 32,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-9, 9]), {
    stiffness: 380,
    damping: 32,
  });
  const lift = useSpring(0, { stiffness: 420, damping: 28 });

  function onMouseMove(e: MouseEvent) {
    if (!tilt || disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    lift.set(-10);
  }

  function onMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
    lift.set(0);
  }

  const Component = as === "button" ? motion.button : motion.div;

  return (
    <div
      className={cn(
        "perspective-[1400px]",
        floatIndex !== undefined && FLOAT_CLASS[floatIndex % FLOAT_CLASS.length]
      )}
    >
      <Component
        ref={ref as never}
        type={as === "button" ? "button" : undefined}
        onClick={onClick}
        disabled={disabled}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className={cn("card-raised card-raised-interactive", className)}
        style={{
          ...style,
          rotateX: tilt ? rotateX : 0,
          rotateY: tilt ? rotateY : 0,
          y: lift,
          transformStyle: "preserve-3d",
        }}
      >
        {shine && <span className="card-raised-shine" aria-hidden="true" />}
        <span className="relative z-[1] block w-full" style={{ transform: "translateZ(20px)" }}>
          {children}
        </span>
      </Component>
    </div>
  );
}
