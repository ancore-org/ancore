import type { Meta, StoryObj } from '@storybook/react';
import { NotificationProvider } from './NotificationProvider';
import { useToast } from './useToast';

function ToastDemo() {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  return (
    <div className="flex flex-col gap-3 w-64">
      <button
        className="rounded bg-success px-4 py-2 text-sm text-success-foreground"
        onClick={() => showSuccess('Transaction sent successfully!')}
      >
        Show Success
      </button>
      <button
        className="rounded bg-destructive px-4 py-2 text-sm text-destructive-foreground"
        onClick={() => showError('Failed to send transaction')}
      >
        Show Error
      </button>
      <button
        className="rounded bg-warning px-4 py-2 text-sm text-warning-foreground"
        onClick={() => showWarning('Low balance detected')}
      >
        Show Warning
      </button>
      <button
        className="rounded bg-info px-4 py-2 text-sm text-info-foreground"
        onClick={() => showInfo('Address copied to clipboard')}
      >
        Show Info
      </button>
    </div>
  );
}

const meta = {
  title: 'Notifications/Toast',
  component: ToastDemo,
  decorators: [
    (Story) => (
      <NotificationProvider>
        <Story />
      </NotificationProvider>
    ),
  ],
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ToastDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllVariants: Story = {};

export const QueueDemo: Story = {
  render: () => {
    const { toast } = useToast();
    return (
      <button
        className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        onClick={() => {
          toast('First message', 'success');
          toast('Second message', 'info');
          toast('Third message', 'warning');
          toast('Fourth message', 'error');
          toast('Fifth message', 'success');
          toast('Sixth message — should replace first', 'info');
        }}
      >
        Trigger 6 toasts (max 5 shown)
      </button>
    );
  },
};
