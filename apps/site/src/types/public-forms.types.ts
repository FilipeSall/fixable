import type { ReactNode } from 'react';
import type { IssueSource } from './forms.types.ts';

export type SubmitResult = { ok: true } | { ok: false; fields?: Record<string, string>; message: string };

export type FormValues = Record<string, string | boolean>;

export type DiagnosticFormProps = { cidadeInicial?: string };

export type ConsentFieldProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
};

export type FormFieldOption = { value: string; label: string };

export type FormFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
  control?: 'input' | 'select' | 'textarea';
  type?: 'text' | 'email' | 'tel';
  placeholder?: string;
  autoComplete?: string;
  options?: readonly FormFieldOption[];
  full?: boolean;
  hint?: string;
};

export type HoneypotFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

export type PublicFormConfig = {
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: unknown } | { success: false; error: IssueSource };
  };
  url: string;
  idPrefix: string;
  order: readonly string[];
  initial: FormValues;
  onSuccess?: () => void;
  extraBody?: () => Record<string, unknown>;
};

export type PublicFormState = {
  values: FormValues;
  errors: Record<string, string>;
  formError: string;
  sending: boolean;
  done: boolean;
  setValue: (name: string, value: string | boolean) => void;
  submit: (event: { preventDefault: () => void }) => void;
  reset: () => void;
};

export type FormSuccessProps = {
  title: string;
  text: string;
  onReset: () => void;
  children?: ReactNode;
};
