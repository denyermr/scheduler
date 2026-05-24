import { useState, type FormEvent } from 'react';
import {
  CORK_INSET_SHADOW,
  CORK_RADIUS,
  CORK_TEXTURE_BG,
  CORK_TEXTURE_SIZE,
  BOARD_FLOAT_SHADOW,
  FONTS,
  PAGE_BG,
  PIN_PALETTE,
  SURFACE,
} from './tokens';

export type SplashScreenProps = {
  onSubmit: (sitePassword: string, boardPassword: string) => Promise<void> | void;
  busy?: boolean;
  error?: string | null;
};

/**
 * The "/" route — creates a new locked board. Two password fields:
 *   - Site password (Fly secret, gates creation — anti-bot)
 *   - Board password (becomes the encryption key for this new board)
 *
 * Visual: a small paper-on-cork form, floating on the page background. The
 * pin head is a static red dot in the top-left — same chrome vocabulary as
 * a regular card, just larger.
 */
export function SplashScreen({
  onSubmit,
  busy = false,
  error,
}: SplashScreenProps) {
  const [site, setSite] = useState('');
  const [board, setBoard] = useState('');
  const canSubmit = site.length > 0 && board.length > 0 && !busy;

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit(site, board);
  }

  return (
    <main
      data-testid="splash"
      style={{
        minHeight: '100vh',
        backgroundImage: PAGE_BG,
        backgroundColor: '#eef0f4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 28px',
        fontFamily: FONTS.body,
      }}
    >
      <div
        style={{
          background: CORK_TEXTURE_BG,
          backgroundSize: CORK_TEXTURE_SIZE,
          borderRadius: CORK_RADIUS,
          boxShadow: `${BOARD_FLOAT_SHADOW}, ${CORK_INSET_SHADOW}`,
          padding: 36,
          maxWidth: 460,
          width: '100%',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            position: 'relative',
            background: SURFACE.paper,
            borderRadius: 1.5,
            padding: '28px 24px 22px',
            boxShadow:
              '0 1.2px 2.5px rgba(0,0,0,.18), 0 4px 8px rgba(0,0,0,.10)',
            transform: 'rotate(-0.6deg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* pin head */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 10,
              top: 12,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, #ff9a8c, ${PIN_PALETTE.red} 60%, #6b1d14 100%)`,
              boxShadow: '0 1px 2px rgba(0,0,0,.35)',
            }}
          />

          <h1
            style={{
              margin: 0,
              fontFamily: FONTS.caveat,
              fontWeight: 600,
              fontSize: 28,
              lineHeight: 1.1,
              color: SURFACE.inkDark,
              paddingLeft: 26,
            }}
          >
            Schedule Board
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: SURFACE.inkMid,
              paddingLeft: 26,
            }}
          >
            Create a new locked board. The board password becomes its
            encryption key — share both the URL and the password to let
            someone view it.
          </p>

          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 12,
              color: SURFACE.inkMid,
              fontWeight: 500,
            }}
          >
            Site password
            <input
              type="password"
              autoComplete="off"
              autoFocus
              disabled={busy}
              value={site}
              onChange={(e) => {
                setSite(e.target.value);
              }}
              style={inputStyle}
            />
          </label>

          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 12,
              color: SURFACE.inkMid,
              fontWeight: 500,
            }}
          >
            Board password
            <input
              type="password"
              autoComplete="off"
              disabled={busy}
              value={board}
              onChange={(e) => {
                setBoard(e.target.value);
              }}
              style={inputStyle}
            />
          </label>

          {error !== null && error !== undefined && error !== '' && (
            <div
              role="alert"
              style={{
                fontSize: 12,
                color: '#9a2018',
                fontFamily: FONTS.body,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              marginTop: 4,
              padding: '8px 14px',
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: SURFACE.inkDark,
              background: '#f2ead9',
              border: `1px solid ${SURFACE.inkMid}`,
              borderRadius: 2,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.55,
            }}
          >
            {busy ? 'Creating…' : 'Create board'}
          </button>

          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: SURFACE.inkMid,
              fontStyle: 'italic',
              paddingTop: 4,
            }}
          >
            No recovery — if you lose the board password, the board is lost.
          </p>
        </form>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '7px 9px',
  fontFamily: FONTS.body,
  fontSize: 13,
  color: SURFACE.inkDark,
  background: '#fdfaf2',
  border: `1px solid ${SURFACE.inkMid}`,
  borderRadius: 2,
  outline: 'none',
};
