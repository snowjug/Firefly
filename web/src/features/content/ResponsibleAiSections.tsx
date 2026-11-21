import { TextLink } from '../../design/index.ts';
import { ContentSection } from './ContentPage.tsx';
import {
  AZURE_SPEECH_LOGGING_URL,
  AZURE_SPEECH_PRIVACY_URL,
  GEMINI_TERMS_URL,
  ISSUES_URL,
} from './links.ts';
import type { TocItem } from './OnThisPage.tsx';

// Every statement on this page describes what this codebase does today. When the behaviour behind a
// sentence changes, change the sentence; when a sentence cannot be checked against the code, it is not
// here. The sources are docs/responsible-ai.md, docs/ai-providers.md, shared/domain/text.ts (what is
// replaced), server/http (what is logged and what is kept) and server/speech (what is sent where).

export const RESPONSIBLE_AI_TOC: readonly TocItem[] = [
  { id: 'purpose', label: 'Purpose and limits' },
  { id: 'fictional-data', label: 'Fictional data only' },
  { id: 'speech', label: 'Speech and audio' },
  { id: 'ai-and-coaching', label: 'The AI customer and the coaching' },
  { id: 'what-is-kept', label: 'What is kept' },
  { id: 'security', label: 'Security' },
  { id: 'limits', label: 'Known limits and reporting a problem' },
];

function PurposeAndLimits() {
  return (
    <ContentSection id="purpose" title="Purpose and limits">
      <p>
        Firefly is a coaching aid for practising customer conversations. It is not an
        employee-performance assessment, and nothing it produces should be used to judge, rank or
        compare people.
      </p>
      <ul>
        <li>
          Scores are practice signals from one simulated call. They show what the coaching evaluator
          found in that transcript, not how good you are at your job.
        </li>
        <li>Firefly never ranks people and never compares one person with another.</li>
        <li>
          Take each report to a mentor. A mentor can add what automatic coaching cannot, such as
          context, tone and what you were trying to do.
        </li>
      </ul>
    </ContentSection>
  );
}

function FictionalData() {
  return (
    <ContentSection id="fictional-data" title="Fictional data only">
      <p>
        Every scenario, customer, organisation and product in Firefly is invented. Treat every call
        as practice with a fictional person.
      </p>
      <p>
        Do not type or say real customer names, case details, log excerpts or anything copied from a
        real case. Firefly is not designed to hold that kind of information.
      </p>
      <p>
        As a safety net, Firefly looks for email addresses, phone numbers, long numbers (such as
        card numbers) and identifiers in each message. It replaces them with a marker such as
        “[email removed]” before the message is saved or sent to a language model. This is pattern
        matching and it will not catch everything, so the safest approach is to enter nothing real.
      </p>
      <p className="ct-note">
        The replacement works on text. Words that came from speech recognition go through the same
        step, but audio is never filtered, so do not say anything real aloud either.
      </p>
    </ContentSection>
  );
}

