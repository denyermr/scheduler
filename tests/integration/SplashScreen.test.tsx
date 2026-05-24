import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SplashScreen } from '../../src/ui/SplashScreen';

function typeInto(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}

describe('<SplashScreen />', () => {
  it('renders two distinct password inputs and a Create button', () => {
    render(<SplashScreen onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/site password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/board password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create board/i }),
    ).toBeInTheDocument();
  });

  it('both password inputs are type=password (no shoulder-surf)', () => {
    render(<SplashScreen onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/site password/i)).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getByLabelText(/board password/i)).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('Create is disabled until both fields are non-empty', () => {
    render(<SplashScreen onSubmit={vi.fn()} />);
    const button = screen.getByRole('button', { name: /create board/i });
    expect(button).toBeDisabled();
    typeInto(screen.getByLabelText(/site password/i), 'a');
    expect(button).toBeDisabled();
    typeInto(screen.getByLabelText(/board password/i), 'b');
    expect(button).toBeEnabled();
  });

  it('submitting calls onSubmit with (sitePassword, boardPassword)', () => {
    const onSubmit = vi.fn();
    render(<SplashScreen onSubmit={onSubmit} />);
    typeInto(screen.getByLabelText(/site password/i), 'site-pw');
    typeInto(screen.getByLabelText(/board password/i), 'board-pw');
    fireEvent.click(screen.getByRole('button', { name: /create board/i }));
    expect(onSubmit).toHaveBeenCalledWith('site-pw', 'board-pw');
  });

  it('busy=true shows progress label and disables the form', () => {
    render(<SplashScreen onSubmit={vi.fn()} busy />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/creating/i);
    expect(screen.getByLabelText(/site password/i)).toBeDisabled();
    expect(screen.getByLabelText(/board password/i)).toBeDisabled();
  });

  it('error prop is displayed as a message', () => {
    render(
      <SplashScreen onSubmit={vi.fn()} error="Site password incorrect" />,
    );
    expect(screen.getByText(/site password incorrect/i)).toBeInTheDocument();
  });

  it('pressing Enter in the board-password field submits the form', () => {
    const onSubmit = vi.fn();
    render(<SplashScreen onSubmit={onSubmit} />);
    typeInto(screen.getByLabelText(/site password/i), 's');
    typeInto(screen.getByLabelText(/board password/i), 'b');
    fireEvent.submit(
      screen.getByLabelText(/board password/i).closest('form')!,
    );
    expect(onSubmit).toHaveBeenCalledWith('s', 'b');
  });

  it('does not show alert role when no error is set', () => {
    render(<SplashScreen onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('caption mentions there is no recovery from a lost board password', () => {
    // CLAUDE.md §5 invariant 2 — no recovery. Users see this before they
    // create a board they cannot recover.
    render(<SplashScreen onSubmit={vi.fn()} />);
    expect(
      screen.getByText(/no recovery|lost.*board|cannot recover/i),
    ).toBeInTheDocument();
  });
});
