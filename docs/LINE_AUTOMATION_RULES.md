# 🚨 SSIN STUDIO / LUMISS LINE自動配信システム 構築ルール

> **このファイルは藤沢・札幌で実稼働中のシステムを別店舗に展開するための確定ルール。**
> **配置先: `~/.salonboard_dashboard/docs/LINE_AUTOMATION_RULES.md`**

---

## ⛔ Claude への強制指示（最優先・必ず守ること）

このファイルを参照した時点で、以下に同意したものとみなす：

| 禁止行為 | 理由 |
|---|---|
| 新規アーキテクチャの提案 | 藤沢・札幌で実稼働中。変更すると本番が壊れる |
| 「もっとシンプルな方法」の提案 | 過去事故の対策が全て組み込まれている |
| 既存ファイル構造の改変 | 他システム（dashboard・GAS・launchd）が依存している |
| ルールを読まずに着手 | 重大事故の温床（過去にVercel push忘れ等） |
| 独断での「効率化」「改善」「最適化」 | 必ず将太の承認を得てから |

### 実装手順は必ず以下の順序：

1. **藤沢の該当ファイルを `view` で全部読む**
   - `~/salonboard_scraper/fetch_fujisawa_daily.py`
   - `~/Documents/gas_line_merged.gs`
   - `~/.salonboard_dashboard/docs/dashboard_sapporo.html`（札幌版が最新）
2. **このルールファイルの該当セクションを `view` で読む**
3. **差分が必要な箇所だけリストアップ → 将太に確認**
4. **コピー → Python置換 → 実行 → 動作確認**

### 疑問が出たら必ず質問する。手を動かす前に止まる。

---

## 0. 用語・前提

- **店舗コード**: `fujisawa` / `sapporo` / `gifu` のような英字小文字
- **店舗ブランド**: `S` = SSIN STUDIO / `L` = LUMISS（LEDマツエク併設店）
- **GAS**: Google Apps Script（LINE Messaging API・スプレッドシート連携の中核）
- **launchd**: macOSのスケジューラ（cron相当）
- **HPB**: ホットペッパービューティー

---

## 1. システム全体像（3層構造）

新店舗でも必ずこの3層で構築する。**勝手に2層や4層にしない。**

| レイヤー | ファイル | 担当シナリオ |
|---|---|---|
| Python | `~/salonboard_scraper/send_reminder.py` | 予約リマインド/定期フォロー/お礼/おかえりなさい |
| GAS | 各店舗専用GAS URL | 来店前リマインド/新規40日後/Webhookハンドリング |
| Dashboard | `dashboard_{store}.html` | KPI確認/手動配信操作 |

データ取得は別途 `fetch_{store}_daily.py`（毎日22時台 launchd）で SalonBoard CSV 取得 → Googleスプレッドシート書込。

---

## 2. 配信シナリオ仕様（全店共通・絶対変更禁止）

### ① 次回予約リマインド
- タイミング: 予約日 **7日前** と **前日** の朝8:30（`REMINDER_DAYS=[7,1]`）
- 条件: SalonBoard予約一覧 × LINE友だち電話番号マッチ
- 文面変数: `{name} {store} {date} {staff} {menu} {hpb_url}`

### ② 21日後 定期リマインド（まつ毛パーマ / 眉毛ワックス / セット）
- タイミング: 最終来店から **20〜22日後**（±1日ウィンドウで取りこぼし防止）
- クーポン有効期限: 40日以内
- Flex Message で画像付き → HPBに誘導

### ③ 30日後 カウントダウン（同3メニュー）
- 29〜31日後 / 「あと{remaining}日です⏰」で損失回避訴求

### ④ マツエク 14日後リマインド（LEDマツエク）
- 13〜15日後

### ⑤ マツエク 21日後 カウントダウン
- 20〜22日後

### ⑥ 来店翌日お礼
- 翌朝8:30
- 条件: 昨日来店 × 「新規次回」or「再来次回」タグあり のみ
- メニュー別文面（持ちを良くするケア法を入れる）

