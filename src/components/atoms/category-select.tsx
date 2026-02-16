'use client';


import { forwardRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Category } from '@/types/database';

interface CategorySelectProps {
  categories: Category[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const CategorySelect = forwardRef<HTMLButtonElement, CategorySelectProps>(
  ({ categories, value, onValueChange, placeholder = 'Kategorie wählen', disabled }, ref) => {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger ref={ref}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {categories.length === 0 ? (
            <div className="px-2 py-4 text-center text-muted-foreground text-sm">
              Keine Kategorien vorhanden
            </div>
          ) : (
            categories.map(category => (
              <SelectItem key={category.id} value={category.id}>
                <div className="flex items-center gap-2">
                  <span>{category.icon ?? '📁'}</span>
                  <span>{category.name}</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  }
);

CategorySelect.displayName = 'CategorySelect';