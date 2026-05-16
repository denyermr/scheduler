import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../../src/ui/Card';
import type { Card as CardModel } from '../../src/domain/types';
import { CARD_PALETTE, PIN_PALETTE } from '../../src/ui/tokens';

const baseCard: CardModel = {
  id: 'card_00000001',
  week: 0,
  day: 0,
  color: 'peach',
  text: 'Dress + light',
  rotation: -1.5,
  pin: PIN_PALETTE.red,
};

describe('<Card />', () => {
  it('renders the card text', () => {
    render(<Card card={baseCard} />);
    expect(screen.getByText('Dress + light')).toBeInTheDocument();
  });

  it('applies Caveat font for non-marker text', () => {
    render(<Card card={{ ...baseCard, text: 'Dress + light' }} />);
    const root = screen.getByTestId('card');
    expect(root.style.fontFamily).toContain('Caveat');
    expect(root.style.fontFamily).not.toContain('Permanent Marker');
    expect(root.style.textTransform).toBe('none');
  });

  it('applies Permanent Marker font when the text matches the all-caps regex', () => {
    render(<Card card={{ ...baseCard, text: 'BLOCK' }} />);
    const root = screen.getByTestId('card');
    expect(root.style.fontFamily).toContain('Permanent Marker');
    expect(root.style.textTransform).toBe('uppercase');
  });

  it('falls back to Caveat for lowercase opt-out', () => {
    render(<Card card={{ ...baseCard, text: 'Block' }} />);
    const root = screen.getByTestId('card');
    expect(root.style.fontFamily).toContain('Caveat');
    expect(root.style.fontFamily).not.toContain('Permanent Marker');
  });

  it('applies the card rotation as a CSS transform', () => {
    render(<Card card={{ ...baseCard, rotation: 1.7 }} />);
    const root = screen.getByTestId('card');
    expect(root.style.transform).toBe('rotate(1.7deg)');
  });

  it('uses the palette fill and ink for its color', () => {
    render(<Card card={{ ...baseCard, color: 'coral' }} />);
    const root = screen.getByTestId('card');
    expect(root.style.background.toLowerCase()).toContain('rgb(242, 107, 134)');
    expect(root.style.color).toBe('rgb(74, 26, 38)');
    expect(CARD_PALETTE.coral.fill).toBe('#F26B86');
  });

  it('renders a pin head colored with the card pin', () => {
    render(<Card card={{ ...baseCard, pin: PIN_PALETTE.blue }} />);
    const pin = screen.getByTestId('card-pin');
    expect(pin.style.background).toContain(PIN_PALETTE.blue);
  });

  it('scales chrome with the size prop', () => {
    render(<Card card={baseCard} size={2} />);
    const root = screen.getByTestId('card');
    expect(root.style.width).toBe('156px');
    const pin = screen.getByTestId('card-pin');
    expect(pin.style.width).toBe('10px');
    expect(pin.style.height).toBe('10px');
  });
});
