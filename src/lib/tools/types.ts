// Provider-neutral tool (function-calling) definitions. Pure types — safe to
// import anywhere.

export type ToolParamType = "string" | "number" | "boolean";

export interface ToolParameter {
  type: ToolParamType;
  description: string;
  enum?: string[];
}

export interface ToolSchema {
  type: "object";
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: ToolSchema;
  /**
   * Keyword triggers used ONLY by the mock provider to simulate tool calls
   * without a real model. Real providers ignore this field.
   */
  triggers?: string[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
