import { useId, useMemo, useRef } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
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

export function CodeEditor({ value, onChange, label = "Nginx configuration" }: CodeEditorProps) {
  const editorId = useId();
  const highlightRef = useRef<HTMLPreElement>(null);
  const highlighted = useMemo(() => highlightNginx(value), [value]);

  return (
    <div className="code-editor">
      <label className="sr-only" htmlFor={editorId}>{label}</label>
      <pre ref={highlightRef} className="code-highlight" aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
      <textarea
        id={editorId}
        aria-label={label}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (!highlightRef.current) return;
          highlightRef.current.scrollTop = event.currentTarget.scrollTop;
          highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      />
    </div>
  );
}

function highlightNginx(input: string) {
  return input.split("\n").map((line) => {
    const commentIndex = line.indexOf("#");
    const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";
    return `${highlightCode(code)}${comment ? `<span class="tok-comment">${escapeHtml(comment)}</span>` : ""}`;
  }).join("\n");
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
