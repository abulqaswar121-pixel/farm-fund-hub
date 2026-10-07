/**
 * Preview notice — a development-only ribbon.
 *
 * When this build is pointed at the local preview ledger
 * (scripts/preview-ledger) the pages carry real-looking figures that were
 * never paid in by anyone. Anyone looking at such a build must be told so
 * plainly, so the ribbon renders only when VITE_PREVIEW_LEDGER is "true" and
 * is absent from every production build.
 */
export function PreviewRibbon() {
  if (import.meta.env["VITE_PREVIEW_LEDGER"] !== "true") return null;

  return (
    <p className="ndh-preview-ribbon" role="note" data-testid="preview-ribbon">
      Preview build · figures come from a local development ledger, not from member money
    </p>
  );
}
