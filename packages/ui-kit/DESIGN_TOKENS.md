# Design Tokens - @ancore/ui-kit

This document describes all design tokens (colors, spacing, typography) used in the Ancore UI Kit.

## Colors

All colors are defined as CSS variables in `src/styles/globals.css` and use HSL color space for easy manipulation.

### Brand Colors

#### Primary (Stellar Purple)

The primary color represents the Stellar brand identity.

**Light Mode:**

- Default: `hsl(262 83% 58%)` - #8B5CF6
- Foreground: `hsl(210 40% 98%)` - #F8FAFC

**Dark Mode:**

- Default: `hsl(262 83% 58%)` - #8B5CF6 (same as light mode)
- Foreground: `hsl(210 40% 98%)` - #F8FAFC

**Usage:**

```tsx
<Button variant="default">Send Transaction</Button>
```

#### Secondary

Used for secondary actions and neutral emphasis.

**Light Mode:**

- Default: `hsl(210 40% 96.1%)` - #F1F5F9
- Foreground: `hsl(222.2 47.4% 11.2%)` - #0F172A

**Dark Mode:**

- Default: `hsl(217.2 32.6% 17.5%)` - #1E293B
- Foreground: `hsl(210 40% 98%)` - #F8FAFC

**Usage:**

```tsx
<Button variant="secondary">Cancel</Button>
```

### Semantic Colors

#### Destructive (Error/Warning)

Used for destructive actions and error states.

**Light Mode:**

- Default: `hsl(0 84.2% 60.2%)` - #EF4444
- Foreground: `hsl(210 40% 98%)` - #F8FAFC

**Dark Mode:**

- Default: `hsl(0 62.8% 30.6%)` - #7F1D1D
- Foreground: `hsl(210 40% 98%)` - #F8FAFC

**Usage:**

```tsx
<Button variant="destructive">Delete Account</Button>
```

#### Muted

Used for muted or de-emphasized content.

**Light Mode:**

- Default: `hsl(210 40% 96.1%)` - #F1F5F9
- Foreground: `hsl(215.4 16.3% 46.9%)` - #64748B

**Dark Mode:**

- Default: `hsl(217.2 32.6% 17.5%)` - #1E293B
- Foreground: `hsl(215 20.2% 65.1%)` - #94A3B8

**Usage:**

```tsx
<p className="text-muted-foreground">Balance: 100 XLM</p>
```

#### Accent

Used for hover states and highlights.

**Light Mode:**

- Default: `hsl(210 40% 96.1%)` - #F1F5F9
- Foreground: `hsl(222.2 47.4% 11.2%)` - #0F172A

**Dark Mode:**

- Default: `hsl(217.2 32.6% 17.5%)` - #1E293B
- Foreground: `hsl(210 40% 98%)` - #F8FAFC

### Base Colors

#### Background

Main application background color.

**Light Mode:** `hsl(0 0% 100%)` - #FFFFFF

**Dark Mode:** `hsl(222.2 84% 4.9%)` - #020617

#### Foreground

Main text color.

**Light Mode:** `hsl(222.2 84% 4.9%)` - #020617

**Dark Mode:** `hsl(210 40% 98%)` - #F8FAFC

#### Border & Input

Default border and input background color.

**Light Mode:**

- Border: `hsl(214.3 31.8% 91.4%)` - #E2E8F0
- Input: `hsl(214.3 31.8% 91.4%)` - #E2E8F0

**Dark Mode:**

- Border: `hsl(217.2 32.6% 17.5%)` - #1E293B
- Input: `hsl(217.2 32.6% 17.5%)` - #1E293B

#### Ring (Focus)

Color used for focus rings.

**Light Mode:** `hsl(262 83% 58%)` - #8B5CF6

**Dark Mode:** `hsl(262 83% 58%)` - #8B5CF6

### Component-Specific Colors

#### Card

Used for card components.

**Light Mode:**

- Background: `hsl(0 0% 100%)` - #FFFFFF
- Foreground: `hsl(222.2 84% 4.9%)` - #020617

**Dark Mode:**

- Background: `hsl(222.2 84% 4.9%)` - #020617
- Foreground: `hsl(210 40% 98%)` - #F8FAFC

#### Popover

Used for popover/dropdown components.

**Light Mode:**

- Background: `hsl(0 0% 100%)` - #FFFFFF
- Foreground: `hsl(222.2 84% 4.9%)` - #020617

**Dark Mode:**

- Background: `hsl(222.2 84% 4.9%)` - #020617
- Foreground: `hsl(210 40% 98%)` - #F8FAFC

## Border Radius

Border radius is defined as a CSS variable `--radius` with computed values.

