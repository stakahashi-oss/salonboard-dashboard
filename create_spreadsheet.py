from playwright.sync_api import sync_playwright
import json
import time

RESULT_FILE = "/Users/shou/.salonboard_dashboard/conversion_all_results.json"

def load_results():
    with open(RESULT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    results = load_results()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # Google Driveを開く
        print("Google Driveを開きます...")
        page.goto("https://sheets.new", wait_until="load", timeout=60000)
        time.sleep(3)

        # ログインが必要な場合は待機
        if "accounts.google.com" in page.url or "login" in page.url:
            print("\n>>> Googleアカウントにログインしてください")
            print(">>> ログイン完了後、スプレッドシートが開くまで待ちます...")
            # スプレッドシートが開くまで最大3分待機
            for i in range(18):
                time.sleep(10)
                print(f"  待機中... {(i+1)*10}秒")
                if "docs.google.com/spreadsheets" in page.url:
                    break

        print(f"\nスプレッドシートURL: {page.url}")
        print("スプレッドシートが開きました！データを入力します...")
        time.sleep(3)

        # スプレッドシートのタイトルを変更
        title = page.query_selector(".docs-title-input, [data-tab-id='0'] input, .waffle-name-box")
        if not title:
            # タイトル部分をクリック
            page.click("text=無題のスプレッドシート")
            time.sleep(1)
        page.keyboard.press("Control+a")
        page.keyboard.type("Lステップ配信転換率レポート")
        page.keyboard.press("Enter")
        time.sleep(2)

        # ヘッダー行を入力
        headers = [
            "配信タイトル", "配信日", "配信数", "開封率(%)",
            "予約転換数", "予約転換率(%)", "来店転換数", "来店転換率(%)"
        ]

        def click_cell(row, col):
            """行・列でセルをクリック（A1=row1,col1）"""
            col_letter = chr(ord('A') + col - 1)
            cell_name = f"{col_letter}{row}"
            name_box = page.query_selector(".jfk-textinput.docs-input.docs-ss-nameBox")
            if name_box:
                name_box.click()
                name_box.fill(cell_name)
                page.keyboard.press("Enter")
                time.sleep(0.3)

        def type_in_cell(row, col, value):
            click_cell(row, col)
            page.keyboard.type(str(value))
            page.keyboard.press("Tab")
            time.sleep(0.1)

        # A1セルに移動
        click_cell(1, 1)
        time.sleep(0.5)

        # ヘッダー入力
        print("ヘッダーを入力中...")
        for i, h in enumerate(headers):
            page.keyboard.type(h)
            page.keyboard.press("Tab")
            time.sleep(0.1)
        page.keyboard.press("Enter")

        # データ入力
        print("データを入力中...")
        for row_idx, result in enumerate(results):
            c = result["campaign"]
            row_num = row_idx + 2

            data = [
                c["title"],
                c["date"],
                c["total"],
                c.get("open_rate", ""),
                result["reservation_count"],
                result["reservation_rate"],
                result["visit_count"],
                result["visit_rate"],
            ]

            click_cell(row_num, 1)
            for val in data:
                page.keyboard.type(str(val) if val is not None else "")
                page.keyboard.press("Tab")
                time.sleep(0.1)
            page.keyboard.press("Enter")
            print(f"  行{row_num}: {c['title']} 入力完了")

        # 保存（自動保存されるが念のためCtrl+S）
        page.keyboard.press("Control+s")
        time.sleep(3)

        print(f"\n✅ 完了！")
        print(f"スプレッドシートURL: {page.url}")

        # URLを保存
        with open("/Users/shou/.salonboard_dashboard/spreadsheet_url.txt", "w") as f:
            f.write(page.url)

        print("\n>>> ブラウザを閉じずに確認してください。終了するにはCtrl+Cを押してください")
        time.sleep(60)
        browser.close()

if __name__ == "__main__":
    main()
