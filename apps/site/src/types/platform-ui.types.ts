import type { ReactNode } from 'react';

export type PillColor = 'green' | 'yellow' | 'red' | 'blue' | 'neutral' | 'clay';

export type PillProps = {
  color: PillColor;
  children: ReactNode;
};

export type TabItem<K extends string = string> = {
  key: K;
  label: string;
};

export type TabsProps<K extends string = string> = {
  items: readonly TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  label: string;
  idPrefix: string;
};

export type TabPanelProps = {
  idPrefix: string;
  active: string;
  children: ReactNode;
};

export type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

export type FormModalProps = {
  title: string;
  submitLabel: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
  error?: string;
  busy?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
};

export type ConfirmDialogProps = {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  busy?: boolean;
  error?: string;
};

export type ToastContextValue = {
  show: (message: string) => void;
};

export type RowCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
};

export type AddBoxProps = {
  label: string;
  onClick: () => void;
  below?: boolean;
};

export type EmptyStateProps = {
  children: ReactNode;
};

export type StatItem = {
  label: string;
  value: number;
};

export type StatRowProps = {
  items: readonly StatItem[];
};

export type AvatarProps = {
  nome: string;
  size?: 'sm' | 'md';
};

export type CrumbItem = {
  label: string;
  to?: string;
};

export type CrumbsProps = {
  items: readonly CrumbItem[];
};

export type SideNavItem = {
  to: string;
  label: string;
};

export type SideNavProps = {
  section: SideNavSection;
};

export type ToastProviderProps = {
  children: ReactNode;
};

export type NotFoundPageProps = {
  embedded?: boolean;
};

export type SideNavSection = {
  label: string;
  items: readonly SideNavItem[];
};