### ⑦ おかえりなさい（40日以上）
- 条件: 最終来店40日以上 × 「先予約あり」タグなし × 予約CSVにも予約なし
- 内容: **特典なし**のシンプルな再来訪呼びかけ + HPBリンク
- 重複管理: `okaerinasai_{uid}_{YYYYMM}` で月1回まで
- 除外運用したい店舗は `label == "店舗名"` でスキップ可

### ⑧ GAS自動: 来店前リマインド（2日前）/ 新規40日後 4種（タグ別）
- GASスケジューラで自動実行（ON固定）

### クーポン金額（COUPON_CONTENT・絶対変更禁止）
- まつ毛パーマ: ¥4,300（税込）
- 眉毛ワックス: ¥4,000（税込）
- セット: まつ毛パーマ＋眉毛ワックス ¥7,100（税込）
- マツエク: LEDマツエク付け足し ¥4,900〜（税込）

### 重複防止
全シナリオ `sent_reminders.json` のキーで管理。同一顧客への同一シナリオ重複送信を防ぐ。

---

## 3. タグ運用ルール（最重要）

### タグ一覧
| タグ | 付与条件 | 用途 |
|---|---|---|
| 新規 / リピーター予備軍 / 常連 / VIP / 再来 | カウンセリング/来店履歴 | 新規・再来判定 |
| 新規次回 | 新規客 × 次回予約あり | 翌日お礼対象 |
| 再来次回 | 再来客 × 次回予約あり | 翌日お礼対象 |
| 先予約あり | 任意のメニューで将来予約あり | おかえりなさい除外 |
| 次回予約なし | 予約なし | 40日クーポン対象 |
| 40日クーポン送付済み | 送信後永続 | 重複送信防止 |
| メニュー系（眉毛ワックス/まつ毛パーマ/セット/LEDエクステ） | カウンセリング記録のメニュー列から自動 | 配信ターゲティング |

### 🚫 絶対ルール: タグ依存禁止
**KPIカード・配信対象判定は「最終来店日」「来店回数」「累計金額」など生データから直接計算する。**

- ❌ NG: タグ「離脱予兆_40-60日」を数える → タグ付与プロセスがないと常に0
- ✅ OK: 最終来店日から経過日数を直接計算

タグは「アクション済み」「送付済み」のフラグ専用。

---

## 4. 新店舗追加 標準手順（この順番で機械的に）

### 4-1. 認証情報の収集
- SalonBoard ID/PW（個別アカウント `KLP` or グループ `CNC`）
- LINE Channel ID / Channel Secret
- スプレッドシートID
- HPB URL（S/L両方）

### 4-2. GAS作成
1. `~/Documents/gas_line_merged.gs`（藤沢基準）をコピー
2. **Pythonで7箇所を置換**（unicodeエスケープ含むため `Edit tool` 不可・Python必須）

```python
content = content.replace("FUJISAWA_TOKEN", "{STORE}_TOKEN")
content = content.replace('"1COD2jGK..."', '"{新SS_ID}"')
content = content.replace('["予約一覧_S藤沢", "予約一覧_L藤沢"]', '["予約一覧_S{店舗}", ...]')
content = content.replace('["売上明細_S藤沢", "売上明細_L藤沢"]', '["売上明細_S{店舗}", ...]')
# 他、店舗名・SALES_SS_ID等
```

3. GASエディタに貼り付け → スクリプトプロパティに `{STORE}_TOKEN` 設定 → 新バージョンでデプロイ
4. `initSheet()` → `setup{Store}Store()` → `resetTrigger()` を実行

### 4-3. LINE_TOKEN管理（絶対ハードコード禁止）

```javascript
// ✅ 正
var LINE_TOKEN = PropertiesService.getScriptProperties().getProperty("{STORE}_TOKEN") || "";

// ❌ NG（30日で期限切れ → sendFlexが壊れる）
var LINE_TOKEN = "OVWoRXHk...";
```

