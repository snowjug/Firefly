import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageFrame, PageHead, Section } from './index.ts';

describe('PageFrame', () => {
  it('sets the document title and holds the page to the chosen width', () => {
    const { container } = render(
      <PageFrame title="Missions" width="narrow" className="extra">
        <p>Body</p>
      </PageFrame>,
    );
    expect(document.title).toBe('Missions · Firefly');
    const frame = container.firstElementChild;
    expect(frame).toHaveClass('frame', 'frame--narrow', 'extra');
    expect(frame).toHaveTextContent('Body');
  });

  it('uses the default width when none is given', () => {
    const { container } = render(<PageFrame title="Home">x</PageFrame>);
    expect(container.firstElementChild).toHaveClass('frame--default');
  });
});

describe('PageHead', () => {
  it('is the page title (h1) with an eyebrow, a lead and actions', () => {
    render(
      <PageHead
        eyebrow="Plate I"
        title="The mission field"
        lead="Thirteen practice calls."
        actions={<button type="button">Start</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'The mission field' })).toBeVisible();
    expect(screen.getByText('Plate I')).toBeInTheDocument();
    expect(screen.getByText('Thirteen practice calls.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('can be a level 2 head in a plain wrapper, and has no empty parts', () => {
    const { container } = render(<PageHead level={2} as="div" title="Inside a page" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Inside a page' })).toBeVisible();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(
      container.querySelector('.ff-head__eyebrow, .ff-head__lead, .ff-head__actions'),
    ).toBeNull();
  });

  it('keeps a very long unbroken title in the document', () => {
    const title = 'Supercalifragilisticexpialidocious'.repeat(4);
    render(<PageHead title={title} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
  });
});

describe('Section', () => {
  it('is a region named by its heading, with an eyebrow and an aside', () => {
    render(
      <Section id="skills" eyebrow="02" title="Skills" aside={<a href="#all">View all</a>}>
        <p>Content</p>
      </Section>,
    );
    const region = screen.getByRole('region', { name: 'Skills' });
    expect(region).toHaveAttribute('id', 'skills');
    expect(screen.getByRole('heading', { level: 2, name: 'Skills' })).toBeInTheDocument();
    expect(region).toHaveTextContent('02');
    expect(screen.getByRole('link', { name: 'View all' })).toBeInTheDocument();
    expect(region).toHaveTextContent('Content');
  });

  it('can be a level 3 section inside another', () => {
    render(<Section title="Nested" level={3} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Nested' })).toBeInTheDocument();
  });
});
