"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FileText,
  Image,
  Trash2,
  Loader2,
  Eye,
  Search,
  FolderOpen,
  Calendar,
  Tag,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast, toast as showToast } from "@/hooks/use-toast";
import { useFormatter, useTranslations } from "next-intl";
import type { DocumentWithDetails } from "@/actions/document-actions";

interface DocumentsClientProps {
  initialDocuments: DocumentWithDetails[];
  /** The server could not load the list; show that instead of the empty state */
  loadFailed?: boolean;
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

function PreviewModal({
  docId,
  onClose,
  t,
}: {
  docId: string | null;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [data, setData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("");
  // Mounted with a key per document, so every preview starts from a clean loading state
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
          showToast({
            title: t("previewFailed"),
            description: result.success ? undefined : result.error,
            variant: "destructive",
          });
          onCloseRef.current();
          return;
        }
        setData(result.data);
        setFileName(result.fileName ?? "Document");
        setMimeType(result.mimeType ?? "application/pdf");
      } catch (error) {
        console.error("Preview load failed:", error);
        if (!cancelled) {
          showToast({ title: t("previewFailed"), variant: "destructive" });
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
          <DialogTitle className="truncate pr-8">{fileName || t("loading")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : data ? (
            mimeType.startsWith("image/") ? (
              <img
                src={`data:${mimeType};base64,${data}`}
                alt={fileName}
                className="mx-auto max-h-full max-w-full rounded-lg object-contain"
              />
            ) : mimeType === "application/pdf" ? (
              <iframe
                src={`data:application/pdf;base64,${data}`}
                className="h-full w-full rounded-lg border"
                title={fileName}
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

export function DocumentsClient({ initialDocuments, loadFailed = false }: DocumentsClientProps) {
  const { toast } = useToast();
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [documents, setDocuments] = useState<DocumentWithDetails[]>(initialDocuments);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const uniqueCategories = new Map<
      string,
      { id: string; name: string; icon: string | null; color: string | null }
    >();
    documents.forEach((doc) => {
      if (doc.category && !uniqueCategories.has(doc.category.id)) {
        uniqueCategories.set(doc.category.id, doc.category);
      }
    });
    return Array.from(uniqueCategories.values());
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.expenseName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesCategory = categoryFilter === "all" || doc.category?.id === categoryFilter;
      const matchesType = typeFilter === "all" || doc.expenseType === typeFilter;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [documents, searchTerm, categoryFilter, typeFilter]);

  const handleDelete = useCallback(async () => {
    if (!deleteDocId) return;

    setIsDeleting(true);
    try {
      const { deleteDocument } = await import("@/actions/document-actions");
      const result = await deleteDocument(deleteDocId);
      if (result.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== deleteDocId));
        toast({ title: t("deleted"), description: t("deletedDesc") });
      } else {
        toast({ title: t("deleteFailed"), description: result.error, variant: "destructive" });
      }
    } catch (error) {
      console.error("Deleting document failed:", error);
      toast({ title: t("deleteFailed"), variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDocId(null);
    }
  }, [deleteDocId, toast, t]);

  if (documents.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-2xl leading-none font-bold tracking-[-0.03em] text-transparent sm:text-[2rem]">
            {t("title")}
          </h2>
          <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
        </div>
        <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
          <CardContent className="py-16 text-center">
            <FileText className="text-muted-foreground/30 mx-auto mb-4 h-16 w-16" />
            <h3 className="mb-2 text-lg font-medium">
              {loadFailed ? t("loadFailed") : t("noDocuments")}
            </h3>
            {!loadFailed && (
              <p className="text-muted-foreground mx-auto max-w-md text-sm">
                {t("noDocumentsDesc")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-2xl leading-none font-bold tracking-[-0.03em] text-transparent sm:text-[2rem]">
            {t("title")}
          </h2>
          <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
        </div>
        <div className="text-muted-foreground text-sm">
          {t("documentsCount", { filtered: filteredDocuments.length, total: documents.length })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-white/[0.08] bg-white/5 pl-9"
          />
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full border-white/[0.08] bg-white/5 sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("filterByCategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon && <span className="mr-2">{cat.icon}</span>}
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full border-white/[0.08] bg-white/5 sm:w-[180px]">
            <SelectValue placeholder={t("filterByType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            <SelectItem value="periodic">{t("periodicExpenses")}</SelectItem>
            <SelectItem value="daily">{t("dailyExpenses")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
        <CardContent className="p-0">
          <div className="grid gap-1 p-4">
            {filteredDocuments.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">{t("noDocumentsFound")}</div>
            ) : (
              filteredDocuments.map((doc) => {
                const Icon = getFileIcon(doc.mimeType);
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.05] sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/20 to-amber-500/10">
                        <Icon className="h-5 w-5 text-amber-500/80" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.fileName}</p>
                        <p className="text-muted-foreground text-xs">{formatFileSize(doc.size)}</p>
                      </div>
                    </div>

                    <div className="ml-13 flex flex-wrap items-center gap-2 text-xs sm:ml-0 sm:gap-3">
                      {doc.category && (
                        <div
                          className="flex items-center gap-1.5 rounded-md px-2 py-1"
                          style={{
                            background: doc.category.color
                              ? `linear-gradient(135deg, ${doc.category.color}30, ${doc.category.color}10)`
                              : "rgba(200,200,200,0.15)",
                          }}
                        >
                          {doc.category.icon && <span>{doc.category.icon}</span>}
                          <span className="text-muted-foreground">{doc.category.name}</span>
                        </div>
                      )}

                      {doc.expenseType && (
                        <div className="flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1">
                          <Tag className="text-muted-foreground h-3 w-3" />
                          <span className="text-muted-foreground">
                            {doc.expenseType === "periodic" ? t("periodic") : t("daily")}
                          </span>
                        </div>
                      )}

                      {doc.expenseName && (
                        <div className="flex max-w-[150px] items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1">
                          <FolderOpen className="text-muted-foreground h-3 w-3 shrink-0" />
                          <span className="text-muted-foreground truncate">{doc.expenseName}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1">
                        <Calendar className="text-muted-foreground h-3 w-3" />
                        <span className="text-muted-foreground">
                          {format.dateTime(new Date(doc.createdAt), { dateStyle: "medium" })}
                        </span>
                      </div>
                    </div>

                    <div className="ml-auto flex shrink-0 gap-1 sm:ml-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewDocId(doc.id)}
                        className="h-8 w-8 hover:bg-white/10"
                        title={t("view")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDocId(doc.id)}
                        className="text-destructive hover:text-destructive h-8 w-8 hover:bg-red-500/10"
                        title={t("delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <PreviewModal
        key={previewDocId ?? "closed"}
        docId={previewDocId}
        onClose={() => setPreviewDocId(null)}
        t={t}
      />

      {deleteDocId && (
        <Dialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("deleteConfirm")}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">{t("deleteConfirmDesc")}</p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteDocId(null)}>
                {tCommon("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? t("deleting") : tCommon("delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
