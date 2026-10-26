# App Review notes（貼到 App Store Connect →「App 審查資訊」→ 備註）

Calm Moments is a breathing-meditation and sleep-sound app. Each of the 13 scenes is a real-time 3D scene (three.js, bundled in the app, works offline) that moves with the user's breath, and every sound is synthesised live on the device with Web Audio.

No account or sign-in is needed. There are no ads, no tracking and no user-generated content.

How to use:
1. Tap 開始 / Start on the title screen.
2. "Begin" starts a guided breathing session; the circle grows on the inhale and shrinks on the exhale.
3. Bottom bar: Sound (mix 18 ambient sounds), Breath (patterns), Scene (13 scenes), Sleep (plays with the screen off and fades out after a timer), Journal (streaks, daily reminder).

In-app purchase (non-consumable, com.austin410203.seasontree.full):
- 4 scenes are free. Tapping any scene marked 🔒 in the Scene sheet, or 🌐 (top right) → "Full Version", opens the Full Version sheet with the price from StoreKit and a "Buy" button.
- "Restore purchase" is on the same sheet.

Native features: background audio for sleep mode (UIBackgroundModes audio, lock-screen pause), daily local notification reminder, haptics during breathing, keep-screen-on during a session, in-app purchase with StoreKit 2.

Health: the app is for relaxation only; the terms say it is not a substitute for medical or mental-health advice.

Contact: hello@emptyoffice.app
