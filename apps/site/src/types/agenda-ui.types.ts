import type { Appointment, AppointmentStatus, PropertySummary } from '@fixable/shared';

export type AgendaItem = Appointment & { clientNome?: string; clientId?: string };

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
  appointments: readonly AgendaItem[];
  editable: boolean;
  onMonthChange: (monthKey: string) => void;
  onEdit?: (appointment: Appointment) => void;
  emptyHint?: string;
};
