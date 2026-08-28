import type { Meta, StoryObj } from '@storybook/react';
import { Identicon } from './Identicon';

const meta = {
  title: 'Wallet/Identicon',
  component: Identicon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Renders a deterministic 5×5 mirrored pixel-art avatar from any string value (typically a Stellar address). Identical inputs always produce identical output; different inputs produce visually distinct icons.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'The address or string to derive the identicon from.',
    },
    size: {
      control: { type: 'number', min: 16, max: 128, step: 8 },
      description: 'Width and height of the SVG in pixels.',
    },
    label: {
      control: 'text',
      description: 'Accessible label. Defaults to "Identicon for address <value>".',
    },
  },
} satisfies Meta<typeof Identicon>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleAddress = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

// ─── Single instances ─────────────────────────────────────────────────────────

export const Default: Story = {
  args: { value: sampleAddress },
};

export const Small: Story = {
  args: { value: sampleAddress, size: 24 },
};

export const Large: Story = {
  args: { value: sampleAddress, size: 80 },
};

export const CustomLabel: Story = {
  args: { value: sampleAddress, size: 48, label: 'Primary wallet avatar' },
};

// ─── Uniqueness showcase ──────────────────────────────────────────────────────

export const UniquePerAddress: Story = {
  name: 'Unique per Address',
  parameters: {
    docs: {
      description: {
        story: 'Every address produces a visually distinct identicon.',
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-3">
      {[
        'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM',
        'GBVFCZE3VZQJPTXDZH3UZEJWIXJLXGCQFXHZCEBR3Q2RVCZ3QGYQJKGH',
        'GABC123STELLARWALLETADDRESSEXAMPLEXXX',
        'GDEZQSCR4BEVIAR5BSBI2ZV7EVSHJBPZWXHQKMD3XKZXZLBM',
        'GASDQWERTYJKLMNBVCXZZAQWSEDFRTGYHUJIKLOP',
        'GTEST456DIFFERENTHASHPRODUCESDIFFERENTCOLORS',
      ].map((addr) => (
        <div key={addr} className="flex flex-col items-center gap-1">
          <Identicon value={addr} size={40} />
          <code className="text-[9px] text-muted-foreground">{addr.slice(0, 6)}</code>
        </div>
      ))}
    </div>
  ),
};

// ─── Sizes ────────────────────────────────────────────────────────────────────

export const SizeScale: Story = {
  name: 'Size Scale',
  render: () => (
    <div className="flex items-end gap-4">
      {[16, 24, 32, 40, 48, 64, 80].map((size) => (
        <div key={size} className="flex flex-col items-center gap-1">
          <Identicon value={sampleAddress} size={size} />
          <span className="text-[10px] text-muted-foreground">{size}px</span>
        </div>
      ))}
    </div>
  ),
};
