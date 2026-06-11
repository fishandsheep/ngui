import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export interface CodeEditorHandle {
  focusLine: (line: number) => void;
}

const blockKeywords = new Set(["http", "server", "location", "upstream", "stream", "map", "events"]);
const directiveKeywords = new Set([
  "listen",
  "server_name",
  "proxy_pass",
  "fastcgi_pass",
  "grpc_pass",
  "uwsgi_pass",
  "rewrite",
  "return",
  "try_files",
  "include",
  "ssl_certificate",
  "ssl_certificate_key"
]);

const highlightDurationMs = 1400;
const fallbackLineHeight = 20;

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, onChange, label = "Nginx configuration" },
  ref
) {
  const editorId = useId();
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clearHighlightTimeoutRef = useRef<number | null>(null);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const highlighted = useMemo(() => highlightNginx(value, activeLine), [activeLine, value]);
  const lineNumbers = useMemo(() => buildLineNumbers(value, activeLine), [activeLine, value]);

  useEffect(() => {
    return () => {
      if (clearHighlightTimeoutRef.current !== null) {
        window.clearTimeout(clearHighlightTimeoutRef.current);
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    focusLine(line: number) {
      const textarea = textareaRef.current;
      const highlight = highlightRef.current;
      if (!textarea || !highlight || !Number.isFinite(line)) return;

      const offsets = getLineOffsets(value, line);
      if (!offsets) return;

      textarea.focus();
      textarea.setSelectionRange(offsets.start, offsets.end);

      const computedLineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight);
      const lineHeight = resolveLineHeight(window.getComputedStyle(textarea), computedLineHeight);
      const targetScrollTop = Math.max(0, (line - 1) * lineHeight - Math.max(0, textarea.clientHeight / 2 - lineHeight));
      textarea.scrollTop = targetScrollTop;
      if (gutterRef.current) {
        gutterRef.current.scrollTop = targetScrollTop;
      }
      highlight.scrollTop = targetScrollTop;
      highlight.scrollLeft = textarea.scrollLeft;

      setActiveLine(line);
      if (clearHighlightTimeoutRef.current !== null) {
        window.clearTimeout(clearHighlightTimeoutRef.current);
      }
      clearHighlightTimeoutRef.current = window.setTimeout(() => {
        setActiveLine((current) => current === line ? null : current);
      }, highlightDurationMs);
    }
  }), [value]);

  return (
    <div className="code-editor">
      <label className="sr-only" htmlFor={editorId}>{label}</label>
      <div ref={gutterRef} className="code-gutter" aria-hidden="true">
        <div dangerouslySetInnerHTML={{ __html: lineNumbers }} />
      </div>
      <pre ref={highlightRef} className="code-highlight" aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
      <textarea
        id={editorId}
        ref={textareaRef}
        aria-label={label}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutterRef.current) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }
          if (!highlightRef.current) return;
          highlightRef.current.scrollTop = event.currentTarget.scrollTop;
          highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      />
    </div>
  );
});

function highlightNginx(input: string, activeLine: number | null) {
  return input.split("\n").map((line, index) => {
    const commentIndex = line.indexOf("#");
    const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";
    const highlightedLine = `${highlightCode(code)}${comment ? `<span class="tok-comment">${escapeHtml(comment)}</span>` : ""}`;
    const lineNumber = index + 1;
    const activeClass = lineNumber === activeLine ? " code-line-active" : "";
    return `<span class="code-line${activeClass}" data-line="${lineNumber}">${highlightedLine || "&nbsp;"}</span>`;
  }).join("");
}

function buildLineNumbers(input: string, activeLine: number | null) {
  return input.split("\n").map((_, index) => {
    const lineNumber = index + 1;
    const activeClass = lineNumber === activeLine ? " code-gutter-line-active" : "";
    return `<span class="code-gutter-line${activeClass}" data-line="${lineNumber}">${lineNumber}</span>`;
  }).join("");
}

function highlightCode(input: string) {
  const tokenPattern = /(https?:\/\/[^\s;{}]+|grpc:\/\/[^\s;{}]+|unix:[^\s;{}]+|\$[a-zA-Z0-9_]+|\b[a-zA-Z_][\w]*\b|[{};])/g;
  let result = "";
  let cursor = 0;
  for (const match of input.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index || 0;
    result += escapeHtml(input.slice(cursor, index));
    result += renderToken(token);
    cursor = index + token.length;
  }
  result += escapeHtml(input.slice(cursor));
  return result;
}

function renderToken(token: string) {
  if (token.startsWith("$")) return `<span class="tok-variable">${escapeHtml(token)}</span>`;
  if (/^(https?:\/\/|grpc:\/\/|unix:)/.test(token)) return `<span class="tok-target">${escapeHtml(token)}</span>`;
  if (/^[{};]$/.test(token)) return `<span class="tok-punct">${escapeHtml(token)}</span>`;
  if (blockKeywords.has(token)) return `<span class="tok-block">${escapeHtml(token)}</span>`;
  if (directiveKeywords.has(token)) return `<span class="tok-directive">${escapeHtml(token)}</span>`;
  return escapeHtml(token);
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getLineOffsets(value: string, line: number) {
  if (line < 1) return null;
  const lines = value.split("\n");
  if (line > lines.length) return null;

  let start = 0;
  for (let index = 1; index < line; index += 1) {
    start += lines[index - 1].length + 1;
  }

  return {
    start,
    end: start + lines[line - 1].length
  };
}

function resolveLineHeight(style: CSSStyleDeclaration, parsedLineHeight: number) {
  if (Number.isFinite(parsedLineHeight) && String(style.lineHeight).endsWith("px")) {
    return parsedLineHeight;
  }

  const fontSize = Number.parseFloat(style.fontSize);
  if (Number.isFinite(parsedLineHeight) && Number.isFinite(fontSize)) {
    return parsedLineHeight * fontSize;
  }

  return fallbackLineHeight;
}
