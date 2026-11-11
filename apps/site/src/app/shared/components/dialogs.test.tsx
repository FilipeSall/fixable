import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useToast } from '../hooks/useToast.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { FormModal } from './FormModal.tsx';
import { Tabs } from './Tabs.tsx';
import { ToastProvider } from './Toast.tsx';

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open ? (
        <FormModal title="Nova solicitação" submitLabel="Adicionar" onSubmit={vi.fn()} onClose={() => setOpen(false)} error="">
          <div className="field full">
            <label htmlFor="campo">Campo</label>
            <input id="campo" />
          </div>
        </FormModal>
      ) : null}
    </>
  );
}

describe('Modal e FormModal', () => {
  it('abre com foco dentro, fecha com Esc e devolve o foco ao gatilho', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Nova solicitação' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('Tab no último elemento volta ao primeiro', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    screen.getByRole('button', { name: 'Adicionar' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('submete pelo botão principal e mostra Excluir quando há onDelete', async () => {
    const onSubmit = vi.fn();
    const onDelete = vi.fn();
    render(
      <FormModal title="Editar" submitLabel="Salvar" onSubmit={onSubmit} onClose={vi.fn()} onDelete={onDelete} error="Erro de teste">
        <span />
      </FormModal>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Erro de teste');
  });
});

describe('ConfirmDialog', () => {
  it('mostra o texto e chama a confirmação ou o cancelamento', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Excluir solicitação" text="Remover “Vazamento”?" confirmLabel="Excluir" onConfirm={onConfirm} onCancel={onCancel} />);
    const user = userEvent.setup();
    expect(screen.getByText('Remover “Vazamento”?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

function ToastHarness() {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show('Solicitação adicionada.')}>
      Avisar
    </button>
  );
}

describe('Toast', () => {
  it('mostra a mensagem e some depois de 3,2 s', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button', { name: 'Avisar' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('Solicitação adicionada.');
    act(() => {
      vi.advanceTimersByTime(3199);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Solicitação adicionada.');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('');
    vi.useRealTimers();
  });
});

describe('Tabs', () => {
  it('troca de aba por clique e por setas', async () => {
    const onChange = vi.fn();
    const items = [
      { key: 'a', label: 'Solicitações' },
      { key: 'b', label: 'Agendamentos' },
    ] as const;
    render(<Tabs items={items} active="a" onChange={onChange} label="Abas do cliente" idPrefix="t" />);
    const user = userEvent.setup();
    expect(screen.getByRole('tab', { name: 'Solicitações' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Agendamentos' }));
    expect(onChange).toHaveBeenLastCalledWith('b');
    screen.getByRole('tab', { name: 'Solicitações' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(screen.getByRole('tab', { name: 'Agendamentos' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Solicitações' })).toHaveAttribute('aria-controls', 't-panel');
  });
});
