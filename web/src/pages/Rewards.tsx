import { Navigate } from 'react-router';

/**
 * Rewards live inside Progress now: points, badges and challenges are its "Recognition" part. This
 * page stays so every old link, bookmark and the palette's address still lands in the right place.
 */
export default function Rewards() {
  return <Navigate to={{ pathname: '/progress', hash: '#recognition' }} replace />;
}
