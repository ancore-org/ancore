import * as React from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, AddressInput, AmountInput as FormAmountInput, FormSubmit } from '@ancore/ui-kit';
import { Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import { Input } from '@ancore/ui-kit';
import { Label } from '@ancore/ui-kit';
import { createInvoiceSchema } from '@ancore/types';
import type { CreateInvoiceInput } from '@ancore/types';

interface CreateInvoiceProps {
  onSubmit: (data: CreateInvoiceInput) => Promise<void>;
  onCancel?: () => void;
}

export function CreateInvoice({ onSubmit, onCancel }: CreateInvoiceProps) {
  const form = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      asset: 'XLM',
    },
  });

  const handleSubmit = async (data: CreateInvoiceInput) => {
    await onSubmit(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Invoice</CardTitle>
      </CardHeader>
      <CardContent>
        <Form onSubmit={handleSubmit} form={form}>
          <div className="space-y-4">
            <AddressInput
              name="recipientAddress"
              label="Recipient Address"
              placeholder="G..."
              required
            />

            <FormAmountInput name="amount" label="Amount" placeholder="0.00" required />

            <div className="space-y-2">
              <Label htmlFor="asset">Asset</Label>
              <Input id="asset" {...form.register('asset')} placeholder="XLM" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                {...form.register('description')}
                placeholder="Invoice description"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (optional)</Label>
              <Input id="dueDate" type="datetime-local" {...form.register('dueDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference (optional)</Label>
              <Input
                id="reference"
                {...form.register('reference')}
                placeholder="INV-001"
                maxLength={100}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <FormSubmit type="submit">Create Invoice</FormSubmit>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border rounded-md hover:bg-muted"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
