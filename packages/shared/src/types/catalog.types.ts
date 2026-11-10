import type {
  APPLICATION_AREAS,
  APPLICATION_STATUSES,
  CONTACT_PREFERENCES,
  PLANS,
  PROPERTY_TYPES,
  SERVICE_REQUEST_STATUSES,
} from '../catalog.ts';

export type PlanId = (typeof PLANS)[number]['id'];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
export type ApplicationArea = (typeof APPLICATION_AREAS)[number];
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
