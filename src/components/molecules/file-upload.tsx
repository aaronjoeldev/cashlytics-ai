'use client';

import { useState, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_SIZE = 5 * 1024 * 1024;

interface FileUploadProps {
  onUploadComplete: () => void;
  expenseId?: string;
  dailyExpenseId?: string;
}

export function FileUpload({ onUploadComplete, expenseId, dailyExpenseId }: FileUploadProps) {
  const t = useTranslations('expenses');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t('onlyPdfPngJpg');
    }
    if (file.size > MAX_SIZE) {
      return t('fileTooLarge');
    }
    return null;
  };

  const handleUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (expenseId) formData.append('expenseId', expenseId);
      if (dailyExpenseId) formData.append('dailyExpenseId', dailyExpenseId);

      const { uploadDocument } = await import('@/actions/document-actions');
      const result = await uploadDocument(formData);

      if (result.success) {
        onUploadComplete();
      } else {
        setError(result.error ?? t('uploadFailed'));
      }
    } catch {
      setError(t('uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }, [expenseId, dailyExpenseId, onUploadComplete, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
          isDragging 
            ? "border-amber-500 bg-amber-500/10" 
            : "border-border/50 hover:border-amber-500/50 hover:bg-accent/50"
        )}
      >
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          disabled={isUploading}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          {isUploading ? (
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-amber-500 animate-spin" />
          ) : (
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {isUploading ? t('uploading') : t('selectFile')}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {t('fileTypes')}
          </p>
        </label>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
