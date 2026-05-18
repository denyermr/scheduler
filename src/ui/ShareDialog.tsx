import { useState, type CSSProperties } from 'react';
import { FONTS, SURFACE } from './tokens';

export type ShareDialogProps = {
  url: string;
  cardCount: number;
  threadCount: number;
  onClose: () => void;
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
  gap: 10,
};

const URL_PILL: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: '#fff',
  border: '1px solid rgba(0,0,0,.10)',
  borderRadius: 6,
  padding: '6px 10px',
  fontFamily: FONTS.mono,
  fontSize: 12,
};

const BTN: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(0,0,0,.15)',
  borderRadius: 6,
  padding: '4px 10px',
  fontFamily: FONTS.body,
  fontSize: 12,
  cursor: 'pointer',
  color: SURFACE.inkDark,
};

export function ShareDialog({
  url,
  cardCount,
  threadCount,
  onClose,
}: ShareDialogProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  function copyUrl(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 1500);
      });
    }
  }

  return (
    <div data-testid="share-dialog" style={OVERLAY} role="dialog" aria-modal>
      <div style={PANEL}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: SURFACE.inkDark,
          }}
        >
          Share this board
        </div>
        <div style={{ color: SURFACE.inkMid, marginBottom: 4 }}>
          Anyone with the link can view and edit. There are no roles or
          accounts.
        </div>
        <div style={URL_PILL}>
          <span
            data-testid="share-dialog-url"
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {url}
          </span>
          <button
            type="button"
            data-testid="share-dialog-copy"
            onClick={copyUrl}
            style={{ ...BTN, marginLeft: 8 }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div
          data-testid="share-dialog-summary"
          style={{ color: SURFACE.inkMid, fontSize: 12 }}
        >
          {cardCount} card{cardCount === 1 ? '' : 's'} · {threadCount} thread
          {threadCount === 1 ? '' : 's'}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 4,
          }}
        >
          <button
            type="button"
            data-testid="share-dialog-close"
            onClick={onClose}
            style={BTN}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
