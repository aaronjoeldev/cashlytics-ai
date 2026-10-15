"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CategoryForm } from "@/components/molecules/category-form";
import { createCategory, updateCategory, deleteCategory } from "@/actions/category-actions";
import { defaultCategories, type CategoryInput } from "@/lib/validations/category";
import type { Category } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { useFormatter, useTranslations } from "next-intl";

interface CategoriesClientProps {
  initialCategories: Category[];
}

export function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const { toast } = useToast();
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const format = useFormatter();
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
      toast({ title: t("created"), description: t("createdDesc", { name: result.data.name }) });
    } else {
      toast({
        title: tCommon("error") || "Error",
        description: t("createFailed"),
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (data: CategoryInput) => {
    if (!editingCategory) return;
    const result = await updateCategory(editingCategory.id, data);
    if (result.success) {
      setCategories(categories.map((c) => (c.id === editingCategory.id ? result.data : c)));
      setEditingCategory(null);
      setIsDialogOpen(false);
      toast({ title: t("updated"), description: t("updatedDesc", { name: result.data.name }) });
    } else {
      toast({
        title: tCommon("error") || "Error",
        description: t("updateFailed"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const category = categories.find((c) => c.id === deleteId);
    const result = await deleteCategory(deleteId);
    if (result.success) {
      setCategories(categories.filter((c) => c.id !== deleteId));
      setDeleteId(null);
      toast({
        title: t("deleted"),
        description: category ? t("deletedDesc", { name: category.name }) : "",
      });
    } else {
      toast({
        title: tCommon("error") || "Error",
        description: t("deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const handleAddDefaults = async () => {
    setIsAddingDefaults(true);
    try {
      const newCategories: Category[] = [];
      for (const cat of defaultCategories) {
        if (!categories.some((c) => c.name === cat.name)) {
          const result = await createCategory(cat);
          if (result.success) {
            newCategories.push(result.data);
          }
        }
      }
      setCategories([...categories, ...newCategories]);
      if (newCategories.length > 0) {
        toast({
          title: t("defaultCategoriesAdded"),
          description: t("defaultCategoriesAddedDesc", { count: newCategories.length }),
        });
      } else {
        toast({ title: t("noChange"), description: t("noChangeDesc") });
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

  const categoriesCountText = t("categoriesCount", { count: categories.length });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-2xl leading-none font-bold tracking-[-0.03em] text-transparent sm:text-[2rem]">
            {t("title")}
          </h2>
          <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          {categories.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddDefaults}
              disabled={isAddingDefaults}
              className="flex-1 sm:flex-none"
            >
              {isAddingDefaults ? t("adding") : t("addDefaultCategories")}
            </Button>
          )}
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingCategory(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreateDialog} className="flex-1 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" />
                {t("addCategory")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingCategory ? t("editCategory") : t("newCategory")}</DialogTitle>
                <DialogDescription>
                  {editingCategory ? t("editCategoryDesc") : t("newCategoryDesc")}
                </DialogDescription>
              </DialogHeader>
              <CategoryForm
                category={editingCategory ?? undefined}
                onSubmit={editingCategory ? handleUpdate : handleCreate}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingCategory(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
          <CardContent className="py-16 text-center">
            <FolderOpen className="text-muted-foreground/30 mx-auto mb-4 h-16 w-16" />
            <h3 className="mb-2 text-lg font-medium">{t("noCategories")}</h3>
            <p className="text-muted-foreground mx-auto mb-6 max-w-md text-sm">
              {t("noCategoriesDesc")}
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="outline" onClick={handleAddDefaults} disabled={isAddingDefaults}>
                {isAddingDefaults ? t("adding") : t("addDefaultCategories")}
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                {t("createOwn")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>{t("allCategories")}</CardTitle>
            <CardDescription>{categoriesCountText}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/5 p-3 transition-all duration-300 hover:border-white/15 hover:bg-white/10 sm:p-4"
                >
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl sm:h-12 sm:w-12 sm:text-2xl"
                      style={{
                        background: category.color
                          ? `linear-gradient(135deg, ${category.color}40, ${category.color}15)`
                          : "linear-gradient(135deg, rgba(200,200,200,0.25), rgba(200,200,200,0.1))",
                      }}
                    >
                      {category.icon ?? "📁"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium sm:text-base">{category.name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {category.color && (
                          <div
                            className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                            style={{ backgroundColor: category.color }}
                          />
                        )}
                        <span className="text-muted-foreground truncate text-xs">
                          {format.dateTime(new Date(category.createdAt), { dateStyle: "medium" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-2 flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(category)}
                      className="h-8 w-8 hover:bg-white/10"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(category.id)}
                      className="text-destructive hover:text-destructive h-8 w-8 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
