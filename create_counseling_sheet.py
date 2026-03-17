"""
カウンセリングシート用スプレッドシートをGoogle Sheetsに自動作成するスクリプト
Playwrightでブラウザを開いて操作します（ログイン不要・既存セッション利用）
"""
from playwright.sync_api import sync_playwright
import json, time, os

DATA_DIR = "/Users/shou/.salonboard_dashboard"

TABS = [
    {
        "name": "カウンセリング記録",
        "headers": [
            "記録ID","記録日時","店舗名","来店日","予約番号",
            "電話番号","お名前","メニュー","担当スタッフ",
            "肌質","アレルギー","アレルギー詳細",
            "過去施術歴","本日の要望","施術メモ","次回提案","次回提案時期",
            "LINE_UID","LINE送信フラグ","最終更新"
        ],
        "color": {"red": 0, "green": 0.725, "blue": 0},
    },
    {
        "name": "LINE配信ログ",
        "headers": ["ログID","送信日時","電話番号","お名前","LINE_UID","種別","内容","ステータス","エラー"],
        "color": {"red": 0.102, "green": 0.451, "blue": 0.937},
    },
    {
        "name": "LINE友だち",
        "headers": ["LINE_UID","電話番号","お名前","登録日時","最終来店日"],
        "color": {"red": 0, "green": 0.478, "blue": 0},
    },
    {
        "name": "設定",
        "headers": ["キー","値"],
        "color": {"red": 0.5, "green": 0.5, "blue": 0.5},
    },
]

SETTINGS = [
    ["店舗名", "テスト店舗（SSIN STUDIO）"],
    ["LINE公式アカウント", "@027qvfqz"],
    ["リマインド_来店前日数", "2"],
    ["フォロー_来店後日数", "1"],
    ["ステップ1_日数", "14"],
    ["ステップ2_日数", "30"],
    ["ステップ3_日数", "60"],
]

def main():
    with sync_playwright() as p:
        # ── ブラウザ起動（既存Chromeプロファイルを使う）─────────────
        try:
            browser = p.chromium.launch_persistent_context(
                user_data_dir=os.path.expanduser("~/Library/Application Support/Google/Chrome"),
                channel="chrome",
                headless=False,
                args=["--profile-directory=Default"],
            )
            page = browser.pages[0] if browser.pages else browser.new_page()
        except Exception:
            browser = p.chromium.launch(headless=False)
            page = browser.new_page()

        print("Google Sheetsでスプレッドシートを作成中...")
        page.goto("https://sheets.new", wait_until="networkidle", timeout=30000)
        time.sleep(3)

        # ログイン確認
        if "accounts.google.com" in page.url or "signin" in page.url:
            print("\n⚠️  Googleにログインしていません。")
            print("ブラウザでGoogleアカウントにログインしてください。")
            print("ログイン完了後、Enterを押してください...")
            input()
            page.goto("https://sheets.new", wait_until="networkidle", timeout=30000)
            time.sleep(3)

        ss_url = page.url
        print(f"スプレッドシートURL: {ss_url}")

        # スプレッドシートIDを取得
        ss_id = ss_url.split("/d/")[1].split("/")[0] if "/d/" in ss_url else None
        if not ss_id:
            print("❌ スプレッドシートIDの取得に失敗しました")
            browser.close()
            return

        print(f"スプレッドシートID: {ss_id}")

        # ── タイトル変更 ──────────────────────────────────────────
        try:
            title_el = page.locator("[data-qa='title-input'], .docs-title-input, [aria-label='スプレッドシート名']").first
            title_el.click()
            time.sleep(0.5)
            title_el.select_all()
            title_el.fill("カウンセリングシート管理_テスト")
            page.keyboard.press("Enter")
            time.sleep(1)
            print("✅ タイトル設定完了")
        except Exception as e:
            print(f"⚠️  タイトル設定スキップ: {e}")

        # ── Google Sheets API でタブ・ヘッダーを設定 ─────────────
        # APIリクエストをページ内JSで実行
        result = page.evaluate(f"""
        async () => {{
            const ssId = "{ss_id}";
            const token = await new Promise(resolve => {{
                chrome?.runtime?.sendMessage({{type: 'getToken'}}, resolve);
            }}).catch(() => null);
            return {{ ssId }};
        }}
        """)

        print("\nヘッダー行を入力します...")

        # ── シート1（カウンセリング記録）にヘッダーを入力 ──────────
        headers1 = TABS[0]["headers"]
        _type_headers(page, headers1)
        print("✅ カウンセリング記録ヘッダー入力完了")

        # ── 追加シートを作成 ─────────────────────────────────────
        for tab in TABS[1:]:
            _add_sheet(page, tab["name"])
            time.sleep(1)
            _type_headers(page, tab["headers"])
            print(f"✅ {tab['name']} 作成完了")

        # 設定シートに初期データ入力
        _click_sheet_tab(page, "設定")
        time.sleep(0.5)
        for i, row in enumerate(SETTINGS):
            cell = f"A{i+2}"
            _click_cell(page, cell)
            page.keyboard.type(row[0])
            page.keyboard.press("Tab")
            page.keyboard.type(str(row[1]))
            page.keyboard.press("Enter")
        print("✅ 設定シート初期データ入力完了")

        # ── IDを保存 ──────────────────────────────────────────────
        id_file = os.path.join(DATA_DIR, "counseling_ss_id.txt")
        with open(id_file, "w") as f:
            f.write(ss_id)

        final_url = f"https://docs.google.com/spreadsheets/d/{ss_id}"
        print(f"\n{'='*50}")
        print(f"✅ スプレッドシート作成完了！")
        print(f"URL: {final_url}")
        print(f"ID: {ss_id}")
        print(f"{'='*50}")
        print("\n5秒後にブラウザを閉じます...")
        time.sleep(5)
        browser.close()

        return ss_id, final_url


