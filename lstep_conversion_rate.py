from playwright.sync_api import sync_playwright
import time
import json
from datetime import datetime

LSTEP_URL = "https://manager.linestep.net/account/login"
EMAIL = "ssin0201"
PASSWORD = "ssin020144"
BASE_URL = "https://manager.linestep.net"
SCREENSHOT_DIR = "/Users/shou/.salonboard_dashboard/"

# 配信リスト（ID、タイトル、配信日）
CAMPAIGNS = [
    {"id": "2510906292", "title": "タイトルなし",           "date": "2026-03-15", "total": 459},
    {"id": "2500398244", "title": "第一印象は見た目が9割",  "date": "2026-03-07", "total": 178},
    {"id": "2482640539", "title": "2月3月限定クーポン",     "date": "2026-02-24", "total": 315},
    {"id": "2464562025", "title": "バレンタイン限定クーポン","date": "2026-02-11", "total": 67},
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
    print(f"ログイン完了: {page.url}\n")

def get_friend_reservation(page, friend_url):
    """友だち詳細ページから予約情報を取得"""
    try:
        page.goto(f"{BASE_URL}{friend_url}", wait_until="load", timeout=20000)
        time.sleep(1)

        # スプシで取得タブをクリック
        spshi = page.query_selector("a:has-text('スプシで取得')")
        if not spshi:
            return None
        spshi.click()
        time.sleep(1)

        data = {}
        # 各フィールドの値を取得
        fields = ["次回予約日", "最終来店日", "来店回数", "次回予約メニュー", "予約時メニュー"]
        for field in fields:
            # ラベルの隣の入力値を取得
            label = page.query_selector(f"td:has-text('{field}'), th:has-text('{field}'), [class*='label']:has-text('{field}')")
            if label:
                # 同じ行の値を取得
                row = label.evaluate("el => el.closest('tr') || el.closest('div[class*=row]')")
                if row:
                    val_el = page.query_selector(f"tr:has(td:has-text('{field}')) input, tr:has(td:has-text('{field}')) select")
                    if val_el:
                        val = val_el.get_attribute("value") or val_el.inner_text().strip()
                        data[field] = val

            # 別の方法：inputのplaceholderや値から取得
            if field not in data:
                body = page.inner_html("body")
                import re
                # 日付フィールド
                pattern = rf'{field}.*?value="([^"]*)"'
                match = re.search(pattern, body, re.DOTALL)
                if match:
                    data[field] = match.group(1)

        return data
    except Exception as e:
        return {"error": str(e)}

def get_campaign_recipients(page, campaign_id):
    """配信の受信者リストとそのURLを取得（全ページ）"""
    recipients = []
    page_num = 1

    while True:
        url = f"{BASE_URL}/magazine/sendlogs/{campaign_id}?page={page_num}"
        page.goto(url, wait_until="load", timeout=20000)
        time.sleep(1.5)

        rows = page.query_selector_all("table tr")
        found = 0
        for row in rows:
            link = row.query_selector("a[href*='/line/detail/']")
            if link:
                href = link.get_attribute("href")
                name = link.inner_text().strip()
                if href and href not in [r["url"] for r in recipients]:
                    recipients.append({"name": name, "url": href})
                    found += 1

        print(f"  ページ{page_num}: {found}人取得（累計{len(recipients)}人）")

        # 次ページがあるか確認
        next_btn = page.query_selector("a[rel='next'], a:has-text('次へ'), li.next a")
        if not next_btn or found == 0:
            break
        page_num += 1
        if page_num > 20:  # 安全上限
            break

    return recipients

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        login(page)

        all_results = []

        for campaign in CAMPAIGNS:
            print(f"\n{'='*50}")
            print(f"配信: {campaign['title']} ({campaign['date']}, {campaign['total']}人)")
            print(f"{'='*50}")
            campaign_date = datetime.strptime(campaign["date"], "%Y-%m-%d")

            # 受信者リスト取得（最初の2ページ = 最大100人でテスト）
            print("受信者リスト取得中...")
            recipients = get_campaign_recipients(page, campaign["id"])
            print(f"取得完了: {len(recipients)}人")

            # 各友だちの予約情報確認
            reservation_count = 0
            visit_count = 0
            details = []

            for i, recipient in enumerate(recipients[:50]):  # まず50人でテスト
                print(f"  [{i+1}/{min(50, len(recipients))}] {recipient['name']}...", end="", flush=True)
                res_data = get_friend_reservation(page, recipient["url"])

                converted_reservation = False
                converted_visit = False

                if res_data and "error" not in res_data:
                    # 配信日以降に予約があるか
                    next_date_str = res_data.get("次回予約日", "")
                    last_visit_str = res_data.get("最終来店日", "")

                    if next_date_str:
                        try:
                            next_date = datetime.strptime(next_date_str, "%Y-%m-%d")
                            if next_date >= campaign_date:
                                converted_reservation = True
                                reservation_count += 1
                        except:
                            pass

                    if last_visit_str:
                        try:
                            last_visit = datetime.strptime(last_visit_str, "%Y-%m-%d")
                            if last_visit >= campaign_date:
                                converted_visit = True
                                visit_count += 1
                        except:
                            pass

                status = ""
                if converted_reservation:
                    status += "✓予約"
                if converted_visit:
                    status += "✓来店"
                print(f" {status or '－'} | 予約日:{res_data.get('次回予約日','') if res_data else ''} 来店日:{res_data.get('最終来店日','') if res_data else ''}")

                details.append({
                    "name": recipient["name"],
                    "url": recipient["url"],
                    "data": res_data,
                    "converted_reservation": converted_reservation,
                    "converted_visit": converted_visit,
                })

            sample_size = min(50, len(recipients))
            result = {
                "campaign": campaign,
                "sample_size": sample_size,
                "reservation_count": reservation_count,
                "visit_count": visit_count,
                "reservation_rate": round(reservation_count / sample_size * 100, 1) if sample_size > 0 else 0,
                "visit_rate": round(visit_count / sample_size * 100, 1) if sample_size > 0 else 0,
                "details": details,
            }
            all_results.append(result)

            print(f"\n--- {campaign['title']} 結果 ---")
            print(f"  サンプル数: {sample_size}人")
            print(f"  予約転換数: {reservation_count}人 → 予約転換率: {result['reservation_rate']}%")
            print(f"  来店転換数: {visit_count}人 → 来店転換率: {result['visit_rate']}%")

        # JSON保存
        with open(f"{SCREENSHOT_DIR}conversion_results.json", "w", encoding="utf-8") as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        print(f"\n保存完了: conversion_results.json")

        # サマリー表示
        print("\n" + "="*60)
        print("【配信別 転換率サマリー】")
        print(f"{'配信タイトル':<25} {'配信日':<12} {'配信数':>6} {'予約転換率':>10} {'来店転換率':>10}")
        print("-"*65)
        for r in all_results:
            c = r["campaign"]
            print(f"{c['title']:<25} {c['date']:<12} {c['total']:>6} {r['reservation_rate']:>9}% {r['visit_rate']:>9}%")

        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    main()
