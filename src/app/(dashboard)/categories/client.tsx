'use client';

import { useState } from 'react';
import { Pencil, Trash2, Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CategoryForm } from '@/components/molecules/category-form';
import { createCategory, updateCategory, deleteCategory } from '@/actions/category-actions';
import { defaultCategories, type CategoryInput } from '@/lib/validations/category';
import type { Category } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

interface CategoriesClientProps {
  initialCategories: Category[];
}

export function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const { toast } = useToast();
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddingDefaults, setIsAddingDefaults] = useState(false);

  const handleCreate = async (data: CategoryInput) => {
    const result = await createCategory(data);
    if (result.success) {
      setCategories([...categories, result.data]);
      setIsDialogOpen(false);
      toast({ title: t('created'), description: t('createdDesc', { name: result.data.name }) });
    } else {
      toast({ title: tCommon('error') || 'Error', description: t('createFailed'), variant: 'destructive' });
    }
  };

  const handleUpdate = async (data: CategoryInput) => {
    if (!editingCategory) return;
    const result = await updateCategory(editingCategory.id, data);
    if (result.success) {
      setCategories(categories.map(c => c.id === editingCategory.id ? result.data : c));
      setEditingCategory(null);
      setIsDialogOpen(false);
      toast({ title: t('updated'), description: t('updatedDesc', { name: result.data.name }) });
    } else {
      toast({ title: tCommon('error') || 'Error', description: t('updateFailed'), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const category = categories.find(c => c.id === deleteId);
    const result = await deleteCategory(deleteId);
    if (result.success) {
      setCategories(categories.filter(c => c.id !== deleteId));
      setDeleteId(null);
      toast({ title: t('deleted'), description: category ? t('deletedDesc', { name: category.name }) : '' });
    } else {
      toast({ title: tCommon('error') || 'Error', description: t('deleteFailed'), variant: 'destructive' });
    }
  };

  const handleAddDefaults = async () => {
    setIsAddingDefaults(true);
    try {
      const newCategories: Category[] = [];
      for (const cat of defaultCategories) {
        if (!categories.some(c => c.name === cat.name)) {
          const result = await createCategory(cat);
          if (result.success) {
            newCategories.push(result.data);
          }
        }
      }
      setCategories([...categories, ...newCategories]);
      if (newCategories.length > 0) {
        toast({ title: t('defaultCategoriesAdded'), description: t('defaultCategoriesAddedDesc', { count: newCategories.length }) });
      } else {
        toast({ title: t('noChange'), description: t('noChangeDesc') });
      }
    } finally {
      setIsAddingDefaults(false);
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const categoriesCountText = categories.length === 1 
    ? t('categoriesCount', { count: categories.length, plural: '' })
    : t('categoriesCount', { count: categories.length, plural: 'n' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{t('title')}</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          {categories.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleAddDefaults} disabled={isAddingDefaults} className="flex-1 sm:flex-none">
              {isAddingDefaults ? t('adding') : t('addDefaultCategories')}
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCategory(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateDialog} className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4 mr-2" />
                {t('addCategory')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? t('editCategory') : t('newCategory')}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory ? t('editCategoryDesc') : t('newCategoryDesc')}
                </DialogDescription>
              </DialogHeader>
              <CategoryForm
                category={editingCategory ?? undefined}
                onSubmit={editingCategory ? handleUpdate : handleCreate}
                onCancel={() => { setIsDialogOpen(false); setEditingCategory(null); }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
          <CardContent className="py-16 text-center">
            <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('noCategories')}</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              {t('noCategoriesDesc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={handleAddDefaults} disabled={isAddingDefaults}>
                {isAddingDefaults ? t('adding') : t('addDefaultCategories')}
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                {t('createOwn')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
          <CardHeader>
            <CardTitle>{t('allCategories')}</CardTitle>
            <CardDescription>
              {categoriesCountText}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-white/5 border border-white/[0.08] hover:bg-white/10 hover:border-white/15 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center text-xl sm:text-2xl"
                      style={{
                        background: category.color
                          ? `linear-gradient(135deg, ${category.color}40, ${category.color}15)`
                          : 'linear-gradient(135deg, rgba(200,200,200,0.25), rgba(200,200,200,0.1))',
                      }}
                    >
                      {category.icon ?? '📁'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{category.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {category.color && (
                          <div
                            className="w-3 h-3 shrink-0 rounded-full border border-white/20"
                            style={{ backgroundColor: category.color }}
                          />
                        )}
                        <span className="text-xs text-muted-foreground truncate">
                          {new Date(category.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(category)}
                      className="h-8 w-8 hover:bg-white/10"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(category.id)}
                      className="h-8 w-8 hover:bg-red-500/10 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
