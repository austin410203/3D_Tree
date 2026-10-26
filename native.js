// Thin bridge to Capacitor plugins. No bundler: native plugins are reached through
// window.Capacitor.Plugins, and every call falls back to a web API (or a no-op)
// so the same files run on the web (Cloudflare) and inside the Android and iOS apps.
const Cap = window.Capacitor;
export const isNative = !!Cap?.isNativePlatform?.();
export const platform = isNative ? Cap.getPlatform() : 'web';
const P = isNative ? Cap.Plugins : {};

let wakeLock = null;

export const native = {
  isNative,

  haptic(kind = 'light') {
    if (P.Haptics) {
      if (kind === 'double') {
        P.Haptics.impact({ style: 'LIGHT' });
        setTimeout(() => P.Haptics.impact({ style: 'LIGHT' }), 90);
      } else P.Haptics.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
    } else navigator.vibrate?.(kind === 'double' ? [8, 60, 8] : kind === 'medium' ? 25 : 12);
  },

  async keepAwake(on) {
    try {
      if (P.KeepAwake) return on ? P.KeepAwake.keepAwake() : P.KeepAwake.allowSleep();
      if (on) wakeLock = await navigator.wakeLock?.request('screen');
      else { await wakeLock?.release(); wakeLock = null; }
    } catch { /* not supported */ }
  },

  // keeps sound playing with the screen off: an Android foreground service, or the iOS playback audio session
  backgroundAudio(on, text, title = '靜心時光') {
    if (!P.BackgroundAudio) return;
    (on ? P.BackgroundAudio.start({ title, text }) : P.BackgroundAudio.stop()).catch(() => {});
  },
  onBackgroundStop(fn) { P.BackgroundAudio?.addListener('stop', fn); },

  // Android back button: handler returns true when it consumed the press
  onBack(fn) {
    P.App?.addListener('backButton', () => { if (!fn()) P.App.minimizeApp(); });
  },

  hideSplash() { P.SplashScreen?.hide().catch(() => {}); },

  statusBar(night) {
    if (!P.StatusBar) return;
    P.StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    P.StatusBar.setStyle({ style: night ? 'DARK' : 'LIGHT' }).catch(() => {});
  },

  // daily reminder (local notification, repeats every day at hour:minute)
  get canRemind() { return !!P.LocalNotifications; },
  async setReminder(on, hour, minute, body, title = '靜心時光') {
    const LN = P.LocalNotifications;
    if (!LN) return false;
    await LN.cancel({ notifications: [{ id: 1 }] }).catch(() => {});
    if (!on) return true;
    const perm = await LN.requestPermissions();
    if (perm.display !== 'granted') return false;
    await LN.schedule({ notifications: [{
      id: 1, title, body,
      schedule: { on: { hour, minute }, allowWhileIdle: true },
    }] });
    return true;
  },
};
