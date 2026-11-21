# AI providers

Firefly runs in one of two modes.

- **Demo mode** (the default) uses Firefly's built-in rules engine. It needs no credentials and makes no network calls. It is labelled "Demo mode" everywhere in the app and is never presented as a model.
- **Live mode** uses a chat model for three judgement calls: classifying what the trainee did, writing the customer's replies, and drafting the coaching report. Three providers are supported: Azure OpenAI, Google's Gemini API, and any OpenAI-compatible chat-completions endpoint.

This page is about the language model. Speaking and listening are a separate boundary with their own providers (none, a labelled demo voice, and Azure AI Speech), described in [voice-architecture.md](voice-architecture.md). Neither choice depends on the other.

> **Verification status.** The Gemini provider has been run end to end against the real Gemini API (see [Verified against the Gemini API](#verified-against-the-gemini-api)). Azure OpenAI and generic OpenAI-compatible services have been verified only against a local fake server (`server/providers/fake-llm-server.ts`) in automated tests. For those two, anything that depends on a real service is unverified: the exact wording of error responses, content-filter payloads, JSON-mode support, token budgets for reasoning models, and the quality of the replies. Run the [smoke test](#optional-manual-smoke-test) with your own key before relying on them.

## Configure a provider

Settings come from environment variables. Firefly loads `.env` on startup (copy `.env.example`; `.env` is git-ignored) and variables already set in the environment win. Never commit real values.

### Demo mode

```
FIREFLY_PROVIDER=mock
```

`FIREFLY_MOCK_DELAY_MS` (default `700`) adds a short pause before demo replies so the typing state is visible.

### Azure OpenAI

```
FIREFLY_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<your-api-key>
AZURE_OPENAI_DEPLOYMENT=<your-deployment-name>
AZURE_OPENAI_API_VERSION=<api-version>
```

Firefly calls `POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}` with the key in an `api-key` header. The deployment must be a chat model; it selects the model, so no `model` field is sent.

### Gemini (Google AI Studio)

A stand-in for Azure OpenAI that needs only an API key from [Google AI Studio](https://aistudio.google.com/apikey).

```
FIREFLY_PROVIDER=gemini
GEMINI_API_KEY=<your-api-key>
# Optional:
GEMINI_MODEL=<model-name>
GEMINI_BASE_URL=<https://generativelanguage.googleapis.com/v1beta/openai>
```

Only the key is required. Without `GEMINI_MODEL` Firefly uses `gemini-3.5-flash-lite`, a fast, low-cost model; without `GEMINI_BASE_URL` it uses Google's OpenAI-compatible endpoint. Firefly calls `POST {base-url}/chat/completions` with `Authorization: Bearer <key>` and the model name in the body. The provider label reads `Gemini (model "<name>")`.

What Firefly does differently for Gemini:

- Gemini models think before they answer, and that thinking counts against the completion limit. Firefly asks for the lowest reasoning effort (`reasoning_effort: "minimal"`) and adds token headroom so a reply is not cut off. A model that rejects the reasoning setting is retried once without it.
- Google answers an invalid API key with HTTP 400 rather than 401. Firefly recognises that and reports "rejected the credentials".
- When Google says how long to wait after a rate limit, Firefly passes that on ("Please try again in about 40 seconds") instead of a vague message.

Things to know before relying on it:

- **Rate limits.** Limits apply per Google project (not per key), per model, and depend on the project's usage tier. When this was tested on a free-tier project, `gemini-3.5-flash-lite` allowed 15 requests per minute, and a trainee message costs two requests, so a fast conversation can hit the limit. Firefly then shows the wait Google asked for, and a failed coaching report can be retried from the report page. Linking a billing account moves a project to a paid tier with higher limits; Google AI Studio shows your current limits, and Google's [rate limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits) explains the tiers.
- **Data use.** Google's [Gemini API terms](https://ai.google.dev/gemini-api/terms) (effective 2026-03-23 when this was checked) say that for unpaid services, which includes the unpaid quota of the Gemini API, Google uses what you submit and the responses to improve its products and human reviewers may read it, and they say not to submit sensitive, confidential or personal information. For paid services, Google does not use prompts and responses to improve its products. Firefly sends only fictional scenario text and redacted trainee messages, so keep it that way: never type real customer data, and read the current terms before using a key for anything else.
- **Model availability.** Models change. During testing some larger models sometimes answered HTTP 503 ("high demand"), which Firefly reports as "not available right now"; choosing another model with `GEMINI_MODEL` fixes that. To list the models your key can use, run `curl -H "Authorization: Bearer $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/openai/models`.
- **Keep the key private.** It belongs only in your git-ignored `.env`. `npm run check:secrets` also looks for Google key shapes, but it is a safety net. If a key is ever pasted somewhere public or shared, delete it in Google AI Studio and create a new one.

### OpenAI-compatible endpoint

```
FIREFLY_PROVIDER=openai-compatible
FIREFLY_LLM_BASE_URL=https://<your-endpoint>/v1
FIREFLY_LLM_API_KEY=<your-api-key>
FIREFLY_LLM_MODEL=<model-name>
```

Firefly calls `POST {base-url}/chat/completions` with `Authorization: Bearer <key>` and the model name in the body. The base URL is everything before `/chat/completions`.

### Limits (optional)

| Variable                  | Default | Meaning                                                                        |
| ------------------------- | ------- | ------------------------------------------------------------------------------ |
| `FIREFLY_LLM_TIMEOUT_MS`  | `30000` | Time allowed for each request (minimum `1000`).                                |
| `FIREFLY_LLM_MAX_RETRIES` | `1`     | Retries for rate limits, server errors and network failures only (`0` to `3`). |

### If settings are incomplete

If a live provider is requested but a required variable is missing, Firefly starts in demo mode instead. The startup console prints a notice naming the missing variables (never their values), and `GET /api/config` reports it as `provider.notice`. The provider label tells you which mode is really running.

### Switching providers

A call remembers the provider it started with. If you change `FIREFLY_PROVIDER` while a call is still in progress (for example from demo mode to Gemini), that call cannot take more messages and the app asks you to start a new one. Finished calls and their reports stay readable.

### Behind a proxy

Node's built-in `fetch` ignores `HTTP_PROXY` and `HTTPS_PROXY` unless asked. If your network needs a proxy to reach the provider, start the server with `NODE_OPTIONS=--use-env-proxy`.

## What each call does

| Call                | When                     | Output                         | Temperature | If it fails                                                       |
| ------------------- | ------------------------ | ------------------------------ | ----------- | ----------------------------------------------------------------- |
| **Classify a turn** | Once per trainee message | JSON: what the trainee did     | 0           | The session service falls back to the rules classifier.           |
| **Customer reply**  | Once per trainee message | Plain text, 1 to 6 sentences   | 0.7         | The message fails with a safe error. There is no silent fallback. |
| **Coaching draft**  | Once when the call ends  | JSON: scores, quotes, guidance | 0.2         | The evaluation reports the error and can be retried.              |

A trainee message therefore costs two model calls, and ending the call costs one. A repair or regeneration adds one more call for that step.

The model never decides the numbers. Customer temperature, trust and patience, which hidden facts are revealed, when a curveball fires, score arithmetic and quote verification are all computed in code. The classifier _describes_ what the trainee did; the engine decides what that means. Every model output is validated before it is used:

- **JSON answers** are read leniently (code fences, text around the object) and then checked against the shared schemas. Unknown intents, behaviours and fact names are dropped, numbers are clamped, long strings are trimmed, and quotes must appear verbatim in the trainee's message. If the result is still invalid, Firefly sends one corrective message naming the problem, then fails with `provider_bad_output`.
- **Customer replies** are cleaned (markdown, speaker labels, stage directions, wrapping quotes) and rejected if empty, over 900 characters, or out of character (mentions being an AI, a system prompt, a language model and so on). A rejected reply is regenerated once with a stricter reminder.

## What is sent to the model, and what is not

**During the call**

- Classifier: the trainee's latest message, the customer's last message, the scenario title, goal and impact line, and a list of discovery targets. Each target is a throwaway name (`t1`, `t2`, ...) with a description of the _kind of question_ that unlocks it. The targets carry no answers, labels or fact ids.
- Customer reply: who the customer is (persona, goal, impact, earlier case history, what they believe), how they speak, how they feel in words (never numbers), how to react to what the trainee just did, any curveball in this reply, the facts they may state in this reply, what they have already said, the rules, and the conversation so far.
- Trainee messages are passed through Firefly's redaction (emails, phone numbers, long numbers and identifiers) before they are sent.

**After the call (coaching draft)**

- The scenario's grounding notes, the full transcript with turn numbers, the discovery results (the call is over, so what the customer held back is included), the customer-state timeline, and facts about how the call ended. Only the customer's first name is sent.

**Never sent**

- Hidden facts the trainee has not earned: no statement, label, id, hint or "do not mention" list, and no description of what is being held back. When the customer is holding something back, the model is told only that something related to what was just asked is not ready to be discussed, and why (trust, or the impact not yet being acknowledged).
- Scenario answer keys during the call: the truth behind a belief, evaluator notes, success criteria, poor approaches, and curveballs that have not fired.
- The customer's raw state numbers during the call (the model sees mood only in words), the API key (it goes only in the request header to the configured endpoint), and anything about other sessions.

Everything is sent to the provider you configure. Scenarios are fictional; do not type real customer data.

### How hidden facts are protected

1. **By construction.** The customer prompt is built only from what the engine decided the customer may say in this reply. Hidden facts are never read from anywhere else.
2. **Screened setup notes.** Scenario background text (setup notes and earlier case history) sometimes restates a hidden fact. A line that shares a number, name or distinctive phrase with an unearned fact is left out until the fact is earned.
3. **Reply check.** Each customer reply is scanned for numbers, codes, names and key phrases that appear only in an unearned fact and nowhere else in the scenario or conversation. A match counts as a leak. The reply is regenerated once with the generic reminder "Only use the facts you were given; do not invent specifics." (it never repeats the leak), and a second leak fails with `provider_bad_output`.

This is a safety net, not a proof. It catches near-verbatim details; a model could still paraphrase around it. The best protection is scenario text that does not restate hidden facts.

## Failure behaviour

All provider failures are `ProviderError` with a fixed, user-safe message. The provider layer does not log, and its error messages never contain the API key, the endpoint, request or response bodies, or transcript text.

| Situation                                      | Code                        | Retryable | Behaviour                                                                                                  |
| ---------------------------------------------- | --------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| HTTP 401 or 403, or Google's 400 for a bad key | `provider_not_configured`   | No        | "The AI provider rejected the credentials. Check ..."                                                      |
| HTTP 404                                       | `provider_not_configured`   | No        | The model or deployment was not found.                                                                     |
| HTTP 429                                       | `provider_rate_limited`     | Yes       | Retried up to the limit, waiting for `Retry-After` (at most 5 s). Google's advised wait is shown if given. |
| HTTP 5xx, network error                        | `provider_unavailable`      | Yes       | Retried up to the limit with a short backoff (0.3 s, 0.6 s, ... up to 2 s).                                |
| Timeout, HTTP 408                              | `provider_timeout`          | Yes       | Not retried automatically; the user can try again.                                                         |
| Content filter (`finish_reason`, Azure error)  | `provider_content_filtered` | No        | The user is asked to rephrase.                                                                             |
| Unusable output after the repair attempt       | `provider_bad_output`       | Yes       | See above.                                                                                                 |
| Other HTTP 4xx                                 | `provider_unavailable`      | No        | Never retried. The status code is in the message.                                                          |
| Cancelled by the caller                        | `AbortError`                | n/a       | Not a `ProviderError`; the request stops at once.                                                          |

### Compatibility adjustments

Models differ in the parameters they accept. If a 400 response says so, Firefly adjusts the request and retries once per adjustment, without using the retry budget, and remembers the adjustment for the life of the process:

- `max_tokens` is rejected: use `max_completion_tokens` (and the reverse). With `max_completion_tokens`, Firefly adds headroom, because models that reason before answering count hidden reasoning against that limit.
- `temperature` is rejected: send the request without it.
- `response_format` is rejected: send the request without it. JSON is then read from the plain text reply.
- `reasoning_effort` is rejected (Gemini only, the one provider that is sent it): send the request without it.

## Verified against the Gemini API

On 2026-11-19 the Gemini provider was run against the real Gemini API with the default model, `gemini-3.5-flash-lite`, through a running Firefly server. Each run created a call, sent four fictional trainee messages, ended the call and waited for the report.

- Three calls (two on "Locked out after a password reset", one on "A new hire has no premium seat") completed. The customer replied in character each time, usually in 3 to 10 seconds, and the coaching was written by the model and then verified by the evaluator: the report records the evaluator as `model` with the Gemini label.
- A fourth call (the Standard scenario "Team cannot open the shared project workspace") got its customer replies, but the coaching draft hit the free-tier rate limit (HTTP 429). Firefly showed it as a retryable failure with the transcript kept, as designed.
- Separate requests confirmed that JSON mode (`response_format`) and `reasoning_effort: "minimal"` are accepted by `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite`, and recorded the shape of Google's error responses for an invalid key, an unknown model, an unknown field and a rate limit. The tests for those cases use those shapes.

This was a handful of scripted calls to show that the provider works. It says nothing about how the coaching compares with a mentor's; see [the scoring rubric](scoring-rubric.md) for how scores are checked.

## Prompt versions

Prompts are plain functions in `server/prompts/` with exported version constants: `CUSTOMER_PROMPT_VERSION` (`customer-1`), `CLASSIFIER_PROMPT_VERSION` (`classifier-1`) and `EVALUATOR_PROMPT_VERSION` (`evaluator-2`). The versions are stored with every session. Change the version whenever you change a prompt's wording or sampling. The evaluator prompt's guidance for each dimension follows [the scoring rubric](scoring-rubric.md); update both together. A model-written coaching draft is verified and merged by `server/evaluator/merge.ts`, as described in that page.

## Optional manual smoke test

This is for the maintainer and is not required. It needs your own key, makes two small model calls, and shows that the settings, the endpoint and the output handling work end to end.

1. Put one provider block in `.env`, then start Firefly with `npm start`. The console should print `AI provider : Azure OpenAI (deployment "...")`, `Gemini (model "...")` or `OpenAI-compatible (model "...")`. If it prints a notice instead, a variable is missing.
2. Optional script check: save the following as `smoke.ts` in the repository root, run `node --env-file=.env --disable-warning=ExperimentalWarning smoke.ts`, then delete it. It prints the label, one classification and one customer reply.

   ```ts
   import { makeScenario } from './server/engine/testing.ts';
   import { createProviderFromEnv } from './server/providers/index.ts';
   import { captureContexts } from './server/prompts/testing.ts';

   const { provider, problem } = createProviderFromEnv();
   if (provider.demo) throw new Error(problem ?? 'Set FIREFLY_PROVIDER to a live provider first.');

   const scenario = makeScenario();
   const line = 'Hi, I am Sam. Can you read me exactly what the sign-in screen says?';
   console.log(provider.label);
   console.log(
     await provider.classifyTurn({
       scenario,
       traineeText: line,
       traineeTurnNumber: 1,
       lastCustomerText: null,
     }),
   );
   const [ctx] = await captureContexts(scenario, [line]);
   if (ctx) console.log((await provider.generateCustomer(ctx)).text);
   ```

3. In the app, start "Locked out after a password reset" and send three or four messages. Check that:
   - the provider label is the live one, not "Demo mode";
   - the customer stays in character and never mentions being an AI;
   - asking what the sign-in screen says reveals the lockout message, and the full phone story appears only after you ask about other devices (Starter difficulty drops a small hint about the phone in the opening);
   - ending the call produces a coaching report whose quotes match your messages.
4. Failure drills: a wrong key should give "rejected the credentials", a wrong deployment or model name should give "could not find", and `FIREFLY_LLM_TIMEOUT_MS=1000` with a slow model should give a timeout.

## Where things live

| File                                  | Role                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `server/providers/types.ts`           | Provider contract, `ProviderError`, environment loading.                                             |
| `server/providers/index.ts`           | `createProvider` and `createProviderFromEnv`.                                                        |
| `server/providers/live.ts`            | The live provider: the three calls, repair and regeneration.                                         |
| `server/providers/http.ts`            | Chat-completions client: URLs, headers, retries, timeouts, error mapping.                            |
| `server/providers/output.ts`          | Reading and validating model output.                                                                 |
| `server/prompts/*.ts`                 | Prompt builders; `facts.ts` holds the hidden-fact policy.                                            |
| `server/providers/fake-llm-server.ts` | Local fake server used by the tests. Run them with `npx vitest run server/providers server/prompts`. |
