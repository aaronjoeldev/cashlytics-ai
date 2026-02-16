import { getCategories } from '@/actions/category-actions';
import { CategoriesClient } from './client';

export default async function CategoriesPage() {
  const result = await getCategories();
  const categories = result.success ? result.data : [];

  return <CategoriesClient initialCategories={categories} />;
}
