// A provider-neutral chat request produced by the prompt builders. Sampling settings travel with the
// prompt text because they are part of what a prompt version means.

export type PromptRole = 'system' | 'user' | 'assistant';

export interface PromptMessage {
  role: PromptRole;
  content: string;
}

export interface PromptRequest {
  messages: PromptMessage[];
  temperature: number;
  /** Budget for the visible reply. The HTTP layer may add headroom for models that reason first. */
  maxTokens: number;
  /** Ask the provider for a single JSON object. */
  json: boolean;
}
