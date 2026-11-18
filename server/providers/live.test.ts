import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { emptyClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import {
  CoachingReportSchema,
  EvaluationDraftSchema,
  type EvaluationDraft,
} from '#shared/domain/report.ts';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import type { CustomerGenerationContext } from '../engine/pipeline.ts';
import { processTraineeTurn } from '../engine/pipeline.ts';
import { createInitialRuntime, openingMessage } from '../engine/session.ts';
import { simulate } from '../engine/simulate.ts';
import { makeScenario } from '../engine/testing.ts';
import type { EvaluationInput, TranscriptTurn } from '../engine/types.ts';
import { mergeModelDraft } from '../evaluator/merge.ts';
import { CUSTOMER_REMINDERS } from '../prompts/customer.ts';
import { captureContexts } from '../prompts/testing.ts';
import { startFakeLlm, type FakeLlm, type RecordedRequest, type Step } from './fake-llm-server.ts';
import { createLiveProvider } from './live.ts';
import { createProvider, createProviderFromEnv } from './index.ts';
import { ProviderError, type ModelProvider } from './types.ts';

const KEY = 'sk-test-SECRET-KEY-77b2e0';
const MARKER = 'purple walrus invoice';

let llm: FakeLlm;
beforeAll(async () => {
  llm = await startFakeLlm();
});
afterEach(() => llm.reset());
afterAll(() => llm.close());

const instant = () => Promise.resolve();

function provider(): ModelProvider {
  return createLiveProvider(
    {
      kind: 'openai-compatible',
      baseUrl: llm.baseUrl,
      apiKey: KEY,
      model: 'test-model',
      timeoutMs: 2000,
      maxRetries: 0,
    },
    { sleep: instant },
  );
}

const systemOf = (request: RecordedRequest): string => request.body?.messages[0]?.content ?? '';
const messagesOf = (request: RecordedRequest) => request.body?.messages ?? [];

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to fail');
}

async function providerErrorOf(promise: Promise<unknown>): Promise<ProviderError> {
  const error = await failureOf(promise);
  expect(error).toBeInstanceOf(ProviderError);
  return error as ProviderError;
}

const scenario = makeScenario({ startingTemperature: 'frustrated', style: 'talkative' });

const classificationJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ ...emptyClassification(), ...overrides });

const classifyArgs = (traineeText: string) => ({
  scenario,
  traineeText,
  traineeTurnNumber: 2,
  lastCustomerText: 'It stopped letting me in.',
});

// ---------------------------------------------------------------------------------------

describe('the live provider', () => {
  it('labels Azure OpenAI and OpenAI-compatible providers without endpoints or keys', () => {
    const azure = createLiveProvider({
      kind: 'azure-openai',
      endpoint: 'https://secret-resource.openai.azure.com',
      apiKey: KEY,
      deployment: 'support-gpt',
      apiVersion: '2024-10-21',
      timeoutMs: 1000,
      maxRetries: 0,
    });
    expect(azure).toMatchObject({
      kind: 'azure-openai',
      label: 'Azure OpenAI (deployment "support-gpt")',
      demo: false,
      prompts: { customer: 'customer-1', classifier: 'classifier-1', evaluator: 'evaluator-1' },
    });
    const compatible = provider();
    expect(compatible).toMatchObject({
      kind: 'openai-compatible',
      label: 'OpenAI-compatible (model "test-model")',
      demo: false,
    });
    for (const label of [azure.label, compatible.label]) {
      expect(label).not.toContain(KEY);
      expect(label).not.toMatch(/https?:|127\.0\.0\.1|secret-resource/);
    }
    expect(typeof azure.evaluateDraft).toBe('function');
  });

  it('is built from configuration: demo mode for mock, live otherwise', () => {
    expect(
      createProvider({ config: { kind: 'mock', mockDelayMs: 0 }, problem: null }),
    ).toMatchObject({
      kind: 'mock',
      demo: true,
    });
    const live = createProvider({
      config: {
        kind: 'openai-compatible',
        baseUrl: 'http://localhost:1/v1',
        apiKey: KEY,
        model: 'm',
        timeoutMs: 1000,
        maxRetries: 1,
      },
      problem: null,
    });
    expect(live).toMatchObject({ kind: 'openai-compatible', demo: false });
  });

  it('falls back to demo mode, with a reason that never contains the key, when setup is incomplete', () => {
    const { provider: fallback, problem } = createProviderFromEnv({
      FIREFLY_PROVIDER: 'azure-openai',
      AZURE_OPENAI_API_KEY: KEY,
    });
    expect(fallback.kind).toBe('mock');
    expect(problem).toMatch(/AZURE_OPENAI_ENDPOINT/);
    expect(problem).not.toContain(KEY);
    expect(createProviderFromEnv({}).problem).toBeNull();
    const configured = createProviderFromEnv({
      FIREFLY_PROVIDER: 'openai-compatible',
      FIREFLY_LLM_BASE_URL: 'http://localhost:1/v1',
      FIREFLY_LLM_API_KEY: KEY,
      FIREFLY_LLM_MODEL: 'm',
    });
    expect(configured.provider.kind).toBe('openai-compatible');
    expect(configured.problem).toBeNull();
  });
});

