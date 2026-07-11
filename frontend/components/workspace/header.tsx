'use client';

import { motion } from 'framer-motion';
import { LogOut, TrendingUp } from 'lucide-react';

interface WorkspaceHeaderProps {
  onLogout: () => void;
}

export function WorkspaceHeader({ onLogout }: WorkspaceHeaderProps) {
  return (
    <div className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo & Title */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">FinTwin AI</span>
            <span className="text-xs text-muted-foreground">Financial Workspace</span>
          </div>
        </motion.div>

        {/* Logout Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onClick={onLogout}
          className="rounded-xl border border-border/40 bg-card/60 p-2 transition-colors hover:bg-secondary"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </motion.button>
      </div>
    </div>
  );
}