トークン再発行（30日ごと）:

```bash
curl -X POST "https://api.line.me/v2/oauth/accessToken" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id={CHANNEL_ID}&client_secret={CHANNEL_SECRET}"
```

### 4-4. Cloudflare Worker設定
1. 既存Worker `summer-glade-d343` の `STORES` マップに `{code, gasUrl, token, destination_userId}` を追加
2. LINE Developers で Webhook URL を `https://summer-glade-d343.s-takahashi-561.workers.dev/?store={code}` に設定

### 4-5. store_config.js に追記（1行のみ）

```javascript
// ~/.salonboard_dashboard/docs/store_config.js
{ code: "kumamoto", name: "SSIN STUDIO 熊本", gasUrl: "https://...", lineId: "@xxx" },
```

これだけでカウンセリングフォーム・スタッフアプリ・全画面に自動反映。**HTMLは絶対に直接編集しない**。

### 4-6. fetch_{store}_daily.py 作成

1. `fetch_fujisawa_daily.py` をコピー
2. 冒頭7箇所を変更（GAS_URL / SHEET_ID / TOKEN_FILE / シート名4種 / FOLLOWUP_MSG / STORES配列）
3. `cp token_fujisawa.pickle token_{store}.pickle`（同じGoogleアカウントなら流用可）
4. launchd plist 2本作成（時刻はずらす）:
   - スクレイプ用: 22:XX（10分刻み）
   - 送信用: 10:XX（5分刻み）
5. 初回 `python3 fetch_{store}_daily.py --init`（CAPTCHA手動対応）

### 4-7. send_reminder.py STORE_CONFIG に追加

```python
STORE_CONFIG["{store}"] = {
    "label": "店舗名",
    "csv_files": [...],
    "kaikei_files": [...],
    "gas_url": "...",
    "hpb_urls": {"S": "...", "L": "..."},  # マツエクURLバグ回避のため必須
}
```

### 4-8. dashboard_{store}.html 作成
1. `dashboard_sapporo.html` をコピー
2. GAS URL/店舗名を変更
3. `refreshAll` 重複定義チェック（後述）
4. **git push（commit だけは厳禁、必ず即push）**

### 4-9. 動作確認
- LINE友だち追加 → 挨拶メッセージ受信
- テスト顧客に手動配信
- launchdジョブ `exitcode=0` 確認
- syncFromSalonboard で電話番号マッチング率確認

---

## 5. SalonBoard スクレイピング 鉄則

### 5-1. ナビゲーション

```python
# ✅ 全 navigation は wait_until="commit"
page.goto(url, wait_until="commit", timeout=30000)
page.wait_for_timeout(1500)

# ❌ NG: "load" / "networkidle" / "domcontentloaded" は不安定
```

### 5-2. 直URLが使えないページ
- 売上系（`/KLP/sales/...`）/ 予約一覧 → **メニュークリック経由必須**
- 分析・顧客系（`/KLP/analysis/`, `/KLP/customer/...`）→ 直URL OK
- 予約一覧は `/KLP/reserve/reserveList/searchDate?date=YYYYMMDD` なら OK

### 5-3. セッション切れ検出（URL確認だけでは不十分）

```python
def _logged_in(page):
    url = page.url
    if "/login/" in url or "/captcha" in url.lower():
        return False
    try:
        title = page.title()
        if "エラー" in title:
            return False
        body = page.locator("body").inner_text(timeout=3000)
        if "有効期限が切れました" in body or "ログインしなおして" in body:
            return False
    except Exception:
        pass
    return True
```

セッション切れ検出時は `session_path.unlink(missing_ok=True)` で再ログインフロー。

### 5-4. ステータスチェックボックス（label[for=id] 形式）

```python
# ✅ 正
lbl = page.locator("label").filter(has_text=kw).first
if lbl.count():
    for_id = lbl.get_attribute("for")
    if for_id:
        cb = page.locator(f"#{for_id}").first

# ❌ NG: page.locator("input[type='checkbox']").filter(has_text=kw)
# checkboxはinnerTextを持たないため常にマッチしない
```

