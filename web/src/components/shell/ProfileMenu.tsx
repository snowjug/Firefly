import { Link, useNavigate } from 'react-router';
import { clearProfile, initials, useProfile } from '../../lib/profile.ts';
import { Icon } from '../Icon.tsx';
import { usePopover } from './usePopover.ts';

/** The person's avatar, with a small menu: profile and settings, and "sign out" of this device. */
export function ProfileMenu() {
  const profile = useProfile();
  const navigate = useNavigate();
  const { open, setOpen, toggle, wrapRef, onBlur } = usePopover();

  return (
    <div className="icon-button-wrap" ref={wrapRef} onBlur={onBlur}>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="profile-panel"
        aria-label={
          profile ? `${initials(profile.name)}, account menu for ${profile.name}` : 'Account menu'
        }
        onClick={toggle}
        style={{ padding: 0 }}
      >
        <span className="avatar-initials">
          {profile ? initials(profile.name) : <Icon name="user" size={18} />}
        </span>
      </button>
      {open ? (
        <div
          className="popover"
          id="profile-panel"
          role="region"
          aria-label="Account"
          style={{ width: 280 }}
        >
          {profile ? (
            <>
              <div className="popover-head" style={{ alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{profile.name}</p>
                  <p className="t-meta">{profile.role || 'Practice profile'}</p>
                </div>
              </div>
              <Link to="/settings" className="popover-item" onClick={() => setOpen(false)}>
                <Icon name="gear" size={18} /> Profile &amp; settings
              </Link>
              <button
                type="button"
                className="popover-item"
                onClick={() => {
                  clearProfile();
                  setOpen(false);
                  void navigate('/');
                }}
              >
                <Icon name="log-out" size={18} /> Sign out of this device
              </button>
              <p className="t-meta" style={{ padding: 'var(--sp-2) var(--sp-3) var(--sp-3)' }}>
                Your profile is stored in this browser only. Signing out forgets it here; saved
                practice calls are kept.
              </p>
            </>
          ) : (
            <>
              <p className="popover-empty" style={{ paddingBottom: 'var(--sp-3)' }}>
                You have not set up a profile on this device yet.
              </p>
              <Link to="/sign-in" className="popover-item" onClick={() => setOpen(false)}>
                <Icon name="user" size={18} /> Create your profile
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
