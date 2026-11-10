import {
  CONTACT_PREFERENCES,
  CONTACT_PREFERENCE_LABELS,
  PLANS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  API,
  diagnosticInput,
  planName,
} from '@fixable/shared';
import { useState, useSyncExternalStore } from 'react';
import type { DiagnosticFormProps, FormFieldOption } from '../../types/public-forms.types.ts';
import { ConsentField } from './ConsentField.tsx';
import { FormField } from './FormField.tsx';
import { FormSuccess } from './FormSuccess.tsx';
import { HoneypotField } from './HoneypotField.tsx';
import { usePublicForm } from './use-public-form.ts';

const FIELD_ORDER = ['nome', 'email', 'telefone', 'cidade', 'tipoImovel', 'descricao', 'preferenciaContato', 'aceiteTermos'];
const PROPERTY_OPTIONS: readonly FormFieldOption[] = PROPERTY_TYPES.map((value) => ({ value, label: PROPERTY_TYPE_LABELS[value] }));
const CONTACT_OPTIONS: readonly FormFieldOption[] = CONTACT_PREFERENCES.map((value) => ({
  value,
  label: CONTACT_PREFERENCE_LABELS[value],
}));
const EMPTY = { nome: '', email: '', telefone: '', cidade: '', tipoImovel: '', descricao: '', preferenciaContato: '', aceiteTermos: false, website: '' };

/** Devolve o id do plano indicado em ?plano= quando ele existe no catálogo, ou vazio. */
function planSnapshot(): string {
  const id = new URLSearchParams(window.location.search).get('plano') ?? '';
  return PLANS.some((plan) => plan.id === id) ? id : '';
}

/** Não há assinatura: a URL só é lida na montagem. */
function subscribeNothing() {
  return () => undefined;
}

/** Valor da URL no servidor, onde não há ?plano=. */
function serverPlan() {
  return '';
}

/** Formulário de solicitação de diagnóstico: valida com Zod e envia para a API pública. */
export function DiagnosticForm({ cidadeInicial = '' }: Readonly<DiagnosticFormProps>) {
  const [dismissed, setDismissed] = useState(false);
  /** Remove o plano de interesse escolhido. */
  function clearPlan() {
    setDismissed(true);
  }
  const fromUrl = useSyncExternalStore(subscribeNothing, planSnapshot, serverPlan);
  const plano = dismissed ? '' : fromUrl;
  const form = usePublicForm({
    schema: diagnosticInput,
    url: API.publicDiagnostics,
    idPrefix: 'd',
    order: FIELD_ORDER,
    initial: { ...EMPTY, cidade: cidadeInicial },
    onSuccess: clearPlan,
    extraBody: () => (plano ? { plano } : {}),
  });
  const { values, errors, setValue } = form;

  /** Atualiza o campo de texto ou seleção pelo nome. */
  function handleChange(name: string, value: string) {
    setValue(name, value);
  }
  /** Atualiza o aceite dos termos. */
  function handleConsent(checked: boolean) {
    setValue('aceiteTermos', checked);
  }
  /** Atualiza o campo isca. */
  function handleHoneypot(value: string) {
    setValue('website', value);
  }

  if (form.done) {
    return (
      <FormSuccess
        title="Solicitação registrada."
        text="Um engenheiro da Fixable vai entrar em contato para agendar a visita. Se este for o seu primeiro diagnóstico, você também vai receber um e-mail para criar sua senha."
        onReset={form.reset}
      />
    );
  }

  return (
    <form id="diagnostic-form" method="post" noValidate onSubmit={form.submit}>
      {plano ? (
        <div className="plan-chip show">
          <span>
            Plano de interesse: <strong>{planName(plano as Parameters<typeof planName>[0])}</strong>
          </span>
          <button type="button" onClick={clearPlan}>
            Remover
          </button>
        </div>
      ) : null}
      <div className="form-grid">
        <FormField id="d-nome" name="nome" label="Nome completo" placeholder="Seu nome" autoComplete="name" value={values.nome as string} error={errors.nome} onChange={handleChange} />
        <FormField id="d-email" name="email" label="E-mail" type="email" placeholder="voce@email.com" autoComplete="email" value={values.email as string} error={errors.email} onChange={handleChange} />
        <FormField id="d-telefone" name="telefone" label="Telefone" type="tel" placeholder="(11) 90000-0000" autoComplete="tel" value={values.telefone as string} error={errors.telefone} onChange={handleChange} />
        <FormField id="d-cidade" name="cidade" label="Cidade" placeholder="Sua cidade" value={values.cidade as string} error={errors.cidade} onChange={handleChange} />
        <FormField id="d-tipoImovel" name="tipoImovel" label="Tipo de imóvel" control="select" options={PROPERTY_OPTIONS} value={values.tipoImovel as string} error={errors.tipoImovel} onChange={handleChange} />
      </div>
      <FormField id="d-descricao" name="descricao" label="Descrição do problema" hint="opcional" control="textarea" full placeholder="Conte um pouco sobre o que sua casa precisa" value={values.descricao as string} error={errors.descricao} onChange={handleChange} />
      <FormField id="d-preferenciaContato" name="preferenciaContato" label="Preferência de contato" control="select" full options={CONTACT_OPTIONS} value={values.preferenciaContato as string} error={errors.preferenciaContato} onChange={handleChange} />
      <ConsentField id="d-aceiteTermos" checked={values.aceiteTermos as boolean} error={errors.aceiteTermos} onChange={handleConsent} />
      <HoneypotField id="d-website" value={values.website as string} onChange={handleHoneypot} />
      {form.formError ? (
        <p className="err" role="alert">
          {form.formError}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-block" disabled={form.sending}>
        {form.sending ? 'Enviando...' : 'Solicitar diagnóstico'}
      </button>
    </form>
  );
}
