# 條款頁產生器（靜心時光版，取自 Company/playbooks/templates/legal_gen.py）。
# 執行 python scripts/legal_gen.py → 在 repo 根目錄產生 pass/terms/refund/privacy/contact.html + legal.css（四語系）。
# 目前 App 全部免費，pass 頁只說明方案；之後推出付費內容時，改 C["pass"] 與 terms/refund/privacy 的購買段落。
import os, html
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
EMAIL = "hello@emptyoffice.app"
DATE = "2026-10-26"
LANGS = [("zh", "中文"), ("ja", "日本語"), ("en", "English"), ("ko", "한국어")]
NAV = {
    "pass": {"zh": "方案與價格", "ja": "料金プラン", "en": "Pricing", "ko": "요금 안내"},
    "terms": {"zh": "服務條款", "ja": "利用規約", "en": "Terms of Service", "ko": "이용약관"},
    "refund": {"zh": "退款政策", "ja": "返金ポリシー", "en": "Refund Policy", "ko": "환불 정책"},
    "privacy": {"zh": "隱私權政策", "ja": "プライバシーポリシー", "en": "Privacy Policy", "ko": "개인정보 처리방침"},
    "contact": {"zh": "聯絡我們", "ja": "お問い合わせ", "en": "Contact", "ko": "문의하기"},
}
APP = {"zh": "靜心時光", "ja": "やすらぎの時間", "en": "Calm Moments", "ko": "고요한 시간"}
BACK = {"zh": "← 回到靜心時光", "ja": "← やすらぎの時間へ戻る", "en": "← Back to Calm Moments", "ko": "← 고요한 시간으로"}
UPDATED = {"zh": "最後更新", "ja": "最終更新", "en": "Last updated", "ko": "최종 업데이트"}
M = f'<a href="mailto:{EMAIL}">{EMAIL}</a>'

# ---------------------------------------------------------------- content (HTML fragments per language)
C = {}
C["pass"] = {
"zh": """
<p class="lead">靜心時光目前<b>全部免費</b>：不用註冊、沒有廣告，也沒有任何付費內容。</p>
<table><tr><th></th><th>目前（免費）</th></tr>
<tr><td>冥想場景</td><td>13 個：四季之樹、海、海邊觀景台、燈塔、鯨魚、山間雲海、森林靈鹿、蓮花池、雨窗、雪夜、燭火、營火、極光</td></tr>
<tr><td>呼吸引導與計時</td><td>✔ 多種呼吸節奏、自訂時長、結束頌缽</td></tr>
<tr><td>聲音</td><td>✔ 18 種即時合成的環境音與白噪音，可自由混音</td></tr>
<tr><td>入睡模式</td><td>✔ 關閉螢幕仍可播放，可設定多久後停止</td></tr>
<tr><td>練習紀錄與每日提醒</td><td>✔</td></tr></table>
<h2>之後會收費嗎？</h2><p>未來可能推出一次買斷的「完整版」或新場景包。推出前，會先在本頁公告內容與價格；不會有訂閱制，也不會放廣告。</p>
<h2>如果推出付費內容，怎麼購買</h2><ul>
<li><b>網頁版</b>：訂單由我們的線上經銷商 Lemon Squeezy 處理，Lemon Squeezy 是交易的登記賣方（Merchant of Record），負責收款、收據與稅務。</li>
<li><b>App 版</b>：透過 App Store 或 Google Play 的 App 內購買，依各商店規定付款與退款。網頁版的序號不能在 App 內使用。</li></ul>
""",
"ja": """
<p class="lead">やすらぎの時間は現在<b>すべて無料</b>です。アカウント登録不要、広告なし、有料コンテンツもありません。</p>
<table><tr><th></th><th>現在（無料）</th></tr>
<tr><td>瞑想シーン</td><td>13 種：四季の木、海、海辺の展望台、灯台、クジラ、山の雲海、森の精霊鹿、蓮の池、雨の窓、雪の夜、ろうそく、焚き火、オーロラ</td></tr>
<tr><td>呼吸ガイドとタイマー</td><td>✔ 複数の呼吸リズム、時間設定、終了のシンギングボウル</td></tr>
<tr><td>サウンド</td><td>✔ リアルタイム合成の環境音・ホワイトノイズ 18 種、自由にミックス可能</td></tr>
<tr><td>おやすみモード</td><td>✔ 画面を消しても再生、停止までの時間を設定可能</td></tr>
<tr><td>記録と毎日のリマインダー</td><td>✔</td></tr></table>
<h2>今後有料になりますか？</h2><p>将来、買い切りの「完全版」や新しいシーンパックを提供する可能性があります。その場合は事前に本ページで内容と価格をお知らせします。サブスクリプションや広告は導入しません。</p>
<h2>有料コンテンツを提供する場合の購入方法</h2><ul>
<li><b>Web 版</b>：ご注文はオンライン販売代理店 Lemon Squeezy が処理し、Lemon Squeezy が販売者（Merchant of Record）として決済・領収書・税務を担当します。</li>
<li><b>アプリ版</b>：App Store または Google Play のアプリ内課金で購入し、各ストアの規定に従います。Web 版のキーはアプリ内では使えません。</li></ul>
""",
"en": """
<p class="lead">Calm Moments is currently <b>completely free</b> — no account, no ads and no paid content.</p>
<table><tr><th></th><th>Now (free)</th></tr>
<tr><td>Meditation scenes</td><td>13: Season Tree, Sea, Seaside Overlook, Lighthouse, Whale, Mountain Clouds, Spirit Deer, Lotus Pond, Rainy Window, Snowy Night, Candle, Campfire, Aurora</td></tr>
<tr><td>Breathing guide &amp; timer</td><td>✔ Several breathing patterns, custom length, closing singing bowl</td></tr>
<tr><td>Sounds</td><td>✔ 18 live-synthesised ambient sounds and noises, freely mixable</td></tr>
<tr><td>Sleep mode</td><td>✔ Keeps playing with the screen off, with a stop timer</td></tr>
<tr><td>Practice log &amp; daily reminder</td><td>✔</td></tr></table>
<h2>Will it cost money later?</h2><p>We may later offer a one-time "Full Version" or new scene packs. If we do, the content and price will be announced on this page first. There will be no subscription and no ads.</p>
<h2>How purchases would work</h2><ul>
<li><b>Web</b>: our order process is conducted by our online reseller Lemon Squeezy, the Merchant of Record for all web orders. They handle payment, receipts and sales tax.</li>
<li><b>Apps</b>: in-app purchase through the App Store or Google Play, under each store's rules. Web licence keys cannot be used inside the apps.</li></ul>
""",
"ko": """
<p class="lead">고요한 시간은 현재 <b>모두 무료</b>입니다. 계정 등록이 필요 없고, 광고도 유료 콘텐츠도 없습니다.</p>
<table><tr><th></th><th>현재(무료)</th></tr>
<tr><td>명상 장면</td><td>13개: 사계절 나무, 바다, 바닷가 전망대, 등대, 고래, 산의 운해, 숲속 정령 사슴, 연꽃 연못, 비 오는 창, 눈 내리는 밤, 촛불, 모닥불, 오로라</td></tr>
<tr><td>호흡 가이드와 타이머</td><td>✔ 여러 호흡 리듬, 시간 설정, 종료 싱잉볼</td></tr>
<tr><td>소리</td><td>✔ 실시간 합성 환경음·화이트 노이즈 18종, 자유롭게 믹스 가능</td></tr>
<tr><td>수면 모드</td><td>✔ 화면을 꺼도 재생, 정지 시간 설정 가능</td></tr>
<tr><td>기록과 매일 알림</td><td>✔</td></tr></table>
<h2>앞으로 유료가 되나요?</h2><p>향후 한 번 구매하는 「완전판」이나 새 장면 팩을 제공할 수 있습니다. 그 경우 먼저 이 페이지에 내용과 가격을 공지합니다. 구독제나 광고는 도입하지 않습니다.</p>
<h2>유료 콘텐츠를 제공할 경우 구매 방법</h2><ul>
<li><b>웹</b>: 주문은 온라인 리셀러 Lemon Squeezy가 처리하며, Lemon Squeezy가 판매자(Merchant of Record)로서 결제·영수증·세금을 담당합니다.</li>
<li><b>앱</b>: App Store 또는 Google Play 인앱 결제로 구매하며 각 스토어 규정을 따릅니다. 웹 라이선스 키는 앱에서 사용할 수 없습니다.</li></ul>
""",
}

