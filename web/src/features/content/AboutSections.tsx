import { CARE_LABELS, DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { Tag, TextLink } from '../../design/index.ts';
import { useAppConfig } from '../../lib/config.tsx';
import { ContentSection } from './ContentPage.tsx';
import { CONTRIBUTORS_URL, ISSUES_URL, REPOSITORY_URL } from './links.ts';

function WhatFireflyIs() {
  return (
    <ContentSection id="what" title="What Firefly is">
      <p>
        Firefly is for new technical-support engineers and apprentices. It trains customer handling
        and case-conversation quality, such as how you open a call, scope an unclear problem, handle
        a frustrated customer and agree next steps. It is product-agnostic: it does not teach
        knowledge of any one technology.
      </p>
      <p>
        Every customer and scenario is fictional, and scores are practice coaching, not
        employee-performance assessment.
      </p>
    </ContentSection>
  );
}

function WhoMadeIt() {
  return (
    <ContentSection id="who" title="Who made it">
      <p>
        Firefly is a collaborative FY27 apprentice project.{' '}
        <TextLink href={CONTRIBUTORS_URL} external>
          Contributors on GitHub
        </TextLink>
      </p>
    </ContentSection>
  );
}

function HowItWorks() {
  return (
    <ContentSection id="how" title="How it works">
      <p>
        A scenario engine keeps track of the customer’s mood and decides what the customer is ready
        to share at each point in the call. In demo mode, the default, a built-in rules engine plays
        the customer and writes the coaching, with no AI model involved. If whoever runs Firefly
        connects a language-model provider, the model plays the customer and drafts the coaching
        instead. Either way, an evaluator checks every quote in the report against your transcript
        before the report is saved.
      </p>
    </ContentSection>
  );
}

function CoachingSkills() {
  return (
    <ContentSection id="skills" title="The six coaching skills">
      <p>
        Every report scores the same six skills from 1 to 5, each worked out from what was said in
        the transcript.
      </p>
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
    </ContentSection>
  );
}

function Status() {
  const { config } = useAppConfig();
  const version = config?.app.version;
  return (
    <ContentSection id="status" title="Status">
      <dl className="ct-defs ct-defs--status">
        {version ? (
          <div className="ct-def">
            <dt>Version</dt>
            <dd>{version}</dd>
          </div>
        ) : null}
        <div className="ct-def">
          <dt>Where it runs</dt>
          <dd>Runs on your own machine. Not deployed.</dd>
        </div>
        <div className="ct-def">
          <dt>Licence</dt>
          <dd>The repository does not currently specify a licence.</dd>
        </div>
      </dl>
    </ContentSection>
  );
}

function MoreInformation() {
  return (
    <ContentSection id="links" title="More information">
      <ul className="ct-links" role="list">
        <li>
          <TextLink to="/responsible-ai">Responsible AI</TextLink>
          <span className="ct-note">
            What Firefly does with your words, your voice and the models.
          </span>
        </li>
        <li>
          <TextLink href={REPOSITORY_URL} external>
            Source on GitHub
          </TextLink>
          <span className="ct-note">The repository.</span>
        </li>
        <li>
          <TextLink href={ISSUES_URL} external>
            Report a problem
          </TextLink>
          <span className="ct-note">Please do not paste customer information.</span>
        </li>
      </ul>
    </ContentSection>
  );
}

export function AboutSections() {
  return (
    <>
      <WhatFireflyIs />
      <WhoMadeIt />
      <HowItWorks />
      <CoachingSkills />
      <Status />
      <MoreInformation />
    </>
  );
}
