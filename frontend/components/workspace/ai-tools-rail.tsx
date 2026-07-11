'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  FileText,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface AIToolsRailProps {
  onToolClick: (tool: { id: string; prompt: string }) => void;
  isProcessing?: boolean;
}

const TOOLS = [
  {
    id: 'snapshot',
    title: 'Financial Snapshot',
    description: 'View your complete financial overview',
    icon: TrendingUp,
    prompt: 'Show my complete financial snapshot.',
  },
  {
    id: 'risk',
    title: 'Risk Analysis',
    description: 'Understand your financial risks',
    icon: AlertTriangle,
    prompt: 'Explain my financial risks.',
  },
  {
    id: 'recommendations',
    title: 'AI Recommendations',
    description: 'Get personalized improvements',
    icon: Lightbulb,
    prompt: 'What are your recommendations to improve my finances?',
  },
  {
    id: 'documents',
    title: 'Recent Documents',
    description: 'Review analyzed documents',
    icon: FileText,
    prompt: 'Show the documents you analyzed.',
  },
  {
    id: 'scenario',
    title: 'Run Scenario',
    description: 'Simulate financial situations',
    icon: Zap,
    prompt: 'I want to run a financial scenario.',
  },
];

export function AIToolsRail({ onToolClick, isProcessing = false }: AIToolsRailProps) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border/40 bg-card/35 p-4 backdrop-blur-xl lg:flex">
      <div className="mb-2 px-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Agents
        </p>
      </div>

      {TOOLS.map((tool, idx) => {
        const Icon = tool.icon;

        return (
          <motion.button
            key={tool.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onToolClick(tool)}
            disabled={isProcessing}
            className="group relative overflow-hidden rounded-full border border-[#161616] border-b-[#374e72] bg-[linear-gradient(180deg,#5771a5_0%,#000_100%)] px-3 py-3 text-left text-white shadow-[0_0_18px_rgba(87,113,165,0.24),inset_0_1px_0_rgba(255,255,255,0.16)] transition-all hover:border-primary/40 hover:shadow-[0_0_24px_rgba(87,113,165,0.38),inset_0_1px_0_rgba(255,255,255,0.2)] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/10 opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="relative flex items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white shadow-[0_0_14px_rgba(255,255,255,0.18)]">
                <Icon className="h-4 w-4 drop-shadow-[0_0_8px_rgba(255,255,255,0.55)]" />
                <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-5 text-white [text-shadow:0_0_8px_rgba(255,255,255,0.35)]">
                  {tool.title}
                </span>
                <span className="mt-0.5 block truncate text-xs leading-4 text-white/70">
                  {tool.description}
                </span>
              </span>
            </span>
          </motion.button>
        );
      })}
    </aside>
  );
}