- **Base radius:** `0.5rem` (8px)
- **Large (lg):** `var(--radius)` = `0.5rem` (8px)
- **Medium (md):** `calc(var(--radius) - 2px)` = `0.375rem` (6px)
- **Small (sm):** `calc(var(--radius) - 4px)` = `0.25rem` (4px)

**Usage:**

```tsx
<div className="rounded-lg">Large radius</div>
<div className="rounded-md">Medium radius</div>
<div className="rounded-sm">Small radius</div>
```

## Typography

Typography scales use Tailwind CSS defaults.

### Font Families

- **Sans-serif:** System font stack (default)
- **Mono:** Monospace font (for addresses, code)

### Font Sizes

- `text-xs`: 0.75rem (12px)
- `text-sm`: 0.875rem (14px)
- `text-base`: 1rem (16px)
- `text-lg`: 1.125rem (18px)
- `text-xl`: 1.25rem (20px)
- `text-2xl`: 1.5rem (24px)
- `text-3xl`: 1.875rem (30px)

### Font Weights

- `font-normal`: 400
- `font-medium`: 500
- `font-semibold`: 600
- `font-bold`: 700

## Spacing

Spacing uses Tailwind's default spacing scale (based on 0.25rem = 4px).

Common values:

- `1`: 0.25rem (4px)
- `2`: 0.5rem (8px)
- `3`: 0.75rem (12px)
- `4`: 1rem (16px)
- `6`: 1.5rem (24px)
- `8`: 2rem (32px)

## Shadows

Shadows use Tailwind CSS defaults:

- `shadow-sm`: Small shadow
- `shadow`: Default shadow
- `shadow-md`: Medium shadow
- `shadow-lg`: Large shadow
- `shadow-xl`: Extra large shadow

## Animations

Custom animations are defined for certain components:

### Accordion Animations

```css
@keyframes accordion-down {
  from {
    height: 0;
  }
  to {
    height: var(--radix-accordion-content-height);
  }
}

@keyframes accordion-up {
  from {
    height: var(--radix-accordion-content-height);
  }
  to {
    height: 0;
  }
}
```

Duration: 0.2s ease-out

## Using Design Tokens

### In Components

```tsx
import { Button } from '@ancore/ui-kit';

// Uses primary color
<Button variant="default">Primary Action</Button>

// Uses destructive color
<Button variant="destructive">Delete</Button>

// Uses muted background
<div className="bg-muted">Muted background</div>

// Uses border color
<div className="border border-border">With border</div>
```

### Custom Classes with cn()

```tsx
import { cn } from '@ancore/ui-kit';

<div
  className={cn('bg-background', 'text-foreground', 'border', 'border-border', 'rounded-lg', 'p-4')}
>
  Custom styled div
</div>;
```

### Extending Tokens

To extend or override tokens in your application:

```css
/* In your app's CSS */
@layer base {
  :root {
    /* Override primary color */
    --primary: 220 90% 56%;
  }
}
```

## Dark Mode

Toggle dark mode by adding/removing the `dark` class on the root element:

```tsx
// Enable dark mode
document.documentElement.classList.add('dark');

// Disable dark mode
document.documentElement.classList.remove('dark');
```

All color tokens automatically adjust for dark mode.

## Best Practices

1. **Use semantic colors:** Prefer `text-foreground` over specific colors
2. **Consistent spacing:** Use the spacing scale (4px increments)
3. **Respect hierarchy:** Use muted colors for secondary content
4. **Test both modes:** Always test components in light and dark mode
5. **Accessibility:** Ensure sufficient color contrast (WCAG AA minimum)

## Token Reference Table

| Token           | Light Mode | Dark Mode | Usage                        |
| --------------- | ---------- | --------- | ---------------------------- |
| `--primary`     | #8B5CF6    | #8B5CF6   | Primary actions, brand color |
| `--secondary`   | #F1F5F9    | #1E293B   | Secondary actions            |
| `--destructive` | #EF4444    | #7F1D1D   | Errors, destructive actions  |
| `--muted`       | #F1F5F9    | #1E293B   | Muted backgrounds            |
| `--accent`      | #F1F5F9    | #1E293B   | Hover states                 |
| `--background`  | #FFFFFF    | #020617   | Main background              |
| `--foreground`  | #020617    | #F8FAFC   | Main text                    |
| `--border`      | #E2E8F0    | #1E293B   | Borders                      |
| `--ring`        | #8B5CF6    | #8B5CF6   | Focus rings                  |

---

For implementation details, see the source files:

- Color definitions: `src/styles/globals.css`
- Tailwind config: `tailwind.config.js`
- Component usage: `README.md`
