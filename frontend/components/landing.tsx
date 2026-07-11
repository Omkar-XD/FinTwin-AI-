"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  animate,
  AnimatePresence,
} from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  LineChart,
  Wallet,
  FileText,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Upload,
  Cpu,
  Layers,
  Activity,
  PlayCircle,
  Menu,
  X,
  ExternalLink,
  PiggyBank,
  AlertTriangle,
  MessageSquare,
  Home,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LandingProps {
  onNavigate: () => void;
}

/* ------------------------------------------------------------------ */
/*  Static content                                                     */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Technology", href: "#technology" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

const FLOATING_CARDS = [
  { label: "Net Worth", value: "₹18,42,600", delta: "+4.2%", up: true, icon: Wallet, className: "top-[8%] left-[4%] rotate-[-4deg]" },
  { label: "Expenses", value: "₹64,120", delta: "-2.1%", up: false, icon: LineChart, className: "top-[18%] right-[2%] rotate-[3deg]" },
  { label: "Savings", value: "₹3,10,000", delta: "+11.6%", up: true, icon: PiggyBank, className: "bottom-[20%] left-[1%] rotate-[3deg]" },
  { label: "AI Summary", value: "Low risk profile", delta: "Updated now", up: true, icon: BrainCircuit, className: "bottom-[6%] right-[6%] rotate-[-2deg]" },
];

const TICKER_ITEMS = [
  { label: "SIP DISCIPLINE", value: "92/100", up: true },
  { label: "EMERGENCY FUND", value: "5.2 mo", up: true },
  { label: "DEBT-TO-INCOME", value: "18%", up: false },
  { label: "PORTFOLIO DRIFT", value: "1.4%", up: true },
  { label: "TAX EFFICIENCY", value: "87/100", up: true },
  { label: "RISK SCORE", value: "MODERATE", up: false },
];

const TECH_STACK = [
  "Supabase",
  "OpenAI",
  "React",
  "Tailwind CSS",
  "TypeScript",
  "PostgreSQL",
  "Framer Motion",
  "Mastra",
  "Qdrant",
  "Enkrypt AI",
  "Hono",
];

const TIMELINE_STEPS = [
  {
    title: "Upload Documents",
    description: "Drop in bank statements, payslips, or investment reports. FinTwin reads them the moment they land.",
    icon: Upload,
  },
  {
    title: "AI Processing",
    description: "A pipeline of specialist agents extracts, cross-checks, and structures every transaction and holding.",
    icon: Cpu,
  },
  {
    title: "Financial Twin",
    description: "Your data becomes a living model of your finances — one that updates itself as new documents arrive.",
    icon: Layers,
  },
  {
    title: "Insights",
    description: "Risk flags, savings opportunities, and scenario outcomes surface automatically, ranked by what matters.",
    icon: Activity,
  },
];

const FEATURES = [
  {
    title: "AI Financial Twin",
    description: "A continuously updated model of your entire financial life, built from every document you feed it.",
    icon: BrainCircuit,
    span: "md:col-span-2",
  },
  {
    title: "Expense Analysis",
    description: "Spending patterns categorised and explained, not just charted.",
    icon: LineChart,
    span: "",
  },
  {
    title: "Risk Intelligence",
    description: "Early warnings on concentration, liquidity, and debt risk before they become problems.",
    icon: ShieldCheck,
    span: "",
  },
  {
    title: "Scenario Simulation",
    description: "Model a job change, a loan, or a market drop and see the twin react in seconds.",
    icon: Sparkles,
    span: "md:col-span-2",
  },
  {
    title: "AI Recommendations",
    description: "Specific, ranked actions — reviewed for safety before they ever reach you.",
    icon: TrendingUp,
    span: "md:col-span-2",
  },
  {
    title: "Document Intelligence",
    description: "Statements, payslips, and reports parsed with structure-aware extraction.",
    icon: FileText,
    span: "",
  },
];

const STATS = [
  { value: 2.3, suffix: "B+", prefix: "₹", label: "Financial Data Analysed" },
  { value: 99.8, suffix: "%", prefix: "", label: "Accuracy" },
  { value: 50, suffix: "K+", prefix: "", label: "Documents Processed" },
  { value: 3, suffix: " sec", prefix: "<", label: "Average Analysis" },
];

const FOOTER_NAV = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Technology", href: "#technology" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

const FOOTER_RESOURCES = [
  { label: "Documentation", href: "#" },
  { label: "API Reference", href: "#" },
  { label: "Security", href: "#" },
  { label: "Status", href: "#" },
];

