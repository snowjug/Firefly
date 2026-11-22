import { TextLink } from '../../design/primitives/TextLink.tsx';
import { ContentSection } from './ContentPage.tsx';
import {
  AZURE_SPEECH_LOGGING_URL,
  AZURE_SPEECH_PRIVACY_URL,
  GEMINI_TERMS_URL,
  ISSUES_URL,
} from './links.ts';

// Every statement on this page describes what this codebase does today, in short bullets with the
// detail folded away. When the behaviour behind a sentence changes, change the sentence; when a
// sentence cannot be checked against the code, it is not here. The sources are
// docs/responsible-ai.md, docs/privacy-audio.md, docs/ai-providers.md, shared/domain/text.ts
// (what is replaced), server/http (what is logged and kept) and server/speech (what is sent where).

function Practice() {
  return (
    <ContentSection
      id="practice"
      title="Practice only"
      bullets={[
        'Customers, organisations and cases are fictional.',
        'Scores are practice signals, not an assessment of you.',
        'Never say or type real customer information.',
      ]}
      detailsLabel="More about practice use"
      details={
        <>
          <p>
            Firefly is a coaching aid for practising customer conversations. It is not an
            employee-performance assessment, and nothing it produces should be used to judge, rank
            or compare people. Take each report to a mentor, who can add what automatic coaching
            cannot: context, tone and what you were trying to do.
          </p>
          <p>
            Scenarios name real Microsoft products, but every person, organisation and case
            reference is invented, and a scenario describes symptoms in a customer’s own words
            rather than stating how a product behaves.
          </p>
          <p>
            As a safety net, Firefly looks for email addresses, phone numbers, long numbers (such as
            card numbers) and identifiers in each message and replaces them with a marker such as
            “[email removed]” before the message is saved or sent to a language model. This is
            pattern matching and will not catch everything. It works on text only: it cannot filter
            audio, so say nothing real aloud either.
          </p>
        </>
      }
    />
  );
}

function Speech() {
  return (
    <ContentSection
      id="speech"
      title="Microphone and speech"
      bullets={[
        'The microphone is used only after you start a voice call.',
        'Mute or stop at any time. A typed call is always possible.',
        'Firefly does not keep audio, and reads words only, not emotion or tone.',
      ]}
      detailsLabel="How speech is handled"
      details={
        <>
          <p>
            Where your speech is processed depends on your browser and on how Firefly has been set
            up.
          </p>
          <h3 className="ct-h3">Typed call</h3>
          <p>Nothing is recorded. Firefly receives only the text you type.</p>
          <h3 className="ct-h3">Browser speech (Chrome and Edge)</h3>
          <p>
            Your browser’s own recognition turns what you say into text. In Chrome and Edge this is
            normally done by the browser maker’s online speech service, so your audio may be
            processed in that company’s cloud under that company’s terms. Some recent browsers
            recognise speech on your device instead. Either way, Firefly receives the text only,
            never the audio.
          </p>
          <h3 className="ct-h3">Server speech provider (when configured)</h3>
          <p>
            Your browser sends short audio clips to Firefly’s server, which passes each one to the
            provider and returns the text. A clip is held in memory only while it is being
            transcribed, is never written to disk or logged, and is discarded when the text comes
            back.
          </p>
          <p>
            If an administrator has configured Azure AI Speech, Microsoft states that, for real-time
            speech to text, audio is processed in memory with no storage at rest by default, unless
            logging is enabled. Firefly does not ask the service to log audio. These are Microsoft’s
            own statements, which Firefly cannot check. Read them at{' '}
            <TextLink href={AZURE_SPEECH_PRIVACY_URL} external>
              Data, privacy and security for Speech to text
            </TextLink>{' '}
            and{' '}
            <TextLink href={AZURE_SPEECH_LOGGING_URL} external>
              How to log audio and transcriptions for speech recognition
            </TextLink>
            .
          </p>
          <h3 className="ct-h3">Your microphone</h3>
          <ul>
            <li>
              It opens only after you start a voice call. You can mute or stop it at any time, and
              your browser shows its own indicator while it is in use.
            </li>
            <li>
              Firefly does not analyse your voice for emotion, tone, accent or pace. It uses only
              the words that were recognised. The one thing it measures from the audio is loudness,
              on your device, to show that the microphone is working and to notice when you have
              finished speaking.
            </li>
          </ul>
          <h3 className="ct-h3">The customer’s voice</h3>
          <p>
            The customer is played by software, and the voice is synthetic: a built-in voice from
            your browser or the speech provider, not a real person, not a clone and not an imitation
            of anyone. An online voice sends the customer’s fictional words to its provider.
          </p>
        </>
      }
    />
  );
}

