import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

# 크롤링 설정
CRAWL_DELAY_SEC = 2  # 단지 간 딜레이 (초)
MAX_COMPLEXES_PER_FILTER = 50  # 필터당 최대 단지 수
NAVER_LAND_URL = "https://new.land.naver.com"
