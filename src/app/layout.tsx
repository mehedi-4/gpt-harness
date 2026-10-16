import type { Metadata } from "next";
import "./globals.css";
import { NativeShell } from "@/components/NativeShell";

export const metadata: Metadata = {
  title: "ChatGPT",
  description: "A ChatGPT clone.",
};

// Runs before paint to set the theme class and avoid a flash of the wrong mode.
const noFlashScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-full"><NativeShell />{children}</body>
    </html>
  );
}
