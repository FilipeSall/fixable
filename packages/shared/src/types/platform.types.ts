import type { z } from 'zod';
import type {
  adminApplication,
  adminLead,
  appointment,
  appointmentInput,
  clientDetail,
  clientListItem,
  clientListResponse,
  clientStats,
  floor,
  floorInput,
  floorplan,
  historyItem,
  idParams,
  newFloorInput,
  propertyAttribute,
  propertyAttributeInput,
  propertyAttributeParams,
  propertyInput,
  propertySummary,
  room,
  roomFieldsInput,
  roomInput,
  service,
  serviceInput,
  serviceRequest,
  serviceRequestInput,
  serviceUpdateInput,
  teamInviteInput,
  SERVICE_STATUSES,
  APPOINTMENT_STATUSES,
  TEAM_INVITE_ROLES,
} from '../platform.ts';

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type TeamInviteRole = (typeof TEAM_INVITE_ROLES)[number];

export type FloorInput = z.infer<typeof floorInput>;
export type NewFloorInput = z.infer<typeof newFloorInput>;
export type RoomInput = z.infer<typeof roomInput>;
export type RoomFieldsInput = z.infer<typeof roomFieldsInput>;
export type ServiceInput = z.infer<typeof serviceInput>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateInput>;
export type ServiceRequestInput = z.infer<typeof serviceRequestInput>;
export type AppointmentInput = z.infer<typeof appointmentInput>;
export type PropertyAttributeInput = z.infer<typeof propertyAttributeInput>;
export type PropertyInput = z.infer<typeof propertyInput>;
export type TeamInviteInput = z.infer<typeof teamInviteInput>;
export type IdParams = z.infer<typeof idParams>;
export type PropertyAttributeParams = z.infer<typeof propertyAttributeParams>;

export type ClientStats = z.infer<typeof clientStats>;
export type ClientListItem = z.infer<typeof clientListItem>;
export type ClientListResponse = z.infer<typeof clientListResponse>;
export type PropertySummary = z.infer<typeof propertySummary>;
export type ClientDetail = z.infer<typeof clientDetail>;
export type PropertyAttribute = z.infer<typeof propertyAttribute>;
export type Room = z.infer<typeof room>;
export type Floor = z.infer<typeof floor>;
export type Service = z.infer<typeof service>;
export type Floorplan = z.infer<typeof floorplan>;
export type HistoryItem = z.infer<typeof historyItem>;
export type ServiceRequest = z.infer<typeof serviceRequest>;
export type Appointment = z.infer<typeof appointment>;
export type AdminLead = z.infer<typeof adminLead>;
export type AdminApplication = z.infer<typeof adminApplication>;
