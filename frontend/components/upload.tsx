'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload as UploadIcon,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  Landmark,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { UploadedFile } from '@/lib/types';
import { useAnalyzeDocument, useDocuments } from '@/lib/hooks';

interface UploadProps {
  onComplete: () => void;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const PDF_MIME_TYPE = 'application/pdf';

export const getFileValidationError = (file: File): string | undefined => {
  if (file.type !== PDF_MIME_TYPE) {
    return 'Only PDF files are supported.';
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return 'PDF files must be 10MB or smaller.';
  }

  return undefined;
};

export const detectFileType = (
  filename: string
): UploadedFile['type'] => {
  const normalized = filename.toLowerCase();
  if (normalized.includes('salary') || normalized.includes('pay')) {
    return 'salary_slip';
  }
  if (normalized.includes('credit') || normalized.includes('card')) {
    return 'credit_card';
  }
  if (normalized.includes('loan')) {
    return 'loan_statement';
  }
  return 'bank_statement';
};

const FILE_TYPES = [
  { id: 'financial_statement', label: 'Financial Statements', icon: FileText },
  { id: 'bank_data', label: 'Bank Data', icon: Landmark },
];

export function Upload({ onComplete }: UploadProps) {
  const { uploadedFiles, addFile, removeFile } = useAppStore();
  const [dragActive, setDragActive] = useState(false);
  const [documentId, setDocumentId] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const { uploadMutation } = useDocuments();
  const analyzeMutation = useAnalyzeDocument();
  const isUploading = uploadMutation.isPending;
  const isAnalyzing = analyzeMutation.isPending;
  const uploadProgress = isUploading ? 50 : uploadSuccess ? 100 : 0;

  const hasActiveDocument = Boolean(documentId) || uploadedFiles.length > 0;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAnalyzing) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isAnalyzing) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      void handleFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleFile = async (file: File) => {
    const validationError = getFileValidationError(file);
    if (validationError) {
      setFileError(validationError);
      setDocumentId(undefined);
      setUploadSuccess(false);
      uploadMutation.reset();
      analyzeMutation.reset();
      return;
    }

    setFileError(undefined);
    setUploadSuccess(false);
    analyzeMutation.reset();
    const docType = detectFileType(file.name);

    try {
      const result = await uploadMutation.mutateAsync({ file, docType });
      setDocumentId(result.documentId);
      setUploadSuccess(true);
      const newFile: UploadedFile = {
        id: result.documentId,
        name: file.name,
        type: docType,
        uploadedAt: new Date(),
        size: file.size,
        status: result.status,
      };
      addFile(newFile);
    } catch {
      setDocumentId(undefined);
      setUploadSuccess(false);
    }
  };

  const handleAnalyze = async () => {
    if (!documentId) {
      return;
    }

    setFileError(undefined);

    try {
      await analyzeMutation.mutateAsync(documentId);
      onComplete();
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : 'Document analysis failed. Please try again.',
      );
    }
  };

  const handleCancel = () => {
    // Clear any in-progress or completed upload state and start fresh.
    setFileError(undefined);
    setUploadSuccess(false);
    setDocumentId(undefined);
    uploadMutation.reset();
    analyzeMutation.reset();
    uploadedFiles.forEach((file) => removeFile(file.id));
  };

  useEffect(() => {
    if (!documentId) {
      setUploadSuccess(false);
    }
  }, [documentId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card/10 to-background p-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight">
            Upload Your Financial Data
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Share your financial documents and let FinTwin AI analyze your wealth
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-8"
        >
          {FILE_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.id}
                className="flex items-center gap-3 rounded-xl bg-card/50 border border-border/40 px-4 py-3 transition-colors hover:border-primary/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="font-medium text-sm">{type.label}</p>
              </div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative p-12 rounded-2xl border-2 border-dashed transition-all mb-6 ${
            dragActive
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border/50 hover:border-primary/50'
          } ${isAnalyzing ? 'opacity-60' : ''}`}
        >
          <input
            type="file"
            onChange={handleChange}
            disabled={isUploading || isAnalyzing}
            accept="application/pdf,.pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Upload PDF document"
          />

          <div className="text-center pointer-events-none">
            {isUploading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="flex justify-center mb-4"
              >
                <Loader2 className="w-12 h-12 text-primary" />
              </motion.div>
            ) : (
              <UploadIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            )}

            <h3 className="font-semibold mb-1">
              {isUploading ? 'Uploading...' : 'Drag and drop your files here'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isUploading
                ? `${Math.round(uploadProgress)}%`
                : 'or click to browse for a PDF up to 10MB'}
            </p>

            {isUploading && (
              <div className="w-full bg-input rounded-full h-1 mt-4">
                <motion.div
                  className="bg-primary h-full rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Status messages: only ever one of these shows at a time, and only
            when relevant — nothing unavailable stays visible. */}
        <AnimatePresence mode="wait">
          {fileError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {fileError}
            </motion.div>
          ) : uploadMutation.isError ? (
            <motion.div
              key="upload-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {uploadMutation.error?.message ?? 'Upload failed.'}
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-6"
            >
              <TerminalLoader />
            </motion.div>
          ) : uploadSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-300 flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              Upload successful
            </motion.div>
          ) : null}
        </AnimatePresence>

        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-3 mb-8"
          >
            <h3 className="font-semibold text-sm">Uploaded Files</h3>
            {uploadedFiles.map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/40"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  {uploadSuccess && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring' }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </motion.div>
                  )}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-input rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={isAnalyzing}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="flex gap-4"
        >
          <button
            onClick={handleCancel}
            disabled={isAnalyzing || (!hasActiveDocument && !fileError)}
            className="flex-1 px-6 py-3 rounded-lg border border-border/40 hover:bg-input transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleAnalyze()}
            disabled={!uploadSuccess || !documentId || isAnalyzing || isUploading}
            className={`flex-1 px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              uploadSuccess && documentId && !isAnalyzing && !isUploading
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze Document
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function TerminalLoader() {
  const messages = [
    'Uploading document...',
    'Extracting data...',
    'Analyzing financials...',
    'Preparing workspace...',
  ];
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [messages.length]);

  return (
    <div className="terminal-loader">
      <div className="terminal-header">
        <div className="terminal-title">Status</div>
        <div className="terminal-controls">
          <div className="control close" />
          <div className="control minimize" />
          <div className="control maximize" />
        </div>
      </div>
      <div key={messages[messageIndex]} className="text">
        {messages[messageIndex]}
      </div>
    </div>
  );
}
