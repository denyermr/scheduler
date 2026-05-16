import {
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
};

export function Thread({
  x1,
  y1,
  x2,
  y2,
  filterId,
  threadId,
}: ThreadProps): JSX.Element {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const sag = threadSag(dist);
  const d = threadPathD(x1, y1, x2, y2, sag);
  return (
    <path
      d={d}
      data-testid="thread-path"
      data-thread-id={threadId}
      stroke={THREAD_STROKE}
      strokeWidth={THREAD_WIDTH}
      strokeLinecap="round"
      opacity={THREAD_OPACITY}
      fill="none"
      filter={filterId ? `url(#${filterId})` : undefined}
    />
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