function SpeechAndAudio() {
  return (
    <ContentSection id="speech" title="Speech and audio">
      <p>
        A call can run in three ways. Which one you get depends on your browser and on how Firefly
        has been set up, and you can always choose a typed call instead. The call brief tells you
        which one applies before you start.
      </p>

      <h3 className="ct-h3">Typed call</h3>
      <p>Nothing is recorded. You type each reply, and Firefly receives only that text.</p>

      <h3 className="ct-h3">Browser speech (Chrome and Edge)</h3>
      <p>
        Your browser’s own speech recognition turns what you say into text. In Chrome and Edge this
        is normally done by the browser maker’s online speech service, so your audio may be
        processed in that company’s cloud under that company’s terms. Some recent browsers can
        recognise speech on your device instead. Either way, Firefly receives the text only. It
        never receives the audio.
      </p>

      <h3 className="ct-h3">Server speech provider (when configured)</h3>
      <p>
        If whoever runs Firefly has configured a speech provider, for example Azure AI Speech, your
        browser sends short audio clips to Firefly’s server. The server passes each clip to the
        provider and returns the text. Firefly keeps no audio: a clip is held in memory only while
        it is being transcribed, it is never written to disk and never logged, and it is discarded
        when the text comes back.
      </p>
      <p>
        If your administrator has configured Azure AI Speech, Microsoft states that, for real-time
        speech to text, audio is processed in memory with no storage at rest by default, unless
        logging is enabled. Firefly does not ask the service to log audio. These are Microsoft’s own
        statements about its service, which Firefly cannot check. Read them at{' '}
        <TextLink href={AZURE_SPEECH_PRIVACY_URL} external>
          Data, privacy and security for Speech to text
        </TextLink>{' '}
        and{' '}
        <TextLink href={AZURE_SPEECH_LOGGING_URL} external>
          How to log audio and transcriptions for speech recognition
        </TextLink>
        .
      </p>

      <h3 className="ct-h3">Your microphone and your voice</h3>
      <ul>
        <li>
          The microphone opens only after you start a voice call. You can mute or stop it at any
          time, the call page shows when it is open, and your browser shows its own indicator while
          it is in use.
        </li>
        <li>
          Firefly does not analyse your voice for emotion, tone, accent or pace. It uses only the
          words that were recognised. The one thing it measures from the audio is loudness, on your
          device, to show that the microphone is working and to notice when you have finished
          speaking.
        </li>
      </ul>

      <h3 className="ct-h3">The customer’s voice</h3>
      <p>
        The customer is played by software, and the voice is synthetic. It is a built-in voice
        supplied by your browser or by the speech provider: not a real person, not a clone and not
        an imitation of anyone. When your browser supplies the voice, the browser decides which
        voice speaks and whether it runs on your device or online. An online voice sends the
        customer’s fictional words to its provider.
      </p>
    </ContentSection>
  );
}

function AiAndCoaching() {
  return (
    <ContentSection id="ai-and-coaching" title="The AI customer and the coaching">
      <h3 className="ct-h3">Demo mode and live mode</h3>
      <p>
        Firefly always says which mode is running. In demo mode, Firefly’s built-in rules engine
        plays the customer and writes the coaching: there is no language model, and the conversation
        and the coaching make no network calls. It is labelled “Demo mode” and is never presented as
        a model. In live mode a language model plays the customer and drafts the coaching, and
        Firefly labels the provider it is using.
      </p>

      <h3 className="ct-h3">What a live model receives</h3>
      <ul>
        <li>
          During a call: the fictional customer’s background and goal, how the customer speaks,
          their mood described in words, only the facts the customer may share in that reply, and
          the conversation so far with personal data replaced.
        </li>
        <li>
          The server, not the model, decides what the customer may reveal in each reply. Facts the
          customer is holding back are left out of what the model receives until the server decides
          they can be shared.
        </li>
        <li>
          After the call: the transcript, the facts the customer held back, how the customer’s mood
          moved and how the call ended, so the model can draft the coaching.
        </li>
        <li>
          Firefly supports Azure OpenAI, Google’s Gemini API and other OpenAI-compatible services.
          Whoever runs Firefly chooses one.
        </li>
      </ul>

      <h3 className="ct-h3">How the output is checked</h3>
      <ul>
        <li>
          Firefly validates what a model returns. Replies that are empty, too long or out of
          character are rejected, and structured answers are checked against fixed schemas before
          they are used.
        </li>
        <li>
          The server tracks the customer’s mood, decides what has been discovered and works out the
          overall score. When a model drafts the coaching, the server checks its scores against the
          evidence.
        </li>
        <li>
          Reports quote only text that is really in your transcript. Every quote is checked against
          the turn it cites, and a quote that cannot be found is dropped.
        </li>
        <li>
          A score cannot be higher than the verified quotes support: a 4 needs at least one verified
          quote and a 5 needs at least two. A short call says that its report rests on limited
          evidence.
        </li>
      </ul>

      <h3 className="ct-h3">What is never penalised</h3>
      <p>
        Scores are never lowered for accent, non-native phrasing, grammar or spelling slips, short
        messages or a terse style, or a communication style that differs from a reviewer’s own.
        Coaching judges behaviours in the call, not personality, and it reads words only: it does
        not assess tone of voice or pace.
      </p>
    </ContentSection>
  );
}

