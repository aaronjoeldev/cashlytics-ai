'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categorySchema, CategoryInput } from '@/lib/validations/category';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmojiPicker } from '@/components/molecules/emoji-picker';
import type { Category } from '@/types/database';

interface CategoryFormProps {
  category?: Category;
  onSubmit: (data: CategoryInput) => Promise<void>;
  onCancel?: () => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e',
];

export function CategoryForm({ category, onSubmit, onCancel }: CategoryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(category?.icon ?? '');
  const [selectedColor, setSelectedColor] = useState(category?.color ?? '#f59e0b');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      icon: category?.icon ?? '',
      color: category?.color ?? '#f59e0b',
    },
  });

  const handleEmojiChange = (emoji: string) => {
    setSelectedEmoji(emoji);
    setValue('icon', emoji);
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    setValue('color', color);
  };

  const handleFormSubmit = async (data: CategoryInput) => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...data,
        icon: selectedEmoji,
        color: selectedColor,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="z.B. Lebensmittel"
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>
        <EmojiPicker value={selectedEmoji} onChange={handleEmojiChange} />
      </div>

      <div className="space-y-2">
        <Label>Farbe</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded-lg transition-all duration-200 ${
                selectedColor === color 
                  ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' 
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-lg border border-white/20"
            style={{ backgroundColor: selectedColor }}
          />
          <Input
            type="text"
            value={selectedColor}
            onChange={(e) => handleColorChange(e.target.value)}
            placeholder="#22c55e"
            className="flex-1"
          />
          <Input
            type="color"
            value={selectedColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-12 h-10 p-1 cursor-pointer rounded-lg"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Speichern...' : category ? 'Aktualisieren' : 'Erstellen'}
        </Button>
      </div>
    </form>
  );
}