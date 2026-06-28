import type { Meta, StoryObj } from '@storybook/react';
import { Dialog, DialogContent } from './dialog';
import { Button } from './button';
import { useState } from 'react';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const DialogDemo = () => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Confirm Action</h2>
            <p>Are you sure you want to proceed with this action?</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const Default: Story = {
  render: () => <DialogDemo />,
};

export const LegacyAPI: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Legacy Dialog</Button>
        <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Legacy Dialog</h2>
            <p>This uses isOpen and onClose</p>
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          </div>
        </Dialog>
      </div>
    );
  },
};
