"""구축진척관리 모듈 단위 테스트"""

import pytest
from datetime import datetime, timedelta

from src.progress.models import (
    CapacityRecord,
    Constructor,
    Milestone,
    PerformanceMetrics,
    Project,
    ProjectPhase,
    ProjectStatus,
    SkillLevel,
)
from src.progress.project_tracker import ProjectTracker
from src.progress.capacity_manager import CapacityManager
from src.progress.performance_analyzer import PerformanceAnalyzer


# ─── 공용 픽스처 ─────────────────────────────────────────────────

def make_project(
    pid="P001",
    name="테스트프로젝트",
    unit_id="DEV",
    phase=ProjectPhase.DEVELOPMENT,
    status=ProjectStatus.IN_PROGRESS,
    progress_rate=60.0,
    days_ago_start=30,
    days_ahead_end=30,
    milestones=None,
) -> Project:
    now = datetime.now()
    return Project(
        id=pid,
        name=name,
        unit_id=unit_id,
        phase=phase,
        status=status,
        start_date=now - timedelta(days=days_ago_start),
        planned_end_date=now + timedelta(days=days_ahead_end),
        progress_rate=progress_rate,
        milestones=milestones or [],
    )


def make_delayed_project(pid="P_DELAY") -> Project:
    now = datetime.now()
    return Project(
        id=pid,
        name="지연프로젝트",
        unit_id="PM",
        phase=ProjectPhase.TESTING,
        status=ProjectStatus.DELAYED,
        start_date=now - timedelta(days=90),
        planned_end_date=now - timedelta(days=10),
        progress_rate=40.0,
    )


def make_constructor(cid="C001", name="홍길동", role="개발자") -> Constructor:
    return Constructor(
        id=cid,
        name=name,
        unit_id="DEV",
        role=role,
        skill_level=SkillLevel.SENIOR,
        max_capacity=100.0,
        current_projects=["P001"],
    )


def make_capacity(
    constructor_id="C001",
    allocated=80.0,
    actual=75.0,
    week_offset=0,
) -> CapacityRecord:
    week_start = CapacityManager._week_start(
        datetime.now() - timedelta(weeks=week_offset)
    )
    return CapacityRecord(
        constructor_id=constructor_id,
        week_start=week_start,
        allocated_capacity=allocated,
        actual_used=actual,
        projects={"P001": allocated},
    )


def make_performance(
    constructor_id="C001",
    project_id="P001",
    planned=10,
    completed=8,
    quality=80.0,
    on_time=85.0,
    bugs_in=5,
    bugs_out=4,
    months_ago=0,
) -> PerformanceMetrics:
    period_start = datetime.now() - timedelta(days=30 * (months_ago + 1))
    period_end = period_start + timedelta(days=30)
    return PerformanceMetrics(
        constructor_id=constructor_id,
        project_id=project_id,
        period_start=period_start,
        period_end=period_end,
        planned_items=planned,
        completed_items=completed,
        quality_score=quality,
        on_time_delivery=on_time,
        bugs_introduced=bugs_in,
        bugs_resolved=bugs_out,
    )


# ─── ProjectTracker 테스트 ───────────────────────────────────────

