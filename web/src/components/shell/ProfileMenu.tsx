import { Link, useNavigate } from 'react-router';
import { clearProfile, initials, useProfile } from '../../lib/profile.ts';
import { Icon } from '../Icon.tsx';
import { usePopover } from './usePopover.ts';

/** Who is using this device, with a small menu: profile and settings, and signing out of it. */
export function ProfileMenu() {
  const profile = useProfile();
  const navigate = useNavigate();
  const { open, setOpen, toggle, wrapRef, triggerRef, onBlur } = usePopover();

  return (
    <div className="flyout-wrap" ref={wrapRef} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="util util--profile"
        aria-expanded={open}
        aria-controls="profile-panel"
        aria-label={
          profile ? `${initials(profile.name)}, account menu for ${profile.name}` : 'Account menu'
        }
        title={profile ? `Account menu for ${profile.name}` : 'Account menu'}
        onClick={toggle}
      >
        <span className="util__initials" aria-hidden="true">
          {profile ? initials(profile.name) : <Icon name="user" size={16} />}
        </span>
      </button>
      {open ? (
        <div
          className="flyout flyout--narrow glass glass--inspector"
          id="profile-panel"
          role="region"
          aria-label="Account"
        >
          {profile ? (
            <>
              <div className="flyout__head">
                <div>
                  <p className="flyout__name">{profile.name}</p>
                  <p className="flyout__meta">{profile.role || 'Practice profile'}</p>
                </div>
              </div>
              <ul role="list" className="flyout__list">
                <li>
                  <Link to="/settings" className="flyout__item" onClick={() => setOpen(false)}>
                    <Icon name="gear" size={16} />
                    <span className="flyout__text">Profile &amp; settings</span>
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="flyout__item"
                    onClick={() => {
                      clearProfile();
                      setOpen(false);
                      void navigate('/');
                    }}
                  >
                    <Icon name="log-out" size={16} />
                    <span className="flyout__text">Sign out of this device</span>
                  </button>
                </li>
              </ul>
              <p className="flyout__note">
                Your profile is stored in this browser only. Signing out forgets it here; saved
                practice calls are kept.
              </p>
            </>
          ) : (
            <>
              <p className="flyout__empty">You have not set up a profile on this device yet.</p>
              <ul role="list" className="flyout__list">
                <li>
                  <Link to="/sign-in" className="flyout__item" onClick={() => setOpen(false)}>
                    <Icon name="user" size={16} />
                    <span className="flyout__text">Create your profile</span>
                  </Link>
                </li>
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
