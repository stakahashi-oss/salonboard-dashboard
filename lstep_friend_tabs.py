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

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        login(page)

        # 友だち詳細ページ（最初の友だち）
        page.goto(f"{BASE_URL}/line/detail/242461558", wait_until="load", timeout=30000)
        time.sleep(2)

        # タブを全部クリックしてデータ確認
        tabs = page.query_selector_all("a[role='tab'], .nav-link, [class*='tab']")
        tab_texts = []
        for tab in tabs:
            text = tab.inner_text().strip()
            if text:
                tab_texts.append((text, tab))
        print(f"タブ一覧: {[t[0] for t in tab_texts]}")

        for tab_text, tab in tab_texts:
            print(f"\n--- タブ: {tab_text} ---")
            try:
                tab.click()
                time.sleep(2)
                page.screenshot(path=f"{SCREENSHOT_DIR}lstep_tab_{tab_text[:10].replace('/', '_')}.png")
                content = page.query_selector("body").inner_text()
                # 予約関連のキーワードを探す
                for kw in ["予約", "来店", "施術", "前回", "次回", "日付", "メニュー", "スタッフ"]:
                    if kw in content:
                        idx = content.find(kw)
                        snippet = content[max(0, idx-20):idx+80].replace("\n", " ")
                        print(f"  [{kw}]: {snippet}")
            except Exception as e:
                print(f"  エラー: {e}")

        # 別の友だちも確認（予約データがある友だち）
        print("\n--- 友だちリストから予約データありを探す ---")
        page.goto(f"{BASE_URL}/line/show", wait_until="load", timeout=30000)
        time.sleep(3)

        # 友だちリンクを最大5件取得
        friend_links = page.query_selector_all("a[href*='/line/detail/']")
        seen = set()
        count = 0
        for link in friend_links:
            href = link.get_attribute("href")
            if href and href not in seen:
                seen.add(href)
                count += 1
                if count > 5:
                    break
                name = link.inner_text().strip()
                print(f"  友だち: {name} → {href}")

                page.goto(f"{BASE_URL}{href}", wait_until="load", timeout=30000)
                time.sleep(2)

                # スプシで取得タブをクリック
                spshi_tab = page.query_selector("a:has-text('スプシ'), button:has-text('スプシ')")
                if spshi_tab:
                    spshi_tab.click()
                    time.sleep(2)
                    page.screenshot(path=f"{SCREENSHOT_DIR}lstep_spshi_{count}.png")
                    content = page.query_selector("body").inner_text()
                    for kw in ["予約", "来店", "施術", "前回", "次回"]:
                        if kw in content:
                            idx = content.find(kw)
                            print(f"    [{kw}]: {content[max(0,idx-10):idx+100].replace(chr(10), ' ')}")

                # ホームタブで友だち情報欄確認
                page.goto(f"{BASE_URL}{href}", wait_until="load", timeout=30000)
                time.sleep(1)
                vars_section = page.query_selector_all("[class*='var'], [class*='friend-info']")
                for v in vars_section[:5]:
                    text = v.inner_text().strip()
                    if text and len(text) < 200:
                        print(f"    情報欄: {text}")

        time.sleep(3)
        browser.close()

if __name__ == "__main__":
    main()
