import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { query } from './db.js';

// Durable outbox: events are recorded by a database trigger in the same transaction.
let flushing = false;
export async function flushNotifications() {
  if (flushing || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return;
  flushing = true;
  try {
    if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
    const { rows } = await query('SELECT * FROM notification_outbox WHERE sent_at IS NULL ORDER BY id LIMIT 50');
    for (const row of rows) {
      try {
        await getMessaging().send({
          topic: `college_${row.college_id}`,
          data: { event: JSON.stringify(row.payload) },
          android: { priority: 'high', ttl: 24 * 60 * 60 * 1000 }
        });
        await query('UPDATE notification_outbox SET sent_at=NOW() WHERE id=$1', [row.id]);
      } catch (error) { console.error('Notification delivery failed:', error.code || error.message); }
    }
  } catch (error) { console.error('Notification outbox:', error.message); }
  finally { flushing = false; }
}
