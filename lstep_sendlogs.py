from playwright.sync_api import sync_playwright
import time
import json

LSTEP_URL = "https://manager.linestep.net/account/login"
EMAIL = "ssin0201"
PASSWORD = "ssin020144"
BASE_URL = "https://manager.linestep.net"
SCREENSHOT_DIR = "/Users/shou/.salonboard_dashboard/"

SENDLOG_IDS = [
    ("2510906292", "タイトルなし_2026-03-15"),
    ("2500398244", "第一印象は見た目が9割_2026-03-07"),
    ("2482640539", "2月3月限定クーポン_2026-02-24"),
    ("2464562025", "バレンタイン限定クーポン_2026-02-11"),
]

def login(page):
    page.goto(LSTEP_URL, wait_until="load", timeout=60000)
    page.fill("input[name='name']", EMAIL)
    page.fill("input[name='password']", PASSWORD)
    print(">>> ブラウザで「私はロボットではありません」にチェックしてください（60秒）")
    for i in range(60, 0, -10):
        print(f"  あと{i}秒...")
        time.sleep(10)
    btn = page.query_selector("button[type='submit'], input[type='submit']")
    if btn:
        btn.click()
    else:
        page.keyboard.press("Enter")
    time.sleep(5)
    print(f"ログイン完了: {page.url}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        login(page)

        all_data = []

        # 各配信のsendlogsページを確認
        for log_id, label in SENDLOG_IDS:
            url = f"{BASE_URL}/magazine/sendlogs/{log_id}"
            print(f"\n--- {label} ---")
            page.goto(url, wait_until="load", timeout=30000)
            time.sleep(3)
            page.screenshot(path=f"{SCREENSHOT_DIR}lstep_sendlog_{log_id}.png")

            # テーブルデータ
            rows = []
            for row in page.query_selector_all("table tr"):
                cells = [c.inner_text().strip() for c in row.query_selector_all("td, th")]
                if any(cells):
                    rows.append(cells)
                    print(f"  {cells}")

            # ページ全体テキストから数値を探す
            body = page.query_selector("body").inner_text()
            for kw in ["開封", "クリック", "既読", "配信数", "送信数", "予約"]:
                if kw in body:
                    idx = body.find(kw)
                    snippet = body[max(0, idx-10):idx+60].replace("\n", " ")
                    print(f"  [{kw}] {snippet}")

            all_data.append({
                "id": log_id,
                "label": label,
                "rows": rows,
                "url": url
            })

        # 予約管理ページ確認
        print("\n--- 予約管理 ---")
        page.goto(f"{BASE_URL}/line/form", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_予約管理.png")
        for row in page.query_selector_all("table tr"):
            cells = [c.inner_text().strip() for c in row.query_selector_all("td, th")]
            if any(cells):
                print(f"  {cells}")

        # URLクリック測定ページ確認
        print("\n--- URLクリック測定 ---")
        page.goto(f"{BASE_URL}/line/site", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_URLクリック測定.png")
        for row in page.query_selector_all("table tr"):
            cells = [c.inner_text().strip() for c in row.query_selector_all("td, th")]
            if any(cells):
                print(f"  {cells}")

        with open(f"{SCREENSHOT_DIR}lstep_sendlogs.json", "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        print(f"\n保存完了: lstep_sendlogs.json")

        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    main()
