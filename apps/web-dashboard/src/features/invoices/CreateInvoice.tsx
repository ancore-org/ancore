import { useFormContext } from 'react-hook-form';
import {
  Form,
  Field,
  AddressInput,
  AmountInput as FormAmountInput,
  FormSubmit,
} from '@ancore/ui-kit';
import { Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import { Input } from '@ancore/ui-kit';
import { createInvoiceSchema } from '@ancore/types';
import type { ZodType } from 'zod';
import type { CreateInvoiceInput } from '@ancore/types';
import { stellarAddressError } from '../../lib/address-validation';

interface CreateInvoiceProps {
  onSubmit: (data: CreateInvoiceInput) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Rendered inside `<Form>` so it can reach the react-hook-form context that
 * `Form` provides. `Form` owns the `useForm` call, so fields register through
 * the context rather than a `form` instance passed down as a prop.
 */
function InvoiceFields({ onCancel }: { onCancel?: () => void }) {
  const { register, watch } = useFormContext<CreateInvoiceInput>();

  // `createInvoiceSchema` only runs on submit, so surface the same format check
  // inline while the user types. Invoices settle to a classic account, so C…
  // contract addresses are not accepted here.
  const recipientAddress = watch('recipientAddress') ?? '';
  const recipientAddressError =
    stellarAddressError(recipientAddress, { kinds: ['account'] }) ?? undefined;

  return (
    <div className="space-y-4">
      <AddressInput
        name="recipientAddress"
        label="Recipient Address"
        placeholder="G..."
        error={recipientAddressError}
        required
      />

      <FormAmountInput name="amount" label="Amount" placeholder="0.00" required />

      <Field label="Asset">
        <Input {...register('asset')} placeholder="XLM" />
      </Field>

      <Field label="Description (optional)">
        <Input {...register('description')} placeholder="Invoice description" maxLength={500} />
      </Field>

      <Field label="Due Date (optional)">
        <Input type="datetime-local" {...register('dueDate')} />
      </Field>

      <Field label="Reference (optional)">
        <Input {...register('reference')} placeholder="INV-001" maxLength={100} />
      </Field>

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
  );
}

export function CreateInvoice({ onSubmit, onCancel }: CreateInvoiceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Invoice</CardTitle>
      </CardHeader>
      <CardContent>
        <Form
          onSubmit={onSubmit}
          validationSchema={createInvoiceSchema as unknown as ZodType<CreateInvoiceInput>}
          defaultValues={{ asset: 'XLM' } as Partial<CreateInvoiceInput>}
        >
          <InvoiceFields onCancel={onCancel} />
        </Form>
      </CardContent>
    </Card>
  );
}
