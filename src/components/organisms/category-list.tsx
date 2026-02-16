'use client';

import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface CategoryListProps {
  initialCategories: Category[];
}

export function CategoryList({ initialCategories }: CategoryListProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreate = async (data: CategoryInput) => {
    const result = await createCategory(data);
    if (result.success) {
      setCategories([...categories, result.data]);
      setIsDialogOpen(false);
    }
  };

  const handleUpdate = async (data: CategoryInput) => {
    if (!editingCategory) return;
    const result = await updateCategory(editingCategory.id, data);
    if (result.success) {
      setCategories(categories.map(c => c.id === editingCategory.id ? result.data : c));
      setEditingCategory(null);
      setIsDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteCategory(deleteId);
    if (result.success) {
      setCategories(categories.filter(c => c.id !== deleteId));
      setDeleteId(null);
    }
  };

  const handleAddDefaults = async () => {
    for (const cat of defaultCategories) {
      if (!categories.some(c => c.name === cat.name)) {
        await createCategory(cat);
      }
    }
    window.location.reload();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Kategorien</CardTitle>
        <div className="flex gap-2">
          {categories.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleAddDefaults}>
              Standardkategorien hinzufügen
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingCategory(null)}>
                <Plus className="w-4 h-4 mr-1" />
                Neu
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
                </DialogTitle>
              </DialogHeader>
              <CategoryForm
                category={editingCategory ?? undefined}
                onSubmit={editingCategory ? handleUpdate : handleCreate}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Kategorien vorhanden. Füge Standardkategorien hinzu oder erstelle eine eigene.
          </p>
        ) : (
          <div className="grid gap-2">
            {categories.map(category => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 dark:hover:bg-white/5 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                    style={{
                      background: category.color
                        ? `linear-gradient(135deg, ${category.color}40, ${category.color}15)`
                        : 'linear-gradient(135deg, rgba(200,200,200,0.25), rgba(200,200,200,0.1))',
                    }}
                  >
                    {category.icon ?? '📁'}
                  </span>
                  <span className="font-medium">{category.name}</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingCategory(category);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(category.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}