import type { Meta, StoryObj } from '@storybook/react';
import { AddressDisplay } from './address-display';

const meta = {
  title: 'Wallet/AddressDisplay',
  component: AddressDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AddressDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleAddress = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

export const Default: Story = {
  args: {
    address: sampleAddress,
  },
  render: (args) => (
    <div className="w-[350px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const WithLabel: Story = {
  args: {
    address: sampleAddress,
    label: 'Wallet Address',
  },
  render: (args) => (
    <div className="w-[350px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const NoCopy: Story = {
  args: {
    address: sampleAddress,
    copyable: false,
    label: 'Read-only Address',
  },
  render: (args) => (
    <div className="w-[350px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const CustomTruncation: Story = {
  args: {
    address: sampleAddress,
    truncate: 10,
    label: 'More Characters Visible',
  },
  render: (args) => (
    <div className="w-[350px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const ShortAddress: Story = {
  args: {
    address: 'SHORT',
    label: 'Short Address (No Truncation)',
  },
  render: (args) => (
    <div className="w-[350px]">
      <AddressDisplay {...args} />
    </div>
  ),
};

export const MultipleAddresses: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <AddressDisplay address={sampleAddress} label="From Address" />
      <AddressDisplay
        address="GBVFCZE3VZQJPTXDZH3UZEJWIXJLXGCQFXHZCEBR3Q2RVCZ3QGYQJKGH"
        label="To Address"
      />
      <AddressDisplay
        address="GASDQWERTYJKLMNBVCXZZAQWSEDFRTGYHUJIKLOP"
        label="Memo"
        copyable={false}
      />
    </div>
  ),
};

export const InCard: Story = {
  render: () => (
    <div className="w-[400px] rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-semibold">Account Information</h3>
      <AddressDisplay address={sampleAddress} label="Your Wallet Address" />
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Balance:</span>
        <span className="font-semibold">100.50 XLM</span>
      </div>
    </div>
  ),
};