function WhatIsKept() {
  return (
    <ContentSection id="what-is-kept" title="What is kept">
      <ul>
        <li>
          Transcripts, the record of the customer’s mood and coaching reports are stored in a SQLite
          database on the machine that runs Firefly. Firefly does not encrypt that file.
        </li>
        <li>
          There are no accounts, no analytics and no tracking. Firefly sets one cookie, which holds
          a random identifier so that your calls stay separate from other browsers using the same
          server. It is not a login, it is not used to track you, and it lasts up to a year.
        </li>
        <li>
          Server logs contain short identifiers, codes and timings. They never contain transcripts,
          messages or audio.
        </li>
        <li>
          You can delete any call from its report. Deleting removes its transcript, its mood record
          and its coaching report from the database.
        </li>
      </ul>

      <h3 className="ct-h3">If a live model provider is configured</h3>
      <p>
        The scenario text, your messages and the transcript, with personal data replaced, are sent
        to the provider that whoever runs Firefly has chosen, so read that provider’s terms with
        your organisation’s data rules in mind. Demo mode sends nothing to a model provider.
      </p>
      <p>
        For example, Google’s terms for the unpaid Gemini API say that Google may use what is
        submitted to improve its products and that human reviewers may read it. Terms differ by plan
        and by region, so read the current{' '}
        <TextLink href={GEMINI_TERMS_URL} external>
          Gemini API terms
        </TextLink>
        . Whichever provider is used, keep every call fictional.
      </p>
    </ContentSection>
  );
}

function Security() {
  return (
    <ContentSection id="security" title="Security">
      <ul>
        <li>
          Provider keys for the language model and the speech service stay on the server. They are
          never sent to the browser, and Firefly’s error messages never contain them.
        </li>
        <li>
          Firefly sends a strict content security policy. Its pages can load scripts, styles, fonts
          and connections only from Firefly itself, and they cannot be shown inside another site’s
          frame.
        </li>
        <li>
          Requests that change data must come from Firefly’s own address (a same-origin check), and
          the requests from one browser are rate limited.
        </li>
        <li>
          The browser is told that only Firefly’s own pages may use the microphone, and that the
          camera, location and payment features are off.
        </li>
        <li>Text written by a model is shown as plain text, never as HTML.</li>
      </ul>
    </ContentSection>
  );
}

function KnownLimits() {
  return (
    <ContentSection id="limits" title="Known limits and reporting a problem">
      <ul>
        <li>
          Coaching can be wrong. The built-in rules evaluator reads patterns in text, so it can miss
          a good way of saying something or credit a sentence too generously. A language model can
          write fluent coaching and still be mistaken. The quotes in a report let you check what
          each score rests on.
        </li>
        <li>
          Speech recognition can mishear words. If a call was spoken, check the quotes against what
          you said.
        </li>
        <li>
          Demo mode is pattern based. Its customer follows rules, so it is less flexible than a
          person or a language model.
        </li>
        <li>
          Firefly works in English only, and it has not been tested for how well it works for every
          accent or way of speaking. If you see non-native phrasing marked down, treat that as a bug
          and report it.
        </li>
        <li>
          Firefly makes no claim of compliance with any standard or regulation, and nothing on this
          page is legal advice.
        </li>
      </ul>
      <p>
        Found a problem, or something on this page that is not true?{' '}
        <TextLink href={ISSUES_URL} external>
          Open an issue on GitHub
        </TextLink>
        . Please do not paste customer information, real transcripts or keys into an issue.
      </p>
    </ContentSection>
  );
}

export function ResponsibleAiSections() {
  return (
    <>
      <PurposeAndLimits />
      <FictionalData />
      <SpeechAndAudio />
      <AiAndCoaching />
      <WhatIsKept />
      <Security />
      <KnownLimits />
    </>
  );
}
