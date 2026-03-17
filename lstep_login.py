from playwright.sync_api import sync_playwright
import time

LSTEP_URL = "https://manager.linestep.net/account/login"
EMAIL = "ssin0201"
PASSWORD = "ssin020144"

def lstep_login():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        print("Lステップにアクセス中...")
        page.goto(LSTEP_URL, wait_until="load", timeout=60000)

        # ID・パスワード入力
        page.fill("input[name='name']", EMAIL)
        page.fill("input[name='password']", PASSWORD)
        print("ID・パスワード入力完了")
        print("\n>>> ブラウザ画面で「私はロボットではありません」にチェックしてください")
        print(">>> 30秒後に自動でログインボタンをクリックします...")

        # 30秒待機（reCAPTCHA対応時間）
        for i in range(30, 0, -5):
            print(f"  あと{i}秒...")
            time.sleep(5)

        # ログインボタンクリック
        login_btn = page.query_selector("button[type='submit'], input[type='submit']")
        if login_btn:
            login_btn.click()
            print("ログインボタンをクリックしました")
        else:
            page.keyboard.press("Enter")

        time.sleep(5)
        print(f"\nログイン後URL: {page.url}")
        print(f"ログイン後タイトル: {page.title()}")
        page.screenshot(path="/Users/shou/.salonboard_dashboard/lstep_after_login.png")
        print("スクリーンショット保存: lstep_after_login.png")

        if "login" not in page.url:
            print("\nログイン成功！")
            # ダッシュボード情報取得
            time.sleep(3)
            page.screenshot(path="/Users/shou/.salonboard_dashboard/lstep_dashboard.png")
            print("ダッシュボードのスクリーンショット保存: lstep_dashboard.png")
        else:
            print("\nログイン失敗。スクリーンショットを確認してください。")

        time.sleep(10)
        browser.close()

if __name__ == "__main__":
    lstep_login()
