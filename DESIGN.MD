# CASHLYTICS - UI/UX DESIGN SYSTEM & IMPLEMENTATION GUIDE

## DESIGN PHILOSOPHIE

### Vision
Eine Premium-Finanzmanagement-App mit **Liquid Glass Design**, organischen Formen und subtilen Verlaeufen.
Glasmorphismus-Aesthetik: halbtransparente Karten, weiche Farbverlaeufe, fliessende Formen, immersives Dark-Mode-Erlebnis.
**Gelb/Amber bleibt die Akzentfarbe** - umgesetzt durch Glow-Effekte, Gradient-Akzente und leuchtende Highlights.

### Kernprinzipien
1. **Liquid Glass**: Glasmorphismus mit backdrop-blur, halbtransparenten Hintergruenden, subtilen Borders
2. **Organic Forms**: Weiche, grosse Border-Radien (2xl-3xl), Blob-Shapes als Hintergrund-Elemente
3. **Gradient-First**: Farbverlaeufe statt flacher Farben fuer Hintergruende, Karten, Akzente, CTAs
4. **Immersive Dark Mode**: Dark Mode als primaeres Premium-Erlebnis mit Glow-Effekten
5. **Data Clarity**: Trotz visueller Eleganz bleiben Zahlen und Daten klar lesbar
6. **Accessibility**: WCAG 2.1 AA Standard auch bei Glasmorphismus

---

## FARBPALETTE

### Light Mode

```css
/* Primary - Warm Gold/Amber */
--primary-50: #fffbeb;
--primary-100: #fef3c7;
--primary-200: #fde68a;
--primary-400: #fbbf24;  /* Main Accent GELB */
--primary-500: #f59e0b;  /* Hover */
--primary-600: #d97706;  /* Active */
--primary-700: #b45309;

/* Gradient Primaries */
--gradient-primary: linear-gradient(135deg, #fbbf24, #f59e0b);
--gradient-primary-hover: linear-gradient(135deg, #f59e0b, #d97706);
--gradient-primary-soft: linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.05));

/* Neutrals */
--gray-50: #fafaf9;      /* Page Background */
--gray-100: #f5f5f4;     /* Card Background */
--gray-200: #e7e5e4;     /* Borders */
--gray-300: #d6d3d1;     /* Dividers */
--gray-400: #a8a29e;     /* Disabled */
--gray-500: #78716c;     /* Muted */
--gray-600: #57534e;     /* Secondary Text */
--gray-700: #44403c;     /* Body Text */
--gray-900: #1c1917;     /* Headings */

/* Glass (Light) */
--glass-bg: rgba(255, 255, 255, 0.7);
--glass-border: rgba(255, 255, 255, 0.5);
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);

/* Semantic */
--success: #10b981;
--success-bg: rgba(16, 185, 129, 0.1);
--error: #ef4444;
--error-bg: rgba(239, 68, 68, 0.1);
--warning: #f59e0b;
--info: #3b82f6;
```

### Dark Mode (Premium Experience)

```css
/* Primary mit Glow */
--primary-400: #fbbf24;
--primary-500: #f59e0b;
--glow-primary: 0 0 20px rgba(251, 191, 36, 0.3);
--glow-primary-strong: 0 0 40px rgba(251, 191, 36, 0.2), 0 0 80px rgba(251, 191, 36, 0.1);

/* Dark Backgrounds - Tiefe Schichtung */
--gray-50: #0a0a0b;      /* Tiefster Hintergrund */
--gray-100: #111113;     /* Page Background */
--gray-150: #161618;     /* Elevated */
--gray-200: #1e1e21;     /* Borders */
--gray-300: #2a2a2e;     /* Dividers */
--gray-400: #3f3f46;
--gray-500: #71717a;
--gray-600: #a1a1aa;
--gray-700: #d4d4d8;
--gray-900: #fafafa;

/* Liquid Glass (Dark) - KERNSTUECK */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-bg-elevated: rgba(255, 255, 255, 0.08);
--glass-bg-hover: rgba(255, 255, 255, 0.1);
--glass-border: rgba(255, 255, 255, 0.08);
--glass-border-hover: rgba(255, 255, 255, 0.15);
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
--glass-shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.4);

/* Gradient Backgrounds */
--gradient-page: linear-gradient(180deg, #0a0a0b 0%, #111118 50%, #0f0f14 100%);
--gradient-card: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));

/* Semantic Dark */
--success: #34d399;
--success-bg: rgba(52, 211, 153, 0.1);
--error: #f87171;
--error-bg: rgba(248, 113, 113, 0.1);
--warning: #fbbf24;
--info: #60a5fa;
```

---

## LIQUID GLASS DESIGN SYSTEM

### Glass Card Variants

**Standard Glass Card:**
- backdrop-blur-xl bg-white/5 (dark) or bg-white/70 (light)
- border 1px solid white/[0.08], rounded-2xl
- hover: bg-white/10, border white/15, translateY(-2px), shadow-elevated
- transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1)

**Elevated Glass Card (KPI Cards):**
- backdrop-blur-2xl bg-white/[0.08], border white/10, rounded-2xl

**Accent Glass Card (Gelb-Glow):**
- bg-gradient-to-br from-primary/[0.08] to-white/[0.03]
- border primary/15, rounded-2xl
- shadow: 0 0 20px rgba(251,191,36,0.15)

