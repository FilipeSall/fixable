import { APPLICATION_AREA_LABELS, type AdminApplication, type ApplicationStatus } from '@fixable/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ApplicationAction } from '../../../../types/admin-ui.types.ts';
import type { TabItem } from '../../../../types/platform-ui.types.ts';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog.tsx';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { RowCard } from '../../../shared/components/RowCard.tsx';
import { TabPanel, Tabs } from '../../../shared/components/Tabs.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { formatDateTime } from '../../../shared/lib/format.ts';
import { adminKeys, approveApplication, refuseApplication } from '../api.ts';
import { useApplications } from '../hooks/useAdmin.ts';

const TABS: readonly TabItem<ApplicationStatus>[] = [
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aprovada', label: 'Aprovadas' },
  { key: 'recusada', label: 'Recusadas' },
];

/** Linha descritiva da candidatura: área, contato, cidade e data. */
function detailsOf(application: AdminApplication): string {
  return [APPLICATION_AREA_LABELS[application.area], application.email, application.telefone, application.cidade, formatDateTime(application.createdAt)].join(' · ');
}

/** Candidaturas do "Faça parte do time"; o admin aprova (envia convite) ou recusa as pendentes. */
export function CandidaturasPage() {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [status, setStatus] = useState<ApplicationStatus>('pendente');
  const [action, setAction] = useState<ApplicationAction>(null);
  const { data, error, isPending } = useApplications(status);

  const decide = useMutation({
    mutationFn: (next: NonNullable<ApplicationAction>) =>
      next.kind === 'approve' ? approveApplication(next.application.id) : refuseApplication(next.application.id),
    onSuccess: async (_, next) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
      show(next.kind === 'approve' ? `Candidatura aprovada. Convite enviado para ${next.application.email}.` : 'Candidatura recusada.');
      setAction(null);
    },
    onError: async (failure) => {
      show(errorMessage(failure));
      setAction(null);
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });

  return (
    <>
      <h1 className="app-h">Candidaturas</h1>
      <p className="app-sub">Profissionais e engenheiros que se cadastraram pelo site. Aprovar cria a conta e envia o convite.</p>
      <Tabs items={TABS} active={status} onChange={setStatus} label="Status das candidaturas" idPrefix="candidaturas" />
      <TabPanel idPrefix="candidaturas" active={status}>
      {isPending ? <p role="status">Carregando...</p> : null}
      {error ? <p role="alert">{errorMessage(error)}</p> : null}
      {data?.length === 0 ? <EmptyState>Nenhuma candidatura neste status.</EmptyState> : null}
      <div className="rows">
        {data?.map((application) => (
          <RowCard
            key={application.id}
            title={application.nome}
            subtitle={detailsOf(application)}
            right={
              application.status === 'pendente' ? (
                <span className="btn-row">
                  <button type="button" className="b-sm green" onClick={() => setAction({ kind: 'approve', application })}>
                    Aprovar
                  </button>
                  <button type="button" className="b-sm danger" onClick={() => setAction({ kind: 'refuse', application })}>
                    Recusar
                  </button>
                </span>
              ) : undefined
            }
          />
        ))}
      </div>
      </TabPanel>
      {action ? (
        <ConfirmDialog
          title={action.kind === 'approve' ? 'Aprovar candidatura' : 'Recusar candidatura'}
          text={
            action.kind === 'approve'
              ? `Criar a conta de ${action.application.nome} e enviar o convite para ${action.application.email}?`
              : `Recusar a candidatura de ${action.application.nome}? Nenhuma conta será criada.`
          }
          confirmLabel={action.kind === 'approve' ? 'Aprovar' : 'Recusar'}
          danger={action.kind === 'refuse'}
          busy={decide.isPending}
          onConfirm={() => decide.mutate(action)}
          onCancel={() => setAction(null)}
        />
      ) : null}
    </>
  );
}
