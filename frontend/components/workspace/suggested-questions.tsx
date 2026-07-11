'use client';

import { motion } from 'framer-motion';
const QUESTIONS = [
  'Explain my risk score',
  'Can I buy a car?',
  'How can I reduce my debt?',
  'How can I increase my savings?',
  'Show my spending analysis',
  'Help me plan for retirement',
];

interface SuggestedQuestionsProps {
  onSendMessage: (message: string) => void;
}

export function SuggestedQuestions({ onSendMessage }: SuggestedQuestionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <p className="text-sm text-muted-foreground mb-4">Suggested questions:</p>
      <div className="flex flex-wrap gap-2">
        {QUESTIONS.map((question, idx) => (
          <motion.button
            key={question}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 + idx * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSendMessage(question)}
            className="px-4 py-2 rounded-full bg-secondary/50 border border-border/40 text-sm text-foreground hover:bg-secondary hover:border-border/60 transition-all"
          >
            {question}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
