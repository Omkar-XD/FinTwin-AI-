'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import { useAssistantChat, useDocuments } from '@/lib/hooks';
import { useAppStore, useAuthStore } from '@/lib/store';
import type { ChatAttachment, ChatMessage, UploadedFile } from '@/lib/types';
import {
  detectFileType,
  getFileValidationError,
  PDF_MIME_TYPE,
} from '@/components/upload';
import { AgentActivityTimeline } from './workspace/agent-activity-timeline';
import { AIToolsRail } from './workspace/ai-tools-rail';
import { ConversationThread } from './workspace/conversation-thread';
import { SuggestedQuestions } from './workspace/suggested-questions';
import { WelcomeSummary } from './workspace/welcome-summary';
import { WorkspaceHeader } from './workspace/header';

interface AIWorkspaceProps {
  onLogout: () => void;
}

type AttachmentUploadState = 'uploading' | 'uploaded' | 'error';

interface PendingAttachment {
  id: string;
  name: string;
  size: number;
  status: AttachmentUploadState;
  error?: string;
  documentId?: string;
  documentStatus?: UploadedFile['status'];
}

function formatFileSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function toChatAttachment(attachment: PendingAttachment): ChatAttachment {
  return {
    id: attachment.id,
    documentId: attachment.documentId ?? attachment.id,
    name: attachment.name,
    size: attachment.size,
    status: attachment.documentStatus ?? 'uploaded',
  };
}

export function AIWorkspace({ onLogout }: AIWorkspaceProps) {
  const user = useAuthStore((state) => state.user);
  const addFile = useAppStore((state) => state.addFile);
  const removeFile = useAppStore((state) => state.removeFile);
  const assistantChat = useAssistantChat();
  const { uploadMutation } = useDocuments();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<PendingAttachment[]>([]);
  const [welcomeSuggestionsUsed, setWelcomeSuggestionsUsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readyAttachments = attachedFiles.filter(
    (attachment) => attachment.status === 'uploaded' && attachment.documentId,
  );
  const hasSendableContent =
    Boolean(inputValue.trim()) || readyAttachments.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, assistantChat.isPending]);

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    files.forEach((file) => {
      const id = crypto.randomUUID();
      const validationError = getFileValidationError(file);

      if (validationError) {
        setAttachedFiles((current) => [
          ...current,
          {
            id,
            name: file.name,
            size: file.size,
            status: 'error',
            error: validationError,
          },
        ]);
        return;
      }

      setAttachedFiles((current) => [
        ...current,
        {
          id,
          name: file.name,
          size: file.size,
          status: 'uploading',
        },
      ]);

      const docType = detectFileType(file.name);
      void uploadMutation
        .mutateAsync({ file, docType })
        .then((result) => {
          setAttachedFiles((current) =>
            current.map((attachment) =>
              attachment.id === id
                ? {
                    ...attachment,
                    status: 'uploaded',
                    documentId: result.documentId,
                    documentStatus: result.status,
                  }
                : attachment,
            ),
          );

          addFile({
            id: result.documentId,
            name: file.name,
            type: docType,
            uploadedAt: new Date(),
            size: file.size,
            status: result.status,
          });
        })
        .catch((error) => {
          setAttachedFiles((current) =>
            current.map((attachment) =>
              attachment.id === id
                ? {
                    ...attachment,
                    status: 'error',
                    error:
                      error instanceof Error
                        ? error.message
                        : 'Upload failed. Please try again.',
                  }
                : attachment,
            ),
          );
        });
    });
  };

  const handleRemoveAttachment = (attachment: PendingAttachment) => {
    setAttachedFiles((current) =>
      current.filter((item) => item.id !== attachment.id),
    );

    if (attachment.documentId) {
      removeFile(attachment.documentId);
    }
  };

  const handleSendMessage = async (
    message: string,
    attachmentsToSend: PendingAttachment[] = [],
  ) => {
    const trimmedMessage = message.trim();
    const uploadedAttachments = attachmentsToSend.filter(
      (attachment) => attachment.status === 'uploaded' && attachment.documentId,
    );

    if (
      (!trimmedMessage && uploadedAttachments.length === 0) ||
      assistantChat.isPending ||
      !user
    ) {
      return;
    }

    const chatAttachments = uploadedAttachments.map(toChatAttachment);
    const attachmentSummary = chatAttachments.length
      ? `\n\nAttached PDFs available in document memory: ${chatAttachments
          .map((attachment) => attachment.name)
          .join(', ')}.`
      : '';
    const userContent = trimmedMessage || 'Attached PDF documents uploaded.';
    const assistantPrompt =
      (trimmedMessage || 'Please review the attached PDF documents.') +
      attachmentSummary;

    setWelcomeSuggestionsUsed(true);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: userContent,
        timestamp: new Date(),
        metadata:
          chatAttachments.length > 0 ? { attachments: chatAttachments } : undefined,
      },
    ]);
    setInputValue('');
    setAttachedFiles((current) =>
      current.filter(
        (attachment) =>
          !uploadedAttachments.some((sent) => sent.id === attachment.id),
      ),
    );
    inputRef.current?.focus();

    let content: string;
    try {
      const result = await assistantChat.mutateAsync({
        userId: user.id,
        message: assistantPrompt,
      });
      content = result.answer;
    } catch {
      content = `I couldn't complete that request. Please try again with a little more detail.`;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <WorkspaceHeader onLogout={onLogout} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AIToolsRail
          onToolClick={handleSendMessage}
          isProcessing={assistantChat.isPending}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
              <AnimatePresence>
                {messages.length === 0 && !welcomeSuggestionsUsed && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mt-auto mb-auto"
                  >
                    <WelcomeSummary />
                    <div className="mt-6">
                      <SuggestedQuestions onSendMessage={handleSendMessage} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {messages.length > 0 && (
                <div className="space-y-5 pb-4">
                  <ConversationThread messages={messages} userName={user?.name} />
                  {assistantChat.isPending && (
                    <div className="max-w-2xl">
                      <AgentActivityTimeline />
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-border/40 bg-background/80 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-2xl border border-border/40 bg-card/80 p-3 shadow-2xl shadow-black/30">
              {attachedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachedFiles.map((attachment) => (
                    <div
                      key={attachment.id}
                      className={`flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                        attachment.status === 'error'
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : attachment.status === 'uploaded'
                            ? 'border-green-500/30 bg-green-500/10 text-green-300'
                            : 'border-border/50 bg-secondary/60 text-foreground'
                      }`}
                    >
                      {attachment.status === 'uploading' ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : attachment.status === 'error' ? (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      )}
                      <FileText className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{attachment.name}</p>
                        <p className="text-[11px] opacity-75">
                          {attachment.status === 'error'
                            ? attachment.error
                            : formatFileSize(attachment.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(attachment)}
                        aria-label={`Remove ${attachment.name}`}
                        className="ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={`${PDF_MIME_TYPE},.pdf`}
                  onChange={handleAttachmentChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={assistantChat.isPending}
                  aria-label="Attach PDF files"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void handleSendMessage(inputValue, readyAttachments);
                    }
                  }}
                  placeholder="Ask anything about your financial life..."
                  className="min-h-11 flex-1 rounded-xl border border-border/40 bg-background/80 px-4 py-3 text-sm text-foreground placeholder-muted-foreground transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  disabled={assistantChat.isPending}
                />
                <button
                  type="button"
                  onClick={() => void handleSendMessage(inputValue, readyAttachments)}
                  disabled={!hasSendableContent || assistantChat.isPending}
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistantChat.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