C["terms"] = {
"zh": f"""
<p>歡迎使用「{APP['zh']}」（以下稱「本服務」），本服務由個人開發者以品牌「Empty Office（無人辦公室）」經營。使用本服務即表示你同意以下條款。</p>
<h2>1. 服務內容</h2><p>本服務提供會跟著呼吸變化的冥想場景、呼吸引導、靜心計時、即時合成的環境音與入睡模式，可在瀏覽器或 Android App 使用。目前全部免費，詳見<a href="pass.html">方案與價格</a>。</p>
<h2>2. 購買與授權（未來推出付費內容時適用）</h2><ul>
<li>網頁版的訂單由我們的線上經銷商 Lemon Squeezy 處理，Lemon Squeezy 是交易的登記賣方（Merchant of Record），負責收款、收據與稅務，並適用其條款。</li>
<li>App 版透過 App Store 或 Google Play 的 App 內購買，適用各商店的條款。</li>
<li>付費內容是數位內容的<b>使用授權</b>，不是所有權移轉；僅限購買者本人及其家人使用，不得轉售或公開分享序號。</li></ul>
<h2>3. 使用規範</h2><p>請勿以違法方式使用本服務，或干擾、攻擊網站與伺服器。</p>
<h2>4. 智慧財產權</h2><p>本服務的程式、圖像、場景與聲音設計由開發者製作，保留所有權利。</p>
<h2>5. 健康聲明與免責</h2><ul>
<li><b>本 App 僅供放鬆，不能取代醫療或心理專業建議、診斷或治療。</b>如果你有身心方面的困擾，請尋求醫師或心理專業人員協助；如有緊急狀況，請立即撥打當地緊急電話。</li>
<li>練習呼吸時如感到頭暈、胸悶或不適，請立即停止，恢復自然呼吸。</li>
<li>請勿在開車、騎車、操作機械等需要專注的情況下使用。</li>
<li>入睡模式請使用適當音量，以保護聽力。</li>
<li>本服務依現況提供。我們會盡力維持服務正常運作，但不保證完全不中斷、沒有錯誤。在法律允許的範圍內，我們對使用本服務所造成的間接損失不負責任。</li></ul>
<h2>6. 變更與終止</h2><p>我們可能更新本服務或本條款，重大變更會在網站公告。</p>
<h2>7. 準據法</h2><p>本條款以中華民國（台灣）法律為準據法。消費者依其居住地法律享有的強制保護，不受影響。</p>
<h2>8. 聯絡</h2><p>{M}</p>
""",
"ja": f"""
<p>「{APP['ja']}」（以下「本サービス」）は、個人開発者がブランド「Empty Office（無人辦公室）」として運営しています。本サービスを利用することで、以下の規約に同意したものとみなします。</p>
<h2>1. サービス内容</h2><p>呼吸に合わせて変化する瞑想シーン、呼吸ガイド、瞑想タイマー、リアルタイム合成の環境音、おやすみモードを、ブラウザまたは Android アプリで提供します。現在はすべて無料です。詳しくは<a href="pass.html">料金プラン</a>をご覧ください。</p>
<h2>2. 購入とライセンス（将来有料コンテンツを提供する場合）</h2><ul>
<li>Web 版のご注文はオンライン販売代理店 Lemon Squeezy が処理し、Lemon Squeezy が販売者（Merchant of Record）として決済・領収書・税務を担当し、同社の規約が適用されます。</li>
<li>アプリ版は App Store または Google Play のアプリ内課金で購入し、各ストアの規約が適用されます。</li>
<li>有料コンテンツはデジタルコンテンツの<b>利用許諾</b>であり、所有権の移転ではありません。購入者本人とその家族のみが使用でき、キーの転売・公開共有はできません。</li></ul>
<h2>3. 禁止事項</h2><p>違法な目的での利用や、サイト・サーバーへの妨害・攻撃を禁止します。</p>
<h2>4. 知的財産</h2><p>本サービスのプログラム、画像、シーン、サウンドデザインは開発者が制作し、すべての権利を保有します。</p>
<h2>5. 健康に関する注意と免責</h2><ul>
<li><b>本アプリはリラックスのためのものであり、医療や心理の専門的な助言・診断・治療に代わるものではありません。</b>心身の不調がある場合は医師や専門家にご相談ください。緊急の場合はすぐに地域の緊急番号へ連絡してください。</li>
<li>呼吸の練習中にめまい、胸の苦しさ、不快感があれば、すぐに中止して自然な呼吸に戻してください。</li>
<li>運転中や機械の操作中など、集中が必要な状況では使用しないでください。</li>
<li>おやすみモードは聴覚を守るため適切な音量でご利用ください。</li>
<li>本サービスは現状有姿で提供されます。正常な運営に努めますが、中断やエラーがないことは保証しません。法令で認められる範囲で、間接的な損害について責任を負いません。</li></ul>
<h2>6. 変更と終了</h2><p>本サービスや本規約は更新されることがあり、重要な変更はサイトでお知らせします。</p>
<h2>7. 準拠法</h2><p>本規約は中華民国（台湾）法を準拠法とします。お住まいの国の消費者保護法による強行的な保護は影響を受けません。</p>
<h2>8. お問い合わせ</h2><p>{M}</p>
""",
"en": f"""
<p>"{APP['en']}" (the "Service") is run by an individual developer under the brand "Empty Office". By using the Service you agree to these terms.</p>
<h2>1. The Service</h2><p>Meditation scenes that move with your breath, a breathing guide, a meditation timer, live-synthesised ambient sound and a sleep mode, in your browser or the Android app. Everything is currently free; see <a href="pass.html">Pricing</a>.</p>
<h2>2. Purchases and licence (if paid content is offered in future)</h2><ul>
<li>Our order process is conducted by our online reseller Lemon Squeezy, the Merchant of Record for all web orders. They handle payment, receipts and taxes, and their terms apply to the purchase.</li>
<li>In the apps, purchases are made through App Store or Google Play in-app purchase, under that store's terms.</li>
<li>Paid content is a <b>licence to use</b> digital content, not a transfer of ownership, for use by the buyer and their household. Keys may not be resold or shared publicly.</li></ul>
<h2>3. Acceptable use</h2><p>Do not use the Service unlawfully or interfere with or attack the site or servers.</p>
<h2>4. Intellectual property</h2><p>The code, artwork, scenes and sound design of the Service are made by the developer, who reserves all rights.</p>
<h2>5. Health notice and disclaimer</h2><ul>
<li><b>This app is for relaxation only and is not a substitute for professional medical or mental-health advice, diagnosis or treatment.</b> If you are struggling, please talk to a doctor or a mental-health professional; in an emergency, call your local emergency number.</li>
<li>If you feel dizzy, tight-chested or unwell during a breathing exercise, stop and return to natural breathing.</li>
<li>Do not use the Service while driving, riding or operating machinery.</li>
<li>Use a comfortable, moderate volume in sleep mode to protect your hearing.</li>
<li>The Service is provided "as is". We work to keep it running but do not guarantee it will be uninterrupted or error-free. To the extent permitted by law, we are not liable for indirect losses arising from use of the Service.</li></ul>
<h2>6. Changes and termination</h2><p>We may update the Service or these terms; significant changes will be announced on the site.</p>
<h2>7. Governing law</h2><p>These terms are governed by the laws of Taiwan (Republic of China). Mandatory consumer protections of your country of residence are not affected.</p>
<h2>8. Contact</h2><p>{M}</p>
""",
"ko": f"""
<p>「{APP['ko']}」(이하 「서비스」)는 개인 개발자가 브랜드 「Empty Office」로 운영합니다. 서비스를 이용하면 아래 약관에 동의한 것으로 봅니다.</p>
<h2>1. 서비스 내용</h2><p>호흡에 맞춰 변하는 명상 장면, 호흡 가이드, 명상 타이머, 실시간 합성 환경음, 수면 모드를 브라우저 또는 Android 앱으로 제공합니다. 현재 모두 무료이며, 자세한 내용은 <a href="pass.html">요금 안내</a>를 참고하세요.</p>
<h2>2. 구매와 라이선스(향후 유료 콘텐츠를 제공할 경우)</h2><ul>
<li>웹 주문은 온라인 리셀러 Lemon Squeezy가 처리하며, Lemon Squeezy가 판매자(Merchant of Record)로서 결제·영수증·세금을 담당하고 그 약관이 적용됩니다.</li>
<li>앱에서는 App Store 또는 Google Play 인앱 결제로 구매하며 각 스토어의 약관이 적용됩니다.</li>
<li>유료 콘텐츠는 디지털 콘텐츠의 <b>이용 허락</b>이며 소유권 이전이 아닙니다. 구매자 본인과 가족만 사용할 수 있으며, 키를 재판매하거나 공개 공유할 수 없습니다.</li></ul>
<h2>3. 이용 규칙</h2><p>불법적인 목적으로 이용하거나 사이트·서버를 방해·공격하지 마세요.</p>
<h2>4. 지식재산권</h2><p>서비스의 프로그램, 이미지, 장면, 사운드 디자인은 개발자가 제작했으며 모든 권리를 보유합니다.</p>
<h2>5. 건강 관련 안내와 면책</h2><ul>
<li><b>이 앱은 휴식을 위한 것이며, 의료나 심리 전문가의 조언·진단·치료를 대신할 수 없습니다.</b> 몸과 마음이 힘들다면 의사나 전문가와 상담하세요. 긴급 상황에서는 즉시 지역 긴급 번호로 연락하세요.</li>
<li>호흡 연습 중 어지럽거나 가슴이 답답하거나 불편하면 즉시 멈추고 자연스럽게 호흡하세요.</li>
<li>운전, 기계 조작 등 집중이 필요한 상황에서는 사용하지 마세요.</li>
<li>수면 모드는 청력 보호를 위해 적당한 음량으로 사용하세요.</li>
<li>서비스는 현 상태로 제공됩니다. 정상 운영을 위해 노력하지만 중단이나 오류가 없음을 보장하지 않습니다. 법이 허용하는 범위에서 간접 손해에 대해 책임지지 않습니다.</li></ul>
<h2>6. 변경과 종료</h2><p>서비스나 약관은 갱신될 수 있으며, 중요한 변경은 사이트에 공지합니다.</p>
<h2>7. 준거법</h2><p>본 약관은 중화민국(대만) 법을 준거법으로 합니다. 거주 국가의 소비자 보호법에 따른 강행적 보호는 영향을 받지 않습니다.</p>
<h2>8. 문의</h2><p>{M}</p>
""",
}

