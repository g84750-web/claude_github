#!/usr/bin/env python3
"""PKG 사업본부(구축) 업무보고 자동화 시스템 CLI 진입점"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.automation import ReportAutomation
from src.insights.trend_analyzer import TrendAnalyzer
from src.models import InsightItem, ReportType
from src.progress.progress_manager import ProgressManager
from src.progress.capacity_manager import CapacityManager as _CapacityManager
from src.progress.models import (
    CapacityRecord, Constructor, Milestone, PerformanceMetrics,
    Project, ProjectPhase, ProjectStatus, SkillLevel,
)
from datetime import datetime, timedelta


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


def cmd_stats(args, auto: ReportAutomation):
    """통계 및 트렌드 분석 출력"""
    analyzer = TrendAnalyzer()
    reports = auto.manager.store.list_reports()
    feedbacks = []
    for r in reports:
        fb = auto.manager.get_feedback(r.id)
        if fb:
            feedbacks.append(fb)

    unit_names = {uid: auto._unit_name(uid) for uid in auto.units}
    summary = analyzer.generate_summary_report(reports, feedbacks, unit_names)
    print(summary)

    if feedbacks and args.unit:
        trend = analyzer.score_trend(feedbacks, args.unit)
        if trend:
            print(f"\n[{auto._unit_name(args.unit)} 점수 추이]")
            for t in trend:
                bar = "█" * int(t['score'] / 10)
                print(f"  {t['date']}  {bar} {t['score']:.1f}점  ({t['action']})")
        print()


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


def _load_demo_progress_data(mgr: ProgressManager):
    """진척관리 데모 데이터 초기화"""
    now = datetime.now()

    # 구축자 등록
    constructors = [
        Constructor("C001", "김철수", "DEV", "백엔드 개발자", SkillLevel.SENIOR, 100.0, ["P001", "P002"]),
        Constructor("C002", "이영희", "DEV", "프론트엔드 개발자", SkillLevel.MID, 100.0, ["P001"]),
        Constructor("C003", "박민준", "PM", "PM", SkillLevel.LEAD, 100.0, ["P001", "P002", "P003"]),
        Constructor("C004", "최지원", "QA", "QA 엔지니어", SkillLevel.MID, 100.0, ["P002"]),
        Constructor("C005", "정수현", "INFRA", "인프라 엔지니어", SkillLevel.SENIOR, 100.0, ["P003"]),
    ]
    for c in constructors:
        mgr.add_constructor(c)

    # 프로젝트 등록
    milestones_p1 = [
        Milestone("M1", "요구사항 확정", now - timedelta(days=40), now - timedelta(days=38), "completed"),
        Milestone("M2", "설계 완료", now - timedelta(days=20), now - timedelta(days=18), "completed"),
        Milestone("M3", "개발 완료", now + timedelta(days=20)),
        Milestone("M4", "테스트 완료", now + timedelta(days=40)),
    ]
    projects = [
        Project("P001", "ERP 시스템 구축", "DEV", ProjectPhase.DEVELOPMENT, ProjectStatus.IN_PROGRESS,
                now - timedelta(days=60), now + timedelta(days=60), progress_rate=58.0,
                milestones=milestones_p1,
                assigned_constructors=["C001", "C002", "C003"],
                risks=["외부 API 연동 지연 - 중위험", "인력 부족 - 저위험"]),
        Project("P002", "모바일 앱 개발", "DEV", ProjectPhase.TESTING, ProjectStatus.IN_PROGRESS,
                now - timedelta(days=90), now + timedelta(days=10), progress_rate=82.0,
                assigned_constructors=["C001", "C004"],
                risks=["테스트 일정 촉박 - 고위험"]),
        Project("P003", "인프라 고도화", "INFRA", ProjectPhase.DESIGN, ProjectStatus.IN_PROGRESS,
                now - timedelta(days=20), now + timedelta(days=80), progress_rate=22.0,
                assigned_constructors=["C003", "C005"]),
        Project("P004", "레거시 마이그레이션", "PM", ProjectPhase.REQUIREMENTS, ProjectStatus.DELAYED,
                now - timedelta(days=120), now - timedelta(days=5), progress_rate=35.0,
                risks=["일정 대폭 초과 - 고위험", "데이터 정합성 - 고위험"]),
    ]
    for p in projects:
        mgr.add_project(p)

    # 역량 기록 (이번 주)
    week_start = _CapacityManager._week_start(now)
    capacity_records = [
        CapacityRecord("C001", week_start, 110.0, 105.0, {"P001": 60.0, "P002": 50.0}),
        CapacityRecord("C002", week_start, 75.0, 70.0, {"P001": 75.0}),
        CapacityRecord("C003", week_start, 95.0, 90.0, {"P001": 30.0, "P002": 30.0, "P003": 35.0}),
        CapacityRecord("C004", week_start, 45.0, 40.0, {"P002": 45.0}),
        CapacityRecord("C005", week_start, 80.0, 75.0, {"P003": 80.0}),
    ]
    for r in capacity_records:
        mgr.add_capacity_record(r)

    # 실적 지표
    perf_data = [
        PerformanceMetrics("C001", "P001", now - timedelta(days=60), now - timedelta(days=30),
                           12, 10, 82.0, 88.0, 8, 7),
        PerformanceMetrics("C001", "P002", now - timedelta(days=30), now,
                           10, 9, 85.0, 90.0, 4, 4),
        PerformanceMetrics("C002", "P001", now - timedelta(days=60), now - timedelta(days=30),
                           8, 5, 70.0, 72.0, 6, 4),
        PerformanceMetrics("C002", "P001", now - timedelta(days=30), now,
                           8, 7, 75.0, 80.0, 3, 3),
        PerformanceMetrics("C003", "P001", now - timedelta(days=60), now - timedelta(days=30),
                           15, 14, 90.0, 95.0, 2, 2),
        PerformanceMetrics("C004", "P002", now - timedelta(days=60), now,
                           10, 6, 60.0, 60.0, 10, 6),
        PerformanceMetrics("C005", "P003", now - timedelta(days=30), now,
                           6, 5, 88.0, 92.0, 1, 1),
    ]
    for pm in perf_data:
        mgr.add_performance_metrics(pm)


def cmd_progress(args, _auto):
    """구축 진척관리 명령 처리"""
    mgr = ProgressManager()

    if args.progress_cmd == "demo":
        if mgr.list_projects():
            print("\n[안내] 이미 데모 데이터가 존재합니다. data/progress/ 를 삭제 후 재실행하세요.\n")
            return
        print("\n[진척관리 데모] 샘플 데이터를 로드합니다...")
        _load_demo_progress_data(mgr)
        print("  ✔ 프로젝트 4건, 구축자 5명, 역량·실적 데이터 로드 완료\n")
        mgr.print_full_report({"DEV": "개발팀", "PM": "PM팀", "INFRA": "인프라팀", "QA": "QA팀"})

    elif args.progress_cmd == "report":
        unit_names = {"DEV": "개발팀", "PM": "PM팀", "INFRA": "인프라팀", "QA": "QA팀"}
        if args.type == "progress":
            mgr.print_progress_report(unit_names)
        elif args.type == "capacity":
            mgr.print_capacity_report()
        elif args.type == "performance":
            mgr.print_performance_report()
        else:
            mgr.print_full_report(unit_names)

    elif args.progress_cmd == "update":
        project = mgr.update_project_progress(args.id, args.rate, args.notes or "")
        if project:
            print(f"\n  프로젝트 [{project.name}] 진척률 → {project.progress_rate:.0f}%  (상태: {project.status.value})\n")
        else:
            print(f"[오류] 프로젝트를 찾을 수 없습니다: {args.id}")

    else:
        print("[오류] 하위 명령이 필요합니다: demo | report | update")


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
  python main.py stats                          # 통계 및 트렌드 분석
  python main.py stats --unit PM               # PM 유닛 점수 추이
  python main.py demo                           # 전체 워크플로우 데모
  python main.py progress demo                  # 진척관리 데모 데이터 로드 및 전체 보고서
  python main.py progress report                # 진척관리 전체 보고서
  python main.py progress report --type progress   # 프로젝트 진척 보고서
  python main.py progress report --type capacity   # 역량 현황 보고서
  python main.py progress report --type performance # 실적 분석 보고서
  python main.py progress update --id P001 --rate 75  # 프로젝트 진척률 업데이트
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="명령어")

    subparsers.add_parser("dashboard", help="현황 대시보드 출력")
    subparsers.add_parser("schedule", help="스케줄 목록 조회")
    subparsers.add_parser("remind", help="리마인더 발송")
    subparsers.add_parser("escalate", help="에스컬레이션 처리")
    subparsers.add_parser("demo", help="전체 워크플로우 데모")

    stats_p = subparsers.add_parser("stats", help="통계 및 트렌드 분석")
    stats_p.add_argument("--unit", choices=["PM", "DEV", "INFRA", "QA", "BIZ", "SUPPORT"],
                         help="특정 유닛 점수 추이 출력")

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

    # 진척관리
    progress_p = subparsers.add_parser("progress", help="구축 진척관리 (프로젝트·역량·실적)")
    progress_sub = progress_p.add_subparsers(dest="progress_cmd")

    progress_sub.add_parser("demo", help="샘플 데이터 로드 및 전체 보고서 출력")

    report_p = progress_sub.add_parser("report", help="진척관리 보고서 출력")
    report_p.add_argument(
        "--type",
        choices=["progress", "capacity", "performance"],
        default=None,
        help="보고서 유형 (생략 시 전체)",
    )

    update_p = progress_sub.add_parser("update", help="프로젝트 진척률 업데이트")
    update_p.add_argument("--id", required=True, help="프로젝트 ID")
    update_p.add_argument("--rate", required=True, type=float, help="진척률 (0-100)")
    update_p.add_argument("--notes", default="", help="비고")

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
        "stats": cmd_stats,
        "demo": cmd_demo,
        "progress": cmd_progress,
    }

    handler = commands.get(args.command)
    if handler:
        handler(args, auto)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
