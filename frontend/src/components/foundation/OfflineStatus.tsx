import { useEffect, useState } from 'react';

export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => { window.removeEventListener('online', updateStatus); window.removeEventListener('offline', updateStatus); };
  }, []);

  if (isOnline) return null;
  return <div className="offline-status" role="status" aria-live="polite">You’re offline. Changes may not be saved.</div>;
}