C["refund"] = {
"zh": f"""
<p>靜心時光目前全部免費，沒有需要退款的項目。未來推出付費內容時，依以下方式處理：</p>
<h2>網頁版：14 天內可退款</h2><ul>
<li><b>購買後 14 天內</b>，不論原因，只要來信提出，都可以全額退款。</li>
<li>超過 14 天後，如果因為技術問題無法使用，而我們也無法修好，仍然可以退款。</li>
<li>申請方式：寄信到 {M}，附上購買時的 email 和訂單編號。退款由 Lemon Squeezy 退回原付款方式，入帳時間依銀行或支付方式而定，通常 5～10 個工作天。</li>
<li>退款後，序號會被停用、付費內容重新上鎖，練習紀錄與免費內容都會保留。</li></ul>
<h2>App 版</h2><ul>
<li>App Store 購買：依 Apple 的退款政策，請到 <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a> 申請。</li>
<li>Google Play 購買：依 Google Play 的退款政策，請到 <a href="https://support.google.com/googleplay/answer/2479637">Google Play 說明中心</a>申請。</li></ul>
""",
"ja": f"""
<p>やすらぎの時間は現在すべて無料のため、返金の対象となる項目はありません。将来有料コンテンツを提供する場合は、以下のとおり対応します。</p>
<h2>Web 版：14 日以内なら返金可能</h2><ul>
<li><b>購入後 14 日以内</b>であれば、理由を問わず、ご連絡いただければ全額返金します。</li>
<li>14 日を過ぎても、技術的な問題で利用できず、こちらで解決できない場合は返金します。</li>
<li>申請方法：{M} 宛てに、購入時のメールアドレスと注文番号をお送りください。Lemon Squeezy から元の支払い方法へ返金され、反映までの期間は銀行や決済方法により異なります（通常 5〜10 営業日）。</li>
<li>返金後はキーが無効化され、有料コンテンツは再びロックされます。記録と無料コンテンツはそのまま残ります。</li></ul>
<h2>アプリ版</h2><ul>
<li>App Store での購入：Apple の返金ポリシーに従います。<a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a> から申請してください。</li>
<li>Google Play での購入：Google Play の返金ポリシーに従います。<a href="https://support.google.com/googleplay/answer/2479637">Google Play ヘルプ</a>から申請してください。</li></ul>
""",
"en": f"""
<p>Calm Moments is currently completely free, so there is nothing to refund. If paid content is offered in future, refunds work like this:</p>
<h2>Web: refunds within 14 days</h2><ul>
<li>Within <b>14 days of purchase</b>, email us for any reason and we will give you a full refund.</li>
<li>After 14 days, if a technical problem stops you using it and we cannot fix it, we will still refund you.</li>
<li>To request one, email {M} with the email address you used and your order number. Lemon Squeezy returns the money to the original payment method; timing depends on your bank or payment method, usually 5–10 business days.</li>
<li>After a refund the key is disabled and the paid content locks again. Your practice log and free content are kept.</li></ul>
<h2>Apps</h2><ul>
<li>App Store purchases follow Apple's refund policy; request one at <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>.</li>
<li>Google Play purchases follow Google Play's refund policy; see the <a href="https://support.google.com/googleplay/answer/2479637">Google Play Help Center</a>.</li></ul>
""",
"ko": f"""
<p>고요한 시간은 현재 모두 무료이므로 환불 대상 항목이 없습니다. 향후 유료 콘텐츠를 제공할 경우 다음과 같이 처리합니다.</p>
<h2>웹: 14일 이내 환불 가능</h2><ul>
<li><b>구매 후 14일 이내</b>에는 이유와 관계없이 연락 주시면 전액 환불해 드립니다.</li>
<li>14일이 지나도, 기술적인 문제로 이용할 수 없고 저희가 해결하지 못하면 환불해 드립니다.</li>
<li>신청 방법: {M} 로 구매 시 이메일 주소와 주문 번호를 보내 주세요. Lemon Squeezy가 원래 결제 수단으로 환불하며, 반영 기간은 은행·결제 수단에 따라 다릅니다(보통 영업일 기준 5~10일).</li>
<li>환불 후에는 키가 비활성화되고 유료 콘텐츠가 다시 잠깁니다. 기록과 무료 콘텐츠는 그대로 유지됩니다.</li></ul>
<h2>앱</h2><ul>
<li>App Store 구매는 Apple 환불 정책을 따르며, <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a> 에서 신청할 수 있습니다.</li>
<li>Google Play 구매는 Google Play 환불 정책을 따르며, <a href="https://support.google.com/googleplay/answer/2479637">Google Play 고객센터</a>를 참고하세요.</li></ul>
""",
}

