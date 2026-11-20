/** Two bars while it moves, a triangle while it is paused: what pressing it would do. */
export function AmbientGlyph({ paused }: { paused: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paused ? (
        <path
          d="M8.2 5.4v13.2a.6.6 0 0 0 .92.5l10.1-6.6a.6.6 0 0 0 0-1L9.12 4.9a.6.6 0 0 0-.92.5z"
          fill="currentColor"
        />
      ) : (
        <>
          <rect x="6.4" y="5" width="3.8" height="14" rx="1.1" fill="currentColor" />
          <rect x="13.8" y="5" width="3.8" height="14" rx="1.1" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
