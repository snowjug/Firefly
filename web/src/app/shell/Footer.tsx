import { TextLink } from '../../design/primitives/TextLink.tsx';
import { ThemeSelect } from '../../design/theme/ThemeToggle.tsx';
import './footer.css';

export const REPOSITORY_URL = 'https://github.com/snowjug/Firefly';

/**
 * The footer: one line about what Firefly is, and three links. There is no version string and no
 * legal text that is not true.
 */
export function Footer() {
  return (
    <footer className="ff-footer">
      <div className="ff-footer__inner l-page">
        <p className="ff-footer__text">A training aid. Customers and scenarios are fictional.</p>
        <div className="ff-footer__end">
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
          <ThemeSelect />
        </div>
      </div>
    </footer>
  );
}
