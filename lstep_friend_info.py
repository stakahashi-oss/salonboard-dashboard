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

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        login(page)

        # 友だち情報欄の項目一覧を確認
        print("\n--- 友だち情報欄管理 ---")
        page.goto(f"{BASE_URL}/line/var", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_var.png")
        body = page.query_selector("body").inner_text()
        # 情報欄名だけ抽出
        rows = []
        for row in page.query_selector_all("table tr"):
            cells = [c.inner_text().strip() for c in row.query_selector_all("td, th")]
            if any(cells):
                rows.append(cells)
                print(f"  {cells}")

        # 友だちリストで実際のデータを確認
        print("\n--- 友だちリスト（前回予約情報付き） ---")
        page.goto(f"{BASE_URL}/line/show", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_friends.png")

        # 最初の友だちの詳細を確認
        first_friend = page.query_selector("table tr:nth-child(2) a, .friend-item a, tr[class*='friend'] a")
        if first_friend:
            href = first_friend.get_attribute("href")
            print(f"最初の友だちURL: {href}")
            page.goto(f"{BASE_URL}{href}", wait_until="load", timeout=30000)
            time.sleep(3)
            page.screenshot(path=f"{SCREENSHOT_DIR}lstep_friend_detail.png")
            print(page.query_selector("body").inner_text()[:2000])
        else:
            # 友だちリスト全体のテキストを確認
            for row in page.query_selector_all("table tr"):
                cells = [c.inner_text().strip() for c in row.query_selector_all("td, th")]
                if any(c for c in cells if c):
                    print(f"  {cells}")
                    # 最初の友だちリンクを探す
                    link = row.query_selector("a[href*='/line/show/']")
                    if link:
                        href = link.get_attribute("href")
                        print(f"  → 詳細URL: {href}")
                        break

        time.sleep(3)
        browser.close()

if __name__ == "__main__":
    main()
