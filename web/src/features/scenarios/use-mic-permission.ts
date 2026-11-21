import { useEffect, useState } from 'react';
import type { Permission } from './mic-readiness.ts';

function toPermission(state: PermissionState): Permission {
  return state === 'granted' || state === 'denied' || state === 'prompt' ? state : 'unknown';
}

/**
 * What the browser says about microphone permission, kept up to date. Asking does not open the
 * microphone and never shows a prompt. Browsers that cannot say (or throw for this name) read as
 * `unknown`.
 */
export function useMicrophonePermission(): Permission {
  const [permission, setPermission] = useState<Permission>('unknown');
  useEffect(() => {
    const permissions = typeof navigator === 'undefined' ? undefined : navigator.permissions;
    if (!permissions || typeof permissions.query !== 'function') return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const update = () => {
      if (status && !cancelled) setPermission(toPermission(status.state));
    };
    permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        update();
        result.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      status?.removeEventListener('change', update);
    };
  }, []);
  return permission;
}