class TestProjectTracker:
    def setup_method(self):
        self.tracker = ProjectTracker()

    def test_progress_summary_empty(self):
        result = self.tracker.get_progress_summary([])
        assert result["total"] == 0
        assert result["avg_progress"] == 0.0

    def test_progress_summary_counts(self):
        projects = [
            make_project("P1", progress_rate=80.0),
            make_project("P2", progress_rate=40.0),
            make_delayed_project(),
        ]
        result = self.tracker.get_progress_summary(projects)
        assert result["total"] == 3
        assert result["delayed_count"] == 1
        assert result["avg_progress"] == pytest.approx((80.0 + 40.0 + 40.0) / 3, abs=0.2)

    def test_completion_rate(self):
        p_done = make_project("P_DONE", status=ProjectStatus.COMPLETED, progress_rate=100.0)
        p_done.status = ProjectStatus.COMPLETED
        projects = [make_project(), p_done]
        result = self.tracker.get_progress_summary(projects)
        assert result["completion_rate"] == 50.0

    def test_delayed_projects_sorted(self):
        p1 = make_delayed_project("D1")
        p1.planned_end_date = datetime.now() - timedelta(days=5)

        p2 = make_delayed_project("D2")
        p2.planned_end_date = datetime.now() - timedelta(days=20)

        delayed = self.tracker.get_delayed_projects([p1, p2])
        assert len(delayed) == 2
        assert delayed[0]["id"] == "D2"  # 더 오래된 지연이 먼저

    def test_phase_distribution(self):
        projects = [
            make_project(phase=ProjectPhase.DEVELOPMENT),
            make_project(phase=ProjectPhase.DEVELOPMENT),
            make_project(phase=ProjectPhase.TESTING),
        ]
        dist = self.tracker.get_phase_distribution(projects)
        assert dist[ProjectPhase.DEVELOPMENT.value] == 2
        assert dist[ProjectPhase.TESTING.value] == 1

    def test_milestone_status_no_milestones(self):
        p = make_project()
        result = self.tracker.get_milestone_status(p)
        assert result["total"] == 0
        assert result["next_milestone"] is None

    def test_milestone_status_with_milestones(self):
        now = datetime.now()
        m1 = Milestone("M1", "설계완료", now - timedelta(days=5), status="completed")
        m2 = Milestone("M2", "개발완료", now + timedelta(days=10))
        p = make_project(milestones=[m1, m2])
        result = self.tracker.get_milestone_status(p)
        assert result["completed"] == 1
        assert result["pending"] == 1
        assert result["next_milestone"]["name"] == "개발완료"

    def test_schedule_variance_on_track(self):
        now = datetime.now()
        p = Project(
            id="P_VAR",
            name="편차테스트",
            unit_id="DEV",
            phase=ProjectPhase.DEVELOPMENT,
            status=ProjectStatus.IN_PROGRESS,
            start_date=now - timedelta(days=50),
            planned_end_date=now + timedelta(days=50),
            progress_rate=50.0,
        )
        variance = p.schedule_variance()
        assert abs(variance) < 5  # 대략 정상 범위 내

    def test_generate_progress_report_no_projects(self):
        report = self.tracker.generate_progress_report([], {})
        assert "등록된 프로젝트가 없습니다" in report

    def test_generate_progress_report_with_projects(self):
        projects = [make_project(), make_delayed_project()]
        report = self.tracker.generate_progress_report(projects, {"DEV": "개발팀", "PM": "PM팀"})
        assert "진척관리 현황 보고서" in report
        assert "지연 프로젝트" in report


# ─── CapacityManager 테스트 ──────────────────────────────────────

class TestCapacityManager:
    def setup_method(self):
        self.mgr = CapacityManager()

    def test_team_summary_empty(self):
        result = self.mgr.get_team_capacity_summary([], [])
        assert result["total_constructors"] == 0
        assert result["team_utilization"] == 0.0

    def test_team_summary_normal(self):
        c1 = make_constructor("C1", "김철수")
        c2 = make_constructor("C2", "이영희")
        r1 = make_capacity("C1", allocated=80.0, actual=75.0)
        r2 = make_capacity("C2", allocated=60.0, actual=55.0)
        result = self.mgr.get_team_capacity_summary([c1, c2], [r1, r2])
        assert result["total_constructors"] == 2
        assert result["total_allocated"] == 140.0
        assert result["overloaded_count"] == 0

    def test_overloaded_detection(self):
        c = make_constructor()
        r = make_capacity(allocated=110.0, actual=108.0)
        overloaded = self.mgr.get_overloaded_constructors([c], [r])
        assert len(overloaded) == 1
        assert overloaded[0]["excess"] == pytest.approx(10.0)

    def test_no_overloaded(self):
        c = make_constructor()
        r = make_capacity(allocated=80.0, actual=75.0)
        overloaded = self.mgr.get_overloaded_constructors([c], [r])
        assert len(overloaded) == 0

    def test_rebalancing_suggestions_overloaded(self):
        c = make_constructor()
        r = make_capacity(allocated=110.0, actual=105.0)
        suggestions = self.mgr.suggest_rebalancing([c], [r])
        assert any("과부하" in s for s in suggestions)

    def test_rebalancing_suggestions_underutilized(self):
        c = make_constructor()
        r = make_capacity(allocated=40.0, actual=35.0)
        suggestions = self.mgr.suggest_rebalancing([c], [r])
        assert any("여유" in s for s in suggestions)

    def test_rebalancing_no_issues(self):
        c = make_constructor()
        r = make_capacity(allocated=75.0, actual=70.0)
        suggestions = self.mgr.suggest_rebalancing([c], [r])
        assert any("적정" in s for s in suggestions)

    def test_constructor_workload_history(self):
        c = make_constructor()
        records = [
            make_capacity(week_offset=3),
            make_capacity(week_offset=2),
            make_capacity(week_offset=1),
            make_capacity(week_offset=0),
        ]
        workload = self.mgr.get_constructor_workload(c, records, last_n_weeks=4)
        assert len(workload) == 4

    def test_available_capacity_property(self):
        r = make_capacity(allocated=60.0, actual=55.0)
        assert r.available_capacity == pytest.approx(40.0)

    def test_is_overloaded_property(self):
        r_over = make_capacity(allocated=105.0, actual=100.0)
        r_ok = make_capacity(allocated=80.0, actual=75.0)
        assert r_over.is_overloaded is True
        assert r_ok.is_overloaded is False

    def test_generate_capacity_report_no_constructors(self):
        report = self.mgr.generate_capacity_report([], [])
        assert "등록된 구축자가 없습니다" in report

    def test_generate_capacity_report_with_data(self):
        c = make_constructor()
        r = make_capacity(allocated=85.0, actual=80.0)
        report = self.mgr.generate_capacity_report([c], [r])
        assert "역량(Capacity) 현황 보고서" in report
        assert c.name in report


