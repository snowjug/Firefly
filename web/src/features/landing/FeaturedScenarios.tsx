import { Component, lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { Icon } from '../../design/icons.tsx';
import { Button } from '../../design/primitives/Button.tsx';
import { useAnnouncer } from '../../design/primitives/LiveRegion.tsx';
import { Skeleton } from '../../design/primitives/Skeleton.tsx';
import { TextLink } from '../../design/primitives/TextLink.tsx';
import { api } from '../../lib/api.ts';
import { useApi, useOnline } from '../../lib/hooks.ts';
import { pickFeatured } from './featured.ts';
import { FEATURED, FEATURED_ID } from './landing-copy.ts';
import './featured.css';

// The gallery and the card are another chunk: this file is only the heading, the request and the
// states around it. The chunk is asked for as the page opens, in step with the request, so the two
// arrive together.
const loadCarousel = () => import('./FeaturedCarousel.tsx');
const FeaturedCarousel = lazy(loadCarousel);

/** Grey cards in the place of the real ones, so the page does not move when they arrive. */
function FeaturedSkeleton() {
  return (
    <div className="lp-featured__loading" aria-busy="true">
      <p className="visually-hidden">{FEATURED.loading}</p>
      <div className="lp-featured__skeletons" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="lp-featured__skeleton">
            <Skeleton width="40%" />
            <Skeleton width="85%" height="1.25rem" />
            <Skeleton width="70%" />
            <Skeleton width="55%" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** One quiet line: what happened, a way to try again and a plain link to all the scenarios. */
function Quiet({ message, onRetry }: { message: string; onRetry(): void }) {
  const online = useOnline();
  const announce = useAnnouncer();
  useEffect(() => {
    announce(message);
  }, [message, announce]);
  return (
    <div className="lp-featured__quiet">
      <Icon name={online ? 'info' : 'warning'} size={18} />
      <p>{message}</p>
      <Button appearance="subtle" size="small" onClick={onRetry}>
        {FEATURED.retry}
      </Button>
      <TextLink to="/scenarios">{FEATURED.browse}</TextLink>
    </div>
  );
}

/** Catches the one thing the request cannot: the gallery's own chunk failing to arrive. */
class Contain extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The featured scenarios, the one part of the landing page that asks the server for anything. The
 * rest of the page never waits for it. While it loads there are grey cards; if it fails, or the
 * visitor is offline, there is one quiet line with a way to try again and a plain link to all the
 * scenarios, never an empty or broken block.
 */
export function FeaturedScenarios() {
  const { data, error, loading, reload } = useApi((signal) => api.scenarios(signal), []);
  const online = useOnline();
  const scenarios = useMemo(() => (data ? pickFeatured(data) : []), [data]);
  const failed = !loading && (error !== null || scenarios.length === 0);
  const message = online ? FEATURED.failed : FEATURED.offline;

  useEffect(() => {
    loadCarousel().catch(() => undefined);
  }, []);

  return (
    <section
      id={FEATURED_ID}
      className="lp-section lp-featured"
      aria-labelledby="lp-featured-title"
    >
      <div className="l-page lp-section__inner">
        <div className="lp-featured__head">
          <div className="lp-section__head">
            <h2 id="lp-featured-title" className="lp-title">
              {FEATURED.title}
            </h2>
            <p className="lp-lead">{FEATURED.lead}</p>
          </div>
          {!loading && !failed ? (
            <TextLink to="/scenarios" className="lp-featured__all">
              {FEATURED.all}
              <Icon name="arrow-right" size={16} />
            </TextLink>
          ) : null}
        </div>

        {loading ? <FeaturedSkeleton /> : null}
        {failed ? <Quiet message={message} onRetry={reload} /> : null}
        {!loading && !failed ? (
          <Contain
            fallback={<Quiet message={FEATURED.failed} onRetry={() => window.location.reload()} />}
          >
            <Suspense fallback={<FeaturedSkeleton />}>
              <FeaturedCarousel scenarios={scenarios} />
            </Suspense>
          </Contain>
        ) : null}
      </div>
    </section>
  );
}
