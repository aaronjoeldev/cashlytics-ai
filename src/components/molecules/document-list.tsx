'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Image, Download, Trash2, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Document } from '@/types/database';

export interface DocumentListRef {
  refresh: () => void;
}

interface DocumentListProps {
  expenseId?: string;
  dailyExpenseId?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  return FileText;
}

function PreviewModal({
  docId,
  onClose
}: {
  docId: string | null;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!docId) {
      setDoc(null);
      setData(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setData(null);

    const load = async () => {
      try {
        const { downloadDocument } = await import('@/actions/document-actions');

        const result = await downloadDocument(docId);
        if (!cancelled && result.success && result.data) {
          setData(result.data);
          setDoc({
            id: docId,
            fileName: result.fileName ?? 'Document',
            mimeType: result.mimeType ?? 'application/pdf',
            size: 0,
            data: result.data,
          } as Document);
        }
      } catch (error) {
        console.error('Preview load failed:', error);
        if (!cancelled) onClose();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [docId, onClose]);

  return (
    <Dialog open={!!docId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="truncate pr-8">{doc?.fileName || 'Wird geladen...'}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data && doc ? (
            doc.mimeType.startsWith('image/') ? (
              <img
                src={`data:${doc.mimeType};base64,${data}`}
                alt={doc.fileName}
                className="max-w-full max-h-full object-contain mx-auto rounded-lg"
              />
            ) : doc.mimeType === 'application/pdf' ? (
              <iframe
                src={`data:application/pdf;base64,${data}`}
                className="w-full h-full rounded-lg border"
                title={doc.fileName}
              />
            ) : (
              <p className="text-center text-muted-foreground">Vorschau nicht verfügbar</p>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteModal({
  isOpen,
  isDeleting,
  onConfirm,
  onCancel
}: {
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      <div 
        className="bg-background rounded-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2">Dokument löschen?</h3>
        <p className="text-muted-foreground mb-6">
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Lösche...' : 'Löschen'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export const DocumentList = forwardRef<DocumentListRef, DocumentListProps>(
  function DocumentList({ expenseId, dailyExpenseId }, ref) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [previewDocId, setPreviewDocId] = useState<string | null>(null);
    const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadDocuments = useCallback(async () => {
      setIsLoading(true);
      try {
        if (expenseId) {
          const { getDocumentsByExpense } = await import('@/actions/document-actions');
          const result = await getDocumentsByExpense(expenseId);
          if (result.success && result.data) {
            setDocuments(result.data);
          }
        } else if (dailyExpenseId) {
          const { getDocumentsByDailyExpense } = await import('@/actions/document-actions');
          const result = await getDocumentsByDailyExpense(dailyExpenseId);
          if (result.success && result.data) {
            setDocuments(result.data);
          }
        }
      } finally {
        setIsLoading(false);
      }
    }, [expenseId, dailyExpenseId]);

    useImperativeHandle(ref, () => ({
      refresh: loadDocuments,
    }));

    useEffect(() => {
      loadDocuments();
    }, [loadDocuments]);

    const handleDownload = useCallback(async (doc: Document) => {
      try {
        const { downloadDocument } = await import('@/actions/document-actions');
        const result = await downloadDocument(doc.id);
        if (result.success && result.data) {
          const link = document.createElement('a');
          link.href = `data:${doc.mimeType};base64,${result.data}`;
          link.download = doc.fileName;
          link.click();
        }
      } catch (error) {
        console.error('Download failed:', error);
      }
    }, []);

    const handleDelete = useCallback(async () => {
      if (!deleteDocId) return;
      
      setIsDeleting(true);
      try {
        const { deleteDocument } = await import('@/actions/document-actions');
        const result = await deleteDocument(deleteDocId);
        if (result.success) {
          setDocuments(prev => prev.filter(d => d.id !== deleteDocId));
        }
      } finally {
        setIsDeleting(false);
        setDeleteDocId(null);
      }
    }, [deleteDocId]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (documents.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-4">
          Keine Dokumente vorhanden
        </p>
      );
    }

    return (
      <>
        <div className="space-y-2">
          {documents.map(doc => {
            const Icon = getFileIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-accent/20"
              >
                <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.size)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setPreviewDocId(doc.id)}
                    title="Ansehen"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDownload(doc)}
                    title="Herunterladen"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setDeleteDocId(doc.id)}
                    className="text-destructive hover:text-destructive"
                    title="Löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <PreviewModal 
          docId={previewDocId} 
          onClose={() => setPreviewDocId(null)} 
        />
        
        <DeleteModal
          isOpen={!!deleteDocId}
          isDeleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteDocId(null)}
        />
      </>
    );
  }
);
