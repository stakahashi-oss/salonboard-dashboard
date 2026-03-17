import os

# 環境変数 → なければハードコード値（ローカル用）
LINE_CHANNEL_ACCESS_TOKEN = os.environ.get(
    "LINE_CHANNEL_ACCESS_TOKEN",
    "E0gasK7zfaVSi5SEFzmvbvZLOwAjvyxEatqHUzv2cFhIqNE4Pg8R8i5/139d9oKI6uExBLGieIqgN36szq1dWEZ5qXxU8T8paVtFhkBOwKESOZRb+muKxCmy8mrI1WyT8/VyJBsXpyYU+CKtRLo8uAdB04t89/1O/w1cDnyilFU="
)
LINE_ACCOUNT_ID = "@027qvfqz"

SPREADSHEET_ID = os.environ.get(
    "SPREADSHEET_ID",
    "1Uwvhc1S_4gLStUiWBp8M_x8cDZBbu7VpMuskkpA8zXg"
)
COUNSELING_SS_ID = "1COD2jGKBidjljFLh5wskdRFp6RsG5JAU4lqO1-yjfV4"

GAS_URL = os.environ.get(
    "GAS_URL",
    "https://script.google.com/macros/s/AKfycbyG9tomwZkWxkHszj7pM9Lw3ZSh__TARFQJGobmyLtJB1t3i81O7bi-wNtKQMrmbAc8yw/exec"
)

PUBLIC_URL = os.environ.get(
    "PUBLIC_URL",
    "https://perfect-spring-tide-destinations.trycloudflare.com"
)

DATA_DIR = os.environ.get("DATA_DIR", "/Users/shou/.salonboard_dashboard")
