import { getCategories } from '@/actions/category-actions';
import { CategoryList } from '@/components/organisms/category-list';

export default async function CategoriesPage() {
  const result = await getCategories();
  const categories = result.success ? result.data : [];

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Kategorien verwalten</h1>
      <CategoryList initialCategories={categories} />
    </div>
  );
}