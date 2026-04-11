/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — Service Worker v2.0
   NOTIFICAÇÕES APENAS — sem cache, sem offline storage
   A aplicação carrega sempre da rede (fresh).
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── INSTALL: activar imediatamente, limpar cache antigo ── */
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    })
  );
});

/* ── ACTIVATE: tomar controlo, apagar qualquer cache ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

/* ── FETCH: sem intercepção — rede normal sempre ── */
self.addEventListener('fetch', function() { return; });

/* ══════════════════════════════════════════════
   PUSH NOTIFICATIONS
══════════════════════════════════════════════ */
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch(err) { try { data = { body: e.data ? e.data.text() : '' }; } catch(e2) {} }

  var title  = data.title  || 'DynamicWorks Angola';
  var body   = data.body   || 'Nova notificação da plataforma.';
  var icon   = data.icon   || '/icon-192.png';
  var tag    = data.tag    || 'dw-' + Date.now();
  var url    = data.url    || '/';
  var type   = data.type   || 'info';

  var prefixes = { ranking:'🏆', alert:'⚡', update:'🆕', info:'📢', trade:'💹' };

  e.waitUntil(
    self.registration.showNotification((prefixes[type] || '📢') + ' ' + title, {
      body    : body,
      icon    : icon,
      badge   : icon,
      tag     : tag,
      data    : { url: url, type: type },
      vibrate : type === 'alert' ? [300,100,300,100,300] : [200,100,200],
      requireInteraction: type === 'alert',
      actions : [
        { action: 'open',    title: 'Abrir' },
        { action: 'dismiss', title: 'Fechar' }
      ]
    })
  );
});

/* ── Clique na notificação ── */
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  if (e.action === 'dismiss') return;
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clients) {
        for (var i = 0; i < clients.length; i++) {
          if (clients[i].url.includes(self.location.origin) && 'focus' in clients[i]) {
            clients[i].focus();
            if ('navigate' in clients[i]) clients[i].navigate(url);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});

/* ── Mensagens da app para o SW ── */
self.addEventListener('message', function(e) {
  if (!e.data) return;
  if (e.data.type === 'PING') {
    if (e.source) e.source.postMessage({ type: 'PONG', version: '2.0' });
    return;
  }
  if (e.data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (e.data.type === 'SHOW_NOTIFICATION') {
    var d = e.data.payload || {};
    self.registration.showNotification(d.title || 'DynamicWorks', {
      body: d.body || '', icon: d.icon || '/icon-192.png',
      tag: d.tag || 'dw-local', data: { url: d.url || '/' }, vibrate: [200,100,200],
    });
  }
});