#!/usr/bin/env python3
"""PKG 사업본부(구축) 업무보고 자동화 시스템 CLI 진입점"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.automation import ReportAutomation
from src.models import InsightItem, ReportType


def cmd_dashboard(args, auto: ReportAutomation):
    """현황 대시보드 출력"""
    auto.print_dashboard()


def cmd_schedule(args, auto: ReportAutomation):
    """스케줄 목록 조회"""
    entries = auto.get_current_schedule()
    print("\n[스케줄 목록]")
    print(f"{'유닛ID':<10} {'보고유형':<8} {'마감일시':<22} {'D-Day'}")
    print("-" * 60)
    from datetime import datetime
    now = datetime.now()
    for entry in entries:
        hours_left = (entry.deadline - now).total_seconds() / 3600
        d_day = f"D-{int(hours_left/24)}" if hours_left > 0 else f"마감초과({abs(hours_left):.0f}h)"
        report_label = "주간" if entry.report_type == ReportType.WEEKLY else "월간"
        print(f"{entry.unit_id:<10} {report_label:<8} {entry.deadline.strftime('%Y-%m-%d %H:%M'):<22} {d_day}")
    print()


def cmd_create(args, auto: ReportAutomation):
    """보고서 초안 생성"""
    report_type = ReportType.WEEKLY if args.type == "weekly" else ReportType.MONTHLY
    report = auto.create_report(args.unit, report_type)
    print(f"\n보고서 초안이 생성되었습니다.")
    print(f"  보고서 ID : {report.id}")
    print(f"  유닛      : {auto._unit_name(args.unit)} ({args.unit})")
    print(f"  보고유형  : {'주간' if report_type == ReportType.WEEKLY else '월간'}")
    print(f"  마감일시  : {report.deadline.strftime('%Y-%m-%d %H:%M') if report.deadline else '-'}")
    print(f"  저장위치  : data/reports/{report.id}.json\n")


def cmd_submit_demo(args, auto: ReportAutomation):
    """데모 보고서 제출 (샘플 데이터 사용)"""
    report_type = ReportType.WEEKLY if args.type == "weekly" else ReportType.MONTHLY
    report = auto.create_report(args.unit, report_type)

    # 유닛별 샘플 데이터
    sample_data = {
        "PM": {
            "insights": [
                InsightItem("프로젝트 진행률 (%)", "72%", "75%", "상승", "예정 대비 3% 지연"),
                InsightItem("마일스톤 달성 현황", "3/5건", "5/5건", "유지", "2건 진행중"),
                InsightItem("리스크 항목 수 및 등급", "4건(고:1, 중:2, 저:1)", "2건 이하", "상승"),
                InsightItem("이슈 해결률", "85%", "90%", "상승"),
                InsightItem("일정 준수율 (%)", "78%", "90%", "유지"),
            ],
            "items": {
                "주간 진행 현황": "설계 단계 85% 완료, 개발 단계 착수. 주요 API 명세 확정",
                "금주 완료 작업": "DB 설계 완료, API 설계서 v2.0 배포, 인프라 환경 구성 완료",
                "차주 계획": "프론트엔드 UI 개발 착수, 단위 테스트 계획 수립",
                "현안 및 리스크": "외부 연동 API 제공 지연(고위험), 담당자 휴가로 인한 공백 대응 필요",
            },
            "action_items": [
                "외부 API 제공사 주 2회 진행상황 점검 미팅 실시",
                "백업 인력 긴급 투입 검토 및 업무 분장 재조정",
                "마일스톤 4번 일정 2주 조정 (PM 승인 요청)",
            ],
            "risks": ["외부 연동 API 지연 - 고위험", "핵심 인력 이탈 위험 - 중위험"],
            "next_period_plan": "프론트엔드 UI 개발 집중, 외부 API 대체안 검토 병행",
        },
        "DEV": {
            "insights": [
                InsightItem("개발 완료율 (%)", "68%", "70%", "상승"),
                InsightItem("코드 리뷰 건수", "23건", "20건 이상", "상승"),
                InsightItem("버그 발생/해결 건수", "발생:12건, 해결:10건", "해결률 90% 이상", "유지"),
                InsightItem("배포 횟수", "3회", "주 2회 이상", "상승"),
            ],
            "items": {
                "개발 진행 현황": "백엔드 API 68% 완성, 프론트엔드 연동 테스트 진행 중",
                "금주 완료 기능": "회원관리 모듈, 권한관리 모듈, 대시보드 API",
                "버그/이슈 현황": "Critical 0건, Major 3건, Minor 7건 (해결 중)",
                "차주 개발 계획": "보고서 생성 모듈, 알림 모듈, 통합 테스트",
            },
            "action_items": [
                "Major 버그 3건 차주 중 100% 해결",
                "통합 테스트 환경 구축 완료",
            ],
            "risks": ["기술 부채 누적 - 중위험"],
            "next_period_plan": "보고서·알림 모듈 개발 완료 후 통합 테스트 진입",
        },
    }

    unit_data = sample_data.get(args.unit, {
        "insights": [InsightItem("업무 완료율", "75%", "80%", "상승")],
        "items": {k: f"{k} 진행 중 - 상세 내용 작성 필요" for k in report.content.items},
        "action_items": ["세부 실행 계획 수립", "다음 주 진행 현황 공유"],
        "risks": [],
        "next_period_plan": "현행 계획 유지 추진",
    })

    report = auto.fill_and_submit(
        report=report,
        items=unit_data.get("items", {}),
        insights=unit_data.get("insights", []),
        action_items=unit_data.get("action_items", []),
        risks=unit_data.get("risks", []),
        next_period_plan=unit_data.get("next_period_plan", ""),
        submitter=f"{auto._unit_name(args.unit)} 유닛장",
    )
    print(f"\n[데모] 보고서가 제출되었습니다: {report.id}")
    print(f"  상태: {report.status.value}\n")
    return report.id


def cmd_review(args, auto: ReportAutomation):
    """보고서 자동 검토 및 피드백"""
    if args.all:
        count = auto.process_all_submitted()
        print(f"\n{count}건의 보고서를 처리했습니다.\n")
    elif args.id:
        report = auto.auto_review_and_feedback(args.id)
        if report:
            feedback = auto.manager.get_feedback(report.id)
            if feedback:
                print(f"\n[검토 결과]")
                print(f"  보고서 ID  : {report.id}")
                print(f"  종합 점수  : {feedback.score.total:.1f}점")
                print(f"  조치       : {feedback.action.value}")
                print(f"\n  요약:\n  {feedback.summary}")
                if feedback.strengths:
                    print(f"\n  우수 항목:")
                    for s in feedback.strengths:
                        print(f"    + {s}")
                if feedback.improvements:
                    print(f"\n  개선 권고:")
                    for i in feedback.improvements:
                        print(f"    - {i}")
                if feedback.required_revisions:
                    print(f"\n  필수 수정 사항:")
                    for r in feedback.required_revisions:
                        print(f"    ! {r}")
                print()
    else:
        print("[오류] --id <보고서ID> 또는 --all 옵션이 필요합니다.")


def cmd_remind(args, auto: ReportAutomation):
    """리마인더 발송"""
    count = auto.check_and_send_reminders()
    print(f"\n{count}건의 리마인더를 발송했습니다.\n")


def cmd_escalate(args, auto: ReportAutomation):
    """에스컬레이션 처리"""
    count = auto.check_escalations()
    print(f"\n{count}건의 에스컬레이션을 처리했습니다.\n")


def cmd_demo(args, auto: ReportAutomation):
    """전체 워크플로우 데모 실행"""
    print("\n" + "=" * 65)
    print("  PKG 사업본부(구축) 업무보고 자동화 시스템 - 전체 워크플로우 데모")
    print("=" * 65)

    units = ["PM", "DEV", "INFRA", "QA", "BIZ", "SUPPORT"]
    report_type = ReportType.WEEKLY

    print("\n[1단계] 현황 대시보드 확인")
    auto.print_dashboard()

    print("[2단계] 리마인더 발송 확인")
    auto.check_and_send_reminders()

    print("\n[3단계] 각 유닛 보고서 제출 (데모 데이터)")
    submitted_ids = []
    for unit_id in units:
        try:
            # create + submit
            report = auto.create_report(unit_id, report_type)
            unit_data_map = {
                "PM": {
                    "insights": [
                        InsightItem("프로젝트 진행률 (%)", "72%", "75%", "상승"),
                        InsightItem("마일스톤 달성 현황", "3/5건", "5/5건", "유지"),
                        InsightItem("리스크 항목 수 및 등급", "4건", "2건 이하", "상승"),
                        InsightItem("이슈 해결률", "85%", "90%", "상승"),
                        InsightItem("일정 준수율 (%)", "78%", "90%", "유지"),
                    ],
                    "items": {k: f"PM 유닛 {k} 작성 완료" for k in report.content.items},
                    "action_items": ["리스크 대응 계획 수립", "외부 API 업체 미팅", "일정 재조정 검토"],
                    "risks": ["외부 API 지연 - 고위험", "핵심 인력 부족 - 중위험"],
                    "next_period_plan": "마일스톤 4번 완료 목표",
                },
            }
            generic = {
                "insights": [
                    InsightItem("업무 완료율", "80%", "85%", "상승"),
                    InsightItem("이슈 해결 건수", "5건", "5건 이상", "유지"),
                ],
                "items": {k: f"{auto._unit_name(unit_id)} {k} 작성 완료" for k in report.content.items},
                "action_items": ["세부 실행 계획 추진", "다음 주 진행 현황 보고"],
                "risks": [],
                "next_period_plan": "현행 계획 지속 추진",
            }
            d = unit_data_map.get(unit_id, generic)
            report = auto.fill_and_submit(
                report, d["items"], d["insights"],
                d["action_items"], d["risks"], d["next_period_plan"],
                f"{auto._unit_name(unit_id)} 유닛장",
            )
            submitted_ids.append(report.id)
            print(f"  ✔ {auto._unit_name(unit_id)} 보고서 제출 완료 (ID: {report.id[:30]}...)")
        except Exception as e:
            print(f"  ✗ {unit_id} 오류: {e}")

    print(f"\n[4단계] 전체 보고서 자동 검토 및 피드백 ({len(submitted_ids)}건)")
    for report_id in submitted_ids:
        auto.auto_review_and_feedback(report_id)

    print("\n[5단계] 최종 현황 대시보드")
    auto.print_dashboard()

    print("데모 완료. data/ 디렉토리에서 저장된 결과를 확인하세요.\n")


def main():
    parser = argparse.ArgumentParser(
        description="PKG 사업본부(구축) 업무보고 자동화 시스템",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
명령어 예시:
  python main.py dashboard                      # 현황 대시보드
  python main.py schedule                       # 스케줄 목록
  python main.py create --unit PM --type weekly # PM 유닛 주간보고 초안 생성
  python main.py submit --unit DEV --type weekly # DEV 유닛 데모 제출
  python main.py review --all                   # 제출된 보고서 전체 자동 검토
  python main.py review --id <보고서ID>          # 특정 보고서 검토
  python main.py remind                         # 리마인더 발송
  python main.py escalate                       # 에스컬레이션 처리
  python main.py demo                           # 전체 워크플로우 데모
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="명령어")

    subparsers.add_parser("dashboard", help="현황 대시보드 출력")
    subparsers.add_parser("schedule", help="스케줄 목록 조회")
    subparsers.add_parser("remind", help="리마인더 발송")
    subparsers.add_parser("escalate", help="에스컬레이션 처리")
    subparsers.add_parser("demo", help="전체 워크플로우 데모")

    create_p = subparsers.add_parser("create", help="보고서 초안 생성")
    create_p.add_argument("--unit", required=True,
                          choices=["PM", "DEV", "INFRA", "QA", "BIZ", "SUPPORT"])
    create_p.add_argument("--type", required=True, choices=["weekly", "monthly"])

    submit_p = subparsers.add_parser("submit", help="데모 보고서 제출")
    submit_p.add_argument("--unit", required=True,
                          choices=["PM", "DEV", "INFRA", "QA", "BIZ", "SUPPORT"])
    submit_p.add_argument("--type", required=True, choices=["weekly", "monthly"])

    review_p = subparsers.add_parser("review", help="보고서 검토 및 피드백")
    review_p.add_argument("--id", help="보고서 ID")
    review_p.add_argument("--all", action="store_true", help="전체 처리")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    auto = ReportAutomation()
    commands = {
        "dashboard": cmd_dashboard,
        "schedule": cmd_schedule,
        "create": cmd_create,
        "submit": cmd_submit_demo,
        "review": cmd_review,
        "remind": cmd_remind,
        "escalate": cmd_escalate,
        "demo": cmd_demo,
    }

    handler = commands.get(args.command)
    if handler:
        handler(args, auto)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
