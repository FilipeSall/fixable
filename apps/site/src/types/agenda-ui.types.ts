import type { Appointment, AppointmentStatus, EngineerAppointment, PropertySummary } from '@fixable/shared';
import type { ReactNode } from 'react';

export type AgendaItem = Appointment | EngineerAppointment;

export type CalendarMonthProps = {
  monthKey: string;
  todayKey: string;
  appointments: readonly AgendaItem[];
  selectedDay: string | null;
  onMonthChange: (monthKey: string) => void;
  onDaySelect: (dayKey: string) => void;
};

export type AppointmentCardProps = {
  appointment: AgendaItem;
  open: boolean;
  editable: boolean;
  onToggle: () => void;
  onStatus?: (status: AppointmentStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  busy?: boolean;
};

export type AppointmentModalProps = {
  clientId: string;
  properties: readonly PropertySummary[];
  defaultPropertyId: string;
  appointment: Appointment | null;
  onClose: () => void;
};

export type AgendamentosTabProps = {
  clientId: string;
  property: PropertySummary;
  properties: readonly PropertySummary[];
  editable: boolean;
};

export type AgendaViewProps = {
  monthKey: string;
  appointments: readonly AgendaItem[] | undefined;
  editable: boolean;
  onMonthChange: (monthKey: string) => void;
  onEdit?: (appointment: Appointment) => void;
  emptyHint?: string;
  actions?: ReactNode;
};

export type AppointmentActionsProps = {
  busy: boolean;
  onStatus: (status: AppointmentStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void;
};
