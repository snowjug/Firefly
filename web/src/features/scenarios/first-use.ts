import { useCallback, useState } from 'react';

// The first-use notice is shown until it has been read: acknowledged, or a call has been started.
// The flag lives in this browser only. Where storage is blocked, the notice simply shows again.

const KEY = 'firefly.voice-notice-seen';

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function write(): void {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Storage is blocked: nothing to remember, and nothing is lost by showing the notice again.
  }
}

export function useFirstUseNotice(): { seen: boolean; markSeen(): void } {
  const [seen, setSeen] = useState(read);
  const markSeen = useCallback(() => {
    write();
    setSeen(true);
  }, []);
  return { seen, markSeen };
}