### 5-5. 予約一覧 1000件上限
950行以上で自動分割取得（`_fetch_yoyaku_chunks()` 再帰、最大4段階）。

### 5-6. CAPTCHA
完全自動突破不可。初回 `--init` でユーザー手動対応（3分待機）→ セッション保存して再利用。

### 5-7. context.storage_state() は try/except 必須

```python
finally:
    try:
        context.storage_state(path=str(session_path))
    except Exception:
        pass
    browser.close()
```

### 5-8. 電話番号正規化（GAS/Python一致）

```python
def n_phone(p):
    return re.sub(r"[^\d]", "", str(p or "")).lstrip("0")  # 先頭0除去 必須
```

GASの `normalizePhone` が `replace(/^0+/, "")` で先頭0を除去するため、Python側も合わせないとマッチング全件失敗。

### 5-9. SalonBoard予約CSV 電話番号列は2つ
col[25] と col[29] の両方を `normalizePhone` してOR照合。dict comprehension は**先勝ち**で書く：

```python
col = {}
for i, h in enumerate(headers):
    if h not in col:
        col[h] = i
```

### 5-10. launchdスクリプトの配置
**Desktop配下は禁止**（Operation not permitted）。`~/salonboard_scraper/` 直下に置く。

---

## 6. GAS編集ルール

### 6-1. ファイル編集はPythonで
GASファイルには絵文字等の `\uXXXX` エスケープが大量に含まれ、Edit toolでは一致しない。

```python
with open('/path/to/gas.gs', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()
content = content.replace(old, new)
with open('/path/to/gas.gs', 'w', encoding='utf-8') as f:
    f.write(content)
```

### 6-2. LINE API呼び出し（POSTのみ）

```python
# テキスト送信
gas_post(url, key, {"action": "send_push", "line_uid": uid, "message": text})

# 画像送信（テキスト→画像の順で2回呼ぶ）
gas_post(url, key, {"action": "send_push", "line_uid": uid, "message": text})
gas_post(url, key, {"action": "send_image", "line_uid": uid, "image_url": img_url})
```

`doGet` で `action=send_push` を渡すと `{"error":"unknown action"}` になる。

### 6-3. doGet/doPost に同じactionを2行書かない
後勝ちバグで先の定義が無視される（実例: `get_customer_profile` で `skip_billing` が無視されていた）。

### 6-4. GAS×Worker 挨拶二重送信防止
followイベントでは GASは `registerFriend()` のみ。挨拶送信は Worker 側に一本化。

### 6-5. デプロイ忘れ厳禁
ローカル `.gs` 修正 → Apps Script エディタに貼り付け → **新バージョンでデプロイ**。
保存だけでは本番反映されない。

---

## 7. ダッシュボード（HTML）ルール

### 7-1. refreshAll は1箇所のみ定義
重複定義（後の `async function refreshAll` が `loadAll` 未定義で勝つ）は致命的バグ。

```javascript
async function refreshAll() {
  Object.keys(localStorage).filter(k => k.startsWith('sgc_')).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('lineFriendsCache_v2');
  Object.keys(_loaded).forEach(k => delete _loaded[k]);
  allFriends = [];
  document.getElementById('updatedAt').textContent = '更新中...';
  await loadDashboard();
}
```

### 7-2. キャッシュヒット時の背景更新で必ず3関数を呼ぶ

```javascript
gasGet('get_line_friends', {}, 5).then(data => {
  allFriends = data.friends || [];
  saveFriendsToCache(allFriends);
  _applyFriendsToUI(allFriends);
  updateChurnKpi();        // 必須
  initHomeStoreFilter();   // 必須
  loadHomeStoreStats();    // 必須
}).catch(() => {});
```

### 7-3. 店舗別ダッシュボードに他店舗データを混ぜない
比較したい場合は別ファイル `横串比較_{月}.html` として独立作成。

