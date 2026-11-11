import type { ClientDetail, ClientListItem, PropertyAttribute, PropertySummary, ServiceRequest } from '@fixable/shared';

export type ClientTabKey = 'solicitacoes' | 'agendamentos' | 'servicos' | 'historico' | 'residencia';

export type ClientWorkspaceProps = {
  client: ClientDetail;
  editable: boolean;
};

export type PropertySwitcherProps = {
  properties: readonly PropertySummary[];
  activeId: string;
  onChange: (id: string) => void;
  onAdd?: () => void;
};

export type ClientTabProps = {
  clientId: string;
  property: PropertySummary;
  properties: readonly PropertySummary[];
  editable: boolean;
};

export type RequestModalProps = {
  clientId: string;
  properties: readonly PropertySummary[];
  request: ServiceRequest | null;
  onClose: () => void;
};

export type AttributeModalProps = {
  propertyId: string;
  attribute: PropertyAttribute | null;
  onClose: () => void;
};

export type NewPropertyModalProps = {
  clientId: string;
  onCreated: (id: string) => void;
  onClose: () => void;
};

export type ClientTabPanelProps = ClientTabProps & {
  tab: ClientTabKey;
};

export type ClientPainelProps = {
  clientId: string;
};

export type ClientCardProps = {
  client: ClientListItem;
};

export type ClientPageBodyProps = {
  clientId: string;
  editable: boolean;
};
