'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AgentActivityTimeline() {
  const steps = [
    { id: 'step-1', title: 'Reading financial profile' },
    { id: 'step-2', title: 'Retrieving financial memory' },
    { id: 'step-3', title: 'Running financial analysis' },
    { id: 'step-4', title: 'Validating response' },
  ];
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    steps.forEach((step, idx) => {
      const timer = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, step.id]);
      }, idx * 400);

      return () => clearTimeout(timer);
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-secondary/30 border border-border/40 rounded-2xl p-6"
    >
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = 
            completedSteps.length === idx || 
            (completedSteps.length > 0 && idx === completedSteps.length);

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className="flex items-center gap-3"
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, type: 'spring' }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </motion.div>
                ) : isCurrent ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Clock className="w-5 h-5 text-primary" />
                  </motion.div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-border/40" />
                )}
              </div>

              {/* Step Title */}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className={`text-sm ${
                  isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}
              >
                {step.title}
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
