# 靜心時光 iOS 上架進度

- Bundle ID：`com.austin410203.seasontree`
- App 名稱：靜心時光（主畫面依語系顯示 Calm Moments／やすらぎの時間／고요한 시간）
- 網頁：https://calm.emptyoffice.app（隱私權 /privacy、支援 /contact）
- 收費：免費 4 個場景 + App 內購 `com.austin410203.seasontree.full`（非消耗型，NT$30）
- 只支援 iPhone（iPad 以相容模式執行，不需要 iPad 截圖）
- 編譯：GitHub Actions `.github/workflows/ios.yml`（手動執行；勾 testflight 會簽章並上傳）

## App 化（已完成 2026-10-27）
- [x] Capacitor 8 iOS 專案（SPM），網頁檔案打包進 App，離線可用
- [x] 原生外掛 `ios/App/App/NativePlugins.swift`：StoreKit 2 內購（購買、恢復購買、退款重新上鎖）、背景播放（AVAudioSession playback + 鎖定畫面暫停）
- [x] App 內沒有網頁付款或序號（store.js `usesAppStore`；條款頁 `.web-only` 段落在 iOS 隱藏）
- [x] iOS 不載入 Google Fonts，改用內建 Hiragino 圓體
- [x] PrivacyInfo.xcprivacy、ITSAppUsesNonExemptEncryption = NO、UIBackgroundModes audio、四語系 App 名稱
- [x] 圖示 1024、啟動畫面（scripts/make_icons.py）

## 商店素材（已完成）
- [x] 截圖 × 6 張 × 4 語系：App Store 現在**必填 6.1／6.3 吋（1206×2622）**，6.9 吋改選填 → 上傳 `store/screenshots/iphone-6.3/<lang>/`（由 6.9 吋縮小）；`python store/make_shots.py` 重拍
- [x] 文案：`store/metadata/{zh-Hant,en-US,ja,ko}.md`
- [x] 審查說明：`store/review-notes.md`
- [x] 圖示：`store/icon-1024.png`

## App Store Connect（2026-10-27 Claude 已完成）
- [x] Bundle ID `com.austin410203.seasontree` 註冊（Team M3FNV67WZ3）
- [x] App 記錄 Apple ID 6827235005；名稱：繁中「靜心時光：呼吸冥想」、英「Calm Moments: Breathe & Sleep」、日「やすらぎの時間：呼吸と瞑想」、韓「고요한 시간: 호흡과 명상」＋四語副標題
- [x] 類別：健康與健身／生活風格
- [x] 內購 Apple ID 6827240204：非消耗型、台灣基準 NT$30（美國 US$0.99）、175 國、四語名稱與說明、審查截圖 `store/iap-review.png`、審查備註（尚未「提交審查」）
- [x] 版本 1.0：四語宣傳文字、描述、關鍵字、支援／行銷網址、版權「2026 Empty Office」、手動發布、四語各 6 張截圖
- 注意：ASC 新增多個語言時要一次存一個，否則會誤報「名稱已被使用」

## 送審前設定（2026-10-27 完成）
- [x] 付費 App 協議 Active（2026-10-26 ~ 2027-10-26）
- [x] 內容權利：含第三方內容（AdMob 廣告）且有權利；受監管醫療器材：否
- [x] 年齡分級問卷：廣告＝有、健康或保健主題＝有，其他全部無 → 多數國家 9+（越南 12+、巴西 AL、韓國 ALL）
- [x] App 隱私已發布：隱私權網址（四語）https://calm.emptyoffice.app/privacy.html；收集 7 種（大略位置、裝置 ID、產品互動、廣告資料、當機、效能、其他診斷），用途第三方廣告＋分析（診斷類只有分析），都「不連結到身分」；裝置 ID 與廣告資料「用來追蹤」
- [x] App 審查資訊：不需登入、聯絡人 Yno Huang／+886 2 8785 3793／hello@emptyoffice.app、備註＝store/review-notes.md
- [x] GitHub Secrets：`APPLE_TEAM_ID`、`ASC_ISSUER_ID`、`ASC_KEY_ID`＝9KFVB24SGW（團隊金鑰「cal moment」，角色 Admin）、`ASC_KEY_P8`（老闆貼上）。App 管理角色的金鑰不能雲端簽章；workflow 會先試金鑰，ID 對不上時從 Admin 金鑰裡找出對的那把
- [ ] 選擇性：內購家人共享（開了不能關）、DSA 交易者身分（目前非交易者）

## 廣告（AdMob，見 MONETIZATION.md）
- [ ] 老闆：AdMob 建立 iOS／Android 應用程式與獎勵廣告單元，交給 Claude App ID、廣告單元 ID、app-ads.txt 那一行
- [ ] Claude：換成正式 ID（老闆決定 1.0 先用測試廣告送審，正式 ID 放 1.0.1）
- [ ] 商店頁「開發者網站」填 https://emptyoffice.app

## 發布
- [x] GitHub Actions 模擬器編譯通過（run #3、#6、#7）
- [x] TestFlight 上傳：1.0 (7)（run #7，2026-10-27）
- [x] build 7 已掛到版本 1.0；TestFlight 內部測試群組「Internal」已邀請帳號持有人
- [ ] 實機測試：冷啟動、四個免費場景、鎖住的場景 → 完整版頁、沙盒購買、刪除重裝後恢復購買、入睡模式關螢幕持續播放、鎖定畫面暫停、靜音開關、每日提醒、飛航模式
- [x] 送審 2026-10-27 11:05：App 1.0 (7) + 內購「完整版」一起送出 → 等待審查（最多 48 小時）。App 價格免費、174 國（不含中國大陸：需要 ICP 備案）
- [ ] 手動發布
