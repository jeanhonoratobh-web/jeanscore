/**
 * Component tests for {@link Modal} (Requirements 33.7, 33.8).
 *
 * Verifies the accessible dialog contract: on open it moves keyboard focus to
 * the first focusable element inside the dialog and traps the Tab / Shift+Tab
 * cycle so focus never escapes (Requirement 33.7); on close (via Escape) it
 * restores focus to the element that triggered the open (Requirement 33.8).
 */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@i18n/I18nProvider';
import { Modal } from './Modal';

/**
 * Harness wiring a trigger button to a stateful Modal so focus restoration
 * (Requirement 33.8) can be observed against a real trigger element.
 */
function Harness({ onClose }: { onClose?: () => void } = {}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <I18nProvider>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        titleKey="home.nextMatch.title"
      >
        <button type="button">Primeiro</button>
        <button type="button">Segundo</button>
      </Modal>
    </I18nProvider>
  );
}

describe('Modal (Requirement 33.7 — focus move + trap)', () => {
  it('renders nothing when closed', () => {
    render(
      <I18nProvider>
        <Modal open={false} onClose={vi.fn()} titleKey="home.nextMatch.title">
          <button type="button">Primeiro</button>
        </Modal>
      </I18nProvider>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus to the first focusable element when opened', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    // The close button (aria-label "Fechar") is the first focusable descendant
    // in DOM order, so focus lands there on open.
    const closeButton = screen.getByRole('button', { name: 'Fechar' });
    expect(document.activeElement).toBe(closeButton);
  });

  it('wraps focus from the last element to the first on Tab', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    const closeButton = screen.getByRole('button', { name: 'Fechar' });
    const last = screen.getByRole('button', { name: 'Segundo' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });

    expect(document.activeElement).toBe(closeButton);
  });

  it('wraps focus from the first element to the last on Shift+Tab', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    const closeButton = screen.getByRole('button', { name: 'Fechar' });
    const last = screen.getByRole('button', { name: 'Segundo' });

    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(last);
  });
});

describe('Modal (Requirement 33.8 — close + focus restore)', () => {
  it('invokes onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger element after closing', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
