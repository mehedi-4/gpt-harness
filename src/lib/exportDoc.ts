/** Client-only document export helpers (no dependencies). */

function slugify(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "document";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Save raw markdown as a `.md` file. */
export function downloadMarkdown(content: string, title: string): void {
  downloadBlob(new Blob([content], { type: "text/markdown" }), `${slugify(title)}.md`);
}

/** Save raw text as a `.txt` file. */
export function downloadText(content: string, title: string): void {
  downloadBlob(new Blob([content], { type: "text/plain" }), `${slugify(title)}.txt`);
}

/**
 * Open a print-friendly window containing the already-rendered message HTML and
 * trigger the browser print dialog (where the user chooses "Save as PDF"). This
 * keeps text selectable and gives real page breaks with zero dependencies.
 * Returns false if the popup was blocked so the caller can surface a hint.
 */
export function printHtmlToPdf(html: string, title: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;

  const doc = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; }
  body {
    font: 15px/1.6 -apple-system, "SF Pro Text", system-ui, Segoe UI, Roboto, sans-serif;
    color: #111; max-width: 720px; margin: 0 auto; padding: 24px;
  }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.4em 0 0.5em; page-break-after: avoid; }
  h1 { font-size: 26px; } h2 { font-size: 21px; } h3 { font-size: 18px; }
  p, li { font-size: 15px; }
  ul, ol { padding-left: 1.4em; }
  a { color: #0a63c9; text-decoration: none; }
  pre {
    background: #f5f5f7; border: 1px solid #e3e3e6; border-radius: 8px;
    padding: 12px 14px; overflow-x: auto; page-break-inside: avoid;
    font: 12.5px/1.5 "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  }
  code { font: 0.9em "SF Mono", ui-monospace, Menlo, Consolas, monospace; }
  p code, li code { background: #f0f0f2; border-radius: 4px; padding: 0.1em 0.35em; }
  pre code { background: none; padding: 0; }
  blockquote {
    margin: 1em 0; padding-left: 1em; border-left: 3px solid #d0d0d5; color: #555;
  }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; page-break-inside: avoid; }
  th, td { border: 1px solid #d8d8dc; padding: 6px 10px; text-align: left; font-size: 14px; }
  th { background: #f5f5f7; }
  img { max-width: 100%; }
</style>
</head>
<body>${html}</body>
</html>`;

  win.document.open();
  win.document.write(doc);
  win.document.close();

  // Give the new document a tick to lay out before invoking print. Guard so we
  // only trigger the dialog once regardless of which timer/handler wins.
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch {
      /* window may have been closed by the user */
    }
  };
  win.onload = doPrint;
  setTimeout(doPrint, 400);

  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
