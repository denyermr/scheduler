import {
  THREAD_DELETE_FLASH_STROKE,
  THREAD_HIT_WIDTH,
  THREAD_OPACITY,
  THREAD_STROKE,
  THREAD_WIDTH,
  threadPathD,
  threadSag,
} from './tokens';

export type ThreadProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  filterId?: string;
  threadId?: string;
  /** When true, the visible stroke renders in the delete-flash colour. */
  flashing?: boolean;
  /** When set, an invisible wider hit-path captures clicks (workflow 03 delete). */
  onClick?: () => void;
};

export function Thread({
  x1,
  y1,
  x2,
  y2,
  filterId,
  threadId,
  flashing = false,
  onClick,
}: ThreadProps): JSX.Element {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const sag = threadSag(dist);
  const d = threadPathD(x1, y1, x2, y2, sag);
  return (
    <g>
      {onClick && (
        <path
          d={d}
          data-testid="thread-hit"
          data-thread-id={threadId}
          stroke="transparent"
          strokeWidth={THREAD_HIT_WIDTH}
          strokeLinecap="round"
          fill="none"
          pointerEvents="stroke"
          style={{ cursor: 'pointer' }}
          onClick={onClick}
        />
      )}
      <path
        d={d}
        data-testid="thread-path"
        data-thread-id={threadId}
        stroke={flashing ? THREAD_DELETE_FLASH_STROKE : THREAD_STROKE}
        strokeWidth={THREAD_WIDTH}
        strokeLinecap="round"
        opacity={THREAD_OPACITY}
        fill="none"
        pointerEvents="none"
        filter={filterId ? `url(#${filterId})` : undefined}
      />
    </g>
  );
}

export const THREAD_FILTER_ID = 'sb-thread-shadow';

export function ThreadShadowDefs(): JSX.Element {
  return (
    <defs>
      <filter
        id={THREAD_FILTER_ID}
        x="-10%"
        y="-10%"
        width="120%"
        height="120%"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
        <feOffset dx="0" dy="1.5" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.45" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}