def _type_headers(page, headers):
    """A1セルからヘッダーを入力"""
    _click_cell(page, "A1")
    time.sleep(0.3)
    for i, h in enumerate(headers):
        page.keyboard.type(h)
        if i < len(headers) - 1:
            page.keyboard.press("Tab")
        else:
            page.keyboard.press("Enter")
    time.sleep(0.3)


def _click_cell(page, cell_ref):
    """セル参照ボックスにセル名を入力して移動"""
    try:
        name_box = page.locator(".docs-nameboxibox, [aria-label='セル'], .waffle-name-box, #t-name-box").first
        name_box.click()
        time.sleep(0.2)
        page.keyboard.press("Control+a")
        page.keyboard.type(cell_ref)
        page.keyboard.press("Enter")
        time.sleep(0.2)
    except Exception:
        pass


def _add_sheet(page, name):
    """シートを追加してリネーム"""
    # + ボタンクリック
    try:
        add_btn = page.locator("[aria-label='シートを追加'], .docs-sheet-add-button, [data-tooltip='シートを追加']").first
        add_btn.click()
        time.sleep(0.8)
    except Exception:
        page.keyboard.press("Shift+F11")
        time.sleep(0.8)

    # タブをダブルクリックしてリネーム
    try:
        tabs = page.locator(".docs-sheet-tab.docs-sheet-active-tab, .goog-toolbar-button.docs-sheet-tab.active").first
        tabs.dblclick()
        time.sleep(0.3)
        page.keyboard.press("Control+a")
        page.keyboard.type(name)
        page.keyboard.press("Enter")
        time.sleep(0.5)
    except Exception as e:
        print(f"  リネームスキップ: {e}")


def _click_sheet_tab(page, name):
    """シートタブをクリック"""
    try:
        page.locator(f"text='{name}'").first.click()
        time.sleep(0.5)
    except Exception:
        pass


if __name__ == "__main__":
    result = main()
    if result:
        ss_id, url = result
        print(f"\nカウンセリングアプリで使用するURL:")
        print(f"  {url}")