function AiAndCoaching() {
  return (
    <ContentSection
      id="ai"
      title="AI customer and coaching"
      bullets={[
        'Demo mode is labelled wherever the provider shows.',
        'Every quote in a report is checked against your transcript.',
        'Coaching can be wrong. Review it with a mentor.',
      ]}
      detailsLabel="How the AI and coaching work"
      details={
        <>
          <h3 className="ct-h3">Demo mode and live mode</h3>
          <p>
            Firefly always says which mode is running. In demo mode a built-in rules engine plays
            the customer and writes the coaching: there is no language model, and it is labelled
            “Demo mode”, never presented as a model. In live mode a language model plays the
            customer and drafts the coaching, and Firefly names the provider.
          </p>
          <h3 className="ct-h3">What a live model receives</h3>
          <ul>
            <li>
              During a call: the fictional customer’s background and goal, how they speak, their
              mood in words, only the facts they may share in that reply, and the conversation so
              far with personal data replaced.
            </li>
            <li>
              The server, not the model, decides what the customer may reveal. Facts held back are
              left out of what the model receives until the server decides they can be shared.
            </li>
            <li>
              After the call: the transcript, the facts held back, how the mood moved and how the
              call ended, so the model can draft the coaching.
            </li>
            <li>
              Whoever runs Firefly chooses the provider: Azure OpenAI, Google’s Gemini API or
              another OpenAI-compatible service.
            </li>
          </ul>
          <h3 className="ct-h3">How the output is checked</h3>
          <ul>
            <li>
              Firefly validates what a model returns. Replies that are empty, too long or out of
              character are rejected, and structured answers are checked against fixed schemas.
            </li>
            <li>
              The server tracks the customer’s mood, decides what has been discovered and works out
              the overall score. When a model drafts the coaching, the server checks its scores
              against the evidence.
            </li>
            <li>
              Reports quote only text that is really in your transcript. A quote that cannot be
              found is dropped.
            </li>
            <li>
              A score cannot be higher than the verified quotes support: a 4 needs at least one
              verified quote and a 5 needs at least two. A short call says that its report rests on
              limited evidence.
            </li>
          </ul>
          <h3 className="ct-h3">What is never penalised</h3>
          <p>
            Scores are never lowered for accent, non-native phrasing, grammar or spelling slips,
            short messages, a terse style, or a communication style that differs from a reviewer’s
            own. Coaching judges behaviours in the call, not personality, and reads words only.
          </p>
          <h3 className="ct-h3">Tips, the closing check and wording to try</h3>
          <ul>
            <li>
              In Guided practice, short tips are chosen only from the call stage and how many
              messages you have sent. They never come from the facts the customer holds back.
              Assessment practice shows no tips.
            </li>
            <li>
              The “Ready to close?” check in Guided practice is neutral. It lists what the call has
              covered and never stops you from ending the call.
            </li>
            <li>
              “Better wording” is wording the coaching suggests for your call, shown as a difference
              from your own words. It is something to try, not a script to repeat.
            </li>
          </ul>
          <h3 className="ct-h3">Where the scenarios come from</h3>
          <p>
            Customers, organisations and cases are fictional, and the Microsoft products in them are
            real. The product wording in each scenario was checked against public Microsoft
            documentation, some of it only in part, and reviewed by an AI assistant. None is marked
            as reviewed by a mentor yet. Firefly did not use Microsoft’s internal support wiki, and
            nothing from it is in the scenarios.
          </p>
        </>
      }
    />
  );
}

