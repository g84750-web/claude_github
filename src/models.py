"""PKG 사업본부(구축) 업무보고 시스템 데이터 모델"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional


class ReportType(Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ReportStatus(Enum):
    DRAFT = "초안"
    SUBMITTED = "제출완료"
    UNDER_REVIEW = "검토중"
    REVIEWED = "검토완료"
    FEEDBACK_SENT = "피드백발송"
    APPROVED = "승인"
    REVISION_REQUESTED = "보완요청"
    RESUBMISSION_REQUESTED = "재제출요청"


class FeedbackAction(Enum):
    APPROVED = "승인"
    APPROVED_WITH_RECOMMENDATION = "승인_보완권고"
    REVISION_REQUESTED = "보완요청"
    RESUBMISSION_REQUESTED = "재제출요청"


@dataclass
class InsightItem:
    metric: str
    value: str
    target: Optional[str] = None
    trend: Optional[str] = None
    comment: Optional[str] = None

    def has_numeric_value(self) -> bool:
        try:
            float(self.value.replace("%", "").replace(",", ""))
            return True
        except ValueError:
            return False


@dataclass
class ReportContent:
    unit_id: str
    report_type: ReportType
    period_start: datetime
    period_end: datetime
    insights: List[InsightItem] = field(default_factory=list)
    items: Dict[str, str] = field(default_factory=dict)
    action_items: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    next_period_plan: str = ""


@dataclass
class Report:
    id: str
    unit_id: str
    report_type: ReportType
    status: ReportStatus
    content: ReportContent
    created_at: datetime
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    feedback_sent_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    submitter: str = ""
    reviewer: str = ""

    def is_overdue(self) -> bool:
        if self.deadline and self.status == ReportStatus.DRAFT:
            return datetime.now() > self.deadline
        return False

    def hours_until_deadline(self) -> Optional[float]:
        if self.deadline:
            delta = self.deadline - datetime.now()
            return delta.total_seconds() / 3600
        return None


@dataclass
class ReviewScore:
    completeness: float = 0.0
    insight_quality: float = 0.0
    action_items: float = 0.0
    timeliness: float = 0.0
    total: float = 0.0
    details: Dict[str, str] = field(default_factory=dict)


@dataclass
class Feedback:
    report_id: str
    unit_id: str
    score: ReviewScore
    action: FeedbackAction
    summary: str
    strengths: List[str] = field(default_factory=list)
    improvements: List[str] = field(default_factory=list)
    required_revisions: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ScheduleEntry:
    unit_id: str
    report_type: ReportType
    deadline: datetime
    reminder_sent: bool = False
    escalated: bool = False
