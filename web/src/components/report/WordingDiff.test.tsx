import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { WordingDiff, isEditOf } from './WordingDiff.tsx';

const BEFORE = 'I think you should restart it now';
const AFTER = 'I think you should restart it first';

describe('isEditOf', () => {
  it('is an edit when the two share at least three words and two in five of the shorter one', () => {
    expect(isEditOf({ kept: 6, removed: 1, added: 1 })).toBe(true);
    expect(isEditOf({ kept: 3, removed: 1, added: 1 })).toBe(true);
  });

  it('is a different sentence when little is shared, and nothing when nothing changed', () => {
    expect(isEditOf({ kept: 2, removed: 1, added: 1 })).toBe(false);
    expect(isEditOf({ kept: 3, removed: 7, added: 7 })).toBe(false);
    expect(isEditOf({ kept: 6, removed: 0, added: 0 })).toBe(false);
    expect(isEditOf({ kept: 0, removed: 0, added: 0 })).toBe(false);
  });
});

describe('WordingDiff', () => {
  it('is just the wording when there was nothing said to compare it to', () => {
    render(<WordingDiff before={null} after="What does the screen say?" />);
    expect(screen.getByText('What does the screen say?')).toHaveClass('wd__plain');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is just the wording when the two have little in common', () => {
    render(
      <WordingDiff before="Please clear your cache." after="Could you tell me what happened?" />,
    );
    expect(screen.getByText('Could you tell me what happened?')).toHaveClass('wd__plain');
    expect(screen.queryByRole('button', { name: 'Show what changed' })).not.toBeInTheDocument();
  });

  it('keeps the plain wording in the page for screen readers, and draws the change for the eye only', () => {
    const { container } = render(<WordingDiff before={BEFORE} after={AFTER} />);
    expect(screen.getByText(AFTER, { selector: 'p.sr-only' })).toBeInTheDocument();
    const drawn = container.querySelector('.wd__line') as HTMLElement;
    expect(drawn).toHaveAttribute('aria-hidden', 'true');
    // The old word is in the drawing but not in what is read out.
    expect(drawn).toHaveTextContent('now');
    expect(container.querySelector('.sr-only')).not.toHaveTextContent('now');
    expect(container.querySelectorAll('.wd__word[data-kind="remove"]')).toHaveLength(1);
    expect(container.querySelectorAll('.wd__word[data-kind="add"]')).toHaveLength(1);
  });

  it('says in words what changed, and explains the marks once they are shown', async () => {
    const user = userEvent.setup();
    const { container } = render(<WordingDiff before={BEFORE} after={AFTER} />);
    const toggle = screen.getByRole('button', { name: 'Show what changed' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAccessibleDescription('6 words kept, 1 taken out, 1 put in.');
    expect(container.querySelector('.wd')).toHaveAttribute('data-view', 'after');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.wd')).toHaveAttribute('data-view', 'changes');
    expect(toggle).toHaveAccessibleDescription(
      '6 words kept, 1 taken out, 1 put in. Struck-through words come out; underlined words go in.',
    );
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('hands over the plain wording to copy from, whichever way it is shown', () => {
    const edit = createRef<HTMLParagraphElement>();
    const { unmount } = render(<WordingDiff before={BEFORE} after={AFTER} textRef={edit} />);
    expect(edit.current).toHaveTextContent(AFTER);
    unmount();
    const plain = createRef<HTMLParagraphElement>();
    render(<WordingDiff before={null} after="What does it say?" textRef={plain} />);
    expect(plain.current).toHaveTextContent('What does it say?');
  });
});
