"""보고서 생명주기 관리 모듈 (제출 → 검토 → 피드백)"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional

from src.models import (
    Feedback, InsightItem, Report, ReportContent,
    ReportStatus, ReportType, ReviewScore
)


class ReportStore:
    """보고서 파일 기반 저장소"""

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)

    def _report_path(self, report_id: str) -> str:
        return os.path.join(self.data_dir, f"{report_id}.json")

    def save(self, report: Report) -> None:
        data = {
            "id": report.id,
            "unit_id": report.unit_id,
            "report_type": report.report_type.value,
            "status": report.status.value,
            "submitter": report.submitter,
            "reviewer": report.reviewer,
            "created_at": report.created_at.isoformat(),
            "submitted_at": report.submitted_at.isoformat() if report.submitted_at else None,
            "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
            "feedback_sent_at": report.feedback_sent_at.isoformat() if report.feedback_sent_at else None,
            "deadline": report.deadline.isoformat() if report.deadline else None,
            "content": {
                "unit_id": report.content.unit_id,
                "report_type": report.content.report_type.value,
                "period_start": report.content.period_start.isoformat(),
                "period_end": report.content.period_end.isoformat(),
                "insights": [
                    {
                        "metric": ins.metric,
                        "value": ins.value,
                        "target": ins.target,
                        "trend": ins.trend,
                        "comment": ins.comment,
                    }
                    for ins in report.content.insights
                ],
                "items": report.content.items,
                "action_items": report.content.action_items,
                "risks": report.content.risks,
                "next_period_plan": report.content.next_period_plan,
            },
        }
        with open(self._report_path(report.id), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self, report_id: str) -> Optional[Report]:
        path = self._report_path(report_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._deserialize(data)

    def list_reports(self, unit_id: Optional[str] = None,
                     report_type: Optional[ReportType] = None,
                     status: Optional[ReportStatus] = None) -> List[Report]:
        reports = []
        for fname in os.listdir(self.data_dir):
            if not fname.endswith(".json"):
                continue
            with open(os.path.join(self.data_dir, fname), "r", encoding="utf-8") as f:
                data = json.load(f)
            if unit_id and data["unit_id"] != unit_id:
                continue
            if report_type and data["report_type"] != report_type.value:
                continue
            if status and data["status"] != status.value:
                continue
            reports.append(self._deserialize(data))
        return sorted(reports, key=lambda r: r.created_at, reverse=True)

    def _deserialize(self, data: dict) -> Report:
        c = data["content"]
        content = ReportContent(
            unit_id=c["unit_id"],
            report_type=ReportType(c["report_type"]),
            period_start=datetime.fromisoformat(c["period_start"]),
            period_end=datetime.fromisoformat(c["period_end"]),
            insights=[
                InsightItem(
                    metric=i["metric"],
                    value=i["value"],
                    target=i.get("target"),
                    trend=i.get("trend"),
                    comment=i.get("comment"),
                )
                for i in c.get("insights", [])
            ],
            items=c.get("items", {}),
            action_items=c.get("action_items", []),
            risks=c.get("risks", []),
            next_period_plan=c.get("next_period_plan", ""),
        )
        return Report(
            id=data["id"],
            unit_id=data["unit_id"],
            report_type=ReportType(data["report_type"]),
            status=ReportStatus(data["status"]),
            content=content,
            created_at=datetime.fromisoformat(data["created_at"]),
            submitted_at=datetime.fromisoformat(data["submitted_at"]) if data.get("submitted_at") else None,
            reviewed_at=datetime.fromisoformat(data["reviewed_at"]) if data.get("reviewed_at") else None,
            feedback_sent_at=datetime.fromisoformat(data["feedback_sent_at"]) if data.get("feedback_sent_at") else None,
            deadline=datetime.fromisoformat(data["deadline"]) if data.get("deadline") else None,
            submitter=data.get("submitter", ""),
            reviewer=data.get("reviewer", ""),
        )


class FeedbackStore:
    """피드백 파일 기반 저장소"""

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)

    def save(self, feedback: Feedback) -> None:
        path = os.path.join(self.data_dir, f"fb_{feedback.report_id}.json")
        data = {
            "report_id": feedback.report_id,
            "unit_id": feedback.unit_id,
            "action": feedback.action.value,
            "summary": feedback.summary,
            "strengths": feedback.strengths,
            "improvements": feedback.improvements,
            "required_revisions": feedback.required_revisions,
            "created_at": feedback.created_at.isoformat(),
            "score": {
                "completeness": feedback.score.completeness,
                "insight_quality": feedback.score.insight_quality,
                "action_items": feedback.score.action_items,
                "timeliness": feedback.score.timeliness,
                "total": feedback.score.total,
                "details": feedback.score.details,
            },
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self, report_id: str) -> Optional[Feedback]:
        path = os.path.join(self.data_dir, f"fb_{report_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        from src.models import FeedbackAction
        score = ReviewScore(
            completeness=data["score"]["completeness"],
            insight_quality=data["score"]["insight_quality"],
            action_items=data["score"]["action_items"],
            timeliness=data["score"]["timeliness"],
            total=data["score"]["total"],
            details=data["score"].get("details", {}),
        )
        return Feedback(
            report_id=data["report_id"],
            unit_id=data["unit_id"],
            score=score,
            action=FeedbackAction(data["action"]),
            summary=data["summary"],
            strengths=data.get("strengths", []),
            improvements=data.get("improvements", []),
            required_revisions=data.get("required_revisions", []),
            created_at=datetime.fromisoformat(data["created_at"]),
        )


class ReportManager:
    """보고서 제출/검토/피드백 워크플로우 관리"""

    def __init__(self, reports_dir: str, feedback_dir: str):
        self.store = ReportStore(reports_dir)
        self.feedback_store = FeedbackStore(feedback_dir)

    def submit_report(self, report: Report, submitter: str = "") -> Report:
        """보고서 제출 처리"""
        if report.status not in (ReportStatus.DRAFT, ReportStatus.REVISION_REQUESTED,
                                 ReportStatus.RESUBMISSION_REQUESTED):
            raise ValueError(f"제출 불가 상태입니다: {report.status.value}")

        report.status = ReportStatus.SUBMITTED
        report.submitted_at = datetime.now()
        if submitter:
            report.submitter = submitter
        self.store.save(report)
        return report

    def start_review(self, report: Report, reviewer: str = "") -> Report:
        """검토 시작"""
        if report.status != ReportStatus.SUBMITTED:
            raise ValueError(f"검토 시작 불가 상태입니다: {report.status.value}")
        report.status = ReportStatus.UNDER_REVIEW
        if reviewer:
            report.reviewer = reviewer
        self.store.save(report)
        return report

    def complete_review(self, report: Report) -> Report:
        """검토 완료"""
        if report.status != ReportStatus.UNDER_REVIEW:
            raise ValueError(f"검토 완료 불가 상태입니다: {report.status.value}")
        report.status = ReportStatus.REVIEWED
        report.reviewed_at = datetime.now()
        self.store.save(report)
        return report

    def send_feedback(self, report: Report, feedback: Feedback) -> Report:
        """피드백 발송 및 상태 업데이트"""
        from src.models import FeedbackAction

        self.feedback_store.save(feedback)
        report.feedback_sent_at = datetime.now()

        action_to_status = {
            FeedbackAction.APPROVED: ReportStatus.APPROVED,
            FeedbackAction.APPROVED_WITH_RECOMMENDATION: ReportStatus.APPROVED,
            FeedbackAction.REVISION_REQUESTED: ReportStatus.REVISION_REQUESTED,
            FeedbackAction.RESUBMISSION_REQUESTED: ReportStatus.RESUBMISSION_REQUESTED,
        }
        report.status = action_to_status.get(feedback.action, ReportStatus.FEEDBACK_SENT)
        self.store.save(report)
        return report

    def get_pending_reports(self) -> List[Report]:
        """검토 대기 중인 보고서 목록"""
        return self.store.list_reports(status=ReportStatus.SUBMITTED)

    def get_unit_reports(self, unit_id: str) -> List[Report]:
        """특정 유닛의 보고서 목록"""
        return self.store.list_reports(unit_id=unit_id)

    def get_report(self, report_id: str) -> Optional[Report]:
        return self.store.load(report_id)

    def get_feedback(self, report_id: str) -> Optional[Feedback]:
        return self.feedback_store.load(report_id)

    def get_overdue_reports(self, entries) -> List[Dict]:
        """마감 초과 미제출 보고서 목록"""
        overdue = []
        submitted_ids = {
            f"{r.unit_id}_{r.report_type.value}"
            for r in self.store.list_reports(status=ReportStatus.SUBMITTED)
        }
        for entry in entries:
            key = f"{entry.unit_id}_{entry.report_type.value}"
            if entry.deadline < datetime.now() and key not in submitted_ids:
                hours_overdue = (datetime.now() - entry.deadline).total_seconds() / 3600
                overdue.append({
                    "unit_id": entry.unit_id,
                    "report_type": entry.report_type.value,
                    "deadline": entry.deadline,
                    "hours_overdue": hours_overdue,
                })
        return overdue