const HERO_TITLE_LINES = ["Your AI Financial", "Intelligence Partner"];

const HERO_SPARKLES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: `${(i * 67) % 100}%`,
  top: `${(i * 41) % 100}%`,
  duration: `${4 + (i % 5)}s`,
  delay: `${i * 0.3}s`,
}));

const DASHBOARD_TABS = ["overview", "chat"] as const;

const EXPENSE_ROWS = [
  { label: "Housing", pct: 38 },
  { label: "Investments", pct: 26 },
  { label: "Food", pct: 14 },
  { label: "Other", pct: 22 },
];

const TICKER_LOOP_ITEMS = [...TICKER_ITEMS, ...TICKER_ITEMS];
const TECH_STACK_LOOP_ITEMS = [...TECH_STACK, ...TECH_STACK];
const CURRENT_YEAR = new Date().getFullYear();

const HERO_ORB_A_STYLE = {
  background: "radial-gradient(circle, rgba(139,124,246,0.28), transparent 70%)",
} as CSSProperties;

const HERO_ORB_B_STYLE = {
  background: "radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%)",
} as CSSProperties;

const CTA_ORB_STYLE = {
  background: "radial-gradient(circle, rgba(139,124,246,0.22), transparent 70%)",
} as CSSProperties;

/* ------------------------------------------------------------------ */
/*  Ambient CSS keyframes — moved off the JS/Framer thread so the      */
/*  hero and nav stay smooth. These run purely on the compositor.      */
/* ------------------------------------------------------------------ */

const AMBIENT_STYLES = `
  @keyframes ftw-drift-a {
    0%, 100% { transform: translate3d(0,0,0); }
    50% { transform: translate3d(36px, 26px, 0); }
  }
  @keyframes ftw-drift-b {
    0%, 100% { transform: translate3d(0,0,0); }
    50% { transform: translate3d(-28px, -18px, 0); }
  }
  @keyframes ftw-twinkle {
    0%, 100% { opacity: 0.08; transform: translate3d(0,0,0); }
    50% { opacity: 0.55; transform: translate3d(0,-12px,0); }
  }
  @keyframes ftw-marquee {
    from { transform: translate3d(0,0,0); }
    to { transform: translate3d(-50%,0,0); }
  }
  .ftw-orb-a { animation: ftw-drift-a 16s ease-in-out infinite; will-change: transform; }
  .ftw-orb-b { animation: ftw-drift-b 18s ease-in-out infinite; will-change: transform; }
  .ftw-twinkle { animation: ftw-twinkle var(--dur, 5s) ease-in-out infinite; will-change: transform, opacity; }
  .ftw-marquee-track { animation: ftw-marquee var(--speed, 26s) linear infinite; will-change: transform; }
  @media (prefers-reduced-motion: reduce) {
    .ftw-orb-a, .ftw-orb-b, .ftw-twinkle, .ftw-marquee-track { animation: none; }
  }
`;

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

const AnimatedCounter = memo(function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        const decimals = value % 1 !== 0 ? 1 : 0;
        setDisplay(latest.toFixed(decimals));
      },
    });
    return () => controls.stop();
  }, [isInView, value]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
});

const SectionEyebrow = memo(function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#8B7CF6] to-[#22D3EE]" />
      {children}
    </div>
  );
});

