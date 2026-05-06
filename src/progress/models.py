"""구축진척관리 데이터 모델"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional


class ProjectStatus(Enum):
    PLANNING = "계획"
    IN_PROGRESS = "진행중"
    COMPLETED = "완료"
    ON_HOLD = "보류"
    DELAYED = "지연"


class ProjectPhase(Enum):
    REQUIREMENTS = "요구분석"
    DESIGN = "설계"
    DEVELOPMENT = "개발"
    TESTING = "테스트"
    DEPLOYMENT = "배포"
    MAINTENANCE = "유지보수"


class SkillLevel(Enum):
    JUNIOR = "주니어"
    MID = "미드"
    SENIOR = "시니어"
    LEAD = "리드"


@dataclass
class Milestone:
    id: str
    name: str
    planned_date: datetime
    actual_date: Optional[datetime] = None
    status: str = "pending"  # "pending", "completed", "delayed"

    def is_delayed(self) -> bool:
        if self.status == "completed":
            return self.actual_date is not None and self.actual_date > self.planned_date
        return datetime.now() > self.planned_date


@dataclass
class Project:
    id: str
    name: str
    unit_id: str
    phase: ProjectPhase
    status: ProjectStatus
    start_date: datetime
    planned_end_date: datetime
    actual_end_date: Optional[datetime] = None
    progress_rate: float = 0.0
    milestones: List[Milestone] = field(default_factory=list)
    assigned_constructors: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    notes: str = ""

    def is_delayed(self) -> bool:
        if self.status == ProjectStatus.COMPLETED:
            return False
        return datetime.now() > self.planned_end_date

    def schedule_variance(self) -> float:
        """일정 편차 (%) — 양수: 선행, 음수: 지연"""
        total_days = (self.planned_end_date - self.start_date).days
        elapsed_days = (datetime.now() - self.start_date).days
        if total_days <= 0:
            return 0.0
        expected_progress = min((elapsed_days / total_days) * 100, 100)
        return round(self.progress_rate - expected_progress, 1)

    def days_remaining(self) -> int:
        delta = self.planned_end_date - datetime.now()
        return max(delta.days, 0)

    def elapsed_days(self) -> int:
        return max((datetime.now() - self.start_date).days, 0)


@dataclass
class Constructor:
    id: str
    name: str
    unit_id: str
    role: str
    skill_level: SkillLevel
    max_capacity: float = 100.0
    current_projects: List[str] = field(default_factory=list)


@dataclass
class CapacityRecord:
    constructor_id: str
    week_start: datetime
    allocated_capacity: float
    actual_used: float
    projects: Dict[str, float] = field(default_factory=dict)
    notes: str = ""

    @property
    def utilization_rate(self) -> float:
        if self.allocated_capacity == 0:
            return 0.0
        return round((self.actual_used / self.allocated_capacity) * 100, 1)

    @property
    def is_overloaded(self) -> bool:
        return self.allocated_capacity > 100.0

    @property
    def available_capacity(self) -> float:
        return max(100.0 - self.allocated_capacity, 0.0)


@dataclass
class PerformanceMetrics:
    constructor_id: str
    project_id: str
    period_start: datetime
    period_end: datetime
    planned_items: int
    completed_items: int
    quality_score: float
    on_time_delivery: float
    bugs_introduced: int = 0
    bugs_resolved: int = 0
    notes: str = ""

    @property
    def completion_rate(self) -> float:
        if self.planned_items == 0:
            return 0.0
        return round((self.completed_items / self.planned_items) * 100, 1)

    @property
    def bug_resolution_rate(self) -> float:
        if self.bugs_introduced == 0:
            return 100.0
        return round((self.bugs_resolved / self.bugs_introduced) * 100, 1)

    @property
    def productivity_score(self) -> float:
        """생산성 종합 점수 (0-100): 완료율 40% + 품질 35% + 납기준수 25%"""
        return round(
            self.completion_rate * 0.40
            + self.quality_score * 0.35
            + self.on_time_delivery * 0.25,
            1,
        )
