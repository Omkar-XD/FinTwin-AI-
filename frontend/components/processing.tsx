'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Brain, BarChart3, TrendingUp, ArrowRight } from 'lucide-react';

interface ProcessingProps {
  onComplete: () => void;
}

const analysisSteps = [
  {
    id: 1,
    label: 'Analyzing Financial Data',
    icon: BarChart3,
    duration: 2000,
  },
  {
    id: 2,
    label: 'AI Pattern Recognition',
    icon: Brain,
    duration: 2200,
  },
  {
    id: 3,
    label: 'Risk Assessment',
    icon: TrendingUp,
    duration: 2000,
  },
  {
    id: 4,
    label: 'Generating Recommendations',
    icon: Zap,
    duration: 1800,
  },
];

export function Processing({ onComplete }: ProcessingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (currentStep >= analysisSteps.length) {
      setIsComplete(true);
      return;
    }

    const step = analysisSteps[currentStep];
    const startTime = Date.now();
    const targetDuration = step.duration;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / targetDuration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setCurrentStep(currentStep + 1);
          setProgress(0);
        }, 300);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [currentStep]);

  const totalProgress = Math.round(
    (currentStep + progress / 100) / analysisSteps.length * 100
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl font-bold mb-3">Analyzing Your Finances</h1>
          <p className="text-muted-foreground">
            Our Agent is working to understand your financial profile
          </p>
        </motion.div>

        {/* Overall Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-primary font-semibold">
              {totalProgress}%
            </span>
          </div>
          <div className="h-2 bg-input rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-accent"
              initial={{ width: '0%' }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>

        {/* Analysis Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-4 mb-12"
        >
          {analysisSteps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const Icon = step.icon;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`p-4 rounded-lg border transition-all ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : isCompleted
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-border/40 bg-card/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isActive ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </motion.div>
                    ) : isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring' }}
                      >
                        ✓
                      </motion.div>
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium text-sm ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>

                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 ml-14"
                  >
                    <div className="h-1 bg-input rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.05 }}
                      />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Completion Message */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4"
            >
              <span className="text-3xl">✓</span>
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Analysis Complete!</h2>
            <p className="text-muted-foreground">
              Your financial profile is ready. Let&apos;s explore your dashboard.
            </p>
          </motion.div>
        )}

        {/* Continue Button */}
        {isComplete && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            onClick={onComplete}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            View Your Dashboard
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
