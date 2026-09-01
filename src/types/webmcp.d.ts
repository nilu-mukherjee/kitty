export {};

declare global {
  interface ModelContextToolDefinition<TInput = unknown, TOutput = unknown> {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (input: TInput) => Promise<TOutput> | TOutput;
  }

  interface ModelContext {
    registerTool: <TInput, TOutput>(tool: ModelContextToolDefinition<TInput, TOutput>) => unknown;
  }

  interface Document {
    modelContext?: ModelContext;
  }
}
