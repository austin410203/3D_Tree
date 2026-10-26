# 靜心時光 收費設計

## 內購項目
| 管道 | ID | 類型 | 內容 | 價格 |
|---|---|---|---|---|
| 網頁版 Lemon Squeezy | Store `507523`、Product `1474549`（測試模式） | 一次買斷、序號 5 台裝置、永久有效 | 「靜心時光 完整版 Calm Moments Full Version」 | NT$30 |
| App Store（iOS） | `com.austin410203.seasontree.full`（要在 App Store Connect 建立） | 非消耗型，StoreKit 2（ios/App/App/NativePlugins.swift） | 同上 | NT$30 |
| Google Play（Android） | 尚未建立 | 非消耗型 | 同上 | 約 NT$30 |

- 結帳連結（測試模式）：https://emptyofficex.lemonsqueezy.com/checkout/buy/c8ce6018-0b8b-469e-9c32-5215b1b7d7b5
- 商品頁設定：稅務類別 Software；產生序號（無期限、上限 5 台）；確認視窗與收據 email 寫好中英文啟用步驟，按鈕連到 https://calm.emptyoffice.app/
- 商品圖：`art/store/`（四季之樹、極光、燈塔，1600×1200）

## 免費 vs 付費
- 免費：四季之樹、海、雨窗、燭火 4 個場景，加上全部聲音、呼吸引導、入睡模式、紀錄與提醒。
- 完整版：解鎖其餘 9 個場景（海邊觀景台、燈塔、鯨魚、山間雲海、森林靈鹿、蓮花池、雪夜、營火、極光）與之後的新場景。
- 付費牆出現時機：在場景選單點到鎖住的場景時，顯示預覽與「完整版」頁。

## 尚未完成
- [x] 網頁版解鎖程式（store.js、worker/index.js；本機測試用 .dev.vars 的 LS_MOCK=1 + TEST- 開頭序號）：照 TrainPlatform 的 `src/store.js`（序號啟用、定期重新驗證、`?lstest`）與 Worker `license()`；`wrangler.jsonc` 加 `vars`（`LS_STORE_ID`、`LS_PRODUCT_ID`、`LS_LIVE`）。
- [x] 場景選單上鎖 🔒、完整版頁（內容清單、價格、輸入序號、啟用）。
- [x] 方案頁 `scripts/legal_gen.py` 的 C["pass"] 改成免費 vs 完整版對照表，再重新產生。
- [ ] 用 `?lstest` 開網頁，以 Lemon Squeezy 測試卡實際買一次並啟用。
- [ ] Lemon Squeezy 從測試模式切到正式模式（老闆操作），之後把 store.js 的 `LIVE` 改 true、wrangler 的 `LS_LIVE` 改 "1"。
- [ ] 上架 Google Play 前：Android 版改用 Play 內購，移除 App 內的網頁結帳與序號輸入（目前 0.7.1 起 App 也上鎖，可輸入網頁序號，Worker 允許 https://localhost 的 CORS）。

## 廣告（2026-10-27 起，公司規定：免費版有廣告，買完整版永久無廣告）
| 位置 | 類型 | 觸發時機 | 頻率上限 | 廣告單元 ID（正式／測試） |
|---|---|---|---|---|
| scene_trial | 獎勵 | 從上鎖場景打開完整版頁 →「看廣告免費體驗」，看完該場景免費 24 小時 | 每人每天 5 次 | 正式：待老闆提供／測試：iOS `ca-app-pub-3940256099942544/1712485313`、Android `ca-app-pub-3940256099942544/5224354917` |

- 冥想 App：**只放獎勵廣告，不放插頁和橫幅**（ads-monetization.md 第 8 節）。
- App：Google AdMob（`ads.js`，`@capacitor-community/admob` 8.2.1）。第一次按「看廣告」時才初始化：UMP 同意（歐盟、英國）→ iOS ATT → 不允許追蹤就送非個人化廣告。內容分級上限 G。
- 網頁：AdSense 還沒審核，先用自家廣告卡（推薦月台圖鑑、80億分之一的人生、星球失物招領所，5 秒後領取，帶 utm_source=calm&utm_campaign=house_ad）。
- 本機測試：網址加 `?adtest`，用 3 秒的假廣告跑完整流程。
- 去廣告方式：完整版（App Store 內購 `com.austin410203.seasontree.full` 或網頁序號）。買了之後所有場景都解鎖，廣告入口自然消失。
- 兒童受眾：否。
- 正式上線前要換的設定：`ads.js` 的 `ADMOB.test` 改 false 並填正式廣告單元；`ios/App/App/Info.plist` 的 `GADApplicationIdentifier`、`android/app/src/main/AndroidManifest.xml` 的 AdMob App ID 改成正式值；`https://emptyoffice.app/app-ads.txt` 已上線（`google.com, pub-4390142574700801, DIRECT, f08c47fec0942fa0`，EmptyOfficeSite repo 負責）。
- 網頁：AdSense 已送審（發布商 pub-4390142574700801，2026-10-27）。獎勵廣告要等「H5 遊戲廣告（Ad Placement API）」另外核准，在那之前**不要**把 ca-pub 填進程式，繼續用自家廣告卡。

### 檢查
- [x] 付費後沒有廣告入口（全部場景已解鎖）
- [x] 看完才解鎖；中途關閉不解鎖（本機 ?adtest 與網頁自家廣告已測）
- [x] 不放插頁、不放橫幅
- [x] 離線或沒有廣告時顯示「目前沒有廣告」，不卡住
- [x] 開發與 TestFlight 用測試廣告單元
- [x] 隱私權政策已有廣告段落（四語系）
- [ ] App Store 隱私標籤、Google Play 資料安全表單
- [ ] 實機確認歐盟同意訊息、iOS ATT 正常顯示
