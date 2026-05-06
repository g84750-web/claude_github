"""PKG 사업본부(구축) 업무보고 자동화 오케스트레이터"""

import os
import yaml
from datetime import datetime
from typing import Dict, List, Optional

from src.feedback.feedback_generator import FeedbackGenerator
from src.insights.insight_analyzer import InsightAnalyzer
from src.models import InsightItem, Report, ReportStatus, ReportType, ScheduleEntry
from src.notifications.notifier import Notifier
from src.reports.report_manager import ReportManager
from src.scheduler.schedule_engine import ScheduleEngine


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _path(relative: str) -> str:
    return os.path.join(BASE_DIR, relative)


class ReportAutomation:
    """보고 스케줄링·검토·피드백 통합 자동화"""

    def __init__(self,
                 schedule_config: str = None,
                 units_config: str = None,
                 reports_dir: str = None,
                 feedback_dir: str = None,
                 log_path: str = None):

        self.schedule_config = schedule_config or _path("config/schedule.yaml")
        self.units_config = units_config or _path("config/units.yaml")
        reports_dir = reports_dir or _path("data/reports")
        feedback_dir = feedback_dir or _path("data/feedback")
        log_path = log_path or _path("data/notifications.log")

        self.engine = ScheduleEngine(self.schedule_config, self.units_config)
        self.manager = ReportManager(reports_dir, feedback_dir)
        self.generator = FeedbackGenerator(self.schedule_config, self.units_config)
        self.notifier = Notifier(self.schedule_config, log_path)

        with open(self.units_config, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        self.units = {u["id"]: u for u in cfg["units"]}

        with open(self.schedule_config, "r", encoding="utf-8") as f:
            self.schedule_cfg = yaml.safe_load(f)

    def _unit_name(self, unit_id: str) -> str:
        return self.units.get(unit_id, {}).get("name", unit_id)

    # ─── 스케줄 관리 ────────────────────────────────────────────

    def get_current_schedule(self) -> List[ScheduleEntry]:
        """현재 기준 전체 유닛 스케줄 조회"""
        return self.engine.generate_schedule_entries()

    def check_and_send_reminders(self, now: Optional[datetime] = None) -> int:
        """리마인더 발송 필요 여부 확인 후 발송"""
        now = now or datetime.now()
        entries = self.engine.generate_schedule_entries(now)
        count = 0
        for entry in entries:
            messages = self.engine.get_reminder_messages(entry, now)
            for msg in messages:
                self.notifier.send_reminder(
                    unit_id=entry.unit_id,
                    unit_name=self._unit_name(entry.unit_id),
                    report_type="주간" if entry.report_type == ReportType.WEEKLY else "월간",
                    deadline=entry.deadline,
                    message=msg,
                )
                count += 1
        return count

    # ─── 보고서 워크플로우 ────────────────────────────────────────

    def create_report(self, unit_id: str, report_type: ReportType) -> Report:
        """보고서 초안 생성"""
        report = self.engine.create_report_template(unit_id, report_type)
        self.manager.store.save(report)
        return report

    def fill_and_submit(self, report: Report,
                        items: Dict[str, str],
                        insights: List[InsightItem],
                        action_items: List[str],
                        risks: List[str],
                        next_period_plan: str,
                        submitter: str = "") -> Report:
        """보고서 내용 입력 후 제출"""
        report.content.items.update(items)
        report.content.insights = insights
        report.content.action_items = action_items
        report.content.risks = risks
        report.content.next_period_plan = next_period_plan

        report = self.manager.submit_report(report, submitter)
        self.notifier.send_submission_confirmation(report, self._unit_name(report.unit_id))
        return report

    def auto_review_and_feedback(self, report_id: str,
                                  reviewer: str = "자동검토시스템") -> Optional[Report]:
        """보고서 자동 검토 및 피드백 생성·발송"""
        report = self.manager.get_report(report_id)
        if not report:
            print(f"[오류] 보고서를 찾을 수 없습니다: {report_id}")
            return None

        # 검토 시작
        report = self.manager.start_review(report, reviewer)
        self.notifier.send_review_started(report, self._unit_name(report.unit_id))

        # 이전 보고서 조회
        all_reports = self.manager.get_unit_reports(report.unit_id)
        previous = next(
            (r for r in all_reports
             if r.id != report.id
             and r.report_type == report.report_type
             and r.status in (ReportStatus.APPROVED, ReportStatus.FEEDBACK_SENT)),
            None
        )

        # 검토 완료
        report = self.manager.complete_review(report)

        # 피드백 생성
        feedback = self.generator.generate(report, previous)

        # 피드백 발송
        report = self.manager.send_feedback(report, feedback)
        self.notifier.send_feedback(feedback, self._unit_name(report.unit_id))

        return report

    def process_all_submitted(self, reviewer: str = "자동검토시스템") -> int:
        """제출된 모든 보고서 자동 처리"""
        pending = self.manager.get_pending_reports()
        count = 0
        for report in pending:
            self.auto_review_and_feedback(report.id, reviewer)
            count += 1
        return count

    # ─── 현황 조회 ────────────────────────────────────────────────

    def get_status_dashboard(self) -> Dict:
        """전체 현황 대시보드 데이터"""
        entries = self.get_current_schedule()
        submitted_units = {
            (r.unit_id, r.report_type.value)
            for r in self.manager.store.list_reports()
            if r.status not in (ReportStatus.DRAFT,)
        }

        weekly_status = {}
        monthly_status = {}

        for entry in entries:
            key = (entry.unit_id, entry.report_type.value)
            is_submitted = key in submitted_units
            hours_left = entry.hours_until_deadline if callable(getattr(entry, "hours_until_deadline", None)) else None
            deadline_str = entry.deadline.strftime("%Y-%m-%d %H:%M")

            info = {
                "unit_name": self._unit_name(entry.unit_id),
                "deadline": deadline_str,
                "submitted": is_submitted,
                "overdue": datetime.now() > entry.deadline and not is_submitted,
            }
            if entry.report_type == ReportType.WEEKLY:
                weekly_status[entry.unit_id] = info
            else:
                monthly_status[entry.unit_id] = info

        return {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "weekly": weekly_status,
            "monthly": monthly_status,
            "overdue": self.manager.get_overdue_reports(entries),
        }

    def print_dashboard(self) -> None:
        """터미널 대시보드 출력"""
        data = self.get_status_dashboard()

        print("\n" + "=" * 65)
        print("  PKG 사업본부(구축) 업무보고 현황 대시보드")
        print(f"  기준시각: {data['generated_at']}")
        print("=" * 65)

        for report_type_label, status_dict in [("주간", data["weekly"]), ("월간", data["monthly"])]:
            print(f"\n[{report_type_label}보고 현황]")
            print(f"{'유닛명':<20} {'마감일시':<20} {'제출현황':<12} {'비고'}")
            print("-" * 65)
            for unit_id, info in status_dict.items():
                submit_flag = "✔ 제출완료" if info["submitted"] else ("⚠ 마감초과" if info["overdue"] else "○ 대기중")
                note = "[에스컬레이션 필요]" if info["overdue"] else ""
                print(f"{info['unit_name']:<20} {info['deadline']:<20} {submit_flag:<12} {note}")

        if data["overdue"]:
            print(f"\n[마감초과 미제출 현황] {len(data['overdue'])}건")
            for item in data["overdue"]:
                print(f"  - {self._unit_name(item['unit_id'])} | "
                      f"{item['report_type']} | "
                      f"초과: {item['hours_overdue']:.1f}시간")

        print("=" * 65 + "\n")

    def check_escalations(self) -> int:
        """에스컬레이션 필요 항목 처리"""
        entries = self.engine.generate_schedule_entries()
        escalation_cfg = self.schedule_cfg.get("notifications", {}).get("escalation", {})
        escalate_to = escalation_cfg.get("escalate_to", "사업본부장")
        count = 0

        for entry in entries:
            all_reports = self.manager.store.list_reports(
                unit_id=entry.unit_id,
                report_type=entry.report_type,
            )
            submitted = any(
                r.submitted_at and r.deadline and r.deadline >= entry.deadline - \
                __import__("datetime").timedelta(days=7)
                for r in all_reports
                if r.status != ReportStatus.DRAFT
            )
            if self.engine.check_escalation_needed(entry, submitted):
                hours_overdue = (datetime.now() - entry.deadline).total_seconds() / 3600
                report_type_str = "주간" if entry.report_type == ReportType.WEEKLY else "월간"
                self.notifier.send_escalation(
                    unit_id=entry.unit_id,
                    unit_name=self._unit_name(entry.unit_id),
                    report_type=report_type_str,
                    escalate_to=escalate_to,
                    hours_overdue=hours_overdue,
                )
                count += 1
        return count
