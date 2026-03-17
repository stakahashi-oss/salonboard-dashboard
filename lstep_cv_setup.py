from playwright.sync_api import sync_playwright
import time

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

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        login(page)

        # コンバージョン管理（新）
        print("\n--- コンバージョン管理 /line/journey-tag ---")
        page.goto(f"{BASE_URL}/line/journey-tag", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_cv_1.png")
        print(f"URL: {page.url}")
        print(f"タイトル: {page.title()}")
        print(page.query_selector("body").inner_text()[:1000])

        # 新規作成ボタン確認
        print("\n--- ページ内ボタン ---")
        for btn in page.query_selector_all("button, a[href*='create'], a[href*='new']"):
            text = btn.inner_text().strip()
            href = btn.get_attribute("href")
            if text:
                print(f"  [{text}] → {href}")

        # 廃止予定のコンバージョン（旧）
        print("\n--- 旧コンバージョン /line/tracker ---")
        page.goto(f"{BASE_URL}/line/tracker", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_cv_old.png")
        print(page.query_selector("body").inner_text()[:800])

        # サイトスクリプト（CV計測の設定場所）
        print("\n--- サイトスクリプト /line/script ---")
        page.goto(f"{BASE_URL}/line/script", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_script.png")
        print(page.query_selector("body").inner_text()[:800])

        # アクション管理（CVトリガーに使える）
        print("\n--- アクション管理 /line/action ---")
        page.goto(f"{BASE_URL}/line/action", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_action.png")
        print(page.query_selector("body").inner_text()[:1000])

        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    main()
