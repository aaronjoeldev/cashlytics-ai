# Cashlytics Component Documentation

This document provides comprehensive documentation for all React components in the Cashlytics application, organized following atomic design principles.

## Component Hierarchy

```
src/components/
├── atoms/           # Basic building blocks
├── molecules/       # Combinations of atoms
├── organisms/       # Complex UI sections
├── layout/          # Page structure components
└── providers/       # Context providers
```

## Atoms

Basic UI building blocks that serve as the foundation of the design system.

| Component | Description | Documentation |
|-----------|-------------|---------------|
| [CategorySelect](./atoms/category-select.md) | Dropdown select for category selection | [View](./atoms/category-select.md) |

## Molecules

Combinations of atoms that form more complex, reusable UI patterns.

| Component | Description | Documentation |
|-----------|-------------|---------------|
| [SearchDialog](./molecules/search-dialog.md) | Global search dialog with keyboard navigation | [View](./molecules/search-dialog.md) |
| [CategoryForm](./molecules/category-form.md) | Form for creating/editing categories | [View](./molecules/category-form.md) |
| [EmojiPicker](./molecules/emoji-picker.md) | Emoji selection popover | [View](./molecules/emoji-picker.md) |
| [ChatInput](./molecules/chat-input.md) | Chat message input with submit handling | [View](./molecules/chat-input.md) |
| [ChatMessage](./molecules/chat-message.md) | Chat message display components | [View](./molecules/chat-message.md) |

## Organisms

Complex components that form distinct sections of the interface.

| Component | Description | Documentation |
|-----------|-------------|---------------|
| [FloatingActions](./organisms/floating-actions.md) | FAB menu with quick actions and chat | [View](./organisms/floating-actions.md) |
| [AccountForm](./organisms/account-form.md) | Dialog form for account management | [View](./organisms/account-form.md) |
| [TransferForm](./organisms/transfer-form.md) | Dialog form for transfers between accounts | [View](./organisms/transfer-form.md) |
| [IncomeForm](./organisms/income-form.md) | Dialog form for income entries | [View](./organisms/income-form.md) |
| [ExpenseForm](./organisms/expense-form.md) | Dialog form for expense entries | [View](./organisms/expense-form.md) |
| [CategoryList](./organisms/category-list.md) | Category management list with CRUD | [View](./organisms/category-list.md) |
| [ChatHistorySidebar](./organisms/chat-history-sidebar.md) | Conversation history navigation | [View](./organisms/chat-history-sidebar.md) |
| [ChatInterface](./organisms/chat-interface.md) | Full chat interface with AI assistant | [View](./organisms/chat-interface.md) |

## Layout

Components that define the overall page structure.

| Component | Description | Documentation |
|-----------|-------------|---------------|
| [Header](./layout/header.md) | Main application header with navigation | [View](./layout/header.md) |
| [AppSidebar](./layout/app-sidebar.md) | Main navigation sidebar | [View](./layout/app-sidebar.md) |
| [ThemeToggle](./layout/theme-toggle.md) | Light/dark theme switcher | [View](./layout/theme-toggle.md) |

## Providers

Context providers for application-wide state management.

| Component | Description | Documentation |
|-----------|-------------|---------------|
| [ThemeProvider](./providers/theme-provider.md) | Theme context provider wrapper | [View](./providers/theme-provider.md) |

## Architecture Overview

### Atomic Design Principles

The component library follows atomic design methodology:

1. **Atoms**: Smallest, most basic components (buttons, inputs, selects)
2. **Molecules**: Groups of atoms working together (forms, search dialogs)
3. **Organisms**: Complex components composed of molecules and atoms
4. **Layout**: Structural components for page organization
5. **Providers**: Context wrappers for global state

### Key Technologies

- **React 18** with TypeScript
- **Next.js 14** App Router
- **shadcn/ui** component library
- **Tailwind CSS** for styling
- **React Hook Form** with Zod validation
- **next-themes** for theme management
- **AI SDK** for chat functionality

### Common Patterns

#### Controlled vs Uncontrolled Dialogs

Most form components support both controlled and uncontrolled dialog states:

```tsx
// Controlled (parent manages open state)
<AccountForm open={isOpen} onOpenChange={setIsOpen} />

// Uncontrolled (component manages its own state)
<AccountForm trigger={<Button>Add Account</Button>} />
```

#### Form Validation

Forms use React Hook Form with Zod schemas:

```tsx
const form = useForm<FormInput>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... }
});
```

#### Server Actions

All mutations use Next.js Server Actions for data persistence:

```tsx
const result = await createAccount(data);
if (result.success) {
  // Handle success
}
```

## Contributing

When adding new components:

1. Place in the appropriate category folder
2. Follow the naming convention: `kebab-case.tsx`
3. Export as named export
4. Create corresponding documentation file
5. Update this README with the new component
