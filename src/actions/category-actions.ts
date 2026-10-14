"use server";

import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, Category, NewCategory } from "@/types/database";
import { logger } from "@/lib/logger";
import {
  createCategoryInput,
  parseInput,
  updateCategoryInput,
} from "@/lib/validations/action-input";
import { requireAuth } from "@/lib/auth/require-auth";

export async function getCategories(): Promise<ApiResponse<Category[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const allCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, authResult.userId))
      .orderBy(categories.name);
    return { success: true, data: allCategories };
  } catch (error) {
    logger.error("Failed to fetch categories", "getCategories", error);
    return { success: false, error: "Failed to fetch categories" };
  }
}

export async function createCategory(
  data: Omit<NewCategory, "userId">
): Promise<ApiResponse<Category>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const input = parseInput(createCategoryInput, data);
    if (!input.success) return input;

    const [category] = await db
      .insert(categories)
      .values({ ...input.data, userId: authResult.userId })
      .returning();
    revalidatePath("/settings");

    revalidatePath("/categories");
    revalidatePath("/expenses");
    return { success: true, data: category };
  } catch (error) {
    logger.error("Failed to create category", "createCategory", error);
    return { success: false, error: "Failed to create category" };
  }
}

export async function updateCategory(
  id: string,
  data: Partial<NewCategory>
): Promise<ApiResponse<Category>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const input = parseInput(updateCategoryInput, data);
    if (!input.success) return input;
    const updates = input.data;
    if (Object.keys(updates).length === 0) {
      return { success: false, error: "Keine Änderungen übergeben." };
    }

    const [category] = await db
      .update(categories)
      .set(updates)
      .where(and(eq(categories.id, id), eq(categories.userId, authResult.userId)))
      .returning();
    if (!category) {
      return { success: false, error: "Category not found" };
    }
    revalidatePath("/settings");

    revalidatePath("/categories");
    revalidatePath("/expenses");
    return { success: true, data: category };
  } catch (error) {
    logger.error("Failed to update category", "updateCategory", error);
    return { success: false, error: "Failed to update category" };
  }
}

export async function deleteCategory(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    // Expenses and daily expenses keep their data; their category is set to null (ON DELETE SET NULL)
    const deleted = await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, authResult.userId)))
      .returning({ id: categories.id });
    if (deleted.length === 0) {
      return { success: false, error: "Category not found" };
    }
    revalidatePath("/settings");

    revalidatePath("/categories");
    revalidatePath("/expenses");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete category", "deleteCategory", error);
    return { success: false, error: "Failed to delete category" };
  }
}