describe('classifyTurn', () => {
  it('asks for a JSON object at temperature zero and returns the classification', async () => {
    llm.enqueue({
      reply: classificationJson({
        askedQuestion: true,
        introduces: true,
        discoveryIntents: ['error_message'],
        factTargets: [{ id: 't2', strength: 'full' }],
        evidence: [{ behaviour: 'greeting', quote: 'Hi, I am Sam.' }],
        confidence: 0.9,
      }),
    });
    const result = await provider().classifyTurn(
      classifyArgs('Hi, I am Sam. Can you read me what the screen says?'),
    );

    expect(result).toMatchObject({
      askedQuestion: true,
      introduces: true,
      discoveryIntents: ['error_message'],
      factTargets: [{ id: 'hf-lockout-message', strength: 'full' }],
      evidence: [{ behaviour: 'greeting', quote: 'Hi, I am Sam.' }],
      confidence: 0.9,
    });
    const sent = llm.requests[0]?.body;
    expect(sent?.temperature).toBe(0);
    expect(sent?.response_format).toEqual({ type: 'json_object' });
    const payload = JSON.parse(messagesOf(llm.requests[0] as RecordedRequest)[1]?.content ?? '{}');
    expect(payload.engineerMessage).toBe('Hi, I am Sam. Can you read me what the screen says?');
    expect(payload.lastCustomerMessage).toBe('It stopped letting me in.');
  });

  it('finds the JSON inside a code fence and surrounding prose', async () => {
    llm.enqueue({
      reply: `Sure, here is the analysis:\n\`\`\`json\n${classificationJson({ empathy: 'generic' })}\n\`\`\`\nLet me know if you need more.`,
    });
    expect((await provider().classifyTurn(classifyArgs('I am sorry to hear that.'))).empathy).toBe(
      'generic',
    );
  });

  it('normalises what a model gets slightly wrong', async () => {
    const text = 'Hi, I am Sam. Can you read me what the screen says? I understand this is hard.';
    llm.enqueue({
      reply: JSON.stringify({
        ...emptyClassification(),
        askedQuestion: 'true',
        introduces: 'Yes',
        empathy: ' Specific ',
        discoveryIntents: ['error_message', 'made_up_topic', 'Timing Onset', 'error_message'],
        factTargets: [
          { id: 'T2', strength: 'FULL' },
          { id: 't2', strength: 'partial' },
          { id: 't1', strength: 'partial' },
          { id: 't9', strength: 'full' },
          { id: 'hf-phone-old-password', strength: 'full' },
        ],
        confidence: '1.7',
        evidence: [
          { behaviour: 'greeting', quote: 'Hi, I am Sam.' },
          { behaviour: 'Empathy_Specific', quote: 'I understand this is hard.' },
          { behaviour: 'greeting', quote: 'Good morning, this is Sam speaking' },
          { behaviour: 'not-a-behaviour', quote: 'Hi, I am Sam.' },
          { behaviour: 'discovery-question', quote: '' },
        ],
      }),
    });
    const result = await provider().classifyTurn(classifyArgs(text));

    expect(result.askedQuestion).toBe(true);
    expect(result.introduces).toBe(true);
    expect(result.empathy).toBe('specific');
    expect(result.discoveryIntents).toEqual(['error_message', 'timing_onset']);
    // Aliases map back to fact ids; the strongest strength wins; unknown names and real ids are dropped;
    // "partial" is dropped for a fact that has no partial statement.
    expect(result.factTargets).toEqual([{ id: 'hf-lockout-message', strength: 'full' }]);
    expect(result.confidence).toBe(1);
    expect(result.evidence).toEqual([
      { behaviour: 'greeting', quote: 'Hi, I am Sam.' },
      { behaviour: 'empathy-specific', quote: 'I understand this is hard.' },
    ]);
  });

  it('keeps a partial target only for a fact that allows partial discovery', async () => {
    llm.enqueue({
      reply: classificationJson({
        askedQuestion: true,
        factTargets: [
          { id: 't2', strength: 'partial' },
          { id: 't1', strength: 'partial' },
        ],
      }),
    });
    const result = await provider().classifyTurn(classifyArgs("What's going on?"));
    expect(result.factTargets).toEqual([{ id: 'hf-lockout-message', strength: 'partial' }]);
  });

  it('never sends fact ids, labels, statements or hints to the model', async () => {
    llm.enqueue({ reply: classificationJson() });
    await provider().classifyTurn(classifyArgs('Hello'));
    const sent = llm.requests[0]?.text ?? '';
    for (const fact of scenario.hiddenFacts) {
      for (const secret of [
        fact.id,
        fact.label,
        fact.statement,
        fact.partialStatement,
        fact.statementTerse,
        fact.statementSimple,
        fact.hint,
        fact.betterQuestion,
        fact.missedConsequence,
      ]) {
        if (secret) expect(sent).not.toContain(secret);
      }
      expect(sent).toContain(JSON.stringify(fact.revealWhen).slice(1, -1));
    }
  });

  it('removes sensitive details from the message before it reaches the model', async () => {
    llm.enqueue({ reply: classificationJson() });
    await provider().classifyTurn(classifyArgs('Please email me at sam.example@contoso.example'));
    expect(llm.requests[0]?.text).not.toContain('sam.example@contoso.example');
  });

  it('repairs a malformed reply once, naming the problem and nothing else', async () => {
    llm.enqueue(
      { reply: classificationJson({ empathy: 'extreme', ownership: 'maybe' }) },
      { reply: classificationJson({ empathy: 'generic' }) },
    );
    const result = await provider().classifyTurn(classifyArgs(`I am sorry. ${MARKER}`));
    expect(result.empathy).toBe('generic');
    expect(llm.requests).toHaveLength(2);

    const repair = messagesOf(llm.requests[1] as RecordedRequest);
    expect(repair.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(repair[2]?.content).toContain('"extreme"');
    expect(repair[3]?.content).toMatch(/empathy/);
    expect(repair[3]?.content).toMatch(/ownership/);
    expect(repair[3]?.content).not.toContain('extreme');
    expect(repair[3]?.content).not.toContain(KEY);
  });

  it('repairs a reply that is not JSON at all', async () => {
    llm.enqueue({ reply: 'I think the engineer was polite.' }, { reply: classificationJson() });
    await provider().classifyTurn(classifyArgs('Hello'));
    expect(messagesOf(llm.requests[1] as RecordedRequest).at(-1)?.content).toMatch(/JSON/);
  });

  it('asks for a shorter reply when the first one was cut off', async () => {
    llm.enqueue(
      { reply: '{"askedQuestion": true, "discoveryIntents": [', finishReason: 'length' },
      { reply: classificationJson() },
    );
    await provider().classifyTurn(classifyArgs('Hello'));
    expect(messagesOf(llm.requests[1] as RecordedRequest).at(-1)?.content).toMatch(/cut off/);
  });

  it('gives up after one repair with a safe provider_bad_output error', async () => {
    llm.respondWith(() => ({ reply: `not json ${MARKER} ${KEY}` }));
    const error = await providerErrorOf(provider().classifyTurn(classifyArgs(MARKER)));
    expect(error.code).toBe('provider_bad_output');
    expect(error.retryable).toBe(true);
    expect(llm.requests).toHaveLength(2);
    expect(`${error.message} ${String(error.cause ?? '')}`).not.toContain(MARKER);
    expect(error.message).not.toContain(KEY);
  });

  it('does not use the repair attempt for transport failures', async () => {
    llm.respondWith(() => ({ status: 500, json: {} }));
    const error = await providerErrorOf(provider().classifyTurn(classifyArgs('Hello')));
    expect(error.code).toBe('provider_unavailable');
    expect(llm.requests).toHaveLength(1);
  });

  it('rejects with an AbortError when cancelled', async () => {
    llm.respondWith(() => ({ reply: classificationJson(), delayMs: 1000 }));
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const error = await failureOf(
      provider().classifyTurn(classifyArgs('Hello'), controller.signal),
    );
    expect((error as Error).name).toBe('AbortError');
  });
});

// ---------------------------------------------------------------------------------------

const DRAFT_QUOTE = 'Hi, I am Sam.';

function validDraft(): EvaluationDraft {
  return {
    summary: 'Sam found the lockout message and the phone quickly and closed with a clear time.',
    dimensions: DIMENSION_IDS.map((id) => ({
      id,
      score: 3,
      rationale: 'Some of this was shown.',
      evidence: [{ turnIndex: 2, quote: DRAFT_QUOTE }],
      sufficiency: 'sufficient' as const,
      guidance: 'Try one more open question.',
    })),
    strengths: [
      {
        dimension: 'scoping-discovery',
        turnIndex: 4,
        quote: 'Is your work email also signed in on your phone or tablet?',
        whyItHelped: 'It found the cause.',
      },
    ],
    improvements: [
      {
        dimension: 'closing',
        turnIndex: null,
        quote: null,
        risk: 'No recap was given.',
        betterPhrasing: 'Before we finish, let me recap.',
        whyItWorks: 'It confirms agreement.',
      },
    ],
    nextPractice: { dimension: 'closing', recommendation: 'Practise closing with a recap.' },
  };
}

async function evaluationInput(): Promise<EvaluationInput> {
  const sim = await simulate(scenario, [
    'Hi, I am Sam. Can you read me exactly what the sign-in screen says?',
    'Is your work email also signed in on your phone or tablet?',
    "I'll arrange the unlock and call you back by 10am to confirm.",
  ]);
  return {
    scenario,
    turns: sim.transcript,
    classifications: {},
    stateEvents: sim.events,
    discovery: sim.runtime.discovery,
    startState: createInitialRuntime(scenario).customer,
    finalState: sim.runtime.customer,
    endedEarly: false,
    durationSeconds: 300,
    provider: { kind: 'openai-compatible', label: 'test' },
    library: [],
  };
}

describe('evaluateDraft', () => {
  it('returns a valid draft and sends the rubric, transcript and results at temperature 0.2', async () => {
    expect(EvaluationDraftSchema.safeParse(validDraft()).success).toBe(true);
    llm.enqueue({ reply: JSON.stringify(validDraft()) });
    const input = await evaluationInput();
    const draft = await provider().evaluateDraft?.(input);
    expect(draft).toEqual(validDraft());

    const sent = llm.requests[0] as RecordedRequest;
    expect(sent.body?.temperature).toBe(0.2);
    expect(sent.body?.response_format).toEqual({ type: 'json_object' });
    const payload = JSON.parse(messagesOf(sent)[1]?.content ?? '{}');
    expect(payload.transcript.map((t: { turn: number; role: string }) => [t.turn, t.role])).toEqual(
      [
        [1, 'customer'],
        [2, 'trainee'],
        [3, 'customer'],
        [4, 'trainee'],
        [5, 'customer'],
        [6, 'trainee'],
        [7, 'customer'],
      ],
    );
    // The call is over, so the evaluator may see what the customer held back.
    expect(payload.discovery.map((d: { label: string }) => d.label)).toContain(
      'Already tried several times, including a colleague',
    );
  });

  it('normalises scores, labels, lengths and unusable items', async () => {
    const messy = {
      summary: `  ${'A long summary. '.repeat(80)}  `,
      dimensions: [
        { ...validDraft().dimensions[0], id: 'Opening & Rapport', score: 7 },
        { ...validDraft().dimensions[1], id: 'scoping-discovery', score: '4' },
        { ...validDraft().dimensions[2], id: 'Empathy & De-escalation', score: 2.6 },
        {
          ...validDraft().dimensions[3],
          rationale: 'x'.repeat(900),
          evidence: Array.from({ length: 6 }, () => ({ turnIndex: '2', quote: DRAFT_QUOTE })),
        },
        { ...validDraft().dimensions[4], sufficiency: ' Limited ' },
        validDraft().dimensions[5],
        { ...validDraft().dimensions[0], id: 'invented-dimension' },
        validDraft().dimensions[1],
      ],
      strengths: [
        ...validDraft().strengths,
        { dimension: 'clarity', turnIndex: 0, quote: 'no usable turn', whyItHelped: 'x' },
        { dimension: 'nonsense', turnIndex: 2, quote: DRAFT_QUOTE, whyItHelped: 'x' },
      ],
      improvements: [
        {
          dimension: 'clarity',
          turnIndex: null,
          quote: 'a quote with no turn to check',
          risk: 'r',
          betterPhrasing: 'b',
          whyItWorks: 'w',
        },
      ],
      nextPractice: { dimension: 'Closing', recommendation: 'Practise closing.' },
    };
    llm.enqueue({ reply: JSON.stringify(messy) });
    const draft = await provider().evaluateDraft?.(await evaluationInput());

    expect(draft?.summary.length).toBeLessThanOrEqual(800);
    expect(draft?.dimensions.map((d) => d.id)).toEqual([...DIMENSION_IDS]);
    expect(draft?.dimensions.map((d) => d.score)).toEqual([5, 4, 3, 3, 3, 3]);
    expect(draft?.dimensions[3]?.rationale.length).toBeLessThanOrEqual(500);
    expect(draft?.dimensions[3]?.evidence).toHaveLength(4);
    expect(draft?.dimensions[3]?.evidence[0]).toEqual({ turnIndex: 2, quote: DRAFT_QUOTE });
    expect(draft?.dimensions[4]?.sufficiency).toBe('limited');
    expect(draft?.strengths).toHaveLength(1);
    expect(draft?.improvements[0]).toMatchObject({ turnIndex: null, quote: null });
    expect(draft?.nextPractice.dimension).toBe('closing');
    expect(EvaluationDraftSchema.safeParse(draft).success).toBe(true);
  });

  it('keeps quotes verbatim when they are too long, by cutting rather than rewording', async () => {
    const long = `${DRAFT_QUOTE} ${'word '.repeat(80)}`;
    const reply = validDraft();
    reply.dimensions[0] = { ...reply.dimensions[0]!, evidence: [{ turnIndex: 2, quote: long }] };
    llm.enqueue({ reply: JSON.stringify(reply) });
    const draft = await provider().evaluateDraft?.(await evaluationInput());
    const quote = draft?.dimensions[0]?.evidence[0]?.quote ?? '';
    expect(quote.length).toBeLessThanOrEqual(260);
    expect(long.startsWith(quote)).toBe(true);
  });

  it('repairs a draft with a missing dimension, naming it', async () => {
    const partial = validDraft();
    partial.dimensions = partial.dimensions.filter((d) => d.id !== 'closing');
    llm.enqueue({ reply: JSON.stringify(partial) }, { reply: JSON.stringify(validDraft()) });
    const draft = await provider().evaluateDraft?.(await evaluationInput());
    expect(draft?.dimensions).toHaveLength(6);
    expect(llm.requests).toHaveLength(2);
    expect(messagesOf(llm.requests[1] as RecordedRequest).at(-1)?.content).toContain('closing');
  });

  it('repairs a draft with no summary', async () => {
    llm.enqueue(
      { reply: JSON.stringify({ ...validDraft(), summary: '' }) },
      { reply: JSON.stringify(validDraft()) },
    );
    await provider().evaluateDraft?.(await evaluationInput());
    expect(messagesOf(llm.requests[1] as RecordedRequest).at(-1)?.content).toContain('summary');
  });

  it('fails with provider_bad_output when the repair is also unusable', async () => {
    llm.respondWith(() => ({ reply: `{"summary": "${MARKER}"}` }));
    const error = await providerErrorOf(
      provider().evaluateDraft?.(await evaluationInput()) as Promise<unknown>,
    );
    expect(error.code).toBe('provider_bad_output');
    expect(llm.requests).toHaveLength(2);
    expect(error.message).not.toContain(MARKER);
  });

  it('produces a draft that the evaluator merges into a valid report without warnings', async () => {
    llm.enqueue({ reply: JSON.stringify(validDraft()) });
    const input = await evaluationInput();
    const draft = (await provider().evaluateDraft?.(input)) as EvaluationDraft;
    const merged = mergeModelDraft(draft, input, {
      name: 'Firefly model evaluator',
      version: 'evaluator-1',
      providerLabel: 'test',
    });
    expect(merged.warnings).toEqual([]);
    expect(CoachingReportSchema.safeParse(merged.report).success).toBe(true);
    expect(merged.report.evaluator.kind).toBe('model');
    expect(merged.report.dimensions.map((d) => d.id)).toEqual([...DIMENSION_IDS]);
    expect(merged.report.strengths[0]?.quote).toBe(
      'Is your work email also signed in on your phone or tablet?',
    );
  });
});

// ---------------------------------------------------------------------------------------

const lastContext = async (lines: string[], using: EffectiveScenario = scenario) => {
  const contexts = await captureContexts(using, lines);
  return contexts.at(-1) as CustomerGenerationContext;
};

describe('generateCustomer', () => {
  it('sends one system message and then the conversation, ending with the trainee', async () => {
    llm.enqueue({ reply: 'It says my account is temporarily locked.' });
    const ctx = await lastContext([
      'Hi, I am Sam. Can you read me exactly what the sign-in screen says?',
    ]);
    const result = await provider().generateCustomer(ctx);
    expect(result.source).toBe('live');
    expect(result.text).toBe('It says my account is temporarily locked.');

    const sent = llm.requests[0] as RecordedRequest;
    expect(sent.body?.response_format).toBeUndefined();
    expect(sent.body?.temperature).toBeGreaterThan(0);
    expect(messagesOf(sent).map((m) => m.role)).toEqual(['system', 'assistant', 'user']);
    expect(messagesOf(sent)[1]?.content).toBe(openingMessage(scenario));
    expect(messagesOf(sent).at(-1)?.content).toMatch(/^Hi, I am Sam\./);
  });

  it.each([
    [
      'a speaker label and a leading action',
      'Maya Okafor: *sighs* It is slow today.',
      'It is slow today.',
    ],
    ['a bracketed action', '(sighs) It is slow today.', 'It is slow today.'],
    ['wrapping quotes', '"It is slow today."', 'It is slow today.'],
    ['bold markup', 'It is **really** slow today.', 'It is really slow today.'],
    [
      'a bulleted list',
      '- It is slow today.\n- I cannot sign in.',
      'It is slow today. I cannot sign in.',
    ],
    ['a link', 'It is [slow](http://example.test) today.', 'It is slow today.'],
    ['emphasis, keeping its word', "I *can't* sign in.", "I can't sign in."],
  ])('cleans %s from the reply', async (_name, raw, expected) => {
    llm.enqueue({ reply: raw });
    const ctx = await lastContext(['What laptop are you using?']);
    expect((await provider().generateCustomer(ctx)).text).toBe(expected);
  });

  it('ignores a reasoning preamble before the reply', async () => {
    llm.enqueue({
      reply: '<think>The engineer asked about the laptop. {not json}</think>It is my work laptop.',
    });
    const ctx = await lastContext(['What laptop are you using?']);
    expect((await provider().generateCustomer(ctx)).text).toBe('It is my work laptop.');
  });

  it('retries once with a stricter reminder when the reply breaks role', async () => {
    llm.enqueue(
      { reply: "As an AI language model, I can't pretend to be a customer." },
      { reply: 'It is my work laptop.' },
    );
    const ctx = await lastContext(['What laptop are you using?']);
    expect((await provider().generateCustomer(ctx)).text).toBe('It is my work laptop.');
    expect(llm.requests).toHaveLength(2);
    expect(systemOf(llm.requests[0] as RecordedRequest)).not.toContain(CUSTOMER_REMINDERS.reply);
    expect(systemOf(llm.requests[1] as RecordedRequest)).toContain(CUSTOMER_REMINDERS.reply);
    expect(llm.requests[1]?.text).not.toContain('language model');
  });

  it.each([
    ['mentions its instructions', 'I have been told in my instructions to say that.'],
    ['mentions the simulation', 'This simulation is going well.'],
    ['mentions a system prompt', 'The system prompt says I am Maya.'],
  ])('rejects a reply that %s', async (_name, bad) => {
    llm.enqueue({ reply: bad }, { reply: 'Okay.' });
    const ctx = await lastContext(['What laptop are you using?']);
    expect((await provider().generateCustomer(ctx)).text).toBe('Okay.');
  });

  it('retries an empty reply and an over-long reply', async () => {
    llm.enqueue({ reply: '   ' }, { reply: 'x'.repeat(901) }, { reply: 'Fine.' });
    const ctx = await lastContext(['What laptop are you using?']);
    // Two attempts only: the empty reply is retried, and the second bad reply is final.
    const error = await providerErrorOf(provider().generateCustomer(ctx));
    expect(error.code).toBe('provider_bad_output');
    expect(llm.requests).toHaveLength(2);

    llm.reset();
    llm.enqueue({ reply: 'y'.repeat(901) }, { reply: 'Fine.' });
    expect((await provider().generateCustomer(ctx)).text).toBe('Fine.');
  });

  it('fails with provider_bad_output, and a safe message, when the retry is also unusable', async () => {
    llm.respondWith(() => ({ reply: `As an AI I cannot. ${MARKER} ${KEY}` }));
    const ctx = await lastContext([`What laptop are you using? ${MARKER}`]);
    const error = await providerErrorOf(provider().generateCustomer(ctx));
    expect(error.code).toBe('provider_bad_output');
    expect(error.retryable).toBe(true);
    expect(llm.requests).toHaveLength(2);
    expect(error.message).not.toContain(MARKER);
    expect(error.message).not.toContain(KEY);
  });

  it('drops a sentence that was cut off by the length limit', async () => {
    llm.enqueue({ reply: 'I tried it. It did not work and then I', finishReason: 'length' });
    const ctx = await lastContext(['What have you tried?']);
    expect((await provider().generateCustomer(ctx)).text).toBe('I tried it.');
  });

  it('surfaces a content-filter block as provider_content_filtered without retrying', async () => {
    llm.respondWith(() => ({ reply: '', finishReason: 'content_filter' }));
    const ctx = await lastContext(['What laptop are you using?']);
    const error = await providerErrorOf(provider().generateCustomer(ctx));
    expect(error.code).toBe('provider_content_filtered');
    expect(error.retryable).toBe(false);
    expect(llm.requests).toHaveLength(1);
  });

  it('reports a requested timeline and follow-up so the pipeline does not repeat them', async () => {
    const urgent = makeScenario({ impact: 'high', startingTemperature: 'frustrated' });
    const ctx = await lastContext(
      ['What laptop are you using?', 'When did it start?', 'What does it say?'],
      urgent,
    );
    llm.enqueue({ reply: 'When will I hear back?' });
    const result = await provider().generateCustomer(ctx);
    expect(result.bookkeeping).toMatchObject({ timelineAsked: true, followUpGiven: false });
    expect(systemOf(llm.requests[0] as RecordedRequest)).toMatch(/getting late in the call/);
  });
});

// ---------------------------------------------------------------------------------------
// The critical fact policy: facts the trainee has not earned never reach the model.

const factTexts = (fact: EffectiveScenario['hiddenFacts'][number]): string[] =>
  [
    fact.statement,
    fact.partialStatement,
    fact.statementTerse,
    fact.statementSimple,
    fact.label,
    fact.betterQuestion,
    fact.missedConsequence,
    fact.id,
  ].filter((t): t is string => Boolean(t));

/** True when the text appears in the request body as plain text or JSON-escaped. */
const appearsIn = (body: string, text: string) =>
  body.includes(text) || body.includes(JSON.stringify(text).slice(1, -1));

describe('the fact policy', () => {
  const byId = (id: string) =>
    scenario.hiddenFacts.find((f) => f.id === id) as (typeof scenario.hiddenFacts)[number];
  const lockout = byId('hf-lockout-message');
  const phone = byId('hf-phone-old-password');
  const timing = byId('hf-reset-timing');
  const tried = byId('hf-tried-colleague');

  it('sends a fact only once the trainee has earned it, across a whole conversation', async () => {
    llm.respondWith(() => ({ reply: 'Okay, thanks.' }));
    const contexts = await captureContexts(scenario, [
      'Hi, I am Sam. Can you read me exactly what the sign-in screen says?',
      'Is your work email also signed in on your phone or tablet?',
      'Thanks. When did it start?',
    ]);
    for (const ctx of contexts) await provider().generateCustomer(ctx);
    const [first, second, third] = llm.requests.map((r) => r.text);

    expect(appearsIn(first as string, lockout.statement)).toBe(true);
    expect(appearsIn(first as string, phone.statement)).toBe(false);
    expect(appearsIn(first as string, timing.statement)).toBe(false);

    expect(appearsIn(second as string, phone.statement)).toBe(true);
    expect(appearsIn(second as string, timing.statement)).toBe(false);

    expect(appearsIn(third as string, timing.statement)).toBe(true);

    // The fourth fact is never asked about, so none of it appears in any request.
    for (const request of llm.requests) {
      for (const text of factTexts(tried)) expect(appearsIn(request.text, text)).toBe(false);
    }
    // Nor do labels, ids, better questions or consequences of facts that were not earned yet.
    for (const text of factTexts(phone).filter((t) => t !== phone.statement)) {
      expect(appearsIn(first as string, text)).toBe(false);
    }
  });

  it('shares only the partial statement for a broad question', async () => {
    llm.enqueue({ reply: 'It says something about waiting.' });
    const ctx = await lastContext(["Hello, I'm Sam. What's going on?"]);
    expect(ctx.discovery.reveal.map((r) => r.mode)).toEqual(['partial']);
    await provider().generateCustomer(ctx);
    const body = llm.requests[0]?.text ?? '';
    expect(appearsIn(body, lockout.partialStatement as string)).toBe(true);
    expect(appearsIn(body, lockout.statement)).toBe(false);
  });

  it('says only that something is being held back, never what, when trust is too low', async () => {
    const guarded = makeScenario({ startingTemperature: 'frustrated' });
    guarded.hiddenFacts = guarded.hiddenFacts.map((f) =>
      f.id === 'hf-phone-old-password' ? { ...f, minTrust: 95 } : f,
    );
    const ctx = await lastContext(['Is your work email also signed in on your phone?'], guarded);
    expect(ctx.discovery.withheld.map((w) => w.reason)).toEqual(['trust']);
    llm.enqueue({ reply: 'I would rather not get into that yet.' });
    await provider().generateCustomer(ctx);

    const system = systemOf(llm.requests[0] as RecordedRequest);
    expect(system).toMatch(/not ready to discuss yet, because you do not trust them enough/);
    for (const text of factTexts(phone))
      expect(appearsIn(llm.requests[0]?.text ?? '', text)).toBe(false);
  });

  it('leaves out setup notes that give an unearned fact away, and keeps harmless ones', async () => {
    const ctx = await lastContext(['What laptop are you using?']);
    llm.enqueue({ reply: 'A work laptop.' });
    await provider().generateCustomer(ctx);
    const system = systemOf(llm.requests[0] as RecordedRequest);
    expect(system).toContain('Work laptop running Windows with the usual browser');
    // "Work email is also set up on her personal phone" restates the phone fact.
    expect(system).not.toContain('personal phone');
    expect(system).not.toContain('Work email is also set up');
  });

  it('brings a setup note back once the fact it restates has been earned', async () => {
    const ctx = await lastContext([
      'Is your work email also signed in on your phone or tablet?',
      'Thanks. Anything else on the phone?',
    ]);
    llm.enqueue({ reply: 'No.' });
    await provider().generateCustomer(ctx);
    expect(systemOf(llm.requests[0] as RecordedRequest)).toContain(
      'Work email is also set up on her personal phone',
    );
  });

  it('sends the same protection with every difficulty, style and call stage', async () => {
    llm.respondWith(() => ({ reply: 'Okay.' }));
    const variants = [
      { difficulty: 'starter' },
      { difficulty: 'challenge', style: 'terse' },
      { style: 'non-native', proficiency: 'expert' },
      { callStage: 'escalated', impact: 'high' },
      { style: 'vague', callStage: 'follow-up' },
    ] as const;
    for (const overrides of variants) {
      const variant = makeScenario({ startingTemperature: 'angry', ...overrides });
      const contexts = await captureContexts(variant, [
        'Hello, I am Sam. What is going on?',
        'When did it start?',
      ]);
      for (const ctx of contexts) {
        llm.reset();
        llm.respondWith(() => ({ reply: 'Okay.' }));
        await provider().generateCustomer(ctx);
        const body = llm.requests[0]?.text ?? '';
        for (const fact of variant.hiddenFacts) {
          const record = ctx.runtime.discovery[fact.id];
          const allowed = new Set<string>();
          if (record && fact.partialStatement) allowed.add(fact.partialStatement);
          if (record?.status === 'discovered') {
            for (const text of [fact.statement, fact.statementTerse, fact.statementSimple]) {
              if (text) allowed.add(text);
            }
          }
          for (const text of factTexts(fact)) {
            if (!allowed.has(text)) expect(appearsIn(body, text)).toBe(false);
          }
        }
      }
    }
  });
});

describe('the leak guard', () => {
  const ARRIVAL = 'It started right after I changed my password at about ten past eight.';

  it('retries once with a generic reminder when a reply states something unearned', async () => {
    llm.enqueue({ reply: ARRIVAL }, { reply: 'It says my account is locked, I think.' });
    const ctx = await lastContext([
      'Hi, I am Sam. Can you read me exactly what the sign-in screen says?',
    ]);
    const result = await provider().generateCustomer(ctx);
    expect(result.text).toBe('It says my account is locked, I think.');
    expect(llm.requests).toHaveLength(2);

    const retry = llm.requests[1] as RecordedRequest;
    expect(systemOf(retry)).toContain(CUSTOMER_REMINDERS.facts);
    // The reminder is generic: it does not repeat the reply or the fact it leaked.
    for (const leaked of ['ten past eight', 'right after I changed', ARRIVAL]) {
      expect(retry.text).not.toContain(leaked);
    }
  });

  it('fails with provider_bad_output, without repeating the leak, when it happens twice', async () => {
    llm.respondWith(() => ({ reply: ARRIVAL }));
    const ctx = await lastContext([
      'Hi, I am Sam. Can you read me exactly what the sign-in screen says?',
    ]);
    const error = await providerErrorOf(provider().generateCustomer(ctx));
    expect(error.code).toBe('provider_bad_output');
    expect(error.retryable).toBe(true);
    expect(llm.requests).toHaveLength(2);
    expect(error.message).not.toMatch(/ten past eight|password/);
  });

  it.each([
    'I use my work laptop every day.',
    'It stopped letting me in this morning after I changed my password.',
    'My colleague next to me is fine, I think.',
  ])('lets an ordinary reply through: %s', async (reply) => {
    llm.enqueue({ reply });
    const ctx = await lastContext(['What laptop are you using?']);
    expect((await provider().generateCustomer(ctx)).text).toBe(reply);
    expect(llm.requests).toHaveLength(1);
  });

  it.each([
    ['a time', 'It was about ten past eight.'],
    ['a count', 'I tried about six times.'],
  ])('catches %s that only an unearned fact contains', async (_name, leak) => {
    llm.enqueue({ reply: leak }, { reply: 'Okay.' });
    const ctx = await lastContext(['What laptop are you using?']);
    expect((await provider().generateCustomer(ctx)).text).toBe('Okay.');
    expect(llm.requests).toHaveLength(2);
  });

  it('does not flag details the trainee or the customer already put in the conversation', async () => {
    const ctx = await lastContext(['Hello. You mentioned eight. Is your laptop a Windows laptop?']);
    llm.enqueue({ reply: 'Yes, I said eight earlier, and it is a Windows laptop.' });
    const result = await provider().generateCustomer(ctx);
    expect(result.text).toMatch(/eight/);
    expect(llm.requests).toHaveLength(1);
  });

  it('lets a fact be stated once it has been earned', async () => {
    llm.enqueue({ reply: 'It started right after I changed my password at about ten past eight.' });
    const ctx = await lastContext(['When did it start, and what happened just before?']);
    const result = await provider().generateCustomer(ctx);
    expect(result.text).toMatch(/ten past eight/);
    expect(llm.requests).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------

describe('a whole conversation through the real pipeline', () => {
  function modelLikeServer(request: RecordedRequest): Step {
    const messages = messagesOf(request);
    const last = messages.at(-1)?.content ?? '';
    if (request.body?.response_format?.type === 'json_object') {
      const payload = JSON.parse(last) as {
        engineerMessage: string;
        targets: { id: string; revealWhen: string }[];
      };
      const target = (pattern: RegExp) =>
        payload.targets.find((t) => pattern.test(t.revealWhen))?.id;
      const message = payload.engineerMessage;
      const base = {
        ...emptyClassification(),
        askedQuestion: message.includes('?'),
        introduces: /\bhi\b/i.test(message),
      };
      if (/screen say/i.test(message)) {
        return {
          reply: JSON.stringify({
            ...base,
            discoveryIntents: ['error_message'],
            factTargets: [{ id: target(/sign-in message/i), strength: 'full' }],
          }),
        };
      }
      if (/phone|tablet/i.test(message)) {
        return {
          reply: JSON.stringify({
            ...base,
            discoveryIntents: ['environment'],
            factTargets: [{ id: target(/other device/i), strength: 'full' }],
          }),
        };
      }
      return {
        reply: JSON.stringify({
          ...base,
          ownership: 'clear',
          nextSteps: 'specific',
          confirmsNextContact: true,
          evidence: [{ behaviour: 'next-steps-specific', quote: "I'll call you back by 10am" }],
        }),
      };
    }
    if (/screen say/i.test(last))
      return { reply: 'It says my account is temporarily locked after too many attempts.' };
    if (/phone|tablet/i.test(last))
      return { reply: 'Yes, my work email is on my personal phone as well.' };
    return { reply: 'Okay, thank you. I will wait for your call.' };
  }

  it('classifies, reveals facts only when earned, and keeps the customer in character', async () => {
    llm.respondWith(modelLikeServer);
    const live = provider();
    let runtime = createInitialRuntime(scenario);
    const history: TranscriptTurn[] = [
      { index: 1, role: 'customer', text: openingMessage(scenario) },
    ];
    const lines = [
      'Hi, I am Sam. Can you read me exactly what the sign-in screen says?',
      'Is your work email also signed in on your phone or tablet?',
      "Thank you. I'll arrange the unlock and I'll call you back by 10am to confirm.",
    ];
    const replies: string[] = [];

    for (const line of lines) {
      const lastCustomer = history.at(-1)?.text ?? null;
      const turnIndex = history.length + 1;
      const result = await processTraineeTurn({
        scenario,
        runtime,
        traineeText: line,
        turnIndex,
        history,
        classify: (text, turn) =>
          live.classifyTurn({
            scenario,
            traineeText: text,
            traineeTurnNumber: turn,
            lastCustomerText: lastCustomer,
          }),
        generate: (ctx) => live.generateCustomer(ctx),
      });
      expect(result.customerSource).toBe('live');
      runtime = result.runtime;
      replies.push(result.customerText);
      history.push(
        { index: turnIndex, role: 'trainee', text: line },
        { index: turnIndex + 1, role: 'customer', text: result.customerText },
      );
    }

    expect(replies[0]).toMatch(/temporarily locked/);
    expect(replies[1]).toMatch(/personal phone/);
    expect(runtime.discovery['hf-lockout-message']?.status).toBe('discovered');
    expect(runtime.discovery['hf-phone-old-password']?.status).toBe('discovered');
    expect(runtime.discovery['hf-reset-timing']).toBeUndefined();
    expect(runtime.discovery['hf-tried-colleague']).toBeUndefined();
    expect(runtime.customer.ownershipStated).toBe(true);
    expect(runtime.customer.nextStepsStated).toBe(true);

    // Three trainee turns: a classifier call and a customer call each, and nothing more.
    expect(llm.requests).toHaveLength(6);
    const customerRequests = llm.requests.filter((r) => r.body?.response_format === undefined);
    expect(customerRequests).toHaveLength(3);
    const unearned = scenario.hiddenFacts.filter(
      (f) => f.id === 'hf-reset-timing' || f.id === 'hf-tried-colleague',
    );
    for (const request of llm.requests) {
      expect(request.headers.authorization).toBe(`Bearer ${KEY}`);
      for (const fact of unearned) {
        for (const text of factTexts(fact)) expect(appearsIn(request.text, text)).toBe(false);
      }
    }
    // The phone fact is sent for the second customer turn and not for the first.
    expect(appearsIn(customerRequests[0]?.text ?? '', byStatement('hf-phone-old-password'))).toBe(
      false,
    );
    expect(appearsIn(customerRequests[1]?.text ?? '', byStatement('hf-phone-old-password'))).toBe(
      true,
    );
  });
});

function byStatement(id: string): string {
  return scenario.hiddenFacts.find((f) => f.id === id)?.statement ?? '';
}
