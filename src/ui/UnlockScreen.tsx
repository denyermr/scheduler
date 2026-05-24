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

export type UnlockScreenProps = {
  /** The slug being unlocked — surfaced so the visitor knows which board this is. */
  slug: string;
  onSubmit: (boardPassword: string) => Promise<void> | void;
  busy?: boolean;
  error?: string | null;
  /** Server returned 404 for this slug — no envelope to unlock. */
  notFound?: boolean;
};

/**
 * The "/b/:slug" route shell — shown before the board is decrypted.
 * Prompts for the board password; on success, the parent hands a
 * CryptoContext to <App> and the board renders.
 *
 * When `notFound`, the form is replaced by a short message + a link back
 * to the splash. (Distinct from the splash so the URL stays addressable
 * for the share flow — visiting a deleted slug doesn't silently create.)
 */
export function UnlockScreen({
  slug,
  onSubmit,
  busy = false,
  error,
  notFound = false,
}: UnlockScreenProps) {
  const [pw, setPw] = useState('');
  const canSubmit = pw.length > 0 && !busy;

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit(pw);
  }

  return (
    <main
      data-testid="unlock"
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
        <div
          style={{
            position: 'relative',
            background: SURFACE.paper,
            borderRadius: 1.5,
            padding: '28px 24px 22px',
            boxShadow:
              '0 1.2px 2.5px rgba(0,0,0,.18), 0 4px 8px rgba(0,0,0,.10)',
            transform: 'rotate(0.4deg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 10,
              top: 12,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, #cad6e8, ${PIN_PALETTE.blue} 60%, #15375f 100%)`,
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
            {notFound ? 'Board not found' : 'Unlock board'}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontFamily: FONTS.mono,
              color: SURFACE.inkMid,
              paddingLeft: 26,
              wordBreak: 'break-all',
            }}
          >
            /b/{slug}
          </p>

          {notFound ? (
            <>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: SURFACE.inkMid }}>
                This slug does not exist. The board was either never created or
                has been deleted.
              </p>
              <a
                href="/"
                style={{
                  marginTop: 8,
                  display: 'inline-block',
                  alignSelf: 'flex-start',
                  padding: '8px 14px',
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  fontWeight: 600,
                  color: SURFACE.inkDark,
                  background: '#f2ead9',
                  border: `1px solid ${SURFACE.inkMid}`,
                  borderRadius: 2,
                  textDecoration: 'none',
                }}
              >
                Create a new board
              </a>
            </>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
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
                  autoFocus
                  disabled={busy}
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
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
                {busy ? 'Unlocking…' : 'Unlock'}
              </button>
            </form>
          )}
        </div>
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
