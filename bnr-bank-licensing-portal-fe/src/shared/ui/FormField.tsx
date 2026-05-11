import { forwardRef, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import type { FieldError } from 'react-hook-form';

interface LabelProps {
  label: string;
  required?: boolean;
  error?: FieldError;
  hint?: string;
  id: string;
  control: ReactNode;
}

function FieldWrapper({ label, required, error, hint, id, control }: LabelProps) {
  return (
    <div className="form-group">
      <label htmlFor={id} className={`form-label${required ? ' required' : ''}`}>
        {label}
      </label>
      {control}
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error.message}</span>}
    </div>
  );
}

function makeId(label: string) {
  return `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
}

// ─── Input ───
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: FieldError;
  hint?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputProps>(
  ({ label, required, error, hint, className, ...rest }, ref) => {
    const id = makeId(label);
    return (
      <FieldWrapper label={label} required={required} error={error} hint={hint} id={id} control={
        <input
          id={id}
          ref={ref}
          className={`form-input${error ? ' error' : ''}${className ? ` ${className}` : ''}`}
          {...rest}
        />
      } />
    );
  },
);
InputField.displayName = 'InputField';

// ─── Textarea ───
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  error?: FieldError;
  hint?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, required, error, hint, className, ...rest }, ref) => {
    const id = makeId(label);
    return (
      <FieldWrapper label={label} required={required} error={error} hint={hint} id={id} control={
        <textarea
          id={id}
          ref={ref}
          className={`form-textarea${error ? ' error' : ''}${className ? ` ${className}` : ''}`}
          {...rest}
        />
      } />
    );
  },
);
TextareaField.displayName = 'TextareaField';

// ─── Select ───
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  required?: boolean;
  error?: FieldError;
  hint?: string;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, required, error, hint, className, children, ...rest }, ref) => {
    const id = makeId(label);
    return (
      <FieldWrapper label={label} required={required} error={error} hint={hint} id={id} control={
        <select
          id={id}
          ref={ref}
          className={`form-select${error ? ' error' : ''}${className ? ` ${className}` : ''}`}
          {...rest}
        >
          {children}
        </select>
      } />
    );
  },
);
SelectField.displayName = 'SelectField';

// ─── Legacy unified export (kept for compatibility) ───
export { InputField as FormField };
