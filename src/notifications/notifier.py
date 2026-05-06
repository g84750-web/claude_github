"""알림 및 에스컬레이션 모듈"""

import os
from datetime import datetime
from typing import List, Optional

import yaml

from src.models import Feedback, Report, ScheduleEntry


class Notifier:
    """콘솔 + 로그 파일 기반 알림 시스템"""

    def __init__(self, schedule_config_path: str, log_path: str = "data/notifications.log"):
        with open(schedule_config_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        self.config = cfg.get("notifications", {})
        self.log_path = log_path
        os.makedirs(os.path.dirname(log_path), exist_ok=True)

    def _log(self, level: str, message: str) -> None:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] [{level}] {message}"
        print(line)
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    def send_reminder(self, unit_id: str, unit_name: str,
                      report_type: str, deadline: datetime, message: str) -> None:
        """보고서 제출 리마인더 발송"""
        deadline_str = deadline.strftime("%Y-%m-%d %H:%M")
        self._log("REMINDER",
                  f"[{unit_name}({unit_id})] {report_type} 보고 리마인더 | "
                  f"마감: {deadline_str} | {message}")

    def send_submission_confirmation(self, report: Report, unit_name: str) -> None:
        """제출 확인 알림"""
        report_type = "주간" if report.report_type.value == "weekly" else "월간"
        self._log("SUBMIT",
                  f"[{unit_name}({report.unit_id})] {report_type}보고서 제출 확인 | "
                  f"보고서ID: {report.id} | 제출자: {report.submitter} | "
                  f"제출일시: {report.submitted_at.strftime('%Y-%m-%d %H:%M') if report.submitted_at else '-'}")

    def send_review_started(self, report: Report, unit_name: str) -> None:
        """검토 시작 알림"""
        report_type = "주간" if report.report_type.value == "weekly" else "월간"
        self._log("REVIEW",
                  f"[{unit_name}({report.unit_id})] {report_type}보고서 검토 시작 | "
                  f"보고서ID: {report.id} | 검토자: {report.reviewer}")

    def send_feedback(self, feedback: Feedback, unit_name: str) -> None:
        """피드백 발송 알림"""
        self._log("FEEDBACK",
                  f"[{unit_name}({feedback.unit_id})] 피드백 발송 | "
                  f"보고서ID: {feedback.report_id} | "
                  f"종합점수: {feedback.score.total:.1f}점 | "
                  f"조치: {feedback.action.value}\n"
                  f"  요약: {feedback.summary}\n"
                  f"  강점: {'; '.join(feedback.strengths[:2])}\n"
                  f"  개선: {'; '.join(feedback.improvements[:2]) if feedback.improvements else '없음'}")

    def send_overdue_alert(self, unit_id: str, unit_name: str,
                           report_type: str, hours_overdue: float) -> None:
        """미제출 마감 초과 경고"""
        self._log("OVERDUE",
                  f"[경고] [{unit_name}({unit_id})] {report_type} 보고서 마감 초과 | "
                  f"초과 시간: {hours_overdue:.1f}시간")

    def send_escalation(self, unit_id: str, unit_name: str,
                        report_type: str, escalate_to: str,
                        hours_overdue: float) -> None:
        """에스컬레이션 알림"""
        self._log("ESCALATION",
                  f"[에스컬레이션] [{escalate_to}에게 보고] "
                  f"[{unit_name}({unit_id})] {report_type} 보고서 미제출 | "
                  f"초과: {hours_overdue:.1f}시간")

    def send_bulk_status_report(self, status_lines: List[str], title: str = "보고 현황") -> None:
        """전체 현황 요약 보고"""
        self._log("STATUS", f"===== {title} =====")
        for line in status_lines:
            self._log("STATUS", f"  {line}")
        self._log("STATUS", "=" * 40)
