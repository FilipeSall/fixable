import type { Floor, PropertySummary, Room, Service } from '@fixable/shared';
import type { ReactNode } from 'react';

export type MaqueteTabProps = {
  property: PropertySummary;
  editable: boolean;
};

export type RoomGridProps = {
  floor: Floor;
  services: readonly Service[];
  selectedRoomId: string | null;
  editable: boolean;
  onSelect: (roomId: string) => void;
};

export type FloorColumnProps = {
  floors: readonly Floor[];
  services: readonly Service[];
  activeFloorId: string;
  editable: boolean;
  onSelect: (floorId: string) => void;
  onAddFloor: () => void;
  onAddRoom: () => void;
  onEditFloor: () => void;
};

export type ServiceCardProps = {
  service: Service;
  location: string;
  editable: boolean;
  now: number;
  onEdit: (service: Service) => void;
  onComplete: (service: Service) => void;
};

export type RoomModalProps = {
  propertyId: string;
  floor: Floor;
  room: Room | null;
  onClose: () => void;
};

export type FloorModalProps = {
  propertyId: string;
  floor: Floor;
  canDelete: boolean;
  onClose: () => void;
  onDeleted: () => void;
};

export type ServiceModalProps = {
  propertyId: string;
  floors: readonly Floor[];
  service: Service | null;
  defaultRoomId: string | null;
  onClose: () => void;
};

export type HistoricoTabProps = {
  property: PropertySummary;
};

export type RoomPlacement = {
  gridColumn: string;
  gridRow: string;
};

export type RoomPopoverProps = {
  room: Room;
  services: readonly Service[];
  editable: boolean;
  renderCards: (services: readonly Service[]) => ReactNode;
  onAddService: () => void;
  onEditRoom: () => void;
  onClose: () => void;
};

export type MaqueteDialog =
  | { kind: 'room'; room: Room | null }
  | { kind: 'floor' }
  | { kind: 'service'; service: Service | null }
  | { kind: 'complete'; service: Service }
  | null;

export type MaqueteDialogsProps = {
  dialog: MaqueteDialog;
  property: PropertySummary;
  floors: readonly Floor[];
  floor: Floor;
  selectedRoomId: string | null;
  onClose: () => void;
  onFloorDeleted: () => void;
};
