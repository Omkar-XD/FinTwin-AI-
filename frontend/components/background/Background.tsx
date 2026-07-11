"use client";

import { memo } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  ElegantShape                                                       */
/*  A single floating glass shape. Internal to this file — not         */
/*  exported, since it only makes sense as part of <Background />.     */
/* ------------------------------------------------------------------ */

interface ElegantShapeProps {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  /** Tailwind gradient "from-*" class. Defaults to a theme-safe tone. */
  gradient?: string;
}

const BACKGROUND_STYLES = `
  @keyframes ftw-bg-reveal {
    from { opacity: 0; transform: translate3d(0, -48px, 0) rotate(calc(var(--ftw-rotate) - 12deg)); }
    to { opacity: 1; transform: translate3d(0, 0, 0) rotate(var(--ftw-rotate)); }
  }

  @keyframes ftw-bg-float {
    0%, 100% { transform: translate3d(0, 0, 0) rotate(var(--ftw-rotate)); }
    50% { transform: translate3d(0, 14px, 0) rotate(var(--ftw-rotate)); }
  }

  .ftw-bg-shape {
    animation:
      ftw-bg-reveal 900ms cubic-bezier(0.23, 0.86, 0.39, 0.96) both,
      ftw-bg-float 14s ease-in-out infinite;
    animation-delay: var(--ftw-delay), calc(var(--ftw-delay) + 900ms);
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .ftw-bg-shape { animation: none; opacity: 1; transform: rotate(var(--ftw-rotate)); will-change: auto; }
  }
`;

const ElegantShape = memo(function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-primary/[0.12]",
}: ElegantShapeProps) {
  return (
    <div
      className={cn("absolute", className)}
      style={
        {
          "--ftw-delay": `${delay * 1000}ms`,
          "--ftw-rotate": `${rotate}deg`,
        } as CSSProperties
      }
    >
      <div
        style={{ width, height }}
        className="ftw-bg-shape relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "border border-foreground/[0.08]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,hsl(var(--foreground)/0.08),transparent_70%)]"
          )}
        />
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Background                                                         */
/*  Layered floating-shape background. Purely decorative — absolutely  */
/*  positioned, pointer-events disabled, fills its nearest positioned  */
/*  ancestor. Drop it in as the first child of any `relative` section. */
/* ------------------------------------------------------------------ */

export const Background = memo(function Background({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <style>{BACKGROUND_STYLES}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.06),transparent_36%),radial-gradient(circle_at_80%_72%,hsl(var(--primary)/0.04),transparent_34%)]" />

      <ElegantShape
        delay={0.3}
        width={600}
        height={140}
        rotate={12}
        gradient="from-primary/[0.15]"
        className="left-[-10%] top-[15%] md:left-[-5%] md:top-[20%]"
      />
      <ElegantShape
        delay={0.5}
        width={500}
        height={120}
        rotate={-15}
        gradient="from-primary/[0.12]"
        className="right-[-5%] top-[70%] md:right-[0%] md:top-[75%]"
      />
      <ElegantShape
        delay={0.4}
        width={300}
        height={80}
        rotate={-8}
        gradient="from-foreground/[0.08]"
        className="bottom-[5%] left-[5%] md:bottom-[10%] md:left-[10%]"
      />
      <ElegantShape
        delay={0.6}
        width={200}
        height={60}
        rotate={20}
        gradient="from-primary/[0.1]"
        className="right-[15%] top-[10%] md:right-[20%] md:top-[15%]"
      />
      <ElegantShape
        delay={0.7}
        width={150}
        height={40}
        rotate={-25}
        gradient="from-foreground/[0.06]"
        className="left-[20%] top-[5%] md:left-[25%] md:top-[10%]"
      />
    </div>
  );
});
