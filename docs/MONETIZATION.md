# 靜心時光 收費設計

## 內購項目
| 管道 | ID | 類型 | 內容 | 價格 |
|---|---|---|---|---|
| 網頁版 Lemon Squeezy | Store `507523`、Product `1474549`（測試模式） | 一次買斷、序號 5 台裝置、永久有效 | 「靜心時光 完整版 Calm Moments Full Version」 | NT$30 |
| Google Play／App Store | `com.austin410203.seasontree.full`（尚未建立） | 非消耗型 | 同上 | 約 NT$30 |

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
- [ ] Android 版改用 Google Play 內購，App 內不顯示網頁結帳（目前原生 App 的 paywallOn = false，全部場景開放）。
