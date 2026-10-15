"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { createPortal } from "react-dom";
import { FileText, Image, Download, Trash2, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Document } from "@/types/database";

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
  if (mimeType.startsWith("image/")) return Image;
  return FileText;
}

/** Documents attached to an expense or daily expense; null when neither id is given. */
async function fetchDocumentList(expenseId?: string, dailyExpenseId?: string) {
  const actions = await import("@/actions/document-actions");
  if (expenseId) return actions.getDocumentsByExpense(expenseId);
  if (dailyExpenseId) return actions.getDocumentsByDailyExpense(dailyExpenseId);
  return null;
}

function PreviewModal({
  docId,
  onClose,
  t,
}: {
  docId: string | null;
  onClose: () => void;
  t: (key: string) => string;
}) {
  // Mounted with a key per document, so every preview starts from a clean loading state
  const [doc, setDoc] = useState<Document | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(docId !== null);
  // The parent passes a new callback on every render; reading it from a ref keeps the effect
  // from loading the document again each time
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!docId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const { downloadDocument } = await import("@/actions/document-actions");

        const result = await downloadDocument(docId);
        if (cancelled) return;
        if (!result.success || !result.data) {
          toast.error((!result.success && result.error) || t("previewFailed"));
          onCloseRef.current();
          return;
        }
        setData(result.data);
        setDoc({
          id: docId,
          fileName: result.fileName ?? "Document",
          mimeType: result.mimeType ?? "application/pdf",
          size: 0,
          data: result.data,
        } as Document);
      } catch (error) {
        console.error("Preview load failed:", error);
        if (!cancelled) {
          toast.error(t("previewFailed"));
          onCloseRef.current();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [docId, t]);

  return (
    <Dialog
      open={!!docId}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="truncate pr-8">{doc?.fileName || t("loading")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : data && doc ? (
            doc.mimeType.startsWith("image/") ? (
              <img
                src={`data:${doc.mimeType};base64,${data}`}
                alt={doc.fileName}
                className="mx-auto max-h-full max-w-full rounded-lg object-contain"
              />
            ) : doc.mimeType === "application/pdf" ? (
              <iframe
                src={`data:application/pdf;base64,${data}`}
                className="h-full w-full rounded-lg border"
                title={doc.fileName}
              />
            ) : (
              <p className="text-muted-foreground text-center">{t("previewNotAvailable")}</p>
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
  onCancel,
  t,
  tCommon,
}: {
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      <div
        className="bg-background mx-4 w-full max-w-md rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-semibold">{t("deleteConfirm")}</h3>
        <p className="text-muted-foreground mb-6">{t("deleteConfirmDesc")}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? t("deleting") : tCommon("delete")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export const DocumentList = forwardRef<DocumentListRef, DocumentListProps>(function DocumentList(
  { expenseId, dailyExpenseId },
  ref
) {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showDocuments = useCallback(
    (result: Awaited<ReturnType<typeof fetchDocumentList>> | Error) => {
      setIsLoading(false);
      if (result instanceof Error) {
        console.error("Loading documents failed:", result);
        toast.error(t("loadFailed"));
      } else if (result && !result.success) {
        toast.error(result.error || t("loadFailed"));
      } else if (result) {
        setDocuments(result.data ?? []);
      }
    },
    [t]
  );

  useImperativeHandle(ref, () => ({
    refresh: () => {
      setIsLoading(true);
      fetchDocumentList(expenseId, dailyExpenseId).then(showDocuments, showDocuments);
    },
  }));

  useEffect(() => {
    let current = true;
    const show = (result: Parameters<typeof showDocuments>[0]) => {
      if (current) showDocuments(result);
    };
    fetchDocumentList(expenseId, dailyExpenseId).then(show, show);
    return () => {
      current = false;
    };
  }, [expenseId, dailyExpenseId, showDocuments]);

  const handleDownload = useCallback(
    async (doc: Document) => {
      try {
        const { downloadDocument } = await import("@/actions/document-actions");
        const result = await downloadDocument(doc.id);
        if (result.success && result.data) {
          const link = document.createElement("a");
          link.href = `data:${doc.mimeType};base64,${result.data}`;
          link.download = doc.fileName;
          link.click();
        } else {
          toast.error((!result.success && result.error) || t("downloadFailed"));
        }
      } catch (error) {
        console.error("Download failed:", error);
        toast.error(t("downloadFailed"));
      }
    },
    [t]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteDocId) return;

    setIsDeleting(true);
    try {
      const { deleteDocument } = await import("@/actions/document-actions");
      const result = await deleteDocument(deleteDocId);
      if (result.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== deleteDocId));
      } else {
        toast.error(result.error || t("deleteFailed"));
      }
    } catch (error) {
      console.error("Deleting document failed:", error);
      toast.error(t("deleteFailed"));
    } finally {
      setIsDeleting(false);
      setDeleteDocId(null);
    }
  }, [deleteDocId, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (documents.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-sm">{t("noDocumentsYet")}</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {documents.map((doc) => {
          const Icon = getFileIcon(doc.mimeType);
          return (
            <div
              key={doc.id}
              className="border-border/50 bg-accent/20 flex items-center gap-3 rounded-xl border p-3"
            >
              <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.fileName}</p>
                <p className="text-muted-foreground text-xs">{formatFileSize(doc.size)}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setPreviewDocId(doc.id)}
                  title={t("view")}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDownload(doc)}
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setDeleteDocId(doc.id)}
                  className="text-destructive hover:text-destructive"
                  title={t("delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <PreviewModal
        key={previewDocId ?? "closed"}
        docId={previewDocId}
        onClose={() => setPreviewDocId(null)}
        t={t}
      />

      <DeleteModal
        isOpen={!!deleteDocId}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDocId(null)}
        t={t}
        tCommon={tCommon}
      />
    </>
  );
});
