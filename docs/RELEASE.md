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

## 要老闆在 Apple 網站操作
- [ ] App Store Connect → 使用者與存取權限 → 整合 → App Store Connect API → 產生金鑰（角色「App 管理」），記下 Issuer ID、Key ID，下載 .p8
- [ ] GitHub repo 3D_Tree → Settings → Secrets and variables → Actions：`APPLE_TEAM_ID`、`ASC_KEY_ID`、`ASC_ISSUER_ID`、`ASC_KEY_P8`（.p8 全文）
- [ ] App Store Connect →「我的 App」→ 新增 App：iOS、名稱「靜心時光：呼吸冥想」、主要語言繁體中文、Bundle ID `com.austin410203.seasontree`、SKU `seasontree`
- [ ] 協議、稅務和銀行業務：付費 App 協議、W-8BEN、銀行帳戶；申請 Small Business Program（抽成 15%）
- [ ] App 內購買項目：非消耗型 `com.austin410203.seasontree.full`、NT$30、四語系名稱與描述（見 metadata）、審查截圖用 `store/screenshots/iphone-6.9/zh/4-sleep.png` 以外的一張完整版頁畫面
- [ ] App 隱私（因為有 AdMob 獎勵廣告，依 Google 的「AdMob 的 App Store 資料揭露」說明填寫，送審前再到 Google 官方頁確認一次）：
  - 收集的資料：裝置 ID、產品互動、廣告資料、當機資料、效能資料、其他診斷資料、大略位置
  - 用途：第三方廣告、分析
  - 「用來追蹤你」：勾選裝置 ID 與廣告資料（使用者在 ATT 允許追蹤時會用於個人化廣告）
  - 我們自己（練習紀錄、設定）不收集任何資料
- [ ] 年齡分級問卷：內容全部選「無」；「廣告」照實勾選有（只有獎勵廣告，內容分級上限 G）→ 預期 4+
- [ ] 類別：健康與健身（主）、生活風格（副）

## 廣告（AdMob，見 MONETIZATION.md）
- [ ] 老闆：AdMob 建立 iOS／Android 應用程式與獎勵廣告單元，交給 Claude App ID、廣告單元 ID、app-ads.txt 那一行
- [ ] Claude：換成正式 ID（app-ads.txt 已由品牌網站部署：pub-4390142574700801）
- [ ] 商店頁「開發者網站」填 https://emptyoffice.app

## 發布
- [ ] GitHub Actions 模擬器編譯通過
- [ ] TestFlight 上傳（build #）
- [ ] 實機測試：冷啟動、四個免費場景、鎖住的場景 → 完整版頁、沙盒購買、刪除重裝後恢復購買、入睡模式關螢幕持續播放、鎖定畫面暫停、靜音開關、每日提醒、飛航模式
- [ ] 送審（日期）→ 結果
- [ ] 手動發布
