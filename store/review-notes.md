# App Review notes（貼到 App Store Connect →「App 審查資訊」→ 備註）

Calm Moments is a breathing-meditation and sleep-sound app. Each of the 13 scenes is a real-time 3D scene (three.js, bundled in the app, works offline) that moves with the user's breath, and every sound is synthesised live on the device with Web Audio.

No account or sign-in is needed. There is no user-generated content. The only ads are optional rewarded ads (Google AdMob): there are no interstitial or banner ads.

How to use:
1. Tap 開始 / Start on the title screen.
2. "Begin" starts a guided breathing session; the circle grows on the inhale and shrinks on the exhale.
3. Bottom bar: Sound (mix 18 ambient sounds), Breath (patterns), Scene (13 scenes), Sleep (plays with the screen off and fades out after a timer), Journal (streaks, daily reminder).

In-app purchase (non-consumable, com.austin410203.seasontree.full):
- 4 scenes are free. Tapping any scene marked 🔒 in the Scene sheet, or 🌐 (top right) → "Full Version", opens the Full Version sheet with the price from StoreKit and a "Buy" button.
- "Restore purchase" is on the same sheet.

Rewarded ads (optional, Google AdMob):
- When the Full Version sheet is opened from a locked scene, it offers "Watch an ad to try it": after one rewarded ad, that scene is free for 24 hours (up to 5 ads a day). Closing the ad early unlocks nothing.
- AdMob is set up only when the user first taps that button: Google's UMP consent form (EU/UK), then the App Tracking Transparency prompt. If tracking is not allowed, only non-personalised ads are requested.
- "Ad privacy choices" (🌐 sheet → About) reopens Google's privacy options form.
- Owning the Full Version removes every ad entry point.

Native features: background audio for sleep mode (UIBackgroundModes audio, lock-screen pause), daily local notification reminder, haptics during breathing, keep-screen-on during a session, in-app purchase with StoreKit 2.

Health: the app is for relaxation only; the terms say it is not a substitute for medical or mental-health advice.

Contact: hello@emptyoffice.app
