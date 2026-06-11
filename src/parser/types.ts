export type TokenType = "word" | "braceOpen" | "braceClose" | "semicolon";

export interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}

export interface Token {
  type: TokenType;
  value: string;
  loc: SourceLocation;
}

export interface NginxDirective {
  id: string;
  name: string;
  args: string[];
  loc: SourceLocation;
  raw: string;
}

export interface NginxBlock extends NginxDirective {
  children: NginxNode[];
}

export type NginxNode = NginxDirective | NginxBlock;

export interface ParseError {
  message: string;
  loc: SourceLocation;
}

export type IssueSeverity = "error" | "warning" | "info";

export interface ConfigIssue {
  id: string;
  severity: IssueSeverity;
  category: string;
  messageKey: string;
  params?: Record<string, string | number>;
  loc: SourceLocation;
  suggestionKey?: string;
  source: "parse" | "check";
}

export interface ParseResult {
  ast: NginxBlock;
  errors: ParseError[];
}

export type TopologyNodeType =
  | "entry"
  | "server"
  | "route"
  | "upstream"
  | "target"
  | "variable";

export interface TopologyNode {
  id: string;
  type: TopologyNodeType;
  label: string;
  subtitle?: string;
  source?: SourceLocation;
  raw?: string;
  confidence?: "high" | "medium" | "low";
  details: string[];
}

export type TopologyEdgeType = "flow" | "rewrite" | "map" | "dynamic";

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: TopologyEdgeType;
  label?: string;
  sourceRaw?: string;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  issues: ConfigIssue[];
}