### 7-4. UI設計（タカショー承認パターン）
- ヒーローバナー（グラデーション + 大型emoji 52px + タイトル）
- タイムライン形式（時系列コンテンツ）
- LINEスタイル会話バブル（お客様=白/スタッフ=ティール）
- 大型数値カード（背景色付き）
- CSS疑似スクリーン（実画像なしで再現）
- 商品カードヘッダー（グラデーション + 大型emoji + 価格大文字）
- 会話例は2〜3往復で完全展開、商品知識は4カラム網羅
- NGパターンは赤色カードで分離

❌ 省略・テキスト中心・カード左ボーダーだけのシンプルすぎは禁止

### 7-5. GAS URLをHTMLにハードコード禁止
`store_config.js` の `SSIN_GAS_BY_CODE[code]` / `SSIN_GAS_BY_NAME[name]` 経由で取得。

---

## 8. Vercel デプロイルール

### 8-1. 配置
- ローカル: `~/.salonboard_dashboard/docs/`
- 公開URL: `https://salonboard-dashboard.vercel.app/{file}`（cleanUrls有効、.html省略可）
- ⚠️ URLに `/docs/` は付かない

### 8-2. 🚨 絶対ルール: commit したら即 push

```bash
cd ~/.salonboard_dashboard
git add docs/{file}.html
git commit -m "..."
git push origin main   # ← これを絶対忘れない
```

commit だけでは本番反映されない。過去にpush忘れで「テスト送信が全部藤沢GASに入る」事故発生。

### 8-3. push失敗時

```bash
git stash
git pull --rebase origin main
git stash pop
git push origin main
```

### 8-4. localStorage競合
JSコード内 `STORAGE_KEY` のバージョンを上げる（v2→v3）。

---

## 9. LINE配信メッセージ作成ルール

### 9-1. トーン
- 敬語ベース、スタッフが語りかけるような温度感
- 「3つのメリット」「箇条書き」は使わない（営業資料っぽくなる）
- プロ視点の豆知識を冒頭に（「4月は眉毛が乱れやすい季節」など）
- クーポン情報は後半（感情を動かしてから提示）
- 短く読み切れる長さ
- 押し売り感を出さず「ぜひご自身のために」で背中を押す

### 9-2. テンプレート変数
`{name} {store} {date} {staff} {menu} {expiry} {remaining} {hpb_url}` を組み合わせて使う。

### 9-3. HPB URL（店舗ごとに必ず変える）
`store_cfg.get("hpb_urls", {}).get("L", "")` 経由で取得。ハードコード厳禁。

---

## 10. データ集計・レポート出力ルール

### 10-1. 「pt」表記禁止
- ❌ NG: 「-36pt」
- ✅ OK: 「基準63%に対して27.5%（36%下回り）」「29人不足」「差分 -¥446,850」

### 10-2. KPI表記の標準形式
`目標/実績 (差分)` 例: 新規 100/43 (-57)

### 10-3. 店舗分析は他店と比較しない
「京都と比較して...」「武蔵小杉と同じタイプ」等の横比較は書かない。店舗内の具体数値だけで要因を説明する。

### 10-4. 0%/100% 等の極端な値は必ず疑う
表記揺れ漏れの可能性が高いため、必ず元データを目視確認。

### 10-5. 表記揺れの網羅（メニュー分類時）
- 英字/カタカナ: `Wax/wax/WAX/ワックス`
- 記号: `+/＋/×/／/、`
- 眉側: `眉毛/眉/美眉/アイブロウ/HBL眉/ブロウリフト/眉毛パーマ`
- まつ側: `まつげ/まつ毛/マツ/まつパ/パーマ/パリジェンヌ/ラッシュ/エクステ`
- 注意: `眉毛パーマ` は眉側処置 → まつ側キーワードから除外

### 10-6. 月度確認ルール
シート参照前に必ず週ラベル/日付列で月度を確認。既存データと10%以上差がある場合は上書き前にユーザー確認。

