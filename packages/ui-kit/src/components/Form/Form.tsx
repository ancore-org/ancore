import * as React from 'react';
import {
  useForm,
  FormProvider,
  useFormContext,
  type FieldValues,
  type DefaultValues,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ZodType } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// FormError – shared submission-level error banner
// ---------------------------------------------------------------------------

export interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  message?: string;
}

const FormError = React.forwardRef<HTMLParagraphElement, FormErrorProps>(
  ({ message, className, ...props }, ref) => {
    if (!message) return null;
    return (
      <p
        ref={ref}
        role="alert"
        className={cn('text-sm font-medium text-destructive', className)}
        {...props}
      >
        {message}
      </p>
    );
  }
);
FormError.displayName = 'FormError';

// ---------------------------------------------------------------------------
// FormSubmit – submit button that reads loading state from form context
// ---------------------------------------------------------------------------

export interface FormSubmitProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Override the auto-derived isSubmitting state */
  loading?: boolean;
  children: React.ReactNode;
}

const FormSubmit = React.forwardRef<HTMLButtonElement, FormSubmitProps>(
  ({ loading, children, className, disabled, ...props }, ref) => {
    const { formState } = useFormContext();
    const isLoading = loading ?? formState.isSubmitting;

    return (
      <Button
        ref={ref}
        type="submit"
        disabled={disabled ?? isLoading}
        className={cn('w-full', className)}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
    );
  }
);
FormSubmit.displayName = 'FormSubmit';

// ---------------------------------------------------------------------------
// Form – main wrapper
// ---------------------------------------------------------------------------

export interface FormProps<TData extends FieldValues = FieldValues> {
  /** Called with validated form data on submit */
  onSubmit: SubmitHandler<TData>;
  /** Zod schema used to build the resolver */
  validationSchema?: ZodType<TData>;
  /** Default field values */
  defaultValues?: DefaultValues<TData>;
  children: React.ReactNode;
  className?: string;
  /** Submission-level error message (e.g. from a server response) */
  error?: string;
}

/**
 * Form – a thin wrapper around react-hook-form + Zod that provides a
 * FormProvider context consumed by AddressInput, AmountInput, and PasswordInput.
 *
 * @example
 * ```tsx
 * const schema = z.object({ recipient: stellarAddressSchema, amount: amountSchema });
 *
 * <Form onSubmit={handleSubmit} validationSchema={schema}>
 *   <AddressInput name="recipient" label="Send To" />
 *   <AmountInput name="amount" label="Amount" />
 *   <Form.Submit>Send</Form.Submit>
 * </Form>
 * ```
 */
function Form<TData extends FieldValues = FieldValues>({
  onSubmit,
  validationSchema,
  defaultValues,
  children,
  className,
  error,
}: FormProps<TData>) {
  const methods = useForm<TData>({
    resolver: validationSchema ? zodResolver(validationSchema) : undefined,
    defaultValues,
  });

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        noValidate
        className={cn('space-y-4', className)}
      >
        {children}
        {error && <FormError message={error} />}
      </form>
    </FormProvider>
  );
}

// Attach sub-components
Form.Submit = FormSubmit;
Form.Error = FormError;

export { Form, FormSubmit, FormError };
