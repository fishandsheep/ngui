import { tokenize } from "./tokenizer";
import type { NginxBlock, NginxDirective, NginxNode, ParseError, ParseResult, Token } from "./types";

let nextId = 0;

const makeId = (prefix: string) => `${prefix}-${nextId++}`;

const rawFrom = (name: string, args: string[], block: boolean) => `${name}${args.length ? ` ${args.join(" ")}` : ""}${block ? " { ... }" : ";"}`;

export function parseNginxConfig(input: string): ParseResult {
  nextId = 0;
  const tokenized = tokenize(input);
  const errors: ParseError[] = [...tokenized.errors];
  const root: NginxBlock = {
    id: "root",
    name: "root",
    args: [],
    children: [],
    loc: { line: 1, column: 1 },
    raw: "root"
  };
  const stack: NginxBlock[] = [root];
  let i = 0;

  while (i < tokenized.tokens.length) {
    const token = tokenized.tokens[i];
    if (token.type === "braceClose") {
      if (stack.length === 1) {
        errors.push({ message: "Unexpected closing brace", loc: token.loc });
      } else {
        stack.pop();
      }
      i += 1;
      continue;
    }

    if (token.type !== "word") {
      errors.push({ message: `Unexpected token "${token.value}"`, loc: token.loc });
      i += 1;
      continue;
    }

    const statement = readStatement(tokenized.tokens, i);
    if (!statement.nextIndex) {
      errors.push({ message: `Directive "${token.value}" is missing ";" or "{"`, loc: token.loc });
      break;
    }

    const node = buildNode(statement.words, statement.terminator, token);
    stack[stack.length - 1].children.push(node);
    i = statement.nextIndex;

    if (statement.terminator.type === "braceOpen") {
      stack.push(node as NginxBlock);
    }
  }

  while (stack.length > 1) {
    const open = stack.pop();
    if (open) errors.push({ message: `Unclosed block "${open.name}"`, loc: open.loc });
  }

  return { ast: root, errors };
}

function readStatement(tokens: Token[], start: number) {
  const words: string[] = [];
  let i = start;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "word") {
      words.push(token.value);
      i += 1;
      continue;
    }
    if (token.type === "semicolon" || token.type === "braceOpen") {
      return { words, terminator: token, nextIndex: i + 1 };
    }
    return { words, terminator: token, nextIndex: i };
  }

  return { words, terminator: tokens[tokens.length - 1], nextIndex: 0 };
}

function buildNode(words: string[], terminator: Token, token: Token): NginxNode {
  const [name = "", ...args] = words;
  const base: NginxDirective = {
    id: makeId(name || "directive"),
    name,
    args,
    loc: token.loc,
    raw: rawFrom(name, args, terminator.type === "braceOpen")
  };

  if (terminator.type === "braceOpen") {
    return { ...base, children: [] };
  }
  return base;
}

export function isBlock(node: NginxNode): node is NginxBlock {
  return "children" in node;
}
