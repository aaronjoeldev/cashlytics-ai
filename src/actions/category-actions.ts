'use server';

import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Category, NewCategory } from '@/types/database';

export async function getCategories(): Promise<ApiResponse<Category[]>> {
  try {
    const allCategories = await db.select().from(categories).orderBy(categories.name);
    return { success: true, data: allCategories };
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return { success: false, error: 'Failed to fetch categories' };
  }
}

export async function createCategory(data: NewCategory): Promise<ApiResponse<Category>> {
  try {
    const [category] = await db.insert(categories).values(data).returning();
    revalidatePath('/settings');
    revalidatePath('/settings/categories');
    revalidatePath('/categories');
    revalidatePath('/expenses');
    return { success: true, data: category };
  } catch (error) {
    console.error('Failed to create category:', error);
    return { success: false, error: 'Failed to create category' };
  }
}

export async function updateCategory(
  id: string,
  data: Partial<NewCategory>
): Promise<ApiResponse<Category>> {
  try {
    const [category] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    if (!category) {
      return { success: false, error: 'Category not found' };
    }
    revalidatePath('/settings');
    revalidatePath('/settings/categories');
    revalidatePath('/categories');
    revalidatePath('/expenses');
    return { success: true, data: category };
  } catch (error) {
    console.error('Failed to update category:', error);
    return { success: false, error: 'Failed to update category' };
  }
}

export async function deleteCategory(id: string): Promise<ApiResponse<void>> {
  try {
    await db.delete(categories).where(eq(categories.id, id));
    revalidatePath('/settings');
    revalidatePath('/settings/categories');
    revalidatePath('/categories');
    revalidatePath('/expenses');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete category:', error);
    return { success: false, error: 'Failed to delete category' };
  }
}