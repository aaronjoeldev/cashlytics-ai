'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Image, Trash2, Loader2, Eye, Search, FolderOpen, Calendar, Tag, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import type { DocumentWithDetails } from '@/actions/document-actions';

interface DocumentsClientProps {
  initialDocuments: DocumentWithDetails[];
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
  onClose,
  t
}: {
  docId: string | null;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [data, setData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!docId) {
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
          setFileName(result.fileName ?? 'Document');
          setMimeType(result.mimeType ?? 'application/pdf');
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
          <DialogTitle className="truncate pr-8">{fileName || t('loading')}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            mimeType.startsWith('image/') ? (
              <img
                src={`data:${mimeType};base64,${data}`}
                alt={fileName}
                className="max-w-full max-h-full object-contain mx-auto rounded-lg"
              />
            ) : mimeType === 'application/pdf' ? (
              <iframe
                src={`data:application/pdf;base64,${data}`}
                className="w-full h-full rounded-lg border"
                title={fileName}
              />
            ) : (
              <p className="text-center text-muted-foreground">{t('previewNotAvailable')}</p>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsClient({ initialDocuments }: DocumentsClientProps) {
  const { toast } = useToast();
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');
  const [documents, setDocuments] = useState<DocumentWithDetails[]>(initialDocuments);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const uniqueCategories = new Map<string, { id: string; name: string; icon: string | null; color: string | null }>();
    documents.forEach(doc => {
      if (doc.category && !uniqueCategories.has(doc.category.id)) {
        uniqueCategories.set(doc.category.id, doc.category);
      }
    });
    return Array.from(uniqueCategories.values());
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.expenseName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesCategory = categoryFilter === 'all' || doc.category?.id === categoryFilter;
      const matchesType = typeFilter === 'all' || doc.expenseType === typeFilter;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [documents, searchTerm, categoryFilter, typeFilter]);

  const handleDelete = useCallback(async () => {
    if (!deleteDocId) return;
    
    setIsDeleting(true);
    try {
      const { deleteDocument } = await import('@/actions/document-actions');
      const result = await deleteDocument(deleteDocId);
      if (result.success) {
        setDocuments(prev => prev.filter(d => d.id !== deleteDocId));
        toast({ title: t('deleted'), description: t('deletedDesc') });
      }
    } finally {
      setIsDeleting(false);
      setDeleteDocId(null);
    }
  }, [deleteDocId, toast, t]);

  if (documents.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{t('title')}</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">{t('description')}</p>
        </div>
        <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
          <CardContent className="py-16 text-center">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('noDocuments')}</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {t('noDocumentsDesc')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{t('title')}</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">{t('description')}</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {t('documentsCount', { filtered: filteredDocuments.length, total: documents.length })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white/5 border-white/[0.08]"
          />
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white/5 border-white/[0.08]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('filterByCategory')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCategories')}</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon && <span className="mr-2">{cat.icon}</span>}
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white/5 border-white/[0.08]">
            <SelectValue placeholder={t('filterByType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            <SelectItem value="periodic">{t('periodicExpenses')}</SelectItem>
            <SelectItem value="daily">{t('dailyExpenses')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
        <CardContent className="p-0">
          <div className="grid gap-1 p-4">
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('noDocumentsFound')}
              </div>
            ) : (
              filteredDocuments.map(doc => {
                const Icon = getFileIcon(doc.mimeType);
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-400/20 to-amber-500/10">
                        <Icon className="w-5 h-5 text-amber-500/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs ml-13 sm:ml-0">
                      {doc.category && (
                        <div
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                          style={{
                            background: doc.category.color
                              ? `linear-gradient(135deg, ${doc.category.color}30, ${doc.category.color}10)`
                              : 'rgba(200,200,200,0.15)',
                          }}
                        >
                          {doc.category.icon && <span>{doc.category.icon}</span>}
                          <span className="text-muted-foreground">{doc.category.name}</span>
                        </div>
                      )}
                      
                      {doc.expenseType && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.05]">
                          <Tag className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {doc.expenseType === 'periodic' ? t('periodic') : t('daily')}
                          </span>
                        </div>
                      )}

                      {doc.expenseName && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.05] max-w-[150px]">
                          <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground truncate">{doc.expenseName}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.05]">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1 ml-auto sm:ml-0 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewDocId(doc.id)}
                        className="h-8 w-8 hover:bg-white/10"
                        title={t('view')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDocId(doc.id)}
                        className="h-8 w-8 hover:bg-red-500/10 text-destructive hover:text-destructive"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
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
        docId={previewDocId}
        onClose={() => setPreviewDocId(null)}
        t={t}
      />

      {deleteDocId && (
        <Dialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t('deleteConfirm')}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              {t('deleteConfirmDesc')}
            </p>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteDocId(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t('deleting') : tCommon('delete')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
