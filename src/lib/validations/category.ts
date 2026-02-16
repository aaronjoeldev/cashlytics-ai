import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(50, 'Name zu lang'),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Ungültige Farbe').optional().or(z.literal('')),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const defaultCategories: CategoryInput[] = [
  { name: 'Wohnen', icon: '🏠', color: '#3b82f6' },
  { name: 'Lebensmittel', icon: '🍔', color: '#22c55e' },
  { name: 'Transport', icon: '🚗', color: '#f59e0b' },
  { name: 'Abonnements', icon: '📱', color: '#8b5cf6' },
  { name: 'Versicherungen', icon: '🛡️', color: '#ef4444' },
  { name: 'Freizeit', icon: '🎮', color: '#ec4899' },
  { name: 'Gesundheit', icon: '💊', color: '#14b8a6' },
  { name: 'Einkommen', icon: '💰', color: '#22c55e' },
];