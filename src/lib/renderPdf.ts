import "server-only";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

const require = createRequire(import.meta.url);

/** Read a bundled CSS file from a dependency, cached across invocations. */
let katexCss: string | null = null;
let hljsCss: string | null = null;

function loadKatexCss(): string {
  if (katexCss == null) {
    katexCss = readFileSync(require.resolve("katex/dist/katex.min.css"), "utf8");
  }
  return katexCss;
}

function loadHljsCss(): string {
  if (hljsCss == null) {
    hljsCss = readFileSync(
      require.resolve("highlight.js/styles/github.css"),
      "utf8",
    );
  }
  return hljsCss;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Convert GitHub-flavored Markdown (with math + code) to an HTML fragment. */
async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeHighlight, { detect: true })
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

/** Print stylesheet mirroring the client `printHtmlToPdf` look, plus vendor CSS. */
function pageHtml(bodyHtml: string, title: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${loadKatexCss()}</style>
<style>${loadHljsCss()}</style>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; }
  body {
    font: 15px/1.6 -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif;
    color: #111; margin: 0 auto; padding: 0;
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
  .katex-display { overflow-x: auto; overflow-y: hidden; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/**
 * Render Markdown to a professional PDF (selectable text + rendered math) using
 * headless Chrome. Isolated here so the engine can be swapped without touching
 * the route. Returns the PDF bytes.
 */
export async function renderPdf(markdown: string, title: string): Promise<Uint8Array> {
  const html = pageHtml(await markdownToHtml(markdown), title);

  // Import puppeteer lazily so the heavy dependency (and its Chromium download
  // check) never runs at build time or for non-PDF requests.
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
