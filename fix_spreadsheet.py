from playwright.sync_api import sync_playwright
import json
import time

SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1YDOXWnXaNQMJ-H_8p7azSpoUM2YT0vl1E7OU1CUF_9A/edit"
RESULT_FILE = "/Users/shou/.salonboard_dashboard/conversion_all_results.json"

def load_results():
    with open(RESULT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def wait_for_sheet(page):
    """スプレッドシートのグリッドが読み込まれるまで待機"""
    for i in range(30):
        time.sleep(2)
        if "docs.google.com/spreadsheets" in page.url:
            # グリッドが見えるか確認
            grid = page.query_selector("canvas, .grid-container, [class*='waffle']")
            if grid:
                print(f"  シート読み込み完了（{(i+1)*2}秒）")
                return True
        print(f"  待機中... {(i+1)*2}秒")
    return False

def clear_and_input(page, headers, rows):
    """Ctrl+Aで全選択→Delete→A1から入力"""
    # Ctrl+Home でA1へ
    page.keyboard.press("Control+Home")
    time.sleep(0.5)

    # 全選択してクリア
    page.keyboard.press("Control+a")
    time.sleep(0.3)
    page.keyboard.press("Delete")
    time.sleep(1)

    # A1に戻る
    page.keyboard.press("Control+Home")
    time.sleep(0.5)

    # ヘッダー入力
    print("ヘッダー入力中...")
    for i, h in enumerate(headers):
        page.keyboard.type(h)
        if i < len(headers) - 1:
            page.keyboard.press("Tab")
    page.keyboard.press("Enter")
    time.sleep(0.2)

    # データ入力
    print("データ入力中...")
    for row in rows:
        # 行頭に移動
        page.keyboard.press("Home")
        for i, val in enumerate(row):
            page.keyboard.type(str(val) if val is not None else "")
            if i < len(row) - 1:
                page.keyboard.press("Tab")
            time.sleep(0.05)
        page.keyboard.press("Enter")
        time.sleep(0.1)
        print(f"  ✓ {row[0]}")

def main():
    results = load_results()

    headers = [
        "配信タイトル", "配信日", "配信数", "開封率(%)",
        "予約転換数", "予約転換率(%)", "来店転換数", "来店転換率(%)"
    ]

    rows = []
    for r in results:
        c = r["campaign"]
        rows.append([
            c["title"],
            c["date"],
            c["total"],
            c.get("open_rate", ""),
            r["reservation_count"],
            r["reservation_rate"],
            r["visit_count"],
            r["visit_rate"],
        ])

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        print("スプレッドシートを開きます...")
        page.goto(SPREADSHEET_URL, wait_until="load", timeout=60000)
        time.sleep(3)

        if "accounts.google.com" in page.url:
            print(">>> Googleにログインしてください（3分待機）")
            for i in range(18):
                time.sleep(10)
                print(f"  {(i+1)*10}秒...")
                if "docs.google.com/spreadsheets" in page.url:
                    break

        print("シートの読み込みを待機中...")
        wait_for_sheet(page)
        time.sleep(3)

        # シートのセルをクリックしてフォーカス
        try:
            page.click("canvas", timeout=5000)
        except:
            try:
                page.click("[class*='waffle']", timeout=5000)
            except:
                pass
        time.sleep(1)

        clear_and_input(page, headers, rows)

        # 保存
        page.keyboard.press("Control+s")
        time.sleep(3)
        print(f"\n✅ 完了！")
        print(f"URL: {page.url}")

        time.sleep(20)
        browser.close()

if __name__ == "__main__":
    main()