const GridOverlay = memo(function GridOverlay({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-[0.06] ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="fintwin-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#fintwin-grid)" />
    </svg>
  );
});

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function Landing({ onNavigate }: LandingProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDashTab, setActiveDashTab] = useState<"overview" | "chat">("overview");

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0]);
  const heroY = useTransform(heroProgress, [0, 1], [0, 80]);

  /* Scroll listener throttled to one check per animation frame instead
     of firing (and re-rendering) on every scroll pixel — this alone
     removes most of the perceived nav lag. */
  useEffect(() => {
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const nextScrolled = window.scrollY > 24;
        setScrolled((current) => (current === nextScrolled ? current : nextScrolled));
        rafId = 0;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  /* Smooth, snappy in-page navigation shared by header + footer links. */
  const handleNavClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!href.startsWith("#")) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      setMobileOpen(false);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    []
  );

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      {/* Ambient keyframes for compositor-only animation (no per-frame JS) */}
      <style>{AMBIENT_STYLES}</style>

      {/* ============================================================ */}
      {/* NAVBAR                                                        */}
      {/* ============================================================ */}
      <header
        className={`fixed top-0 z-50 w-full transition-colors duration-300 ${
          scrolled
            ? "border-b border-white/10 bg-background/75 backdrop-blur-md shadow-[0_1px_0_0_rgba(139,124,246,0.15)]"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <a
            href="#top"
            onClick={(e) => handleNavClick(e, "#top")}
            className="flex items-center gap-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[#8B7CF6]/20 to-[#22D3EE]/10">
              <BrainCircuit className="h-4 w-4 text-[#8B7CF6]" />
            </span>
            <span className="font-mono text-sm font-semibold tracking-tight">
              FinTwin<span className="bg-gradient-to-r from-[#8B7CF6] to-[#22D3EE] bg-clip-text text-transparent"> AI</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label === "Home" && <Home className="h-3.5 w-3.5" />}
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={onNavigate}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign In
            </button>
            <button
              onClick={onNavigate}
              className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#8B7CF6] to-[#6D5EF8] px-4 py-2 text-sm font-medium text-white shadow-[0_0_24px_-6px_rgba(139,124,246,0.7)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          <button
            className="text-foreground md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0.96 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.96 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ transformOrigin: "top" }}
              className="overflow-hidden border-t border-white/10 bg-background/95 md:hidden"
            >
              <div className="flex flex-col gap-4 px-6 py-6">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label === "Home" && <Home className="h-3.5 w-3.5" />}
                    {link.label}
                  </a>
                ))}
                <div className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-4">
                  <button onClick={onNavigate} className="text-left text-sm text-muted-foreground hover:text-foreground">
                    Sign In
                  </button>
                  <button
                    onClick={onNavigate}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#8B7CF6] to-[#6D5EF8] px-4 py-2.5 text-sm font-medium text-white"
                  >
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ============================================================ */}
      {/* HERO                                                          */}
      {/* ============================================================ */}
      <section
        id="top"
        ref={heroRef}
        className="relative flex min-h-[92vh] w-full items-center overflow-hidden pt-28"
      >
        {/* Background layers — pure CSS animation, no per-frame JS cost */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-background" />
          <GridOverlay className="text-foreground" />
          <div
            className="ftw-orb-a absolute left-[10%] top-[12%] h-72 w-72 rounded-full"
            style={HERO_ORB_A_STYLE}
          />
          <div
            className="ftw-orb-b absolute bottom-[8%] right-[12%] h-96 w-96 rounded-full"
            style={HERO_ORB_B_STYLE}
          />
          {HERO_SPARKLES.map((sparkle) => (
            <span
              key={sparkle.id}
              className="ftw-twinkle absolute h-1 w-1 rounded-full bg-[#8B7CF6]/60"
              style={
                {
                  left: sparkle.left,
                  top: sparkle.top,
                  "--dur": sparkle.duration,
                  animationDelay: sparkle.delay,
                } as CSSProperties
              }
            />
          ))}
        </div>

        {/* Floating financial cards - desktop only */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          {FLOATING_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                className={`absolute w-44 transform-gpu rounded-2xl border border-white/10 bg-card/85 p-4 shadow-[0_8px_32px_-14px_rgba(0,0,0,0.45)] ${card.className}`}
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(139,124,246,0.10), rgba(34,211,238,0.04))",
                }}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.4 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {card.label}
                  </span>
                  <Icon className="h-3.5 w-3.5 text-[#8B7CF6]" />
                </div>
                <div className="font-mono text-lg font-semibold tabular-nums">{card.value}</div>
                <div
                  className={`mt-1 flex items-center gap-1 text-xs ${
                    card.up ? "text-[#34D399]" : "text-muted-foreground"
                  }`}
                >
                  {card.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {card.delta}
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-start px-6 pb-24 pt-10 lg:px-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground"
          >
            <Sparkles className="h-3 w-3 text-[#8B7CF6]" />
            Multi-agent financial intelligence, live in seconds
          </motion.div>

          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            {HERO_TITLE_LINES.map((line, i) => (
              <motion.span
                key={line}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`block ${
                  i === 1
                    ? "bg-gradient-to-r from-[#8B7CF6] via-[#6D5EF8] to-[#22D3EE] bg-clip-text text-transparent"
                    : ""
                }`}
              >
                {line}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-6 max-w-xl text-lg text-muted-foreground"
          >
            Transform financial documents into intelligent financial insights using AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <button
              onClick={onNavigate}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8B7CF6] to-[#6D5EF8] px-6 py-3.5 text-sm font-medium text-white shadow-[0_0_32px_-8px_rgba(139,124,246,0.8)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Start Your AI Analysis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-card/80 px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-card">
              <PlayCircle className="h-4 w-4 text-[#22D3EE]" />
              Watch Demo
            </button>
          </motion.div>
        </motion.div>

        {/* Signature element: live ledger ticker (pure CSS marquee) */}
        <div className="absolute bottom-0 left-0 right-0 z-10 border-y border-white/10 bg-card/85">
          <div className="flex items-center">
            <span className="hidden shrink-0 items-center gap-2 border-r border-white/10 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:flex">
              <Activity className="h-3 w-3 text-[#22D3EE]" />
              Live Ledger
            </span>
            <div className="relative flex-1 overflow-hidden py-3">
              <div
                className="ftw-marquee-track flex w-max gap-10 whitespace-nowrap pr-10"
                style={{ "--speed": "22s" } as React.CSSProperties}
              >
                {TICKER_LOOP_ITEMS.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={item.up ? "text-[#34D399]" : "text-foreground"}>{item.value}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* TECHNOLOGY MARQUEE                                            */}
      {/* ============================================================ */}
      <section id="technology" className="relative border-b border-white/10 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-center text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Built on a modern, verifiable stack
          </p>
        </div>
        <div className="relative mt-8 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
          <div
            className="ftw-marquee-track flex w-max gap-4 px-4"
            style={{ "--speed": "30s" } as React.CSSProperties}
          >
            {TECH_STACK_LOOP_ITEMS.map((tech, i) => (
              <div
                key={`${tech}-${i}`}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-card/80 px-5 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#8B7CF6] to-[#22D3EE]" />
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* HOW IT WORKS                                                  */}
      {/* ============================================================ */}
      <section id="how-it-works" className="relative py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <SectionEyebrow>How FinTwin Works</SectionEyebrow>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            From raw statement to living model, in one pass.
          </motion.h2>

          <div className="relative mt-16 grid gap-10 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-white/10 md:block" />
            {TIMELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative flex flex-col"
                >
                  <div className="relative z-10 mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#8B7CF6]/15 to-[#22D3EE]/10 text-[#8B7CF6]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                  <h3 className="mt-1 text-lg font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURES - BENTO GRID                                        */}
      {/* ============================================================ */}
      <section id="features" className="relative border-t border-white/10 py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <SectionEyebrow>Features</SectionEyebrow>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Six agents, one financial twin.
          </motion.h2>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-card/80 p-7 transition-[transform,background-color,border-color,color] hover:-translate-y-1 hover:border-[#8B7CF6]/30 hover:bg-card ${feature.span}`}
                >
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-[#8B7CF6]/12 to-[#22D3EE]/8 opacity-70 transition-opacity group-hover:opacity-100" />
                  <div className="relative mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-background/60 text-[#8B7CF6]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="relative text-lg font-medium">{feature.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* DASHBOARD PREVIEW                                            */}
      {/* ============================================================ */}
      <section className="relative border-t border-white/10 py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <SectionEyebrow>Dashboard Preview</SectionEyebrow>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Everything about your money, on one screen.
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="relative mt-14 overflow-hidden rounded-2xl border border-white/10 bg-card/50 shadow-[0_20px_70px_-20px_rgba(139,124,246,0.35)] backdrop-blur-xl"
          >
            {/* Dashboard chrome */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              </div>
              <div className="flex gap-1 rounded-full border border-white/10 bg-background/60 p-1">
                {DASHBOARD_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDashTab(tab)}
                    className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                      activeDashTab === tab
                        ? "bg-gradient-to-r from-[#8B7CF6] to-[#6D5EF8] text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "overview" ? "Overview" : "AI Chat"}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">fintwin.ai/dashboard</span>
            </div>

            <div className="grid gap-px bg-white/10 md:grid-cols-3">
              {/* Net worth chart */}
              <div className="col-span-2 bg-background/40 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Net Worth</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">₹18,42,600</span>
                </div>
                <svg viewBox="0 0 400 120" className="h-28 w-full overflow-visible">
                  <defs>
                    <linearGradient id="ftw-line-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8B7CF6" />
                      <stop offset="100%" stopColor="#22D3EE" />
                    </linearGradient>
                  </defs>
                  <motion.polyline
                    points="0,90 40,85 80,70 120,75 160,55 200,60 240,40 280,45 320,20 360,28 400,10"
                    fill="none"
                    stroke="url(#ftw-line-grad)"
                    strokeWidth="2.5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                  <polyline
                    points="0,90 40,85 80,70 120,75 160,55 200,60 240,40 280,45 320,20 360,28 400,10 400,120 0,120"
                    fill="url(#ftw-line-grad)"
                    opacity="0.08"
                  />
                </svg>
                <div className="mt-4 grid grid-cols-3 gap-4 border-t border-white/10 pt-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">Assets</p>
                    <p className="mt-1 font-mono font-medium tabular-nums">₹24,10,000</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Liabilities</p>
                    <p className="mt-1 font-mono font-medium tabular-nums">₹5,67,400</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">This Month</p>
                    <p className="mt-1 font-mono font-medium text-[#34D399]">+4.2%</p>
                  </div>
                </div>
              </div>

              {/* Right rail */}
              <div className="flex flex-col divide-y divide-white/10 bg-background/40">
                <div className="p-6">
                  <p className="mb-3 text-sm text-muted-foreground">Expense Breakdown</p>
                  <div className="space-y-2.5">
                    {EXPENSE_ROWS.map((row, i) => (
                      <div key={row.label}>
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>{row.label}</span>
                          <span className="font-mono">{row.pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#8B7CF6] to-[#22D3EE]"
                            initial={{ scaleX: 0 }}
                            whileInView={{ scaleX: row.pct / 100 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: i * 0.08 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  <p className="mb-3 text-sm text-muted-foreground">Recent Activity</p>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" /> Statement parsed
                      </span>
                      <span className="font-mono">2m ago</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5" /> Risk flag cleared
                      </span>
                      <span className="font-mono">1h ago</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" /> AI Assistant reply
                      </span>
                      <span className="font-mono">3h ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Chat strip */}
            <div className="border-t border-white/10 bg-background/40 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#8B7CF6]/20 to-[#22D3EE]/10 text-[#8B7CF6]">
                  <BrainCircuit className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground">FinTwin:</span> Your emergency fund covers 5.2 months of
                  expenses — above target. Redirecting ₹8,000/mo to your equity SIP would close your retirement
                  gap two years earlier.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* STATISTICS                                                    */}
      {/* ============================================================ */}
      <section className="relative border-t border-white/10 py-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="text-center md:text-left"
              >
                <p className="bg-gradient-to-r from-[#8B7CF6] to-[#22D3EE] bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
                  <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CTA                                                           */}
      {/* ============================================================ */}
      <section id="about" className="relative overflow-hidden border-t border-white/10 py-32">
        <div className="absolute inset-0 -z-10">
          <GridOverlay className="text-foreground" />
          <div
            className="absolute left-1/2 top-1/2 h-96 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={CTA_ORB_STYLE}
          />
        </div>
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            Ready to Build Your Financial Twin?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mx-auto mt-4 max-w-lg text-muted-foreground"
          >
            Upload your first statement and see a structured, explained model of your finances in under three
            seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-9"
          >
            <button
              onClick={onNavigate}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8B7CF6] to-[#6D5EF8] px-7 py-4 text-sm font-medium text-white shadow-[0_0_32px_-8px_rgba(139,124,246,0.8)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Start Your AI Analysis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                        */}
      {/* ============================================================ */}
      <footer className="relative border-t border-white/10 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-12 md:grid-cols-4">
            <div className="md:col-span-2">
              <a
                href="#top"
                onClick={(e) => handleNavClick(e, "#top")}
                className="flex items-center gap-2"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[#8B7CF6]/20 to-[#22D3EE]/10">
                  <BrainCircuit className="h-4 w-4 text-[#8B7CF6]" />
                </span>
                <span className="font-mono text-sm font-semibold tracking-tight">
                  FinTwin<span className="bg-gradient-to-r from-[#8B7CF6] to-[#22D3EE] bg-clip-text text-transparent"> AI</span>
                </span>
              </a>
              <p className="mt-4 max-w-sm text-sm text-muted-foreground">
                An AI-native financial intelligence platform that turns your documents into a living, explainable
                model of your money.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <a
                  href="#"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="#"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  LinkedIn
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Navigation</p>
              <ul className="mt-4 space-y-3">
                {FOOTER_NAV.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Resources</p>
              <ul className="mt-4 space-y-3">
                {FOOTER_RESOURCES.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-muted-foreground sm:flex-row">
            <p>© {CURRENT_YEAR} FinTwin AI. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="transition-colors hover:text-foreground">
                Privacy
              </a>
              <a href="#" className="transition-colors hover:text-foreground">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
