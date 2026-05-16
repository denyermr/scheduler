const MARKER_REGEX = /^[A-Z &+]{2,}$/;

export function isMarker(text: string): boolean {
  return MARKER_REGEX.test(text);
}
