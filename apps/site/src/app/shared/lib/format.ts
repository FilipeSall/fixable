/** Completa um número com zero à esquerda até dois dígitos. */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formata uma data ISO (AAAA-MM-DD ou timestamp) como dd/mm/aaaa, ou "—" quando vazia. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDay) return `${isoDay[3]}/${isoDay[2]}/${isoDay[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Formata um timestamp como "dd/mm/aaaa às HH:MM" no fuso do navegador. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(value)} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Devolve o primeiro nome de um nome completo, para saudações. */
export function firstName(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** Devolve as iniciais (até duas letras) de um nome, para o avatar. */
export function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
