"use client";

import { Children, isValidElement, memo, useState, type ReactNode } from "react";
import { Streamdown, defaultRehypePlugins, defaultRemarkPlugins, type Components } from "streamdown";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import type { PluggableList } from "unified";
import "katex/dist/katex.min.css";

const remarkPlugins: PluggableList = [...Object.values(defaultRemarkPlugins), remarkMath];
const livePlugins: PluggableList = [...Object.values(defaultRehypePlugins), [rehypeKatex, { throwOnError: false, strict: false }]];
const completePlugins: PluggableList = [...livePlugins, rehypeHighlight];
const textAnimation = { animation: "fadeIn", duration: 180, easing: "ease-out", sep: "word", stagger: 12, maxBacklogMs: 180 } as const;

function nodeText(children: ReactNode): string {
  return Children.toArray(children).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    return isValidElement<{ children?: ReactNode }>(child) ? nodeText(child.props.children) : "";
  }).join("");
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const lang = /language-(\w+)/.exec(className ?? "")?.[1] ?? "";
  const text = nodeText(children);

  const copy = () => {
    navigator.clipboard.writeText(text.replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="my-4 rounded-lg border border-hairline bg-[#0d1117]">
      {/* Sticky header keeps the copy button reachable even when the code
          block is taller than the viewport and you've scrolled past its top.
          No overflow-hidden on the wrapper, or sticky would be clipped. */}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-white/10 bg-[#0d1117] px-4 py-2 text-xs text-[#8b949e]">
        <span className="font-mono">{lang || "text"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 transition-colors hover:text-white"
          type="button"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            {copied ? (
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <>
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </>
            )}
          </svg>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-b-lg px-4 pb-4 pt-3 text-[13.5px] leading-relaxed">
        <code className={`font-mono ${className ?? ""}`}>{children}</code>
      </pre>
    </div>
  );
}

/**
 * Models emit LaTeX with `\( … \)` (inline) and `\[ … \]` (display) delimiters,
 * but remark-math only recognizes `$ … $` / `$$ … $$`. Rewrite the former into
 * the latter so equations render. Code spans and fenced code blocks are left
 * untouched — we split the text on them and only rewrite the prose segments.
 */
function normalizeMath(input: string): string {
  // Split on fenced code blocks (```…```) and inline code (`…`), keeping the
  // delimiters, so we never rewrite math-like sequences inside code.
  const segments = input.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return segments
    .map((seg, i) => {
      // Odd indices are the captured code segments — leave them as-is.
      if (i % 2 === 1) return seg;
      return seg
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, body) => `$$${body}$$`)
        .replace(/\\\(([\s\S]+?)\\\)/g, (_, body) => `$${body}$`);
    })
    .join("");
}

const components: Components = {
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
  em({ children }) {
    return <em>{children}</em>;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children, node, ...props }) {
    const isBlock = node?.position?.start.line !== node?.position?.end.line ||
      /language-/.test(className ?? "");
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return (
      <code
        className="rounded-[5px] bg-surface-2 px-1.5 py-0.5 font-mono text-[0.9em]"
        {...props}
      >
        {children}
      </code>
    );
  },
  a({ children, ...props }) {
    return (
      <a
        className="text-link underline-offset-2 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  },
  ul({ children }) {
    return <ul className="my-3 list-disc space-y-1.5 pl-6">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-3 list-decimal space-y-1.5 pl-6">{children}</ol>;
  },
  h1({ children }) {
    return <h1 className="mb-3 mt-6 text-2xl font-semibold">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mb-3 mt-6 text-xl font-semibold">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-5 text-lg font-semibold">{children}</h3>;
  },
  p({ children }) {
    return <p className="my-4 first:mt-0 last:mb-0">{children}</p>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-4 border-l-2 border-hairline pl-4 text-fg-secondary">
        {children}
      </blockquote>
    );
  },
  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-hairline bg-surface-2 px-3 py-1.5 text-left font-semibold">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border border-hairline px-3 py-1.5">{children}</td>;
  },
};

function MarkdownImpl({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="min-w-0 [overflow-wrap:anywhere] leading-[1.47] text-[17px]">
      <Streamdown
        className="chat-markdown"
        remarkPlugins={remarkPlugins}
        rehypePlugins={streaming ? livePlugins : completePlugins}
        components={components}
        isAnimating={!!streaming}
        animated={textAnimation}
        caret={streaming && content ? "block" : undefined}
        controls={false}
      >
        {normalizeMath(content)}
      </Streamdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
