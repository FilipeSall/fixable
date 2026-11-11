import { TEAM_INVITE_ROLES, type TeamInviteRole } from '@fixable/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { InviteModalProps } from '../../../../types/admin-ui.types.ts';
import { FormModal } from '../../../shared/components/FormModal.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { inviteTeamMember } from '../api.ts';

const ROLE_LABELS: Record<TeamInviteRole, string> = { engenheiro: 'Engenheiro', admin: 'Administrador' };

/** Modal de convidar um engenheiro ou administrador por e-mail. */
export function InviteModal({ onClose }: Readonly<InviteModalProps>) {
  const { show } = useToast();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamInviteRole>('engenheiro');

  const send = useMutation({
    mutationFn: () => inviteTeamMember({ nome, email, role }),
    onSuccess: () => {
      show(`Convite enviado para ${email.trim().toLowerCase()}.`);
      onClose();
    },
  });

  return (
    <FormModal
      title="Convidar pessoa"
      submitLabel="Enviar convite"
      busy={send.isPending}
      error={send.error ? errorMessage(send.error) : ''}
      onSubmit={() => send.mutate()}
      onClose={onClose}
    >
      <div className="field full">
        <label htmlFor="inv-nome">Nome completo</label>
        <input id="inv-nome" value={nome} onChange={(event) => setNome(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="inv-email">E-mail</label>
        <input id="inv-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="inv-perfil">Perfil</label>
        <select id="inv-perfil" value={role} onChange={(event) => setRole(event.target.value as TeamInviteRole)}>
          {TEAM_INVITE_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
    </FormModal>
  );
}
