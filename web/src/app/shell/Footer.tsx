import { TextLink } from '../../design/primitives/TextLink.tsx';
import { Wordmark } from './Wordmark.tsx';
import './footer.css';

export const REPOSITORY_URL = 'https://github.com/snowjug/Firefly';

/**
 * The footer: what Firefly is, and three links. The slim form (inside the app) leaves out the
 * wordmark. There is no version string and no legal text that is not true.
 */
export function Footer({ slim = false }: { slim?: boolean }) {
  return (
    <footer className={slim ? 'ff-footer ff-footer--slim' : 'ff-footer'}>
      <div className="ff-footer__inner l-page">
        <div className="ff-footer__about">
          {slim ? null : <Wordmark size="sm" />}
          <p className="ff-footer__text">
            Firefly is a training aid. Every customer and scenario is fictional.
          </p>
        </div>
        <ul className="ff-footer__links" role="list">
          <li>
            <TextLink to="/responsible-ai" tone="inherit">
              Responsible AI
            </TextLink>
          </li>
          <li>
            <TextLink to="/about" tone="inherit">
              About
            </TextLink>
          </li>
          <li>
            <TextLink href={REPOSITORY_URL} external tone="inherit">
              Source on GitHub
            </TextLink>
          </li>
        </ul>
      </div>
    </footer>
  );
}
