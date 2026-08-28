import type { Meta, StoryObj } from '@storybook/react';
import { QRCode } from './QRCode';

const meta = {
  title: 'Wallet/QRCode',
  component: QRCode,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Renders a styled, accessible SVG QR code for Stellar addresses or payment URIs. Uses `qrcode.react` under the hood with error-correction level M.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'The address or URI to encode in the QR code.',
    },
    size: {
      control: { type: 'number', min: 64, max: 512, step: 32 },
      description: 'Width and height of the QR code SVG in pixels.',
    },
    label: {
      control: 'text',
      description: 'Accessible label. Defaults to "QR code for address <value>".',
    },
  },
} satisfies Meta<typeof QRCode>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleAddress = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

// ─── Core variants ────────────────────────────────────────────────────────────

export const Default: Story = {
  args: { value: sampleAddress },
};

export const Small: Story = {
  args: { value: sampleAddress, size: 128 },
};

export const Large: Story = {
  args: { value: sampleAddress, size: 320 },
};

export const CustomLabel: Story = {
  args: { value: sampleAddress, size: 192, label: 'Scan to send XLM' },
};

// ─── Payment URI ──────────────────────────────────────────────────────────────

export const PaymentURI: Story = {
  name: 'Payment URI',
  args: {
    value: `web+stellar:pay?destination=${sampleAddress}&amount=10&asset_code=XLM`,
    label: 'Pay 10 XLM',
    size: 224,
  },
  parameters: {
    docs: {
      description: {
        story:
          'QR codes can encode SEP-0007 payment URIs, allowing wallets to pre-fill send forms when scanned.',
      },
    },
  },
};

// ─── Sizes ────────────────────────────────────────────────────────────────────

export const SizeScale: Story = {
  name: 'Size Scale',
  render: () => (
    <div className="flex items-end gap-6">
      {[96, 128, 192, 256].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <QRCode value={sampleAddress} size={size} />
          <span className="text-xs text-muted-foreground">{size}px</span>
        </div>
      ))}
    </div>
  ),
};

// ─── In context ──────────────────────────────────────────────────────────────

export const ReceiveCard: Story = {
  name: 'Receive Card',
  render: () => (
    <div className="w-[300px] rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col items-center gap-4">
      <h3 className="text-base font-semibold">Receive XLM</h3>
      <QRCode value={sampleAddress} size={200} label="Scan to send to this wallet" />
      <div className="w-full rounded-md border border-input bg-background px-3 py-2">
        <code className="block text-xs font-mono text-muted-foreground text-center break-all">
          {sampleAddress.slice(0, 12)}...{sampleAddress.slice(-12)}
        </code>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Scan the QR code or share your address to receive funds.
      </p>
    </div>
  ),
};
