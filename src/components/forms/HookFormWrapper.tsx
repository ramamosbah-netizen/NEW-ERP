import React from 'react';
import { useForm, UseFormReturn, FieldValues, DefaultValues, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema } from 'zod';

interface HookFormWrapperProps<TFieldValues extends FieldValues> {
  schema: ZodSchema<TFieldValues>;
  defaultValues?: DefaultValues<TFieldValues>;
  onSubmit: SubmitHandler<TFieldValues>;
  children: (methods: UseFormReturn<TFieldValues>) => React.ReactNode;
  className?: string;
  id?: string;
}

export function HookFormWrapper<TFieldValues extends FieldValues = FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className = '',
  id,
}: HookFormWrapperProps<TFieldValues>) {
  const methods = useForm<TFieldValues>({
    resolver: zodResolver(schema as any),
    defaultValues,
    mode: 'onTouched',
  });


  return (
    <form
      id={id}
      onSubmit={methods.handleSubmit(onSubmit as any)}
      className={`space-y-4 ${className}`}
      noValidate
    >
      {children(methods as any)}
    </form>
  );
}