C["privacy"] = {
"zh": f"""
<p>本政策說明「{APP['zh']}」會處理哪些資料。我們盡量少收資料：<b>不需要註冊帳號、沒有廣告、沒有分析追蹤、不做跨網站追蹤</b>。</p>
<h2>1. 只存在你裝置上的資料</h2><p>設定（場景、聲音混音、呼吸節奏、語言）、練習紀錄（次數、分鐘數、連續天數）與提醒時間，都存在你的瀏覽器或 App 的本機儲存空間（localStorage），不會上傳。清除瀏覽器資料或解除安裝 App 就會刪除。所有聲音都在你的裝置上即時合成，不會錄音，也不會使用麥克風。</p>
<h2>2. App 使用的裝置功能（Android）</h2><ul>
<li><b>通知</b>：只有在你開啟「每日提醒」時，才會請求通知權限，並在你的裝置上排定本機通知，不經過伺服器。</li>
<li><b>背景播放</b>：在入睡模式或關閉螢幕後繼續播放聲音時，系統會顯示一則「播放中」的常駐通知（Android 前景服務規定）。</li>
<li><b>保持螢幕常亮</b>：靜心進行中會暫時防止螢幕自動關閉，結束後恢復。</li>
<li><b>震動</b>：呼吸引導轉換時的輕微震動，預設關閉，只有在呼吸設定中開啟「震動提示」才會使用。</li></ul>
<p>本 App 不使用位置、相機、麥克風、聯絡人等權限。</p>
<h2>3. 連線與第三方</h2><ul>
<li>網站與更新檔由 Cloudflare 提供，Cloudflare 可能為了安全與防止濫用，短期處理 IP 位址等連線資訊。</li>
<li>介面字型由 Google Fonts 載入，Google 會在載入時收到你的 IP 位址與瀏覽器資訊，依 <a href="https://policies.google.com/privacy">Google 隱私權政策</a>處理。</li>
<li>未來如果推出付費內容，網頁版付款由 Lemon Squeezy 處理（依其<a href="https://www.lemonsqueezy.com/privacy">隱私權政策</a>），App 版由 App Store 或 Google Play 處理；我們不會拿到你的信用卡資料。</li></ul>
<h2>4. 資料分享</h2><p>我們不出售你的資料，也不與廣告商分享。</p>
<h2>5. 你的權利</h2><p>你的資料只存在你的裝置上，你隨時可以清除瀏覽器資料或解除安裝 App 來刪除。如有任何疑問，歡迎來信。</p>
<h2>6. 兒童</h2><p>本服務適合一般大眾，未特別針對 13 歲以下兒童，也不會向兒童收集個人資料。</p>
<h2>7. 聯絡與更新</h2><p>如有任何問題，請寫信到 {M}。本政策更新時，會修改本頁的「最後更新」日期。</p>
""",
"ja": f"""
<p>本ポリシーは「{APP['ja']}」が扱うデータについて説明します。収集するデータは最小限です：<b>アカウント登録不要、広告なし、アクセス解析なし、サイトをまたぐ追跡なし</b>。</p>
<h2>1. 端末内だけに保存されるデータ</h2><p>設定（シーン、サウンドのミックス、呼吸リズム、言語）、記録（回数、分数、連続日数）、リマインダーの時刻は、ブラウザまたはアプリのローカルストレージ（localStorage）に保存され、アップロードされません。ブラウザのデータ消去やアプリの削除で消えます。サウンドはすべて端末上でリアルタイムに合成しており、録音やマイクの使用は行いません。</p>
<h2>2. アプリが使う端末機能（Android）</h2><ul>
<li><b>通知</b>：「毎日のリマインダー」をオンにした場合のみ通知の許可を求め、端末内でローカル通知を予約します。サーバーは経由しません。</li>
<li><b>バックグラウンド再生</b>：おやすみモードや画面オフ中に再生を続けるとき、「再生中」の常駐通知が表示されます（Android のフォアグラウンドサービスの規定）。</li>
<li><b>画面の常時点灯</b>：瞑想中は画面が自動で消えないようにし、終了後に元に戻します。</li>
<li><b>振動</b>：呼吸ガイドの切り替え時の軽い振動。初期設定はオフで、呼吸の設定で「振動で知らせる」をオンにした場合のみ使用します。</li></ul>
<p>位置情報、カメラ、マイク、連絡先などの権限は使用しません。</p>
<h2>3. 通信と第三者</h2><ul>
<li>サイトと更新ファイルは Cloudflare で提供されており、セキュリティと不正防止のため、IP アドレスなどの接続情報が短期間処理されることがあります。</li>
<li>画面のフォントは Google Fonts から読み込まれ、その際 Google に IP アドレスとブラウザ情報が送られ、<a href="https://policies.google.com/privacy">Google のプライバシーポリシー</a>に従って扱われます。</li>
<li>将来有料コンテンツを提供する場合、Web 版の決済は Lemon Squeezy（同社の<a href="https://www.lemonsqueezy.com/privacy">プライバシーポリシー</a>に従います）、アプリ版は App Store または Google Play が処理します。当方がカード情報を受け取ることはありません。</li></ul>
<h2>4. 第三者提供</h2><p>データを販売したり、広告事業者と共有したりすることはありません。</p>
<h2>5. あなたの権利</h2><p>データは端末内にのみ保存されており、ブラウザのデータ消去やアプリの削除でいつでも削除できます。ご不明な点はメールでお問い合わせください。</p>
<h2>6. 子どもについて</h2><p>本サービスは一般向けで、13 歳未満の子どもを特に対象とはしておらず、子どもから個人情報を収集することもありません。</p>
<h2>7. お問い合わせと改定</h2><p>ご質問は {M} までお送りください。本ポリシーを改定した場合は、本ページの「最終更新」日を変更します。</p>
""",
"en": f"""
<p>This policy explains what data "{APP['en']}" handles. We keep it to a minimum: <b>no account, no ads, no analytics and no cross-site tracking</b>.</p>
<h2>1. Data that stays on your device</h2><p>Your settings (scene, sound mix, breathing pattern, language), practice log (sessions, minutes, streak) and reminder time are stored in your browser's or the app's local storage (localStorage) and never uploaded. Clearing your browser data or uninstalling the app deletes them. All sound is synthesised live on your device; nothing is recorded and the microphone is never used.</p>
<h2>2. Device features used by the app (Android)</h2><ul>
<li><b>Notifications</b>: only if you turn on the daily reminder do we ask for notification permission; the reminder is scheduled locally on your device, with no server involved.</li>
<li><b>Background playback</b>: when sound keeps playing in sleep mode or with the screen off, Android shows an ongoing "playing" notification (required for foreground services).</li>
<li><b>Keep screen on</b>: during a session the screen is kept from switching off, and released when it ends.</li>
<li><b>Vibration</b>: gentle haptics when the breathing guide changes phase — off by default, used only if you turn on "Vibration cues" in the breathing settings.</li></ul>
<p>The app does not use location, camera, microphone or contacts permissions.</p>
<h2>3. Connections and third parties</h2><ul>
<li>The site and its update files are served by Cloudflare, which may briefly process connection data such as IP addresses for security and abuse prevention.</li>
<li>The interface font is loaded from Google Fonts, so Google receives your IP address and browser details when it loads, under the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.</li>
<li>If paid content is offered in future, web payments are handled by Lemon Squeezy (under their <a href="https://www.lemonsqueezy.com/privacy">privacy policy</a>) and app payments by the App Store or Google Play. We never receive your card details.</li></ul>
<h2>4. Sharing</h2><p>We do not sell your data or share it with advertisers.</p>
<h2>5. Your rights</h2><p>Your data lives only on your device; you can delete it at any time by clearing your browser data or uninstalling the app. Email us with any questions.</p>
<h2>6. Children</h2><p>The Service is for a general audience, is not directed at children under 13, and does not collect personal data from children.</p>
<h2>7. Contact and changes</h2><p>Questions: {M}. When this policy changes, we update the "Last updated" date on this page.</p>
""",
"ko": f"""
<p>이 방침은 「{APP['ko']}」가 처리하는 데이터를 설명합니다. 수집은 최소한으로 합니다: <b>계정 불필요, 광고 없음, 분석 도구 없음, 사이트 간 추적 없음</b>.</p>
<h2>1. 기기에만 저장되는 데이터</h2><p>설정(장면, 소리 믹스, 호흡 리듬, 언어), 기록(횟수, 분, 연속 일수), 알림 시간은 브라우저나 앱의 로컬 저장소(localStorage)에 저장되며 업로드되지 않습니다. 브라우저 데이터를 지우거나 앱을 삭제하면 사라집니다. 모든 소리는 기기에서 실시간으로 합성되며, 녹음하거나 마이크를 사용하지 않습니다.</p>
<h2>2. 앱이 사용하는 기기 기능(Android)</h2><ul>
<li><b>알림</b>: 「매일 알림」을 켤 때만 알림 권한을 요청하며, 알림은 서버를 거치지 않고 기기에서 예약됩니다.</li>
<li><b>백그라운드 재생</b>: 수면 모드나 화면이 꺼진 상태에서 소리를 계속 재생할 때 「재생 중」 상시 알림이 표시됩니다(Android 포그라운드 서비스 규정).</li>
<li><b>화면 켜짐 유지</b>: 명상 중에는 화면이 자동으로 꺼지지 않도록 하고, 끝나면 원래대로 돌립니다.</li>
<li><b>진동</b>: 호흡 가이드가 바뀔 때의 가벼운 진동으로, 기본값은 꺼짐이며 호흡 설정에서 「진동 알림」을 켤 때만 사용합니다.</li></ul>
<p>위치, 카메라, 마이크, 연락처 권한은 사용하지 않습니다.</p>
<h2>3. 통신과 제3자</h2><ul>
<li>사이트와 업데이트 파일은 Cloudflare를 통해 제공되며, 보안과 남용 방지를 위해 IP 주소 등 접속 정보가 잠시 처리될 수 있습니다.</li>
<li>화면 글꼴은 Google Fonts에서 불러오며, 이때 Google이 IP 주소와 브라우저 정보를 받아 <a href="https://policies.google.com/privacy">Google 개인정보처리방침</a>에 따라 처리합니다.</li>
<li>향후 유료 콘텐츠를 제공할 경우, 웹 결제는 Lemon Squeezy(그 <a href="https://www.lemonsqueezy.com/privacy">개인정보 처리방침</a>을 따름), 앱 결제는 App Store 또는 Google Play가 처리합니다. 저희는 카드 정보를 받지 않습니다.</li></ul>
<h2>4. 제3자 제공</h2><p>데이터를 판매하거나 광고주와 공유하지 않습니다.</p>
<h2>5. 이용자의 권리</h2><p>데이터는 기기에만 저장되며, 브라우저 데이터를 지우거나 앱을 삭제해 언제든 삭제할 수 있습니다. 궁금한 점은 이메일로 문의하세요.</p>
<h2>6. 아동</h2><p>서비스는 일반 이용자를 위한 것으로 13세 미만 아동을 특별히 대상으로 하지 않으며, 아동의 개인정보를 수집하지 않습니다.</p>
<h2>7. 문의 및 변경</h2><p>문의: {M}. 방침이 바뀌면 이 페이지의 「최종 업데이트」 날짜를 변경합니다.</p>
""",
}

