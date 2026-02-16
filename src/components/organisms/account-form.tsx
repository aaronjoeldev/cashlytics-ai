'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createAccount } from '@/actions/account-actions';
import { useToast } from '@/hooks/use-toast';

interface AccountFormProps {
  onSuccess?: (data: any) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const accountTypes = [
  { value: 'checking', label: 'Girokonto', icon: '🏦' },
  { value: 'savings', label: 'Sparkonto', icon: 'piggy' },
  { value: 'etf', label: 'ETF-Konto', icon: '📈' },
];

export function AccountForm({ onSuccess, open: controlledOpen, onOpenChange }: AccountFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value: boolean) => {
    setUncontrolledOpen(value);
    onOpenChange?.(value);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'checking' | 'savings' | 'etf'>('checking');
  const [balance, setBalance] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte gib einen Namen ein.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    const result = await createAccount({
      name: name.trim(),
      type,
      balance: balance || '0',
    });

    setIsLoading(false);

    if (result.success) {
      toast({
        title: 'Konto erstellt',
        description: `${name} wurde erfolgreich angelegt.`,
      });
      setName('');
      setType('checking');
      setBalance('');
      setOpen(false);
      onSuccess?.(result.data);
    } else {
      toast({
        title: 'Fehler',
        description: result.error || 'Konto konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Konto hinzufügen
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Neues Konto</DialogTitle>
            <DialogDescription>
              Füge ein neues Konto zu deiner Übersicht hinzu.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="z.B. Girokonto Sparkasse"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Kontotyp</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as 'checking' | 'savings' | 'etf')}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wähle den Kontotyp" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="balance">Anfangssaldo (€)</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Wird erstellt...' : 'Konto erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}