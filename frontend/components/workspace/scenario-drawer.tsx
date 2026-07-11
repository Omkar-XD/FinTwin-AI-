'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useSimulation, type ScenarioType } from '@/lib/hooks';
import { useAuthStore } from '@/lib/store';

interface ScenarioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DrawerResult {
  scenario: string;
  projectedImpact: Record<string, number>;
  risks: string[];
  recommendation: string;
}

export function ScenarioDrawer({ isOpen, onClose }: ScenarioDrawerProps) {
  const user = useAuthStore((state) => state.user);
  const simulation = useSimulation();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [result, setResult] = useState<DrawerResult | null>(null);
  const scenarios: Array<{
    id: ScenarioType;
    name: string;
    description: string;
  }> = [
    { id: 'vehicle_purchase', name: 'Buy Vehicle', description: 'Simulate purchasing a car' },
    { id: 'new_loan', name: 'New Loan', description: 'Take out a personal loan' },
    { id: 'salary_change', name: 'Salary Change', description: 'Model a salary change' },
    { id: 'increase_savings', name: 'Increase Savings', description: 'Boost monthly savings' },
    { id: 'increase_investments', name: 'Increase Investments', description: 'Allocate more to investments' },
    { id: 'early_loan_repayment', name: 'Prepay Loan', description: 'Model early loan repayment' },
  ];
  const isRunning = simulation.isPending;

  const handleRunScenario = async (scenarioId: string) => {
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (!scenario || !user) return;
    const response = await simulation.mutateAsync({
      userId: user.id,
      scenarioType: scenario.id,
    });
    const outcome = response.projectedOutcome as {
      narrative?: string;
      risks?: string[];
      projectedNetWorth?: Record<string, number>;
    };
    setResult({
      scenario: scenario.name,
      projectedImpact: outcome.projectedNetWorth ?? {},
      risks: outcome.risks ?? [],
      recommendation: outcome.narrative ?? 'No narrative was returned.',
    });
  };

  const handleReset = () => {
    setSelectedScenario(null);
    setResult(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 500, opacity: 0 }}
            transition={{ type: 'spring', damping: 30 }}
            className="fixed right-0 top-0 h-screen w-full max-w-md bg-background border-l border-border/40 z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="border-b border-border/40 p-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Run Scenario</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!result ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose a financial scenario to simulate:
                  </p>

                  {scenarios.map((scenario) => (
                    <motion.button
                      key={scenario.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setSelectedScenario(scenario.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedScenario === scenario.id
                          ? 'bg-primary/10 border-primary/40'
                          : 'bg-secondary/40 border-border/40 hover:border-border/60'
                      }`}
                    >
                      <h3 className="font-medium text-foreground mb-1">
                        {scenario.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {scenario.description}
                      </p>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Success Header */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 mb-4"
                  >
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Simulation Complete
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {result.scenario}
                      </p>
                    </div>
                  </motion.div>

                  {/* Impact */}
                  {Object.keys(result.projectedImpact).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-secondary/40 border border-border/40 rounded-lg p-4"
                    >
                      <h4 className="text-sm font-medium text-foreground mb-3">
                        Projected Impact
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(result.projectedImpact).map(
                          ([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-muted-foreground capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}:
                              </span>
                              <span className="text-foreground font-medium">
                                {typeof value === 'number' &&
                                value > 0 &&
                                !key.toLowerCase().includes('payment')
                                  ? '+'
                                  : ''}
                                {typeof value === 'number'
                                  ? value > 1000
                                    ? `$${(value / 1000).toFixed(1)}k`
                                    : `$${value}`
                                  : value}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Risks */}
                  {result.risks.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-destructive/10 border border-destructive/30 rounded-lg p-4"
                    >
                      <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Risks to Consider
                      </h4>
                      <ul className="space-y-2">
                        {result.risks.map((risk, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground">
                            • {risk}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {/* Recommendation */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-primary/10 border border-primary/40 rounded-lg p-4"
                  >
                    <h4 className="text-sm font-medium text-foreground mb-2">
                      AI Recommendation
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.recommendation}
                    </p>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border/40 p-6 space-y-3">
              {result ? (
                <button
                  onClick={handleReset}
                  className="w-full px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
                >
                  Run Another Scenario
                </button>
              ) : (
                <>
                  <button
                    onClick={() =>
                      selectedScenario && handleRunScenario(selectedScenario)
                    }
                    disabled={!selectedScenario || isRunning}
                    className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {isRunning ? 'Running...' : 'Run Scenario'}
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
