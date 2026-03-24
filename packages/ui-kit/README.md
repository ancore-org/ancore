# @ancore/ui-kit

Shared UI component library for Ancore wallet applications, built with shadcn/ui, Tailwind CSS, and Radix UI primitives.

## Features

- 🎨 **Beautiful Design** - Components styled with Tailwind CSS and shadcn/ui
- ♿ **Accessible** - Built on Radix UI primitives for WCAG compliance
- 🌓 **Dark Mode** - Full dark mode support with class-based strategy
- 🎯 **TypeScript** - Full TypeScript support with type definitions
- 📦 **Tree-shakeable** - Import only what you need
- 🔧 **Customizable** - Easily customize design tokens and variants
- 🧪 **Tested** - Comprehensive test coverage with React Testing Library

## Installation

This package is part of the Ancore monorepo. Install it from the workspace:

```bash
pnpm add @ancore/ui-kit
```

## Usage

### Import Styles

First, import the global styles in your app's root component:

```tsx
import '@ancore/ui-kit/dist/styles/globals.css';
```

### Using Components

```tsx
import { Button, Input, Card, Badge } from '@ancore/ui-kit';

function App() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Recipient address" />
        <Button>Send</Button>
      </CardContent>
    </Card>
  );
}
```

## Components

### Core UI Components

#### Button

Versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@ancore/ui-kit';

<Button variant="default">Primary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
```

#### Input

Text input component with consistent styling.

```tsx
import { Input } from '@ancore/ui-kit';

<Input type="text" placeholder="Enter text" />
<Input type="email" placeholder="Email" />
<Input type="password" placeholder="Password" />
<Input type="number" placeholder="Amount" />
```

#### Card

Container component for grouping related content.

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@ancore/ui-kit';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>;
```

#### Badge

Small status/label component.

```tsx
import { Badge } from '@ancore/ui-kit';

<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

#### Separator

Visual divider component.

```tsx
import { Separator } from '@ancore/ui-kit';

<Separator orientation="horizontal" />
<Separator orientation="vertical" />
```

### Wallet-Specific Components

#### AmountInput

Specialized input for cryptocurrency amounts with balance display and asset badge.

```tsx
import { AmountInput } from '@ancore/ui-kit';

<AmountInput
  balance="100.50"
  asset="XLM"
  label="Send Amount"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  error={error}
/>;
```

**Props:**

- `balance?: string` - Current balance to display
- `asset?: string` - Asset symbol (e.g., 'XLM', 'USDC')
- `label?: string` - Label for the input (default: 'Amount')
- `error?: string` - Error message to display
- All standard input props

#### AddressDisplay

Component for displaying blockchain addresses with truncation and copy functionality.

```tsx
import { AddressDisplay } from '@ancore/ui-kit';

<AddressDisplay
  address="GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM"
  label="Wallet Address"
  copyable={true}
  truncate={6}
/>;
```

**Props:**

- `address: string` - The address to display (required)
- `label?: string` - Label for the address
- `copyable?: boolean` - Show copy button (default: true)
- `truncate?: number` - Number of characters to show at start/end (default: 6)

## Design Tokens

### Colors

The component library uses CSS variables for theming, supporting both light and dark modes.

#### Primary (Stellar Purple)

- Light: `hsl(262 83% 58%)`
- Dark: `hsl(262 83% 58%)`

#### Secondary

- Light: `hsl(210 40% 96.1%)`
- Dark: `hsl(217.2 32.6% 17.5%)`

#### Destructive

- Light: `hsl(0 84.2% 60.2%)`
- Dark: `hsl(0 62.8% 30.6%)`

### Border Radius

- `lg`: `0.5rem`
- `md`: `calc(0.5rem - 2px)`
- `sm`: `calc(0.5rem - 4px)`

### Typography

Inherits from Tailwind's default typography scale.

## Dark Mode

Enable dark mode by adding the `dark` class to your root element:

```tsx
<html className="dark">{/* Your app */}</html>
```

Or toggle dynamically:

```tsx
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return <Button onClick={() => setIsDark(!isDark)}>Toggle Theme</Button>;
}
```

## Development

### Running Storybook

```bash
cd packages/ui-kit
pnpm storybook
```

Visit http://localhost:6006 to view component stories.

### Running Tests

```bash
cd packages/ui-kit
pnpm test
```

### Building

```bash
cd packages/ui-kit
pnpm build
```

## Customization

### Tailwind Configuration

Extend the Tailwind configuration in your app:

```js
// tailwind.config.js
module.exports = {
  presets: [require('@ancore/ui-kit/tailwind.config.js')],
  content: ['./src/**/*.{ts,tsx}', './node_modules/@ancore/ui-kit/dist/**/*.{js,mjs}'],
  // Your custom configuration
};
```

### Custom Variants

Use the `cn()` utility to create custom variants:

```tsx
import { Button } from '@ancore/ui-kit';
import { cn } from '@ancore/ui-kit';

<Button className={cn('my-custom-class', conditionalClass && 'conditional-class')}>
  Custom Button
</Button>;
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines on contributing to this package.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
