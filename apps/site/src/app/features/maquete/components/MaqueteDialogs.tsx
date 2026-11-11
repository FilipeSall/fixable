import type { Service } from '@fixable/shared';
import { useMutation } from '@tanstack/react-query';
import type { MaqueteDialogsProps } from '../../../../types/maquete.types.ts';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { completeService } from '../api.ts';
import { useRefreshMaquete } from '../hooks/useMaquete.ts';
import { FloorModal } from './FloorModal.tsx';
import { RoomModal } from './RoomModal.tsx';
import { ServiceModal } from './ServiceModal.tsx';

/** Abre o modal pedido pela maquete: cômodo, andar, serviço ou a confirmação de concluir. */
export function MaqueteDialogs({ dialog, property, floors, floor, selectedRoomId, onClose, onFloorDeleted }: Readonly<MaqueteDialogsProps>) {
  const refresh = useRefreshMaquete(property.id);
  const { show } = useToast();
  const complete = useMutation({
    mutationFn: (service: Service) => completeService(service.id),
    onSuccess: async () => {
      await refresh();
      onClose();
      show('Serviço concluído e enviado ao histórico de manutenção.');
    },
  });

  if (dialog?.kind === 'room') return <RoomModal propertyId={property.id} floor={floor} room={dialog.room} onClose={onClose} />;
  if (dialog?.kind === 'floor') {
    return <FloorModal propertyId={property.id} floor={floor} canDelete={floors.length > 1} onClose={onClose} onDeleted={onFloorDeleted} />;
  }
  if (dialog?.kind === 'service') {
    return <ServiceModal propertyId={property.id} floors={floors} service={dialog.service} defaultRoomId={selectedRoomId} onClose={onClose} />;
  }
  if (dialog?.kind !== 'complete') return null;
  const text = complete.error
    ? errorMessage(complete.error)
    : `“${dialog.service.titulo}” vai para o histórico de manutenção agora e continua visível em Serviços em andamento por 24 horas.`;
  return (
    <ConfirmDialog
      title="Concluir serviço"
      text={text}
      confirmLabel="Marcar como concluído"
      danger={false}
      busy={complete.isPending}
      onConfirm={() => complete.mutate(dialog.service)}
      onCancel={onClose}
    />
  );
}
