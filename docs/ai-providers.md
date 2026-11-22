# AI providers

Firefly runs in one of two modes.

- **Demo mode** (the default) uses Firefly's built-in rules engine. It needs no credentials and makes no network calls. It is labelled "Demo mode" everywhere in the app and is never presented as a model.
- **Live mode** uses a chat model for three judgement calls: classifying what the trainee did, writing the customer's replies, and drafting the coaching report. Three providers are supported: Azure OpenAI, Google's Gemini API, and any OpenAI-compatible chat-completions endpoint.

This page is about the language model. Speaking and listening are a separate boundary with their own providers (none, a labelled demo voice, and Azure AI Speech), described in [voice-architecture.md](voice-architecture.md). Neither choice depends on the other.

> **Verification status.** Gemini had one limited live smoke check on 21 Nov 2026. Azure OpenAI and the OpenAI-compatible endpoint have not been run live. The three live providers share one adapter, which is tested against a local fake model server (`server/providers/fake-llm-server.ts`). Anything that depends on a real service and was not in the Gemini smoke check is unverified: the exact wording of error responses, content-filter payloads, JSON-mode support on other services, token budgets for reasoning models, and the quality of the replies. See [Status of each provider](#status-of-each-provider), and run the [smoke test](#optional-manual-smoke-test) with your own key before relying on one.

## Status of each provider

| Provider          | Setting                              | What is tested, against the local fake                                                                                                           | Live check                       |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Demo mode         | `FIREFLY_PROVIDER=mock` (default)    | The rules engine, in unit, API and browser tests.                                                                                                | Not run (no external service)    |
| Gemini            | `FIREFLY_PROVIDER=gemini`            | The request (bearer key, base URL, model in the body), token headroom and compatibility adjustments, JSON repair, and the reply and fact guards. | Limited smoke check, 21 Nov 2026 |
| Azure OpenAI      | `FIREFLY_PROVIDER=azure-openai`      | The request (deployment route, `api-version` query, `api-key` header, no model in the body), and the same adapter behaviour as above.            | Not run                          |
| OpenAI-compatible | `FIREFLY_PROVIDER=openai-compatible` | The request (bearer key, base URL, model in the body), and the same adapter behaviour as above.                                                  | Not run                          |

**What the status column means.** The adapters are written against each vendor's documentation and tested against a local fake. CI uses the fake servers and the mock. "Not run" means Firefly has not been run against that service.

**The Gemini smoke check.** Gemini (model `gemini-3.5-flash-lite`, free tier, key supplied locally by the user) got a limited live smoke check on 21 Nov 2026 through the real HTTP API: two scripted calls (Outlook shared mailbox, 7 engineer turns; Teams external meetings, 10 engineer turns) with live customer replies and a model-written v2 report for each; no errors, no retries, no coaching or list-style replies detected by simple automatic checks. That is a smoke check, not a quality evaluation: it says nothing about voice, about other scenarios, or about paid-tier behaviour.

These two calls were a re-run. An earlier live run the same day exposed four customer-engine faults: a reveal the customer had earned was rejected as bad output, a repeated question got a wrong answer, the customer pushed too hard, and it repeated lines word for word. They were fixed before the re-run, with tests.

Azure OpenAI, the OpenAI-compatible endpoint and Azure AI Speech have not been run live. When another provider is run, add the date, the model and what was run here.

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

**A documentation check you should know about.** Microsoft's current pages describe a newer "v1" Azure OpenAI API: `POST {endpoint}/openai/v1/chat/completions`, with no `api-version` parameter, which you can opt in to ([Azure OpenAI v1 API](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle) and the [chat reference](https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/chat), both read on 21 November 2026). The chat reference accepts the key in the `api-key` header or the `authorization` header. Firefly's adapter still uses the dated route above. The pages read for this check do not say that route has been removed, and do not say it has not. It has not been tried against a live resource. If a resource rejects the dated route, that is the first thing to check, and supporting the v1 route would be a change to `server/providers/http.ts`.

### Gemini (Google AI Studio)

A stand-in for Azure OpenAI that needs only an API key from [Google AI Studio](https://aistudio.google.com/apikey).

```
FIREFLY_PROVIDER=gemini
GEMINI_API_KEY=<your-api-key>
# Optional:
GEMINI_MODEL=<model-name>
GEMINI_BASE_URL=<https://generativelanguage.googleapis.com/v1beta/openai>
```

Only the key is required. Without `GEMINI_MODEL` Firefly uses `gemini-3.5-flash-lite`, which Google's [models page](https://ai.google.dev/gemini-api/docs/models) lists as Stable (read 21 November 2026). Without `GEMINI_BASE_URL` it uses Google's OpenAI-compatible endpoint, `https://generativelanguage.googleapis.com/v1beta/openai/`, as Google's [OpenAI compatibility page](https://ai.google.dev/gemini-api/docs/openai) gives it (read the same day). Firefly calls `POST {base-url}/chat/completions` with `Authorization: Bearer <key>` and the model name in the body, which is the shape that page shows. The provider label reads `Gemini (model "<name>")`.

What Firefly does differently for Gemini:

- Gemini models think before they answer, and that thinking counts against the completion limit. Firefly asks for the lowest reasoning effort (`reasoning_effort: "minimal"`) and adds token headroom so a reply is not cut off. Google's compatibility page lists `minimal`, `low`, `medium`, `high` and `xhigh` as values, and says that reasoning cannot be turned off for Gemini 2.5 Pro, Gemini 3 or Gemini 4 models. A model that rejects the reasoning setting is retried once without it.
- Firefly treats a Google HTTP 400 that says the key is invalid as "rejected the credentials". An earlier run saw Google answer an invalid key with 400 rather than 401. That has not been re-checked on this version, and the tests reproduce the shape.
- When Google says how long to wait after a rate limit, Firefly passes that on ("Please try again in about 40 seconds") instead of a vague message.

Things to know before relying on it:

- **Rate limits.** Google's [rate limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits) (read 21 November 2026) says limits are applied per project, not per key, that they vary by model, and that they depend on the project's usage tier. AI Studio shows your active limits. A trainee message costs two model requests, so a fast conversation can reach a low limit. Firefly then shows the wait Google asked for, and a failed coaching report can be retried from the report page.
- **Data use.** Google's [Gemini API terms](https://ai.google.dev/gemini-api/terms) (effective 23 March 2026, read 21 November 2026) say that for unpaid services, which includes the unpaid quota of the Gemini API, Google uses what you submit and the responses to provide, improve and develop its products, that human reviewers may read, annotate and process the input and output, and not to submit sensitive, confidential or personal information. For paid services, Google does not use prompts and responses to improve its products. The terms also say that for users in the EEA, Switzerland or the United Kingdom the paid-service data terms apply to all services, and that only Paid Services may be used when making an application available to users there. Firefly sends only fictional scenario text and redacted trainee messages, so keep it that way: never type real customer data, and read the current terms for what applies to you.
- **Model availability.** Models change. If a model is retired or busy, choose another with `GEMINI_MODEL`; Google's models page lists what is current.
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

| Call                | When                     | Output                                                         | Temperature | If it fails                                                                                                                                                |
| ------------------- | ------------------------ | -------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Classify a turn** | Once per trainee message | JSON: what the trainee did                                     | 0           | The session service falls back to the rules classifier.                                                                                                    |
| **Customer reply**  | Once per trainee message | Plain speech, within the reply plan's sentence limit           | 0.7         | One retry with a generic reminder, then whatever is safe to say is kept. If nothing safe is left, the message fails with a safe error. No silent fallback. |
| **Coaching draft**  | Once when the call ends  | JSON: six scores, quotes, guidance, strengths and improvements | 0.2         | The evaluation reports the error and can be retried.                                                                                                       |

A trainee message therefore costs two model calls, and ending the call costs one. A repair or regeneration adds one more call for that step.

The model never decides the customer's state. Customer temperature, trust and patience, which hidden facts are revealed, when a curveball fires and quote verification are all computed in code, and so are CARE, the milestones, discovery and the overall score. The classifier _describes_ what the trainee did; the engine decides what that means. The coaching draft is the one place where a model proposes numbers: it scores the six skills, and the server then checks every quote and lowers a score that lacks evidence (see [care-cbcf-rubric.md](care-cbcf-rubric.md#when-a-model-writes-the-evaluation)). Every model output is validated before it is used:

- **JSON answers** are read leniently (code fences, text around the object) and then checked against the shared schemas. Unknown intents, behaviours and fact names are dropped, numbers are clamped, long strings are trimmed, and quotes must appear verbatim in the trainee's message. If the result is still invalid, Firefly sends one corrective message naming the problem, then fails with `provider_bad_output`.
- **Customer replies** are cleaned (reasoning, speaker labels, stage directions and wrapping quotes removed, each line of a list turned into a sentence of its own, markdown stripped) and checked: empty, over 900 characters, out of character (mentions being an AI, a system prompt, a language model and so on), leaking an unearned fact, or making up what the customer does not know. A reply that fails is regenerated once with a generic reminder, and then what is safe is kept sentence by sentence. [customer-realism.md](customer-realism.md#live-model-guards) has the full list.

## What is sent to the model, and what is not

**During the call**

- Classifier: the trainee's latest message, the customer's last message, the scenario title, goal and impact line, and a list of discovery targets. Each target is a throwaway name (`t1`, `t2`, ...) with a description of the _kind of question_ that unlocks it. The targets carry no answers, labels or fact ids.
- Customer reply: who the customer is (persona, goal, impact, what they hope for, background on their setup, what they tried and what changed, the case history on a call-back, what they believe), what they do not know and who would know, how they speak, how they feel in words (never numbers), what they have already said and what each side has committed to, how to react to what the trainee just did, any curveball in this reply, the facts they may state in this reply, a sentence limit, the rules, and the conversation so far.
- Trainee messages are passed through Firefly's redaction (emails, phone numbers, long numbers and identifiers) before they are sent.

**After the call (coaching draft)**

- The scenario's grounding notes (including what a strong call looks like for each CARE principle), the settings used for the call, the full transcript with turn numbers, the discovery results (the call is over, so what the customer held back is included), the customer-state timeline, and facts about how the call ended. Only the customer's first name is sent. The CARE results, milestones and discovery are computed by the server, and the prompt tells the model to leave them alone and never to mention CBCF.

**Never sent**

- Hidden facts the trainee has not earned: no statement, label, id or "do not mention" list, and no description of what is being held back. When the customer is holding something back, the model is told only that something related to what was just asked is not ready to be discussed, and why (trust, or the impact not yet being acknowledged). The one exception is a fact's `hint`, the author's gentle clue, which the engine may let the customer drop at Starter difficulty. It is sent as a clue to drop naturally, not as the fact.
- Scenario answer keys during the call: the truth behind a belief, evaluator notes, success criteria, poor approaches, and curveballs that have not fired.
- The customer's raw state numbers during the call (the model sees mood only in words), the API key (it goes only in the request header to the configured endpoint), and anything about other sessions.

Everything is sent to the provider you configure. Scenarios are fictional; do not type real customer data.

### How hidden facts are protected

1. **By construction.** The customer prompt is built only from what the engine decided the customer may say in this reply. Hidden facts are never read from anywhere else.
2. **Screened setup notes.** Scenario background text (setup notes and earlier case history) sometimes restates a hidden fact. A line that shares a number, name or distinctive phrase with an unearned fact is left out until the fact is earned.
3. **Reply check.** Each customer reply is scanned for numbers, codes, names and key phrases that appear only in an unearned fact and nowhere else in the scenario or conversation. A match counts as a leak. The reply is regenerated once with the generic reminder "Only use the facts you were given; do not invent specifics." (it never repeats the leak). If the second reply leaks too, the sentences that do not leak are kept, and only when none is left does the message fail with `provider_bad_output`.

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

## Prompt versions

Prompts are plain functions in `server/prompts/` with exported version constants: `CUSTOMER_PROMPT_VERSION` (`customer-4`), `CLASSIFIER_PROMPT_VERSION` (`classifier-2`) and `EVALUATOR_PROMPT_VERSION` (`evaluator-3`). The versions are stored with every session. Change the version whenever you change a prompt's wording or sampling. The evaluator prompt's guidance for each dimension follows [the rubric](care-cbcf-rubric.md); update both together. A model-written coaching draft is verified and merged by `server/evaluator/merge.ts`, as described in that page.

## Optional manual smoke test

This is for the maintainer and is not required. It needs your own key, makes two small model calls, and shows that the settings, the endpoint and the output handling work end to end.

1. Put one provider block in `.env`, then start Firefly with `npm start`. The console should print `AI provider : Azure OpenAI (deployment "...")`, `Gemini (model "...")` or `OpenAI-compatible (model "...")`. If it prints a notice instead, a variable is missing.
2. Optional script check: save the following as `smoke.ts` in the repository root, run `node --env-file=.env --disable-warning=ExperimentalWarning smoke.ts`, then delete it. It prints the label, one classification and one customer reply. It uses the test fixture scenario from `server/engine/testing.ts`, not one from the library.

   ```ts
   import { captureContexts, makeScenario } from './server/engine/testing.ts';
   import { createProviderFromEnv } from './server/providers/index.ts';

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

3. In the app, start "Shared team mailbox missing from Outlook" (Starter) and send three or four messages. Check that:
   - the provider label is the live one, not "Demo mode";
   - the customer stays in character and never mentions being an AI;
   - asking what he has already tried gets an answer from the scenario (see `hf-tried-restart` in `server/scenarios/library/outlook-shared-mailbox-missing.ts`), and the customer does not volunteer facts you have not asked about;
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
