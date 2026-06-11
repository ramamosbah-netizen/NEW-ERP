import { supabase } from '@/lib/supabase';

// Utility helper to convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushService = {
  /**
   * Prompts the browser for notification permissions, registers with Service Worker PushManager,
   * and upserts the VAPID subscription keys into the public.push_subscriptions table.
   */
  async registerPushNotifications(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported in this browser environment.');
        return;
      }

      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission was denied by the user.');
      }

      // 2. Await service worker registration readiness
      const registration = await navigator.serviceWorker.ready;

      // 3. Resolve VAPID Public Key from environment
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable.');
      }

      // 4. Retrieve or create push subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      // 5. Package and upload keys to Supabase database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to link push subscriptions.');

      const subscriptionJSON = subscription.toJSON();
      const endpoint = subscriptionJSON.endpoint;
      const p256dh = subscriptionJSON.keys?.p256dh;
      const auth = subscriptionJSON.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        throw new Error('Failed to resolve valid keys from browser push subscription.');
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint,
          keys_p256dh: p256dh,
          keys_auth: auth,
          created_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });

      if (error) throw error;
      console.log('Push notification subscription linked successfully.');
    } catch (err) {
      console.error('Failed to register for push notifications:', err);
      throw err;
    }
  },

  /**
   * Cleans up push subscription from database on user sign out.
   */
  async unsubscribePush(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        const endpoint = subscription.endpoint;
        
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);
          
        // Unsubscribe from browser
        await subscription.unsubscribe();
        console.log('Unsubscribed push notifications successfully.');
      }
    } catch (err) {
      console.error('Failed to unsubscribe push notifications:', err);
    }
  }
};

export default pushService;
