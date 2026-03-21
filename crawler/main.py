"""
sophia.life 부동산 매물 크롤러 메인
사용법:
  python main.py              # 즉시 1회 실행
  python main.py --schedule   # 하루 5회 스케줄 (08/12/16/20/00시)
"""
import sys
import asyncio
import logging
from datetime import datetime
from pathlib import Path

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY
from naver_client import crawl_filter
from diff_engine import process_crawled_data
from notifier import notify_new_listings, notify_price_changes, notify_removed

# 로그 파일 설정
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "crawler.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
logger = logging.getLogger("crawler")


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def load_active_filters(supabase):
    """활성 필터 목록 조회"""
    resp = supabase.table("re_filters").select("*").eq("is_active", True).execute()
    return resp.data or []


async def crawl_cycle():
    """한 사이클: 모든 활성 필터 크롤링"""
    logger.info("크롤링 사이클 시작")
    print(f"\n{'='*60}")
    print(f"[집] 크롤링 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    supabase = get_supabase()
    filters = load_active_filters(supabase)

    if not filters:
        print("[경고] 활성 필터가 없습니다. sophia.life > 부동산 > 매물 모니터에서 필터를 추가하세요.")
        return

    print(f" {len(filters)}개 필터 처리 예정\n")

    total_new = 0
    total_changed = 0
    total_removed = 0

    for f in filters:
        try:
            # 크롤링 (supabase 전달하여 시→구 확장 지원)
            articles = await crawl_filter(f, supabase=supabase)

            # Diff 처리 + DB 저장
            result = process_crawled_data(supabase, f["id"], articles)

            new_count = len(result["new"])
            changed_count = len(result["changed"])
            removed_count = len(result["removed"])

            total_new += new_count
            total_changed += changed_count
            total_removed += removed_count

            print(f"   결과: 신규 {new_count} / 변동 {changed_count} / 삭제 {removed_count}")

            # Discord 알림
            if new_count > 0:
                notify_new_listings(f["name"], result["new"])
            if changed_count > 0:
                notify_price_changes(f["name"], result["changed"])
            if removed_count > 0:
                notify_removed(f["name"], result["removed"])

        except Exception as e:
            print(f"  [실패] 필터 '{f['name']}' 처리 실패: {e}")

    logger.info(f"크롤링 사이클 완료: 신규 {total_new} / 변동 {total_changed} / 삭제 {total_removed}")
    print(f"\n{'='*60}")
    print(f"[완료] 크롤링 완료: 신규 {total_new} / 변동 {total_changed} / 삭제 {total_removed}")
    print(f"{'='*60}\n")


def run_once():
    """즉시 1회 실행"""
    asyncio.run(crawl_cycle())


def run_schedule():
    """스케줄 실행 (하루 5회: 08/12/16/20/00시)"""
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR

    def job_listener(event):
        if event.exception:
            logger.error(f"크롤링 작업 실패: {event.exception}")
        else:
            logger.info("크롤링 작업 정상 완료")
            # 다음 실행 시간 표시
            job = scheduler.get_job("naver_realestate_crawl")
            if job and job.next_run_time:
                print(f"   다음 실행: {job.next_run_time.strftime('%Y-%m-%d %H:%M:%S')}")
                logger.info(f"다음 실행 예정: {job.next_run_time.strftime('%Y-%m-%d %H:%M:%S')}")

    scheduler = BlockingScheduler()
    scheduler.add_job(
        lambda: asyncio.run(crawl_cycle()),
        CronTrigger(hour="8,12,16,20,0", minute=0),
        id="naver_realestate_crawl",
        name="네이버 부동산 크롤링",
        misfire_grace_time=3600,  # 1시간 이내면 놓친 작업도 실행
    )
    scheduler.add_listener(job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    logger.info("스케줄러 시작됨 (08:00, 12:00, 16:00, 20:00, 00:00)")
    print(" 스케줄러 시작 (08:00, 12:00, 16:00, 20:00, 00:00)")
    print("   종료하려면 Ctrl+C")

    # 시작 시 1회 즉시 실행
    asyncio.run(crawl_cycle())

    try:
        scheduler.start()
    except KeyboardInterrupt:
        logger.info("스케줄러 종료됨 (Ctrl+C)")
        print("\n[중지] 스케줄러 종료")


if __name__ == "__main__":
    if "--schedule" in sys.argv:
        run_schedule()
    else:
        run_once()