C["contact"] = {
"zh": f"""
<p class="lead">有任何問題、建議或錯誤回報，歡迎來信：</p>
<p class="big">{M}</p>
<p>我們通常在 <b>3 個工作天內</b>回覆。回報問題時，請附上裝置型號與使用的場景，會更快找到原因。</p>
<h2>常見問題</h2>
<h3>關掉螢幕後聲音停了？</h3><p>請從「入睡」開始播放；Android 若仍會停止，請到系統設定把「靜心時光」的電池最佳化設為「不限制」。</p>
<h3>每日提醒沒有出現？</h3><p>請確認已允許靜心時光的通知權限，並且手機沒有開啟勿擾模式。</p>
<h3>換手機後紀錄會保留嗎？</h3><p>不會。為了保護隱私，練習紀錄只存在原本的裝置上，不會上傳。</p>
<h3>要付費嗎？</h3><p>目前全部免費，詳見<a href="pass.html">方案與價格</a>。</p>
<p class="note">營運者：Empty Office（無人辦公室），個人開發者，台灣。</p>
""",
"ja": f"""
<p class="lead">ご質問、ご提案、不具合の報告は、こちらまでご連絡ください。</p>
<p class="big">{M}</p>
<p>通常 <b>3 営業日以内</b>に返信します。不具合のご報告には、端末の機種と使用していたシーンを添えていただくと原因を早く特定できます。</p>
<h2>よくある質問</h2>
<h3>画面を消すと音が止まる</h3><p>「おやすみ」から再生してください。Android で止まる場合は、システム設定で「やすらぎの時間」の電池の最適化を「制限なし」にしてください。</p>
<h3>毎日のリマインダーが届かない</h3><p>通知の許可がオンになっているか、おやすみモード（マナーモード）になっていないかご確認ください。</p>
<h3>機種変更すると記録は残りますか？</h3><p>残りません。プライバシー保護のため、記録は元の端末にのみ保存され、アップロードされません。</p>
<h3>料金はかかりますか？</h3><p>現在はすべて無料です。<a href="pass.html">料金プラン</a>をご覧ください。</p>
<p class="note">運営：Empty Office（無人辦公室）、個人開発者、台湾。</p>
""",
"en": f"""
<p class="lead">Questions, ideas or bug reports — please email:</p>
<p class="big">{M}</p>
<p>We usually reply within <b>3 business days</b>. For bug reports, tell us your device model and which scene you were using.</p>
<h2>FAQ</h2>
<h3>The sound stops when the screen turns off</h3><p>Start playback from "Sleep". If Android still stops it, set battery optimisation for Calm Moments to "Unrestricted" in system settings.</p>
<h3>The daily reminder doesn't appear</h3><p>Make sure notifications are allowed for Calm Moments and that Do Not Disturb is off.</p>
<h3>Will my practice log move to a new phone?</h3><p>No. To protect your privacy, the log stays on the original device and is never uploaded.</p>
<h3>Does it cost anything?</h3><p>Everything is currently free; see <a href="pass.html">Pricing</a>.</p>
<p class="note">Operated by Empty Office, an individual developer based in Taiwan.</p>
""",
"ko": f"""
<p class="lead">질문, 제안, 버그 신고는 아래 이메일로 보내 주세요.</p>
<p class="big">{M}</p>
<p>보통 <b>영업일 기준 3일 이내</b>에 답장합니다. 버그를 신고할 때 기기 모델과 사용하던 장면을 알려 주시면 원인을 더 빨리 찾을 수 있습니다.</p>
<h2>자주 묻는 질문</h2>
<h3>화면을 끄면 소리가 멈춰요</h3><p>「수면」에서 재생을 시작하세요. Android에서 계속 멈추면 시스템 설정에서 「고요한 시간」의 배터리 최적화를 「제한 없음」으로 바꿔 주세요.</p>
<h3>매일 알림이 오지 않아요</h3><p>알림 권한이 허용되어 있는지, 방해 금지 모드가 꺼져 있는지 확인해 주세요.</p>
<h3>휴대폰을 바꾸면 기록이 남나요?</h3><p>남지 않습니다. 개인정보 보호를 위해 기록은 원래 기기에만 저장되며 업로드되지 않습니다.</p>
<h3>유료인가요?</h3><p>현재 모두 무료입니다. <a href="pass.html">요금 안내</a>를 참고하세요.</p>
<p class="note">운영: Empty Office, 대만의 개인 개발자.</p>
""",
}


