import { useEffect, useState } from 'react';
import { useAuth } from './useAuth.js';
import api from '../services/api.js';
import { errorMessage } from '../utils/auth.js';

function applicationServerKey(value) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

export default function usePushNotifications() {
  const { user } = useAuth();
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [state, setState] = useState({ loading: true, configured: false, enabled: false, permission: supported ? Notification.permission : 'unsupported', error: '' });

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supported) {
        setState({ loading: false, configured: false, enabled: false, permission: 'unsupported', error: '' });
        return;
      }
      try {
        const [{ data }, registration] = await Promise.all([api.get('/notifications/push-config'), navigator.serviceWorker.ready]);
        const subscription = await registration.pushManager.getSubscription();
        if (active) setState({ loading: false, configured: data.enabled, enabled: Boolean(data.enabled && subscription), permission: Notification.permission, error: '' });
      } catch (error) {
        if (active) setState(current => ({ ...current, loading: false, error: errorMessage(error) }));
      }
    }
    void load();
    return () => { active = false; };
  }, [supported, user.id]);

  async function enable() {
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Allow notifications for FitTrack in your browser settings.' : 'Notification permission was not granted.');
      const [{ data }, registration] = await Promise.all([api.get('/notifications/push-config'), navigator.serviceWorker.ready]);
      if (!data.enabled || !data.publicKey) throw new Error('Phone notifications are not configured on this server.');
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(data.publicKey) });
      await api.put('/notifications/push-subscriptions', subscription.toJSON());
      setState({ loading: false, configured: true, enabled: true, permission, error: '' });
    } catch (error) {
      setState(current => ({ ...current, loading: false, permission: Notification.permission, error: errorMessage(error) }));
    }
  }

  async function disable() {
    setState(current => ({ ...current, loading: true, error: '' }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete('/notifications/push-subscriptions', { data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setState(current => ({ ...current, loading: false, enabled: false, error: '' }));
    } catch (error) {
      setState(current => ({ ...current, loading: false, error: errorMessage(error) }));
    }
  }

  return { ...state, supported, enable, disable };
}