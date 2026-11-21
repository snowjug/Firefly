import {
  CARE_LABELS,
  DIMENSION_IDS,
  DIMENSIONS,
  PRODUCT_FAMILIES,
  PRODUCT_FAMILY_LABELS,
} from '#shared/domain/vocab.ts';
import { Tag } from '../../design/primitives/Badge.tsx';
import { TextLink } from '../../design/primitives/TextLink.tsx';
import { useAppConfig } from '../../lib/config.tsx';
import { ContentSection } from './ContentPage.tsx';
import { CONTRIBUTORS_URL, ISSUES_URL, REPOSITORY_URL } from './links.ts';

/** "Microsoft 365, Windows, Azure and Dynamics 365": the product families, in the vocabulary's order. */
function listOf(items: readonly string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function WhatItIs() {
  return (
    <ContentSection
      id="what"
      title="What it is"
      bullets={[
        'Practise a support call by voice with a synthetic customer.',
        `Scenarios cover ${listOf(PRODUCT_FAMILIES.map((family) => PRODUCT_FAMILY_LABELS[family]))}.`,
        'Coaching quotes your transcript, so you can check it.',
        <>
          A collaborative FY27 apprentice project.{' '}
          <TextLink href={CONTRIBUTORS_URL} external>
            Contributors on GitHub
          </TextLink>
        </>,
      ]}
      detailsLabel="More about Firefly"
      details={
        <>
          <p>
            Firefly is for new technical-support engineers and apprentices. It trains customer
            handling and case-conversation quality, such as how you open a call, scope an unclear
            problem, handle a frustrated customer and agree next steps. It does not teach product
            knowledge: Microsoft product names are used so that practice feels real, and scenarios
            describe what a customer sees in everyday words without stating how a product behaves.
          </p>
          <p>
            A scenario engine keeps track of the customer’s mood and decides what the customer is
            ready to share at each point in the call. In demo mode, the default, a built-in rules
            engine plays the customer and writes the coaching, with no AI model involved. If whoever
            runs Firefly connects a language-model provider, the model plays the customer and drafts
            the coaching instead. Either way, an evaluator checks every quote in the report against
            your transcript before the report is saved.
          </p>
        </>
      }
    />
  );
}

function Coaching() {
  return (
    <ContentSection
      id="coaching"
      title="Coaching"
      bullets={[
        'Six skills, each scored from 1 to 5.',
        'Every score shows the quotes it rests on.',
        'Scores are practice signals, not an assessment.',
      ]}
      detailsLabel="The six skills"
      details={
        <>
          <dl className="ct-defs">
            {DIMENSION_IDS.map((id) => (
              <div key={id} className="ct-def">
                <dt>{DIMENSIONS[id].label}</dt>
                <dd>{DIMENSIONS[id].description}</dd>
                <dd className="ct-def__tags">
                  <span className="visually-hidden">CARE behaviours: </span>
                  {DIMENSIONS[id].care.map((behaviour) => (
                    <Tag key={behaviour} size="small">
                      {CARE_LABELS[behaviour]}
                    </Tag>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="ct-note">
            The mapping to the CARE behaviours is a working aid for coaching conversations, not an
            official standard.
          </p>
        </>
      }
    />
  );
}

function Status() {
  const { config } = useAppConfig();
  const version = config?.app.version;
  return (
    <ContentSection
      id="status"
      title="Status"
      bullets={[
        ...(version ? [`Version ${version}.`] : []),
        'Runs on your own machine. Not deployed.',
        'The repository does not currently specify a licence.',
      ]}
    />
  );
}

function More() {
  return (
    <ContentSection
      id="links"
      title="More"
      bullets={[
        <TextLink key="rai" to="/responsible-ai">
          Responsible AI
        </TextLink>,
        <TextLink key="source" href={REPOSITORY_URL} external>
          Source on GitHub
        </TextLink>,
        <>
          <TextLink href={ISSUES_URL} external>
            Report a problem
          </TextLink>
          . Please do not paste customer information.
        </>,
      ]}
    />
  );
}

export function AboutSections() {
  return (
    <>
      <WhatItIs />
      <Coaching />
      <Status />
      <More />
    </>
  );
}