### 10-7. 売上データのスコープ確認
- **本部/SV視点**: 着地見込テーブル / 事業部売上集計10期（gid=50056376）が正本
- **店舗総売上**: 加盟店オーナー取り分含む別スコープ
両者を混同しない。

---

## 11. プライバシー・セキュリティルール

### 11-1. ハードコード禁止
- LINE_TOKEN → スクリプトプロパティ
- GAS URL → store_config.js
- パスワード/API KEY → 環境変数 or .env（gitignore）

### 11-2. 個人情報の扱い
- スタッフ名・売上・MTG内容を含むHTMLは原則公開不可
- 社内共有目的でVercelに上げる場合は URL知っている人だけアクセス可能であることを認識
- 機微な情報を載せる場合は再検討

### 11-3. AppleScript系のtccutil禁止
`tccutil reset AppleEvents` を実行するとTerminal→Messagesの自動化権限が消えてサイレント失敗が起きる。絶対禁止。

---

## 12. トラブルシューティング標準フロー

1. **launchdジョブが動かない**: `launchctl list | grep salon` で確認 → ログ `~/salonboard_scraper/logs/` 確認
2. **LINE送信が失敗**: GASの `LINE_TOKEN` 期限切れ確認 → curl で再発行 → スクリプトプロパティ更新
3. **電話番号マッチング率が低い**: `syncFromSalonboard` が予約一覧の「会計済み」を読めているか確認（`status_keywords` に必ず含める）
4. **ダッシュボードKPIが常に0**: タグ依存になっていないか確認 → 生データから直接計算に変更
5. **Vercelに反映されない**: `git log origin/main` で push 済みか確認

---

## 13. 新店舗チェックリスト（コピペ用）

```
[ ] SalonBoard認証情報取得（ID/PW、グループ or 個別）
[ ] LINE Channel作成（Channel ID/Secret/Token取得）
[ ] スプレッドシート作成（予約一覧_S/L、売上明細_S/L、フォロー待機 シート）
[ ] HPB URL確認（S/L両方）
[ ] GASファイル作成（gas_line_merged.gs ベースで7箇所置換）
[ ] スクリプトプロパティに {STORE}_TOKEN 設定
[ ] GAS新バージョンデプロイ → initSheet/setup/resetTrigger 実行
[ ] Cloudflare Worker STORES マップに追加
[ ] LINE Developers で Webhook URL 設定
[ ] store_config.js に1行追加 → git push
[ ] fetch_{store}_daily.py 作成（7箇所変更）
[ ] token_{store}.pickle 配置
[ ] launchd plist 2本作成（22:XX / 10:XX）→ launchctl load
[ ] 初回 --init 実行（CAPTCHA手動）
[ ] send_reminder.py STORE_CONFIG に追加
[ ] dashboard_{store}.html 作成 → git push
[ ] LINE友だち追加で挨拶受信確認
[ ] テスト送信13種類すべて確認
[ ] syncFromSalonboard で電話番号マッチング率確認
[ ] launchd exitcode=0 確認
```

---

## 14. 過去事故・絶対回避リスト

1. **2026-05-12**: Vercel push忘れ → テスト送信が全部藤沢GASに → commit即push徹底
2. **2026-05-07**: KPIタグ依存で常に0表示 → 生データから直接計算に変更
3. **2026-04-22**: 店舗別ダッシュボードに他店舗データ混入 → 各店単独で完結
4. **Tomoyo SMS事故**: tccutil でAppleEvents権限リセット → AppleScriptサイレント失敗 → tccutil系コマンド禁止
5. **2026-04-20**: セット分類で「0%」誤判定 → 表記揺れ網羅・極端値検算ルール化
6. **2026-04-21**: 3月シート参照で4月メモリ上書き → 月度確認ルール化

---

このルールに従えば、新店舗のLINE自動配信システムは**チェックリストを上から順に実行するだけ**で構築できる。
不明点があればこのファイルを参照し、変更が発生したら都度このファイルを更新する。

**疑問が出たら必ず止まって質問する。独断で進めない。**
