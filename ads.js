// Rewarded ads in the free version: watch one ad to try a locked scene for a day (store.js trials).
// Calm Moments only uses rewarded ads the user asks for — no interstitials, no banners
// (Company/playbooks/ads-monetization.md). Nothing is shown once the Full Version is owned.
//  - app (iOS / Android): Google AdMob rewarded video. AdMob is set up on the first ad request, not at
//    launch: Google's consent form (EU/UK, UMP) first, then Apple's tracking prompt (ATT) on iOS;
//    people who don't allow tracking get non-personalised ads
//  - web: until AdSense approves the site, a 5-second card recommending another Empty Office app
//    (a "house ad": no third-party scripts, no tracking)
//  - localhost with ?adtest: a fake 3-second ad, so the whole flow can be tried in a desktop browser
// Until the real IDs below are filled in, the app shows Google's public test ads.
import { isNative, platform } from './native.js';
import { t, getLang } from './i18n.js';

const ADMOB = {
  test: true,   // false once the real ad unit IDs are in
  ios: { reward: 'ca-app-pub-3940256099942544/1712485313' },
  android: { reward: 'ca-app-pub-3940256099942544/5224354917' },
};
export const DAILY_LIMIT = 5;   // rewarded ads per person per day

const AdMob = isNative ? window.Capacitor.Plugins.AdMob : null;
const fake = (() => { try { return !isNative && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('adtest'); } catch { return false; } })();

// ---------- daily limit ----------
const COUNT_KEY = 'seasontree.ads';
const today = () => new Date().toDateString();
function countToday() {
  try { const c = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}'); return c.day === today() ? c.n : 0; } catch { return 0; }
}
function bump() {
  try { localStorage.setItem(COUNT_KEY, JSON.stringify({ day: today(), n: countToday() + 1 })); } catch { /* storage blocked */ }
}
export const adsLeftToday = () => Math.max(0, DAILY_LIMIT - countToday());

// ---------- AdMob setup, on first use ----------
let setup = null, npa = true;
function setupAdMob() {
  setup ??= (async () => {
    await AdMob.initialize({ maxAdContentRating: 'General', tagForChildDirectedTreatment: false });
    const info = await AdMob.requestConsentInfo().catch(() => null);
    if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm().catch(() => {});
    if (platform === 'ios') {
      let { status } = await AdMob.trackingAuthorizationStatus().catch(() => ({ status: 'denied' }));
      if (status === 'notDetermined') {
        await AdMob.requestTrackingAuthorization().catch(() => {});
        ({ status } = await AdMob.trackingAuthorizationStatus().catch(() => ({ status: 'denied' })));
      }
      npa = status !== 'authorized';
    } else npa = false;
  })().catch(e => { setup = null; throw e; });
  return setup;
}
// the "privacy options" entry the consent rules ask for (🌐 sheet → About, app only)
export const showAdPrivacy = () => (isNative ? setupAdMob().then(() => AdMob.showPrivacyOptionsForm()).catch(() => {}) : Promise.resolve());

// ---------- rewarded: resolves 'rewarded' | 'closed' | 'noad' | 'limit' ----------
export async function showRewarded(hooks = {}) {
  if (!adsLeftToday()) return 'limit';
  const pause = hooks.pause || (() => {}), resume = hooks.resume || (() => {});
  let result = 'noad';
  pause();
  try {
    if (fake) result = await fakeAd();
    else if (isNative) {
      await setupAdMob();
      const unit = { adId: ADMOB[platform].reward, isTesting: ADMOB.test, npa };
      await AdMob.prepareRewardVideoAd(unit);
      const item = await AdMob.showRewardVideoAd();
      result = item ? 'rewarded' : 'closed';
    } else result = await houseAd();
  } catch (e) {
    console.warn('rewarded ad', e);
  } finally {
    resume();
  }
  if (result === 'rewarded') bump();
  return result;
}

// ---------- web: a 5-second card for another Empty Office app ----------
const HOUSE = [
  { id: 'train', url: 'https://train.emptyoffice.app/', name: ['月台圖鑑', 'Platform Atlas', 'ホーム図鑑', '플랫폼 도감'],
    line: ['手繪車站裡，95 款日本與台灣列車進站', '95 Japanese and Taiwanese trains pull into hand-drawn stations', '手描きの駅に、日本と台湾の 95 形式が入線', '손그림 역에 일본과 대만 열차 95종이 들어와요'] },
  { id: 'life', url: 'https://life.emptyoffice.app/', name: ['80億分之一的人生', 'One in 8 Billion', '80億分の1の人生', '80억분의 1의 인생'],
    line: ['如果重新出生一次，你會在哪裡長大？', 'Born again at random — where would you grow up?', 'もう一度生まれたら、どこで育つ？', '다시 태어난다면 어디에서 자랄까요?'] },
  { id: 'planet', url: 'https://planet.emptyoffice.app/', name: ['星球失物招領所', 'Lost & Found in Space', 'ほしのおとしもの係', '행성 분실물 센터'],
    line: ['轉動小星球，找出藏起來的失物', 'Spin tiny planets to find what was lost', '小さな星を回して、落とし物を探そう', '작은 행성을 돌려 잃어버린 물건을 찾아요'] },
];
const LANGI = { zh: 0, en: 1, ja: 2, ko: 3 };

function houseAd() {
  const li = LANGI[getLang()] ?? 1;
  const ad = HOUSE[Math.floor(Math.random() * HOUSE.length)];
  return countdownCard(`
    <img src="icons/house/${ad.id}.png" alt="">
    <b>${ad.name[li]}</b>
    <p>${ad.line[li]}</p>
    <a href="${ad.url}?utm_source=calm&utm_campaign=house_ad" target="_blank" rel="noopener">${t('ad.visit')}</a>`, 5);
}

function fakeAd() {
  return countdownCard('<b>AD · rewarded (test)</b><p>?adtest</p>', 3);
}

// a card with a countdown; closing before it ends gives no reward
function countdownCard(inner, secs) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'house-ad';
    el.innerHTML = `<div class="house-card"><small class="house-tag">${t('ad.tag')}</small>${inner}
      <button class="house-go" disabled>${t('ad.wait', secs)}</button><button class="house-x" aria-label="${t('close')}">✕</button></div>`;
    document.body.appendChild(el);
    const go = el.querySelector('.house-go');
    let n = secs;
    const tick = setInterval(() => {
      n--;
      if (n > 0) go.textContent = t('ad.wait', n);
      else { clearInterval(tick); go.disabled = false; go.textContent = t('ad.claim'); }
    }, 1000);
    const done = v => { clearInterval(tick); el.remove(); resolve(v); };
    go.onclick = () => done('rewarded');
    el.querySelector('.house-x').onclick = () => done('closed');
  });
}
