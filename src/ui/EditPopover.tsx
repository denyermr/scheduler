import type { CSSProperties, KeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';
import { CARD_COLORS, type Color } from '../domain/types';
import { CARD_PALETTE, FONTS, SURFACE } from './tokens';

export type EditPopoverProps = {
  text: string;
  color: Color;
  onTextChange: (text: string) => void;
  onColorChange: (color: Color) => void;
  onCommit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  style?: CSSProperties;
};

const POPOVER_WIDTH = 220;

export function EditPopover({
  text,
  color,
  onTextChange,
  onColorChange,
  onCommit,
  onCancel,
  onDelete,
  style,
}: EditPopoverProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  const root: CSSProperties = {
    position: 'absolute',
    width: POPOVER_WIDTH,
    background: SURFACE.paper,
    color: SURFACE.inkDark,
    borderRadius: 6,
    boxShadow:
      '0 12px 28px -6px rgba(30,40,60,.25), 0 4px 10px -2px rgba(30,40,60,.18)',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontFamily: FONTS.body,
    fontSize: 12,
    zIndex: 30,
    ...style,
  };

  return (
    <div
      data-testid="edit-popover"
      role="dialog"
      aria-label="Edit card"
      style={root}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <input
        ref={inputRef}
        data-testid="edit-popover-input"
        value={text}
        onChange={(e) => {
          onTextChange(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={onCommit}
        placeholder="What's happening?"
        style={{
          width: '100%',
          border: '1px solid rgba(0,0,0,.12)',
          borderRadius: 4,
          padding: '6px 8px',
          fontFamily: FONTS.body,
          fontSize: 13,
          background: '#fff',
          color: SURFACE.inkDark,
        }}
      />
      <div
        data-testid="edit-popover-swatches"
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
      >
        {CARD_COLORS.map((c) => {
          const palette = CARD_PALETTE[c];
          const selected = c === color;
          return (
            <button
              key={c}
              type="button"
              data-testid={`swatch-${c}`}
              aria-label={c}
              aria-pressed={selected}
              onMouseDown={(e) => {
                // Prevent the input from blurring (which would commit + close)
                // before the swatch click actually fires.
                e.preventDefault();
              }}
              onClick={() => {
                onColorChange(c);
              }}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: palette.fill,
                border: selected
                  ? '2px solid rgba(0,0,0,.55)'
                  : '1px solid rgba(0,0,0,.12)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          data-testid="edit-popover-delete"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#a63a2a',
            fontFamily: FONTS.body,
            fontSize: 12,
            cursor: 'pointer',
            padding: '4px 6px',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
