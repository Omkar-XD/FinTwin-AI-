'use client';

import { motion } from 'framer-motion';
import { FileText, Sparkles } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';

interface ConversationThreadProps {
  messages: ChatMessage[];
  userName?: string;
}

function formatFileSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function ConversationThread({ messages, userName }: ConversationThreadProps) {
  const userInitial = userName?.trim()?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="space-y-5">
      {messages.map((message) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`flex max-w-2xl gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl shadow-lg ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground shadow-primary/15'
                  : 'border border-border/50 bg-card text-primary'
              }`}
            >
              {message.role === 'user' ? (
                <span className="text-sm font-semibold">{userInitial}</span>
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>

            <div
              className={`rounded-2xl px-4 py-3 shadow-xl ${
                message.role === 'user'
                  ? 'rounded-tr-md bg-primary text-primary-foreground shadow-primary/10'
                  : 'rounded-tl-md border border-border/40 bg-card/80 text-foreground'
              }`}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="whitespace-pre-wrap text-sm leading-relaxed"
              >
                {message.content}
              </motion.div>

              {message.metadata?.attachments &&
                message.metadata.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.metadata.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className={`flex max-w-[16rem] items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                          message.role === 'user'
                            ? 'border-primary-foreground/25 bg-black/10 text-primary-foreground'
                            : 'border-border/40 bg-secondary/50 text-foreground'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{attachment.name}</p>
                          <p
                            className={
                              message.role === 'user'
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }
                          >
                            {formatFileSize(attachment.size)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`mt-2 text-xs opacity-70 ${
                  message.role === 'user'
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </motion.div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
