#!/usr/bin/env python3
"""
PKG 사업본부(구축) 업무보고 자동화 - 주기적 백그라운드 실행기

실행 방법:
  python runner.py                # 기본 실행 (주기적 자동 처리)
  python runner.py --once         # 1회 즉시 실행 후 종료
  python runner.py --interval 60  # 60분 간격으로 실행
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.automation import ReportAutomation

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("data/runner.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

os.makedirs("data", exist_ok=True)


def run_cycle(auto: ReportAutomation) -> None:
    """1 사이클: 리마인더 → 자동검토 → 에스컬레이션"""
    now = datetime.now()
    log.info("=" * 50)
    log.info(f"자동화 사이클 시작: {now.strftime('%Y-%m-%d %H:%M:%S')}")

    # 1. 리마인더 발송
    reminder_count = auto.check_and_send_reminders(now)
    log.info(f"리마인더 발송: {reminder_count}건")

    # 2. 제출된 보고서 자동 검토·피드백
    processed = auto.process_all_submitted()
    log.info(f"자동 검토·피드백 처리: {processed}건")

    # 3. 에스컬레이션 확인
    escalated = auto.check_escalations()
    log.info(f"에스컬레이션 처리: {escalated}건")

    log.info("자동화 사이클 완료")
    log.info("=" * 50)


def main():
    parser = argparse.ArgumentParser(
        description="PKG 사업본부(구축) 업무보고 자동화 백그라운드 실행기"
    )
    parser.add_argument(
        "--once", action="store_true",
        help="1회 즉시 실행 후 종료"
    )
    parser.add_argument(
        "--interval", type=int, default=60,
        help="실행 간격 (분 단위, 기본값: 60분)"
    )
    args = parser.parse_args()

    log.info("PKG 사업본부(구축) 업무보고 자동화 실행기 시작")

    try:
        auto = ReportAutomation()
    except Exception as e:
        log.error(f"초기화 실패: {e}")
        sys.exit(1)

    if args.once:
        run_cycle(auto)
        return

    log.info(f"주기 실행 모드: {args.interval}분 간격 (Ctrl+C로 종료)")

    while True:
        try:
            run_cycle(auto)
        except KeyboardInterrupt:
            log.info("사용자 종료 요청. 실행기를 중단합니다.")
            break
        except Exception as e:
            log.error(f"사이클 실행 오류: {e}", exc_info=True)

        next_run = datetime.now().replace(second=0, microsecond=0)
        log.info(f"다음 실행까지 {args.interval}분 대기 중...")

        try:
            time.sleep(args.interval * 60)
        except KeyboardInterrupt:
            log.info("사용자 종료 요청. 실행기를 중단합니다.")
            break


if __name__ == "__main__":
    main()
