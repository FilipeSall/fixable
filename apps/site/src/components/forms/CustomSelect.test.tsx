import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FormField } from './FormField.tsx';

const OPTIONS = [
  { value: 'casa', label: 'Casa' },
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'sobrado', label: 'Sobrado' },
];

/** Formulário de apoio que liga o FormField de select a um estado local. */
function Harness({ error }: Readonly<{ error?: string }>) {
  const [value, setValue] = useState('');
  return (
    <form aria-label="teste">
      <FormField id="f-tipo" name="tipo" label="Tipo de imóvel" control="select" options={OPTIONS} value={value} error={error} onChange={(_, next) => setValue(next)} />
    </form>
  );
}

const combo = () => screen.getByRole('combobox', { name: 'Tipo de imóvel' });

describe('CustomSelect', () => {
  it('mostra o placeholder, abre pelo clique e marca a opção escolhida', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(combo()).toHaveTextContent('Selecione');
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(combo());
    expect(combo()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await user.click(screen.getByRole('option', { name: 'Sobrado' }));
    expect(combo()).toHaveTextContent('Sobrado');
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
    await user.click(combo());
    expect(screen.getByRole('option', { name: 'Sobrado' })).toHaveAttribute('aria-selected', 'true');
  });

  it('navega por teclado com setas, Home e End e seleciona com Enter', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combo().focus();
    await user.keyboard('{Enter}');
    expect(combo()).toHaveAttribute('aria-activedescendant', 'f-tipo-opt-0');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(combo()).toHaveAttribute('aria-activedescendant', 'f-tipo-opt-2');
    await user.keyboard('{ArrowDown}');
    expect(combo()).toHaveAttribute('aria-activedescendant', 'f-tipo-opt-2');
    await user.keyboard('{Home}');
    expect(combo()).toHaveAttribute('aria-activedescendant', 'f-tipo-opt-0');
    await user.keyboard('{End}{Enter}');
    expect(combo()).toHaveTextContent('Sobrado');
    expect(combo()).toHaveFocus();
  });

  it('abre com Espaço e seleciona com Espaço; seta para cima também abre', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combo().focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown} ');
    expect(combo()).toHaveTextContent('Apartamento');
    await user.keyboard('{ArrowUp}');
    expect(combo()).toHaveAttribute('aria-expanded', 'true');
  });

  it('a busca por letra vai à próxima opção que começa com ela', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combo().focus();
    await user.keyboard('{Enter}s{Enter}');
    expect(combo()).toHaveTextContent('Sobrado');
  });

  it('Escape fecha sem alterar o valor e mantém o foco; Tab também fecha', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    combo().focus();
    await user.keyboard('{Enter}{ArrowDown}{Escape}');
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
    expect(combo()).toHaveTextContent('Selecione');
    expect(combo()).toHaveFocus();
    await user.keyboard('{Enter}{Tab}');
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
  });

  it('clique fora fecha a lista', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">fora</button>
        <Harness />
      </>,
    );
    await user.click(combo());
    await user.click(screen.getByRole('button', { name: 'fora' }));
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
  });

  it('envia o valor escolhido no corpo do formulário por um input hidden', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(combo());
    await user.click(screen.getByRole('option', { name: 'Apartamento' }));
    const form = screen.getByRole<HTMLFormElement>('form', { name: 'teste' });
    expect(new FormData(form).get('tipo')).toBe('apartamento');
  });

  it('liga a mensagem de erro por aria-describedby e marca aria-invalid', () => {
    render(<Harness error="Selecione o tipo." />);
    expect(combo()).toHaveAttribute('aria-invalid', 'true');
    expect(combo()).toHaveAccessibleDescription('Selecione o tipo.');
  });
});
