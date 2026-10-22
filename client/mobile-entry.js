import { registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const CampusNotifications = registerPlugin('CampusNotifications');
window.CRMS = {
  native: true,
  apiUrl: __API_URL__,
  notifications: CampusNotifications,
  geolocation: {
    getCurrentPosition(success, failure, options) {
      Geolocation.getCurrentPosition(options).then(success, failure);
    },
    watchPosition(success, failure, options) {
      return Geolocation.watchPosition(options, (position, error) => error ? failure(error) : success(position));
    },
    clearWatch(id) { Promise.resolve(id).then(id => Geolocation.clearWatch({ id })).catch(() => {}); }
  }
};
await import('./app.js');
