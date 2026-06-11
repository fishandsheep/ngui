import type { ParseError, Token } from "./types";

const FILE_MARKER = /^#\s*configuration file\s+(.+?):\s*$/;

export function tokenize(input: string): { tokens: Token[]; errors: ParseError[] } {
  const tokens: Token[] = [];
  const errors: ParseError[] = [];
  let line = 1;
  let column = 1;
  let index = 0;
  let file: string | undefined;

  const push = (type: Token["type"], value: string, startLine = line, startColumn = column) => {
    tokens.push({ type, value, loc: { line: startLine, column: startColumn, file } });
  };

  const advance = (char: string) => {
    index += 1;
    if (char === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  };

  while (index < input.length) {
    const char = input[index];

    if (char === "#") {
      const start = index;
      while (index < input.length && input[index] !== "\n") advance(input[index]);
      const comment = input.slice(start, index);
      const marker = comment.match(FILE_MARKER);
      if (marker) file = marker[1];
      continue;
    }

    if (/\s/.test(char)) {
      advance(char);
      continue;
    }

    if (char === "{") {
      push("braceOpen", char);
      advance(char);
      continue;
    }

    if (char === "}") {
      push("braceClose", char);
      advance(char);
      continue;
    }

    if (char === ";") {
      push("semicolon", char);
      advance(char);
      continue;
    }

    const startLine = line;
    const startColumn = column;
    let value = "";
    let quote: string | null = null;

    while (index < input.length) {
      const current = input[index];
      if (quote) {
        if (current === "\\" && index + 1 < input.length) {
          value += current;
          advance(current);
          value += input[index];
          advance(input[index]);
          continue;
        }
        if (current === quote) {
          advance(current);
          quote = null;
          continue;
        }
        value += current;
        advance(current);
        continue;
      }

      if (current === "'" || current === '"') {
        quote = current;
        advance(current);
        continue;
      }

      if (/\s/.test(current) || current === "{" || current === "}" || current === ";" || current === "#") {
        break;
      }

      value += current;
      advance(current);
    }

    if (quote) {
      errors.push({ message: `Unclosed ${quote} quote`, loc: { line: startLine, column: startColumn, file } });
    }
    if (value) push("word", value, startLine, startColumn);
  }

  return { tokens, errors };
}
