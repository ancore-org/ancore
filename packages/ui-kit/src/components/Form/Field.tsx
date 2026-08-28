import * as React from 'react';
import { cn } from '@/lib/utils';

type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean | 'true' | 'false';
  required?: boolean;
};

type FieldRenderProps = {
  id: string;
  describedBy?: string;
  invalid: boolean;
  controlProps: FieldControlProps & { id: string };
};

export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  label: React.ReactNode;
  children: React.ReactElement<FieldControlProps> | ((props: FieldRenderProps) => React.ReactNode);
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

function mergeIds(...ids: Array<string | undefined>): string | undefined {
  const merged = ids.filter(Boolean).join(' ');
  return merged || undefined;
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ label, children, description, error, required = false, className, ...props }, ref) => {
    const generatedId = React.useId();
    const childProps = typeof children === 'function' ? undefined : children.props;
    const inputId = childProps?.id ?? generatedId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = mergeIds(childProps?.['aria-describedby'], descriptionId, errorId);

    const controlProps: FieldControlProps & { id: string } = {
      id: inputId,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : childProps?.['aria-invalid'],
      'aria-required': required ? true : childProps?.['aria-required'],
      ...(required ? { required: true } : {}),
    };

    const control =
      typeof children === 'function'
        ? children({
            id: inputId,
            describedBy,
            invalid: Boolean(error),
            controlProps,
          })
        : React.cloneElement(children, controlProps);

    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        <label
          htmlFor={inputId}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        {control}
        {description && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Field.displayName = 'Field';

export { Field };