# ─── PerformanceAnalyzer 테스트 ──────────────────────────────────

class TestPerformanceAnalyzer:
    def setup_method(self):
        self.analyzer = PerformanceAnalyzer()

    def test_individual_no_records(self):
        result = self.analyzer.get_individual_performance("C_NONE", [])
        assert result["total_records"] == 0

    def test_individual_performance_calc(self):
        m = make_performance(planned=10, completed=8, quality=80.0, on_time=90.0)
        result = self.analyzer.get_individual_performance("C001", [m])
        assert result["avg_completion_rate"] == pytest.approx(80.0)
        assert result["avg_quality_score"] == pytest.approx(80.0)
        assert result["avg_on_time_delivery"] == pytest.approx(90.0)

    def test_productivity_score_formula(self):
        m = make_performance(planned=10, completed=10, quality=90.0, on_time=100.0)
        # completion=100, quality=90, on_time=100
        expected = round(100 * 0.40 + 90 * 0.35 + 100 * 0.25, 1)
        assert m.productivity_score == pytest.approx(expected)

    def test_completion_rate_zero_planned(self):
        m = make_performance(planned=0, completed=0)
        assert m.completion_rate == 0.0

    def test_bug_resolution_rate_no_bugs(self):
        m = make_performance(bugs_in=0, bugs_out=0)
        assert m.bug_resolution_rate == 100.0

    def test_bug_resolution_rate(self):
        m = make_performance(bugs_in=10, bugs_out=8)
        assert m.bug_resolution_rate == pytest.approx(80.0)

    def test_performance_grade_A(self):
        grade = self.analyzer._grade(90.0)
        assert "A" in grade

    def test_performance_grade_D(self):
        grade = self.analyzer._grade(40.0)
        assert "D" in grade

    def test_team_performance_empty_metrics(self):
        c = make_constructor()
        result = self.analyzer.get_team_performance([c], [])
        assert result["avg_productivity"] == 0.0
        assert result["total_metrics"] == 0

    def test_team_performance_aggregation(self):
        c1 = make_constructor("C1")
        c2 = make_constructor("C2")
        m1 = make_performance("C1", quality=90.0, on_time=90.0)
        m2 = make_performance("C2", quality=70.0, on_time=70.0)
        result = self.analyzer.get_team_performance([c1, c2], [m1, m2])
        assert result["total_metrics"] == 2
        assert result["avg_quality"] == pytest.approx(80.0)

    def test_excellent_count(self):
        c = make_constructor()
        m = make_performance(planned=10, completed=10, quality=90.0, on_time=100.0)
        result = self.analyzer.get_team_performance([c], [m])
        assert result["excellent_count"] == 1

    def test_productivity_trend(self):
        metrics = [
            make_performance(months_ago=2),
            make_performance(months_ago=1),
            make_performance(months_ago=0),
        ]
        trend = self.analyzer.get_productivity_trend("C001", metrics, last_n=3)
        assert len(trend) == 3
        assert "productivity" in trend[0]

    def test_improvement_suggestions_no_data(self):
        c = make_constructor()
        suggestions = self.analyzer.get_improvement_suggestions(c, [])
        assert len(suggestions) == 1
        assert "데이터가 없습니다" in suggestions[0]

    def test_improvement_suggestions_low_completion(self):
        c = make_constructor()
        m = make_performance(planned=10, completed=5, quality=80.0, on_time=80.0)
        suggestions = self.analyzer.get_improvement_suggestions(c, [m])
        assert any("완료율" in s for s in suggestions)

    def test_improvement_suggestions_good_performance(self):
        c = make_constructor()
        m = make_performance(planned=10, completed=9, quality=88.0, on_time=90.0)
        suggestions = self.analyzer.get_improvement_suggestions(c, [m])
        assert any("우수" in s for s in suggestions)

    def test_generate_performance_report_no_constructors(self):
        report = self.analyzer.generate_performance_report([], [])
        assert "등록된 구축자가 없습니다" in report

    def test_generate_performance_report_with_data(self):
        c = make_constructor()
        m = make_performance()
        report = self.analyzer.generate_performance_report([c], [m])
        assert "실적 분석 및 생산성 향상 보고서" in report
        assert c.name in report