def page(key):
    sections = []
    for code, _ in LANGS:
        nav = " · ".join(f'<a href="{k}.html" class="{"on" if k == key else ""}">{html.escape(NAV[k][code])}</a>' for k in NAV)
        sections.append(f'''<section lang="{code}" data-l="{code}">
  <nav class="top"><a href="./" class="back">{BACK[code]}</a></nav>
  <h1>{NAV[key][code]}</h1>
  <p class="upd">{UPDATED[code]}：{DATE}</p>
  {C[key][code]}
  <footer><nav>{nav}</nav><p>Empty Office · {M}</p></footer>
</section>''')
    switch = "".join(f'<button data-l="{c}">{n}</button>' for c, n in LANGS)
    titles = ", ".join(f"{c}: {(NAV[key][c] + ' · ' + APP[c])!r}" for c, _ in LANGS)
    return f'''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{NAV[key]["zh"]} · {APP["zh"]}</title>
<meta name="description" content="{html.escape(NAV[key]["en"])} — Calm Moments by Empty Office">
<link rel="canonical" href="https://calm.emptyoffice.app/{key}">
<link rel="icon" href="icons/icon-192.png"><link rel="stylesheet" href="legal.css"></head>
<body><div class="langs">{switch}</div>
{"".join(sections)}
<script>
(function () {{
  var TITLES = {{{titles}}};
  function pick() {{
    var q = new URLSearchParams(location.search).get('lang'); if (TITLES[q]) return q;
    try {{ var s = JSON.parse(localStorage.getItem('seasontree.settings') || '{{}}').lang; if (TITLES[s]) return s; }} catch (e) {{}}
    var n = (navigator.language || '').toLowerCase();
    return n.indexOf('ja') === 0 ? 'ja' : n.indexOf('ko') === 0 ? 'ko' : n.indexOf('zh') === 0 ? 'zh' : 'en';
  }}
  function show(l) {{
    document.querySelectorAll('section[data-l]').forEach(function (s) {{ s.hidden = s.getAttribute('data-l') !== l; }});
    document.querySelectorAll('.langs button').forEach(function (b) {{ b.classList.toggle('on', b.getAttribute('data-l') === l); }});
    document.documentElement.lang = l === 'zh' ? 'zh-Hant' : l; document.title = TITLES[l];
  }}
  document.querySelector('.langs').addEventListener('click', function (e) {{
    var b = e.target.closest('button'); if (!b) return; var l = b.getAttribute('data-l');
    // share the app's language setting so the app and these pages stay in sync
    try {{ var st = JSON.parse(localStorage.getItem('seasontree.settings') || '{{}}'); st.lang = l; localStorage.setItem('seasontree.settings', JSON.stringify(st)); }} catch (err) {{}}
    show(l);
  }});
  show(pick());
}})();
</script></body></html>
'''


