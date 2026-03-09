// Service Worker for Background Notifications
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, timestamp } = event.data;
    
    const delay = timestamp - Date.now();
    
    if (delay > 0) {
      setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: '/icon.png',
          badge: '/badge.png',
          vibrate: [200, 100, 200],
          tag: 'panchang-notification',
          requireInteraction: true
        });
      }, delay);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
