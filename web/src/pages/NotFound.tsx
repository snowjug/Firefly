import { NotFoundNotice } from '../components/frame/Notices.tsx';
import { useProfile } from '../lib/profile.ts';

/** The page for an address that is not a page (the router's `*`). */
export default function NotFound() {
  return <NotFoundNotice signedIn={useProfile() !== null} />;
}