function Kept() {
  return (
    <ContentSection
      id="kept"
      title="What is kept"
      bullets={[
        'Transcripts and reports stay on the machine that runs Firefly.',
        'No accounts, analytics or tracking.',
        'You can delete a call from its report.',
      ]}
      detailsLabel="What is stored, and security"
      details={
        <>
          <ul>
            <li>
              Transcripts, the record of the customer’s mood and coaching reports are stored in a
              SQLite database on the machine that runs Firefly. Firefly does not encrypt that file.
            </li>
            <li>
              One cookie holds a random identifier so that your calls stay separate from other
              browsers using the same server. It is not a login, it is not used to track you, and it
              lasts up to a year.
            </li>
            <li>
              Server logs hold short identifiers, codes and timings. They never contain transcripts,
              messages or audio.
            </li>
            <li>
              Deleting a call removes its transcript, its mood record and its coaching report from
              the database.
            </li>
          </ul>
          <h3 className="ct-h3">If a live model provider is configured</h3>
          <p>
            The scenario text, your messages and the transcript, with personal data replaced, are
            sent to the provider that whoever runs Firefly has chosen, so read that provider’s terms
            with your organisation’s data rules in mind. Demo mode sends nothing to a model
            provider. For example, Google’s terms for the unpaid Gemini API say that Google may use
            what is submitted to improve its products and that human reviewers may read it. Terms
            differ by plan and by region, so read the current{' '}
            <TextLink href={GEMINI_TERMS_URL} external>
              Gemini API terms
            </TextLink>
            . Whichever provider is used, keep every call fictional.
          </p>
          <h3 className="ct-h3">Security</h3>
          <ul>
            <li>
              Provider keys for the language model and the speech service stay on the server. They
              are never sent to the browser, and Firefly’s error messages never contain them.
            </li>
            <li>
              Firefly sends a strict content security policy. Its pages can load scripts, styles,
              fonts and connections only from Firefly itself, and they cannot be shown inside
              another site’s frame.
            </li>
            <li>
              Requests that change data must come from Firefly’s own address (a same-origin check),
              and the requests from one browser are rate limited.
            </li>
            <li>Text written by a model is shown as plain text, never as HTML.</li>
          </ul>
        </>
      }
    />
  );
}

function Limits() {
  return (
    <ContentSection
      id="limits"
      title="Limits"
      bullets={[
        'No compliance or certification claims.',
        'No official CBCF mapping is applied.',
        'Speech recognition can mishear words: check the quotes.',
      ]}
      detailsLabel="Known limits and reporting"
      details={
        <>
          <ul>
            <li>
              Coaching can be wrong. The built-in rules evaluator reads patterns in text, so it can
              miss a good way of saying something or credit a sentence too generously. A language
              model can write fluent coaching and still be mistaken. The quotes in a report let you
              check what each score rests on.
            </li>
            <li>
              Speech recognition can mishear words. If a call was spoken, check the quotes against
              what you said.
            </li>
            <li>
              Demo mode is pattern based. Its customer follows rules, so it is less flexible than a
              person or a language model.
            </li>
            <li>
              Firefly works in English only, and it has not been tested for how well it works for
              every accent or way of speaking. If you see non-native phrasing marked down, treat
              that as a bug and report it.
            </li>
            <li>
              Firefly makes no claim of compliance with any standard or regulation, and nothing on
              this page is legal advice. The CARE behaviours are a working aid for coaching
              conversations, and no CBCF mapping is applied.
            </li>
          </ul>
          <p>
            Found a problem, or something here that is not true?{' '}
            <TextLink href={ISSUES_URL} external>
              Open an issue on GitHub
            </TextLink>
            . Please do not paste customer information, real transcripts or keys into an issue.
          </p>
        </>
      }
    />
  );
}

export function ResponsibleAiSections() {
  return (
    <>
      <Practice />
      <Speech />
      <AiAndCoaching />
      <Kept />
      <Limits />
    </>
  );
}
