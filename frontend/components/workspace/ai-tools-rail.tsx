'use client';

import { motion } from 'framer-motion';
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  FileText,
  Zap,
} from 'lucide-react';

interface AIToolsRailProps {
  onToolClick: (prompt: string) => void;
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
    <div className="w-64 bg-background/50 border-r border-border/40 flex flex-col gap-3 p-4 overflow-y-auto">
      {TOOLS.map((tool, idx) => {
        const Icon = tool.icon;

        return (
          <motion.button
            key={tool.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onToolClick(tool.prompt)}
            disabled={isProcessing}
            className="relative flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 border border-border/40 hover:border-border/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            {/* Icon */}
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-primary flex-shrink-0" />
              <h3 className="text-sm font-medium text-foreground">{tool.title}</h3>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground leading-snug">
              {tool.description}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}
