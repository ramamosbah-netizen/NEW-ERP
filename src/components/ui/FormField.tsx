import React from 'react';

export type FormFieldType = 'text' | 'number' | 'date' | 'textarea' | 'select' | 'toggle' | 'checkbox' | 'password' | 'email';

interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, 'type'> {
  type?: FormFieldType;
  label?: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  containerClassName?: string;
}

export const FormField = React.forwardRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, FormFieldProps>(
  (
    {
      type = 'text',
      label,
      error,
      helpText,
      required,
      options = [],
      containerClassName = '',
      className = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const fieldId = id || `field-${Math.random().toString(36).substring(2, 9)}`;

    // Common input styling class (supporting compact density via variables)
    const baseInputStyle =
      'w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors duration-100 focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--primary-glow)] disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-[var(--bg-card-hover)]';

    const errorStyle = error ? 'border-[var(--status-danger-border)] focus:border-[var(--error)] focus:ring-[var(--error-glow)]' : '';

    const sizePaddingStyle = 'px-3 py-2 text-sm';

    const renderInput = () => {
      if (type === 'textarea') {
        return (
          <textarea
            ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
            id={fieldId}
            disabled={disabled}
            className={`${baseInputStyle} ${errorStyle} ${sizePaddingStyle} min-h-[80px] resize-y ${className}`}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        );
      }

      if (type === 'select') {
        return (
          <select
            ref={ref as React.ForwardedRef<HTMLSelectElement>}
            id={fieldId}
            disabled={disabled}
            className={`${baseInputStyle} ${errorStyle} ${sizePaddingStyle} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_auto] bg-[right_12px_center] bg-no-repeat pr-10 ${className}`}
            {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
          >
            {props.placeholder && <option value="">{props.placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                {opt.label}
              </option>
            ))}
          </select>
        );
      }

      if (type === 'toggle') {
        const inputProps = props as React.InputHTMLAttributes<HTMLInputElement>;
        const isChecked = !!inputProps.checked;
        return (
          <label className="inline-flex items-center cursor-pointer select-none mt-1.5">
            <input
              ref={ref as React.ForwardedRef<HTMLInputElement>}
              type="checkbox"
              id={fieldId}
              disabled={disabled}
              className="sr-only peer"
              {...inputProps}
            />
            <div className="relative w-9 h-5 bg-[var(--bg-card)] dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-card)] after:border-[var(--border)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-[var(--bg-dark)]"></div>
            <span className="ml-2 text-xs font-semibold text-[var(--text-secondary)]">
              {isChecked ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        );
      }

      if (type === 'checkbox') {
        return (
          <label className="inline-flex items-center gap-2 cursor-pointer mt-2 select-none">
            <input
              ref={ref as React.ForwardedRef<HTMLInputElement>}
              type="checkbox"
              id={fieldId}
              disabled={disabled}
              className="w-4 h-4 rounded bg-[var(--bg-dark)] border border-[var(--border-color)] text-primary focus:ring-offset-[var(--bg-dark)] focus:ring-2 focus:ring-primary focus:ring-opacity-25"
              {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
            />
            {label && (
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {label} {required && <span className="text-red-500">*</span>}
              </span>
            )}
          </label>
        );
      }

      return (
        <input
          ref={ref as React.ForwardedRef<HTMLInputElement>}
          type={type}
          id={fieldId}
          disabled={disabled}
          className={`${baseInputStyle} ${errorStyle} ${sizePaddingStyle} ${className}`}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      );
    };

    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
        {label && type !== 'checkbox' && type !== 'toggle' && (
          <label
            htmlFor={fieldId}
            className="text-xs font-medium text-[var(--text-secondary)] select-none leading-none"
          >
            {label} {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        
        <div className="relative">{renderInput()}</div>
        
        {helpText && !error && (
          <p className="text-[10px] text-[var(--text-muted)] leading-normal">{helpText}</p>
        )}
        
        {error && (
          <p className="text-[10px] text-red-500 dark:text-red-400 font-medium leading-none mt-0.5 animate-pulse">
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
