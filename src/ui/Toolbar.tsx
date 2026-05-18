import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { MAX_WEEKS, MIN_WEEKS, clampWeeks } from '../domain/weeks';
import { FONTS, SURFACE } from './tokens';

export type ToolbarProps = {
  weeks: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onShare: () => void;
  /** Fires once the user confirms a target week count via the stepper. The
   * editor decides whether to commit immediately or open the resize dialog. */
  onRequestResize: (weeks: number) => void;
};

const PILL_STYLE: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  background: '#fff',
  borderRadius: 8,
  boxShadow:
    '0 6px 16px -2px rgba(30,40,60,.18), 0 2px 4px -1px rgba(30,40,60,.10)',
  padding: '4px 6px',
  fontFamily: FONTS.body,
  fontSize: 13,
  fontWeight: 500,
  color: SURFACE.inkDark,
};

const BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '6px 10px',
  borderRadius: 6,
  fontFamily: FONTS.body,
  fontSize: 13,
  fontWeight: 500,
  color: SURFACE.inkDark,
  cursor: 'pointer',
};

const BTN_DISABLED_STYLE: CSSProperties = {
  ...BTN_STYLE,
  color: 'rgba(42,31,21,0.32)',
  cursor: 'not-allowed',
};

const DIVIDER_STYLE: CSSProperties = {
  width: 1,
  height: 18,
  background: 'rgba(0,0,0,.08)',
  margin: '0 2px',
};

const SHARE_BTN_STYLE: CSSProperties = {
  ...BTN_STYLE,
  background: SURFACE.inkDark,
  color: SURFACE.paper,
  marginLeft: 2,
};

export function Toolbar({
  weeks,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onShare,
  onRequestResize,
}: ToolbarProps): JSX.Element {
  const [stepperOpen, setStepperOpen] = useState(false);
  const [draftWeeks, setDraftWeeks] = useState(String(weeks));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stepperOpen) {
      // Focus the input on next paint.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [stepperOpen]);

  function openStepper(): void {
    setDraftWeeks(String(weeks));
    setStepperOpen(true);
  }

  function apply(): void {
    const n = Number(draftWeeks);
    if (!Number.isFinite(n)) {
      setStepperOpen(false);
      return;
    }
    const clamped = clampWeeks(n);
    onRequestResize(clamped);
    setStepperOpen(false);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>): void {
    setDraftWeeks(e.target.value);
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      apply();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setStepperOpen(false);
    }
  }

  return (
    <div data-testid="toolbar" style={PILL_STYLE} role="toolbar">
      {!stepperOpen ? (
        <button
          type="button"
          data-testid="toolbar-weeks-display"
          onClick={openStepper}
          style={BTN_STYLE}
        >
          Weeks {weeks}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label
            htmlFor="toolbar-weeks-input"
            style={{ fontSize: 13, color: SURFACE.inkMid }}
          >
            Weeks
          </label>
          <input
            id="toolbar-weeks-input"
            ref={inputRef}
            data-testid="toolbar-weeks-input"
            type="number"
            min={MIN_WEEKS}
            max={MAX_WEEKS}
            step={1}
            value={draftWeeks}
            onChange={onInputChange}
            onKeyDown={onInputKey}
            style={{
              width: 56,
              padding: '4px 6px',
              border: '1px solid rgba(0,0,0,.12)',
              borderRadius: 4,
              fontFamily: FONTS.body,
              fontSize: 13,
            }}
          />
          <button
            type="button"
            data-testid="toolbar-weeks-apply"
            onClick={apply}
            style={{ ...BTN_STYLE, padding: '4px 8px' }}
          >
            Apply
          </button>
        </div>
      )}
      <span style={DIVIDER_STYLE} aria-hidden />
      <button
        type="button"
        data-testid="toolbar-undo"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Cmd/Ctrl-Z)"
        style={canUndo ? BTN_STYLE : BTN_DISABLED_STYLE}
      >
        {'↶'} Undo
      </button>
      <button
        type="button"
        data-testid="toolbar-redo"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Cmd/Ctrl-Shift-Z)"
        style={canRedo ? BTN_STYLE : BTN_DISABLED_STYLE}
      >
        {'↷'} Redo
      </button>
      <span style={DIVIDER_STYLE} aria-hidden />
      <button
        type="button"
        data-testid="toolbar-share"
        onClick={onShare}
        style={SHARE_BTN_STYLE}
      >
        Share
      </button>
    </div>
  );
}
