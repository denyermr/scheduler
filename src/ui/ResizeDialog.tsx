import type { CSSProperties } from 'react';
import { FONTS, SURFACE } from './tokens';

export type ResizeDialogProps = {
  weeks: number;
  cutCount: number;
  onConfirm: () => void;
  onCancel: () => void;
};

const OVERLAY: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20,25,35,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const PANEL: CSSProperties = {
  width: 340,
  background: SURFACE.paper,
  color: SURFACE.inkDark,
  borderRadius: 10,
  padding: '18px 18px 16px',
  fontFamily: FONTS.body,
  fontSize: 13,
  boxShadow:
    '0 30px 60px -16px rgba(20,25,35,.35), 0 8px 18px -6px rgba(20,25,35,.25)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const BTN: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(0,0,0,.15)',
  borderRadius: 6,
  padding: '6px 12px',
  fontFamily: FONTS.body,
  fontSize: 13,
  cursor: 'pointer',
  color: SURFACE.inkDark,
};

const BTN_PRIMARY: CSSProperties = {
  ...BTN,
  background: SURFACE.inkDark,
  color: SURFACE.paper,
  border: 'none',
};

export function ResizeDialog({
  weeks,
  cutCount,
  onConfirm,
  onCancel,
}: ResizeDialogProps): JSX.Element {
  return (
    <div data-testid="resize-dialog" style={OVERLAY} role="dialog" aria-modal>
      <div style={PANEL}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: SURFACE.inkDark,
          }}
        >
          Shrink to {weeks} weeks?
        </div>
        <div data-testid="resize-dialog-message" style={{ color: SURFACE.inkMid }}>
          {cutCount} card{cutCount === 1 ? '' : 's'} would be cut off. They'll be
          preserved off-board and restored if you grow the board back.
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            data-testid="resize-dialog-cancel"
            onClick={onCancel}
            style={BTN}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="resize-dialog-confirm"
            onClick={onConfirm}
            style={BTN_PRIMARY}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
