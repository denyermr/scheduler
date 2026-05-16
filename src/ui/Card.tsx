import type { CSSProperties } from 'react';
import type { Card as CardModel } from '../domain/types';
import { isMarker } from '../domain/marker';
import {
  CARD_BASE,
  CARD_PALETTE,
  FONTS,
  PIN_SIZE,
} from './tokens';

export type CardProps = {
  card: CardModel;
  size?: number;
  style?: CSSProperties;
};

export function Card({ card, size = 1, style }: CardProps): JSX.Element {
  const pal = CARD_PALETTE[card.color];
  const shouty = isMarker(card.text);
  const rootStyle: CSSProperties = {
    position: 'relative',
    width: CARD_BASE.width * size,
    minHeight: CARD_BASE.minHeight * size,
    padding: `${String(CARD_BASE.paddingY * size)}px ${String(CARD_BASE.paddingRight * size)}px ${String(CARD_BASE.paddingY * size)}px ${String(CARD_BASE.paddingLeft * size)}px`,
    background: pal.fill,
    color: pal.ink,
    borderRadius: CARD_BASE.borderRadius,
    transform: `rotate(${String(card.rotation)}deg)`,
    boxShadow: `0 ${String(1.2 * size)}px ${String(2.5 * size)}px rgba(0,0,0,.18), 0 ${String(4 * size)}px ${String(8 * size)}px rgba(0,0,0,.10)`,
    fontFamily: shouty ? FONTS.marker : FONTS.caveat,
    fontWeight: shouty ? 400 : 600,
    fontSize: shouty ? 14 * size : 16 * size,
    lineHeight: 1.05,
    letterSpacing: shouty ? '0.04em' : '0.01em',
    textTransform: shouty ? 'uppercase' : 'none',
    ...style,
  };
  const pinStyle: CSSProperties = {
    position: 'absolute',
    left: 3 * size,
    top: '50%',
    transform: 'translateY(-50%)',
    width: PIN_SIZE * size,
    height: PIN_SIZE * size,
    borderRadius: '50%',
    background: `radial-gradient(circle at 30% 30%, #fff8 0 18%, ${card.pin} 20% 100%)`,
    boxShadow: `0 ${String(0.6 * size)}px ${String(1.2 * size)}px rgba(0,0,0,.4)`,
  };
  return (
    <div data-testid="card" data-card-id={card.id} style={rootStyle}>
      <span data-testid="card-pin" style={pinStyle} />
      <span
        style={{ display: 'block', textAlign: 'center', textWrap: 'balance' }}
      >
        {card.text}
      </span>
    </div>
  );
}
