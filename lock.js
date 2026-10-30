// Domain lock: if the game is copied whole onto another site, send players to the official address.
// Imported first by the entry module so it runs before anything else; the throw stops the rest of the game.
// Only web pages are checked: file://, the iOS app (capacitor://) and the desktop build (app://) always run.
// Allowed web hosts: emptyoffice.app, our own *.workers.dev and local dev/test hosts.
const HOME = 'https://calm.emptyoffice.app/';
const host = location.hostname;
const official = !/^https?:$/.test(location.protocol)
  || /(^|\.)emptyoffice\.app$/.test(host) || /\.austin410203\.workers\.dev$/.test(host)
  || host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '[::1]';
if (!official) {
  location.replace(HOME);
  throw new Error('unofficial host: ' + host);
}
