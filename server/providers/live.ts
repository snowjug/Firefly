import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EvaluationDraft } from '#shared/domain/report.ts';
import type { CustomerGeneration, CustomerGenerationContext } from '../engine/pipeline.ts';
import type { EvaluationInput } from '../engine/types.ts';
import { buildClassifierPrompt, CLASSIFIER_PROMPT_VERSION } from '../prompts/classifier.ts';
import {
  buildCustomerPrompt,
  CUSTOMER_PROMPT_VERSION,
  CUSTOMER_REMINDERS,
} from '../prompts/customer.ts';
import { buildEvaluatorPrompt, EVALUATOR_PROMPT_VERSION } from '../prompts/evaluator.ts';
import { factPolicy } from '../prompts/facts.ts';
import type { PromptRequest } from '../prompts/types.ts';
import {
  badOutput,
  createChatClient,
  type ChatClient,
  type ChatClientOptions,
  type ChatCompletion,
  type LiveConfig,
} from './http.ts';
import {
  cleanCustomerText,
  OutputProblem,
  parseClassification,
  parseEvaluationDraft,
  replyProblem,
} from './output.ts';
import type { ClassifyArgs, ModelProvider, PromptVersions } from './types.ts';

// Live mode: a chat model behind Azure OpenAI or an OpenAI-compatible endpoint. It supplies the three
// judgement calls (classify a trainee turn, write the customer's reply, draft the coaching) and
// nothing else. Every output is validated before it is used, and every failure is a ProviderError.

export const LIVE_PROMPTS: PromptVersions = {
  customer: CUSTOMER_PROMPT_VERSION,
  classifier: CLASSIFIER_PROMPT_VERSION,
  evaluator: EVALUATOR_PROMPT_VERSION,
};

const labelFor = (config: LiveConfig): string =>
  config.kind === 'azure-openai'
    ? `Azure OpenAI (deployment "${config.deployment}")`
    : `OpenAI-compatible (model "${config.model}")`;

// ---------------------------------------------------------------------------------------
// JSON answers (classifier and evaluator): one repair attempt, then give up

function repairRequest(
  request: PromptRequest,
  previous: ChatCompletion,
  problem: string,
): PromptRequest {
  const note =
    previous.finishReason === 'length'
      ? 'Your previous reply was cut off before the JSON object was complete. Reply again with the complete JSON object only, and keep every string short.'
      : `Your previous reply could not be used: ${problem} Reply again with only the corrected JSON object, in exactly the shape described in the system message.`;
  return {
    ...request,
    messages: [
      ...request.messages,
      {
        role: 'assistant',
        content: previous.content.trim() === '' ? '(no reply)' : previous.content.slice(0, 20_000),
      },
      { role: 'user', content: note },
    ],
  };
}

async function completeJson<T>(
  chat: ChatClient,
  request: PromptRequest,
  parse: (content: string) => T,
  signal?: AbortSignal,
): Promise<T> {
  const first = await chat.complete(request, signal);
  try {
    return parse(first.content);
  } catch (error) {
    if (!(error instanceof OutputProblem)) throw error;
    const second = await chat.complete(repairRequest(request, first, error.message), signal);
    try {
      return parse(second.content);
    } catch (again) {
      if (again instanceof OutputProblem) throw badOutput();
      throw again;
    }
  }
}

// ---------------------------------------------------------------------------------------
// The customer's reply: one retry with a reminder, then give up

function speakerNames(ctx: CustomerGenerationContext): string[] {
  const full = ctx.scenario.persona.name;
  return [full, full.split(' ')[0] ?? '', 'Customer'].filter(Boolean);
}

async function customerReply(
  chat: ChatClient,
  ctx: CustomerGenerationContext,
  signal?: AbortSignal,
): Promise<CustomerGeneration> {
  const policy = factPolicy(ctx);
  let reminder: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildCustomerPrompt(ctx, reminder ? { reminder } : {});
    const completion = await chat.complete(prompt.request, signal);
    const text = cleanCustomerText(completion.content, {
      finishReason: completion.finishReason,
      speakerNames: speakerNames(ctx),
    });
    const problem = replyProblem(text);
    const leaked = problem === null && policy.leaks(text);
    if (problem === null && !leaked) {
      return {
        text,
        source: 'live',
        bookkeeping: { timelineAsked: prompt.timelineAsked, followUpGiven: prompt.followUpGiven },
      };
    }
    // The retry carries a generic reminder only: it never repeats the bad reply or what leaked.
    reminder = leaked ? CUSTOMER_REMINDERS.facts : CUSTOMER_REMINDERS.reply;
  }
  throw badOutput();
}

// ---------------------------------------------------------------------------------------

export function createLiveProvider(
  config: LiveConfig,
  options: ChatClientOptions = {},
): ModelProvider {
  const chat = createChatClient(config, options);
  return {
    kind: config.kind,
    label: labelFor(config),
    demo: false,
    prompts: LIVE_PROMPTS,
    classifyTurn(args: ClassifyArgs, signal?: AbortSignal): Promise<TurnClassification> {
      const prompt = buildClassifierPrompt(args);
      return completeJson(chat, prompt.request, (c) => parseClassification(c, prompt), signal);
    },
    generateCustomer(ctx, signal) {
      return customerReply(chat, ctx, signal);
    },
    evaluateDraft(input: EvaluationInput, signal?: AbortSignal): Promise<EvaluationDraft> {
      return completeJson(chat, buildEvaluatorPrompt(input), parseEvaluationDraft, signal);
    },
  };
}