### TailwindCSS Utility Classes (in globals.css)

```css
.glass { @apply backdrop-blur-xl bg-white/5 border border-white/[0.08] rounded-2xl; }
.glass-elevated { @apply backdrop-blur-2xl bg-white/[0.08] border border-white/10 rounded-2xl; }
.glass-accent { @apply backdrop-blur-xl bg-gradient-to-br from-primary/[0.08] to-white/[0.03] border border-primary/15 rounded-2xl; }
.glass-glow { box-shadow: 0 0 20px rgba(251,191,36,0.15); }
```

### Border Radius (Organisch)
- sm: 0.5rem (8px - Inputs, Badges)
- md: 0.75rem (12px - Buttons)
- lg: 1rem (16px)
- xl: 1.25rem (20px - Standard Cards)
- 2xl: 1.5rem (24px - Large Cards, Dialogs)
- 3xl: 2rem (32px - Feature Cards)
- full: 9999px (Pills, Avatars)

---

## LAYOUT

### Organic Background Blobs (Dark Mode only)

```tsx
<div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none dark:block hidden">
  <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-primary/5 blur-[120px]" />
  <div className="absolute top-1/3 -right-1/4 w-1/3 h-1/3 rounded-full bg-primary/[0.03] blur-[100px]" />
  <div className="absolute -bottom-1/4 left-1/3 w-1/3 h-1/3 rounded-full bg-amber-500/[0.03] blur-[80px]" />
</div>
```

### Glass Header
- h-16, backdrop-blur-xl, bg-background/80 dark:bg-background/50
- border-b border-border/50 dark:border-white/[0.08]

### Glass Sidebar
- backdrop-blur-xl, bg-background/80 dark:bg-background/50
- border-r border-border/50 dark:border-white/[0.08]
- Active Item: bg-gradient from-primary/10 to-primary/5, border-l-2 border-primary with glow

### Content Area: p-6, gap-6

---

## COMPONENT SPECS

### 1. KPI Cards
- Container: glass card (backdrop-blur-xl bg-white/5 dark rounded-2xl)
- Icon: bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-2
- Value: text-2xl font-bold
- Trend: text-success or text-error with arrow icon
- Hover: translateY(-2px), shadow-elevated

### 2. Charts
- Container: Glass Card rounded-2xl
- Gradient Fills: success (0.3 to 0 opacity), error (0.3 to 0 opacity)
- Grid Lines: white/5 (dark), very subtle
- Tooltip: Glass (backdrop-blur, bg-white/10, rounded-xl, border white/10)

### 3. Buttons
**Primary (Gradient):**
bg-gradient-to-r from-amber-400 to-amber-500 text-gray-900 rounded-xl shadow-lg shadow-amber-500/25
hover: from-amber-500 to-amber-600 shadow-xl translateY(-1px)

**Secondary (Glass):**
glass-bg backdrop-blur border glass-border
hover: glass-bg-hover glass-border-hover

**Ghost:** transparent, hover: glass-bg

### 4. Inputs (Glass)
- bg-white/5 dark, backdrop-blur-sm, border white/[0.08], rounded-xl
- Focus: border-primary/40, ring-3 ring-primary/10
- Hover: border white/15

### 5. Modal/Dialog
- Backdrop: bg-black/60 backdrop-blur-sm
- Modal: backdrop-blur-2xl bg-white/[0.08] dark rounded-3xl border white/10
- Animation: scale(0.95) opacity(0) to scale(1) opacity(1), 200ms

### 6. Progress Bars (Gradient)
- Track: bg-white/5 rounded-full h-2
- Normal: bg-gradient-to-r from-amber-400 to-amber-500
- Over budget: from-red-400 to-red-500

### 7. Transaction Rows
- Container: Glass Card rounded-2xl
- Row: hover bg-white/5, rounded-xl, border-b border-white/5
- Icon: rounded-full bg-gradient

---

## ANIMATIONS
- Glass transitions: 300ms cubic-bezier(0.4, 0, 0.2, 1)
- Card hover lift: translateY(-2px)
- Page enter: fadeInUp 400ms, stagger 50ms per child
- prefers-reduced-motion: disable all animations + backdrop-filter

## RESPONSIVE
- Mobile-first: sm:640 md:768 lg:1024 xl:1280 2xl:1536
- Mobile nav: Glass Bottom Tab Bar (backdrop-blur bg-white/5 border-t)
- KPI: horizontal snap scroll on mobile
- Reduced blur on mobile for performance

## DARK MODE
- Premium experience with glass aesthetics
- Surfaces: bg-white/5 with backdrop-blur
- Glow on accent elements (yellow)
- Organic blob backgrounds (fixed blurred circles)
- Subtle borders: white/[0.08]
- Yellow glow: shadow-[0_0_20px_rgba(251,191,36,0.15)]

## ACCESSIBILITY
- WCAG 2.1 AA: min 4.5:1 contrast even on glass
- Fallback solid bg when backdrop-filter unsupported
- Focus: ring-2 ring-primary/50
- Semantic HTML, ARIA labels, aria-live for toasts
- prefers-reduced-motion: disable animations + backdrop-filter
