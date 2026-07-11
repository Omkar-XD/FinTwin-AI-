'use client';

import { motion } from 'framer-motion';

const SCENARIO_OPTIONS = [
  { id: 'vehicle', label: 'Buy Vehicle', emoji: '🚗' },
  { id: 'loan', label: 'New Loan', emoji: '💳' },
  { id: 'salary', label: 'Salary Increase', emoji: '💰' },
  { id: 'savings', label: 'Increase Savings', emoji: '📈' },
  { id: 'investments', label: 'Increase Investments', emoji: '📊' },
];

interface ScenarioChipsProps {
  onScenarioSelect: (scenario: string) => void;
}

export function ScenarioChips({ onScenarioSelect }: ScenarioChipsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-4 flex flex-wrap gap-2"
    >
      {SCENARIO_OPTIONS.map((scenario, idx) => (
        <motion.button
          key={scenario.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onScenarioSelect(scenario.label)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 hover:border-primary/60 text-sm font-medium text-foreground hover:bg-gradient-to-r hover:from-primary/30 hover:to-accent/30 transition-all flex items-center gap-2"
        >
          <span>{scenario.emoji}</span>
          <span>{scenario.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
