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
import type { PromptRequest } from '../prompts/types.ts';
import {
  blockingProblems,
  guardsFor,
  judgeReply,
  repairReply,
  type GuardProblem,
} from './guards.ts';
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
} from './output.ts';
import type { ClassifyArgs, ModelProvider, PromptVersions } from './types.ts';

// Live mode: a chat model behind Azure OpenAI, an OpenAI-compatible endpoint or the Gemini API. It
// supplies the three judgement calls (classify a trainee turn, write the customer's reply, draft the
// coaching) and nothing else. Every output is validated before it is used, and every failure is a
// ProviderError.

export const LIVE_PROMPTS: PromptVersions = {
  customer: CUSTOMER_PROMPT_VERSION,
  classifier: CLASSIFIER_PROMPT_VERSION,
  evaluator: EVALUATOR_PROMPT_VERSION,
};

function labelFor(config: LiveConfig): string {
  if (config.kind === 'azure-openai') return `Azure OpenAI (deployment "${config.deployment}")`;
  if (config.kind === 'gemini') return `Gemini (model "${config.model}")`;
  return `OpenAI-compatible (model "${config.model}")`;
}

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
// The customer's reply: one retry with a reminder, then keep what can be said safely

function speakerNames(ctx: CustomerGenerationContext): string[] {
  const full = ctx.scenario.persona.name;
  return [full, full.split(' ')[0] ?? '', 'Customer'].filter(Boolean);
}

// The retry carries a generic reminder only: it never repeats the bad reply or what leaked.
function reminderFor(problems: readonly GuardProblem[]): string {
  const has = (...codes: GuardProblem[]) => codes.some((code) => problems.includes(code));
  if (has('leaks')) return CUSTOMER_REMINDERS.facts;
  if (has('invents')) return CUSTOMER_REMINDERS.unknown;
  if (has('coaching', 'announces-facts', 'praise')) return CUSTOMER_REMINDERS.coaching;
  if (has('repeats-previous')) return CUSTOMER_REMINDERS.repeat;
  if (has('assistant-speak', 'repeats-name', 'recaps', 'robotic-ack')) {
    return CUSTOMER_REMINDERS.style;
  }
  return CUSTOMER_REMINDERS.reply;
}

async function customerReply(
  chat: ChatClient,
  ctx: CustomerGenerationContext,
  signal?: AbortSignal,
): Promise<CustomerGeneration> {
  const guards = guardsFor(ctx);
  const turnedDown: { text: string; problems: GuardProblem[] }[] = [];
  const codes: string[] = [];
  let reminder: string | undefined;
  let bookkeeping: CustomerGeneration['bookkeeping'];
  for (const attempt of [0, 1] as const) {
    const prompt = buildCustomerPrompt(ctx, reminder ? { reminder } : {});
    bookkeeping = { timelineAsked: prompt.timelineAsked, followUpGiven: prompt.followUpGiven };
    const completion = await chat.complete(prompt.request, signal);
    const text = cleanCustomerText(completion.content, {
      finishReason: completion.finishReason,
      speakerNames: speakerNames(ctx),
    });
    // The pipeline conforms every reply again; the checks only decide whether this one is worth keeping.
    const verdict = judgeReply(text, guards);
    if (blockingProblems(verdict, attempt).length === 0) {
      return { text, source: 'live', bookkeeping };
    }
    turnedDown.push({ text, problems: verdict.problems });
    codes.push(...verdict.problems.map((problem) => `${attempt + 1}:${problem}`));
    reminder = reminderFor(verdict.problems);
  }
  // Neither reply was usable as it stood. Whatever of the latest can be said safely is kept
  // rather than failing the same call forever; only a reply with nothing safe in it fails.
  for (const { text, problems } of [...turnedDown].reverse()) {
    const repaired = repairReply(text, guards);
    if (repaired !== null)
      return { text: repaired, source: 'live', bookkeeping, repaired: problems };
  }
  throw badOutput([...codes, 'repair:none']);
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
