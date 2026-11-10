import { API, APPLICATION_AREAS, APPLICATION_AREA_LABELS, applicationInput } from '@fixable/shared';
import type { FormFieldOption } from '../../types/public-forms.types.ts';
import { ConsentField } from './ConsentField.tsx';
import { FormField } from './FormField.tsx';
import { FormSuccess } from './FormSuccess.tsx';
import { HoneypotField } from './HoneypotField.tsx';
import { usePublicForm } from './use-public-form.ts';

const FIELD_ORDER = ['nome', 'email', 'telefone', 'cidade', 'area', 'aceiteTermos'];
const AREA_OPTIONS: readonly FormFieldOption[] = APPLICATION_AREAS.map((value) => ({ value, label: APPLICATION_AREA_LABELS[value] }));
const EMPTY = { nome: '', email: '', telefone: '', cidade: '', area: '', aceiteTermos: false, website: '' };

/** Formulário "Faça parte do time": valida a candidatura com Zod e envia para a API pública. */
export function ApplicationForm() {
  const form = usePublicForm({
    schema: applicationInput,
    url: API.publicApplications,
    idPrefix: 't',
    order: FIELD_ORDER,
    initial: EMPTY,
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
        title="Cadastro recebido."
        text="A equipe Fixable vai analisar sua candidatura e entrar em contato pelo e-mail informado."
        onReset={form.reset}
      />
    );
  }

  return (
    <form id="team-form" method="post" noValidate onSubmit={form.submit}>
      <div className="form-grid">
        <FormField id="t-nome" name="nome" label="Nome completo" placeholder="Seu nome" autoComplete="name" value={values.nome as string} error={errors.nome} onChange={handleChange} />
        <FormField id="t-email" name="email" label="E-mail" type="email" placeholder="voce@email.com" autoComplete="email" value={values.email as string} error={errors.email} onChange={handleChange} />
        <FormField id="t-telefone" name="telefone" label="Telefone" type="tel" placeholder="(11) 90000-0000" autoComplete="tel" value={values.telefone as string} error={errors.telefone} onChange={handleChange} />
        <FormField id="t-cidade" name="cidade" label="Cidade" placeholder="Sua cidade" value={values.cidade as string} error={errors.cidade} onChange={handleChange} />
      </div>
      <FormField id="t-area" name="area" label="Área de atuação" control="select" full options={AREA_OPTIONS} value={values.area as string} error={errors.area} onChange={handleChange} />
      <ConsentField id="t-aceiteTermos" checked={values.aceiteTermos as boolean} error={errors.aceiteTermos} onChange={handleConsent} />
      <HoneypotField id="t-website" value={values.website as string} onChange={handleHoneypot} />
      {form.formError ? (
        <p className="err" role="alert">
          {form.formError}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-block" disabled={form.sending}>
        {form.sending ? 'Enviando...' : 'Fazer meu cadastro'}
      </button>
    </form>
  );
}
