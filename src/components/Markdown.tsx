"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const lang = /language-(\w+)/.exec(className ?? "")?.[1] ?? "";
  const text = String(children ?? "");

  const copy = () => {
    navigator.clipboard.writeText(text.replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-hairline bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-[#8b949e]">
        <span className="font-mono">{lang || "text"}</span>
        <button
          onClick={copy}
          className="transition-colors hover:text-white"
          type="button"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pb-4 pt-1 text-[13.5px] leading-relaxed">
        <code className={`font-mono ${className ?? ""}`}>{children}</code>
      </pre>
    </div>
  );
}

const components: Components = {
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

function MarkdownImpl({ content }: { content: string }) {
  return (
    <div className="leading-[1.47] text-[17px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
