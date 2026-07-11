'use client';

import { motion } from 'framer-motion';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}

export function FollowUpSuggestions({ suggestions, onSuggestionClick }: FollowUpSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-4 pt-4 border-t border-border/40"
    >
      <p className="text-xs text-muted-foreground mb-3">Would you like to:</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, idx) => (
          <motion.button
            key={suggestion}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSuggestionClick(suggestion)}
            className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs text-foreground hover:bg-primary/20 hover:border-primary/50 transition-all"
          >
            • {suggestion}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
