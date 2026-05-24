import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UnlockScreen } from '../../src/ui/UnlockScreen';

function typeInto(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}

describe('<UnlockScreen />', () => {
  it('renders a board-password input and an Unlock button', () => {
    render(<UnlockScreen slug="oak-thread-helmet-tractor-1234" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/board password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /unlock/i }),
    ).toBeInTheDocument();
  });

  it('input is type=password', () => {
    render(<UnlockScreen slug="x" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/board password/i)).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('shows the slug somewhere in the page so the visitor confirms which board they are unlocking', () => {
    render(
      <UnlockScreen
        slug="oak-thread-helmet-tractor-1234"
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/oak-thread-helmet-tractor-1234/i),
    ).toBeInTheDocument();
  });

  it('Unlock is disabled until the password field is non-empty', () => {
    render(<UnlockScreen slug="x" onSubmit={vi.fn()} />);
    const button = screen.getByRole('button', { name: /unlock/i });
    expect(button).toBeDisabled();
    typeInto(screen.getByLabelText(/board password/i), 'p');
    expect(button).toBeEnabled();
  });

  it('submitting calls onSubmit with the password', () => {
    const onSubmit = vi.fn();
    render(<UnlockScreen slug="x" onSubmit={onSubmit} />);
    typeInto(screen.getByLabelText(/board password/i), 'my-password');
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
    expect(onSubmit).toHaveBeenCalledWith('my-password');
  });

  it('busy=true shows progress label and disables the form', () => {
    render(<UnlockScreen slug="x" onSubmit={vi.fn()} busy />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/unlocking|decrypting/i);
    expect(screen.getByLabelText(/board password/i)).toBeDisabled();
  });

  it('error prop is displayed as a message', () => {
    render(
      <UnlockScreen slug="x" onSubmit={vi.fn()} error="Wrong password" />,
    );
    expect(screen.getByText(/wrong password/i)).toBeInTheDocument();
  });

  it('pressing Enter submits the form', () => {
    const onSubmit = vi.fn();
    render(<UnlockScreen slug="x" onSubmit={onSubmit} />);
    typeInto(screen.getByLabelText(/board password/i), 'pw');
    fireEvent.submit(
      screen.getByLabelText(/board password/i).closest('form')!,
    );
    expect(onSubmit).toHaveBeenCalledWith('pw');
  });

  it('notFound=true renders a "this board does not exist" message instead of the form', () => {
    render(<UnlockScreen slug="ghost" onSubmit={vi.fn()} notFound />);
    expect(
      screen.getByRole('heading', { name: /board not found|not found/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/board password/i)).not.toBeInTheDocument();
  });

  it('notFound=true offers a link back to the splash', () => {
    render(<UnlockScreen slug="ghost" onSubmit={vi.fn()} notFound />);
    const link = screen.getByRole('link', { name: /create a new board|home|start/i });
    expect(link).toHaveAttribute('href', '/');
  });
});
