import type { Meta, StoryObj } from '@storybook/react';
import { AddressDisplay } from './address-display';

const meta = {
  title: 'Wallet/AddressDisplay',
  component: AddressDisplay,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays a Stellar address with optional truncation, copy-to-clipboard, identicon avatar, full-address tooltip on hover, and validation state feedback.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    truncate: {
      control: { type: 'number', min: 4, max: 20, step: 1 },
      description: 'Characters shown at each end of the truncated address.',
    },
    copyable: { control: 'boolean' },
    showIdenticon: { control: 'boolean' },
    isValid: {
      control: 'select',
      options: [undefined, true, false],
      description: 'When false, renders a destructive border and alert icon.',
    },
  },
} satisfies Meta<typeof AddressDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleAddress = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

// ─── Core variants ────────────────────────────────────────────────────────────

export const Default: Story = {
  args: { address: sampleAddress },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const WithLabel: Story = {
  args: { address: sampleAddress, label: 'Wallet Address' },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const NoCopy: Story = {
  args: { address: sampleAddress, copyable: false, label: 'Read-only Address' },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const CustomTruncation: Story = {
  args: { address: sampleAddress, truncate: 10, label: 'More Characters Visible' },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const ShortAddress: Story = {
  args: { address: 'SHORT', label: 'Short Address (No Truncation)' },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

// ─── Identicon ────────────────────────────────────────────────────────────────

export const WithIdenticon: Story = {
  name: 'With Identicon',
  args: { address: sampleAddress, label: 'Your Wallet', showIdenticon: true },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const WithIdenticonNoCopy: Story = {
  name: 'Identicon — Read-only',
  args: {
    address: sampleAddress,
    label: 'Recipient Address',
    showIdenticon: true,
    copyable: false,
  },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

// ─── Validation feedback ─────────────────────────────────────────────────────

export const ValidAddress: Story = {
  name: 'Validation — Valid',
  args: {
    address: sampleAddress,
    label: 'Validated Address',
    isValid: true,
  },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const InvalidAddress: Story = {
  name: 'Validation — Invalid',
  args: {
    address: 'not-a-stellar-address',
    label: 'Invalid Address',
    isValid: false,
  },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const InvalidWithIdenticon: Story = {
  name: 'Validation — Invalid + Identicon',
  args: {
    address: 'bad-address',
    label: 'Unresolved Address',
    isValid: false,
    showIdenticon: true,
  },
  render: (args) => (
    <div className="w-[380px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

// ─── Compound examples ────────────────────────────────────────────────────────

export const MultipleAddresses: Story = {
  render: () => (
    <div className="w-[420px] space-y-4">
      <AddressDisplay address={sampleAddress} label="From Address" showIdenticon />
      <AddressDisplay
        address="GBVFCZE3VZQJPTXDZH3UZEJWIXJLXGCQFXHZCEBR3Q2RVCZ3QGYQJKGH"
        label="To Address"
        showIdenticon
      />
      <AddressDisplay
        address="bad-address"
        label="Memo Address (invalid)"
        isValid={false}
        copyable={false}
      />
    </div>
  ),
};

export const InCard: Story = {
  render: () => (
    <div className="w-[420px] rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-semibold">Account Information</h3>
      <AddressDisplay address={sampleAddress} label="Your Wallet Address" showIdenticon />
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Balance:</span>
        <span className="font-semibold">100.50 XLM</span>
      </div>
    </div>
  ),
};
