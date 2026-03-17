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

def get_table(page, label):
    page.screenshot(path=f"{SCREENSHOT_DIR}lstep_{label}.png")
    rows = []
    for row in page.query_selector_all("table tr"):
        cells = [c.inner_text().strip() for c in row.query_selector_all("td, th")]
        if any(cells):
            rows.append(cells)
            print(f"  {cells}")
    return rows

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        login(page)

        data = {}

        # コンバージョン管理（旧フェーズ管理）
        print("\n--- コンバージョン管理 ---")
        page.goto(f"{BASE_URL}/line/journey-tag", wait_until="load", timeout=30000)
        time.sleep(3)
        data["コンバージョン管理"] = get_table(page, "コンバージョン管理")

        # 一斉配信の詳細（個別クリック率を確認）
        print("\n--- 一斉配信詳細 ---")
        page.goto(f"{BASE_URL}/line/magazine", wait_until="load", timeout=30000)
        time.sleep(3)

        # 各配信の「詳細」リンクを取得
        links = page.query_selector_all("a[href*='magazine']")
        detail_urls = []
        for link in links:
            href = link.get_attribute("href")
            text = link.inner_text().strip()
            if href and "/magazine/" in href and href not in detail_urls:
                detail_urls.append(href)
                print(f"  配信詳細URL: {href} ({text})")

        # 最初の配信詳細を確認
        if detail_urls:
            page.goto(f"{BASE_URL}{detail_urls[0]}", wait_until="load", timeout=30000)
            time.sleep(3)
            page.screenshot(path=f"{SCREENSHOT_DIR}lstep_配信詳細.png")
            print(f"\n--- 配信詳細 ({detail_urls[0]}) ---")
            data["配信詳細"] = get_table(page, "配信詳細")

            # ページ内テキストも取得
            body_text = page.query_selector("body").inner_text()
            keywords = ["開封", "クリック", "予約", "コンバージョン", "CV", "率"]
            for kw in keywords:
                if kw in body_text:
                    idx = body_text.find(kw)
                    print(f"  '{kw}' 周辺: ...{body_text[max(0,idx-20):idx+50]}...")

        # クロス分析（タグ×行動）
        print("\n--- クロス分析 ---")
        page.goto(f"{BASE_URL}/line/board", wait_until="load", timeout=30000)
        time.sleep(3)
        data["クロス分析"] = get_table(page, "クロス分析")

        with open(f"{SCREENSHOT_DIR}lstep_conversion.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n保存完了: lstep_conversion.json")

        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    main()
