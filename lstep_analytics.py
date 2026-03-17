from playwright.sync_api import sync_playwright
import time
import json

LSTEP_URL = "https://manager.linestep.net/account/login"
EMAIL = "ssin0201"
PASSWORD = "ssin020144"
SCREENSHOT_DIR = "/Users/shou/.salonboard_dashboard/"

def lstep_get_analytics():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        # ログイン
        print("Lステップにログイン中...")
        page.goto(LSTEP_URL, wait_until="load", timeout=60000)
        page.fill("input[name='name']", EMAIL)
        page.fill("input[name='password']", PASSWORD)

        print("\n>>> ブラウザ画面で「私はロボットではありません」にチェックしてください")
        print(">>> 60秒後に自動で続行します...")
        for i in range(60, 0, -10):
            print(f"  あと{i}秒...")
            time.sleep(10)

        login_btn = page.query_selector("button[type='submit'], input[type='submit']")
        if login_btn:
            login_btn.click()
        time.sleep(5)

        if "login" in page.url and "account" in page.url:
            print("ログイン失敗。reCAPTCHAを確認してください。")
            browser.close()
            return

        print(f"ログイン成功: {page.url}")

        results = {}

        # 1. メッセージ配信履歴（開封率・クリック率）
        print("\n--- 配信履歴を確認中 ---")
        nav_items = page.query_selector_all("a, li")
        for item in nav_items:
            text = item.inner_text().strip()
            if any(kw in text for kw in ["配信", "メッセージ", "分析", "レポート", "統計"]):
                href = item.get_attribute("href")
                print(f"  メニュー発見: {text} → {href}")

        # 配信管理ページへ移動
        delivery_urls = [
            "https://manager.linestep.net/message/list",
            "https://manager.linestep.net/broadcast",
            "https://manager.linestep.net/report",
            "https://manager.linestep.net/analysis",
            "https://manager.linestep.net/delivery",
        ]

        for url in delivery_urls:
            try:
                page.goto(url, wait_until="load", timeout=15000)
                title = page.title()
                current_url = page.url
                print(f"  試行: {url} → タイトル: {title} | URL: {current_url}")
                if url in current_url or current_url != LSTEP_URL:
                    page.screenshot(path=f"{SCREENSHOT_DIR}lstep_{url.split('/')[-1]}.png")
                    print(f"  スクリーンショット保存")
                    time.sleep(2)
                    break
            except Exception as e:
                print(f"  {url}: {e}")

        # 2. 現在のページのナビゲーション構造を全取得
        print("\n--- ナビゲーション全体を取得中 ---")
        page.goto("https://manager.linestep.net/", wait_until="load", timeout=30000)
        time.sleep(3)
        page.screenshot(path=f"{SCREENSHOT_DIR}lstep_home.png")

        links = page.query_selector_all("a[href]")
        nav_data = []
        for link in links:
            href = link.get_attribute("href")
            text = link.inner_text().strip()
            if href and text and len(text) < 50:
                nav_data.append({"text": text, "href": href})

        print(f"  リンク数: {len(nav_data)}")
        for item in nav_data[:30]:
            print(f"  {item['text']} → {item['href']}")

        results["navigation"] = nav_data

        # 結果をJSONに保存
        with open(f"{SCREENSHOT_DIR}lstep_nav.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\nナビゲーション情報保存: lstep_nav.json")

        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    lstep_get_analytics()
