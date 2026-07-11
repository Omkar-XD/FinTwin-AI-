'use client';

import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  FileText, 
  Zap 
} from 'lucide-react';

interface QuickInsightCardsProps {
  onCardClick: (prompt: string) => void;
}

const QUICK_INSIGHTS = [
  {
    id: 'snapshot',
    type: 'snapshot',
    title: 'Financial Snapshot',
    description: 'View your complete financial overview',
    prompt: 'Show me my complete financial snapshot.',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    id: 'risk',
    type: 'risk',
    title: 'Risk Analysis',
    description: 'Understand your financial risks',
    prompt: 'Explain my financial risks.',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    id: 'recommendations',
    type: 'recommendation',
    title: 'Recommendations',
    description: 'Get personalized improvements',
    prompt: 'What are your recommendations to improve my finances?',
    icon: <Lightbulb className="w-5 h-5" />,
  },
  {
    id: 'documents',
    type: 'document',
    title: 'Recent Documents',
    description: 'Review analyzed documents',
    prompt: 'Show the documents you analyzed.',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: 'scenario',
    type: 'scenario',
    title: 'Run Scenario',
    description: 'Simulate financial situations',
    prompt: 'I can simulate different financial situations. Choose one below.',
    icon: <Zap className="w-5 h-5" />,
  },
];

export function QuickInsightCards({ onCardClick }: QuickInsightCardsProps) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">Quick insights</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {QUICK_INSIGHTS.map((insight, idx) => (
          <motion.button
            key={insight.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onCardClick(insight.prompt)}
            className="text-left p-4 rounded-xl bg-secondary/40 border border-border/40 hover:bg-secondary/60 hover:border-border/60 transition-all"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
              className="text-primary mb-2"
            >
              {insight.icon}
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 + idx * 0.05 }}
            >
              <h4 className="text-sm font-medium text-foreground mb-1">
                {insight.title}
              </h4>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {insight.description}
              </p>
            </motion.div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
