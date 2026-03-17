from playwright.sync_api import sync_playwright
import time
import json

LSTEP_URL = "https://manager.linestep.net/account/login"
EMAIL = "ssin0201"
PASSWORD = "ssin020144"
BASE_URL = "https://manager.linestep.net"
SCREENSHOT_DIR = "/Users/shou/.salonboard_dashboard/"

def login(page):
    page.goto(LSTEP_URL, wait_until="load", timeout=60000)
    page.fill("input[name='name']", EMAIL)
    page.fill("input[name='password']", PASSWORD)
    print("\n>>> ブラウザで「私はロボットではありません」にチェックしてください（60秒）")
    for i in range(60, 0, -10):
        print(f"  あと{i}秒...")
        time.sleep(10)
    btn = page.query_selector("button[type='submit'], input[type='submit'], button:has-text('ログイン')")
    if btn:
        btn.click()
    else:
        page.keyboard.press("Enter")
    time.sleep(5)
    print(f"ログイン完了: {page.url}")

def get_page_data(page, url, label):
    print(f"\n--- {label} ---")
    page.goto(f"{BASE_URL}{url}", wait_until="load", timeout=30000)
    time.sleep(3)
    page.screenshot(path=f"{SCREENSHOT_DIR}lstep_{label}.png")
    print(f"スクリーンショット保存: lstep_{label}.png")

    # テーブルデータ取得
    rows = []
    table_rows = page.query_selector_all("table tr")
    for row in table_rows:
        cells = row.query_selector_all("td, th")
        row_data = [cell.inner_text().strip() for cell in cells]
        if row_data:
            rows.append(row_data)
            print(f"  {row_data}")

    return rows

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        login(page)

        all_data = {}

        # 1. 一斉配信リスト（開封率・クリック率あり）
        all_data["一斉配信"] = get_page_data(page, "/line/magazine", "一斉配信")

        # 2. 送信数分析
        all_data["送信数分析"] = get_page_data(page, "/line/analytics/send", "送信数分析")

        # 3. 流入経路分析
        all_data["流入経路分析"] = get_page_data(page, "/line/landing", "流入経路分析")

        # 4. ファネル分析
        all_data["ファネル分析"] = get_page_data(page, "/line/journey", "ファネル分析")

        # JSONに保存
        with open(f"{SCREENSHOT_DIR}lstep_stats.json", "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        print(f"\n全データ保存: lstep_stats.json")

        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    main()