CSS = """:root { --ink: #3b3346; --paper: #fbf4f7; --dim: #9a8fa3; --accent: #a0569a; --card: #ffffff; --line: #eadde6; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.75 system-ui, -apple-system, "Segoe UI", "Noto Sans TC", "Noto Sans JP", "Noto Sans KR", sans-serif; }
section { max-width: 760px; margin: 0 auto; padding: 24px 18px 48px; }
.langs { position: sticky; top: 0; z-index: 2; display: flex; gap: 6px; justify-content: flex-end; padding: 10px 16px; background: rgba(251, 244, 247, .94); border-bottom: 1px solid var(--line); }
.langs button { border: 1.5px solid #c9b6cf; color: var(--ink); background: var(--card); border-radius: 999px; padding: 2px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.langs button.on { background: linear-gradient(135deg, #f0a6c4, #b7a3e8); border-color: transparent; color: #fff; }
.top .back { font-size: 14px; color: var(--dim); text-decoration: none; }
h1 { font-size: 30px; line-height: 1.3; margin: 14px 0 2px; letter-spacing: .04em; }
h2 { font-size: 19px; margin: 28px 0 6px; padding-top: 10px; border-top: 1px dashed var(--line); }
h3 { font-size: 16px; margin: 18px 0 2px; }
.upd { color: var(--dim); font-size: 13px; margin: 0 0 18px; }
.lead { font-size: 17px; }
.big { font-size: 22px; font-weight: 700; }
.note { font-size: 13.5px; color: #6c6274; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px; }
a { color: var(--accent); }
table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 14.5px; background: var(--card); border-radius: 14px; overflow: hidden; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { background: #f5e8f0; }
td:first-child { font-weight: 700; white-space: nowrap; }
footer { margin-top: 40px; padding-top: 16px; border-top: 1.5px solid #d9c6d6; font-size: 13.5px; color: #6c6274; }
footer nav a { color: inherit; }
footer nav a.on { font-weight: 700; color: var(--ink); text-decoration: none; }
@media (max-width: 560px) { h1 { font-size: 25px; } td:first-child { white-space: normal; } table { font-size: 13.5px; } }
"""

open(os.path.join(OUT, "legal.css"), "w", encoding="utf-8", newline="\n").write(CSS)
for k in NAV:
    open(os.path.join(OUT, f"{k}.html"), "w", encoding="utf-8", newline="\n").write(page(k))
    print("wrote", k)
