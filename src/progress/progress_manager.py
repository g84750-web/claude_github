"""구축진척관리 통합 관리자"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional

from src.progress.capacity_manager import CapacityManager
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
from src.progress.performance_analyzer import PerformanceAnalyzer
from src.progress.project_tracker import ProjectTracker


class ProgressManager:
    """구축진척관리 시스템 진입점 — 프로젝트·역량·실적 통합 관리"""

    def __init__(self, data_dir: str = "data/progress"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.tracker = ProjectTracker()
        self.capacity_mgr = CapacityManager()
        self.perf_analyzer = PerformanceAnalyzer()

        self._projects: List[Project] = []
        self._constructors: List[Constructor] = []
        self._capacity_records: List[CapacityRecord] = []
        self._performance_metrics: List[PerformanceMetrics] = []

        self._load_data()

    # ─── 데이터 로드 / 저장 ──────────────────────────────────────

    def _load_data(self):
        for fname, loader, target in [
            ("projects.json", self._dict_to_project, "_projects"),
            ("constructors.json", self._dict_to_constructor, "_constructors"),
            ("capacity_records.json", self._dict_to_capacity, "_capacity_records"),
            ("performance_metrics.json", self._dict_to_performance, "_performance_metrics"),
        ]:
            path = os.path.join(self.data_dir, fname)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                setattr(self, target, [loader(d) for d in data])

    def _save(self, fname: str, items, serializer):
        path = os.path.join(self.data_dir, fname)
        with open(path, "w", encoding="utf-8") as f:
            json.dump([serializer(item) for item in items], f, ensure_ascii=False, indent=2)

    # ─── 프로젝트 관리 ───────────────────────────────────────────

    def add_project(self, project: Project) -> Project:
        self._projects.append(project)
        self._save("projects.json", self._projects, self._project_to_dict)
        return project

    def update_project_progress(
        self, project_id: str, progress_rate: float, notes: str = ""
    ) -> Optional[Project]:
        for p in self._projects:
            if p.id == project_id:
                p.progress_rate = min(max(progress_rate, 0.0), 100.0)
                if notes:
                    p.notes = notes
                if progress_rate >= 100.0:
                    p.status = ProjectStatus.COMPLETED
                    p.actual_end_date = datetime.now()
                elif p.is_delayed() and p.status == ProjectStatus.IN_PROGRESS:
                    p.status = ProjectStatus.DELAYED
                self._save("projects.json", self._projects, self._project_to_dict)
                return p
        return None

    def get_project(self, project_id: str) -> Optional[Project]:
        return next((p for p in self._projects if p.id == project_id), None)

    def list_projects(self) -> List[Project]:
        return list(self._projects)

    # ─── 구축자 / 역량 관리 ──────────────────────────────────────

    def add_constructor(self, constructor: Constructor) -> Constructor:
        self._constructors.append(constructor)
        self._save("constructors.json", self._constructors, self._constructor_to_dict)
        return constructor

    def add_capacity_record(self, record: CapacityRecord) -> CapacityRecord:
        self._capacity_records.append(record)
        self._save("capacity_records.json", self._capacity_records, self._capacity_to_dict)
        return record

    def list_constructors(self) -> List[Constructor]:
        return list(self._constructors)

    # ─── 실적 관리 ───────────────────────────────────────────────

    def add_performance_metrics(self, metrics: PerformanceMetrics) -> PerformanceMetrics:
        self._performance_metrics.append(metrics)
        self._save("performance_metrics.json", self._performance_metrics, self._performance_to_dict)
        return metrics

    # ─── 보고서 출력 ─────────────────────────────────────────────

    def print_progress_report(self, unit_names: Optional[Dict[str, str]] = None):
        names = unit_names or {p.unit_id: p.unit_id for p in self._projects}
        print(self.tracker.generate_progress_report(self._projects, names))

    def print_capacity_report(self):
        print(self.capacity_mgr.generate_capacity_report(
            self._constructors, self._capacity_records
        ))

    def print_performance_report(self):
        print(self.perf_analyzer.generate_performance_report(
            self._constructors, self._performance_metrics
        ))

    def print_full_report(self, unit_names: Optional[Dict[str, str]] = None):
        self.print_progress_report(unit_names)
        print()
        self.print_capacity_report()
        print()
        self.print_performance_report()

    # ─── 직렬화 헬퍼 ─────────────────────────────────────────────

    def _project_to_dict(self, p: Project) -> dict:
        return {
            "id": p.id,
            "name": p.name,
            "unit_id": p.unit_id,
            "phase": p.phase.value,
            "status": p.status.value,
            "start_date": p.start_date.isoformat(),
            "planned_end_date": p.planned_end_date.isoformat(),
            "actual_end_date": p.actual_end_date.isoformat() if p.actual_end_date else None,
            "progress_rate": p.progress_rate,
            "milestones": [
                {
                    "id": m.id,
                    "name": m.name,
                    "planned_date": m.planned_date.isoformat(),
                    "actual_date": m.actual_date.isoformat() if m.actual_date else None,
                    "status": m.status,
                }
                for m in p.milestones
            ],
            "assigned_constructors": p.assigned_constructors,
            "risks": p.risks,
            "notes": p.notes,
        }

    def _dict_to_project(self, d: dict) -> Project:
        phase_map = {ph.value: ph for ph in ProjectPhase}
        status_map = {st.value: st for st in ProjectStatus}
        milestones = [
            Milestone(
                id=m["id"],
                name=m["name"],
                planned_date=datetime.fromisoformat(m["planned_date"]),
                actual_date=datetime.fromisoformat(m["actual_date"]) if m.get("actual_date") else None,
                status=m.get("status", "pending"),
            )
            for m in d.get("milestones", [])
        ]
        return Project(
            id=d["id"],
            name=d["name"],
            unit_id=d["unit_id"],
            phase=phase_map.get(d["phase"], ProjectPhase.DEVELOPMENT),
            status=status_map.get(d["status"], ProjectStatus.IN_PROGRESS),
            start_date=datetime.fromisoformat(d["start_date"]),
            planned_end_date=datetime.fromisoformat(d["planned_end_date"]),
            actual_end_date=(
                datetime.fromisoformat(d["actual_end_date"]) if d.get("actual_end_date") else None
            ),
            progress_rate=d.get("progress_rate", 0.0),
            milestones=milestones,
            assigned_constructors=d.get("assigned_constructors", []),
            risks=d.get("risks", []),
            notes=d.get("notes", ""),
        )

    def _constructor_to_dict(self, c: Constructor) -> dict:
        return {
            "id": c.id,
            "name": c.name,
            "unit_id": c.unit_id,
            "role": c.role,
            "skill_level": c.skill_level.value,
            "max_capacity": c.max_capacity,
            "current_projects": c.current_projects,
        }

    def _dict_to_constructor(self, d: dict) -> Constructor:
        skill_map = {sk.value: sk for sk in SkillLevel}
        return Constructor(
            id=d["id"],
            name=d["name"],
            unit_id=d["unit_id"],
            role=d["role"],
            skill_level=skill_map.get(d["skill_level"], SkillLevel.MID),
            max_capacity=d.get("max_capacity", 100.0),
            current_projects=d.get("current_projects", []),
        )

    def _capacity_to_dict(self, r: CapacityRecord) -> dict:
        return {
            "constructor_id": r.constructor_id,
            "week_start": r.week_start.isoformat(),
            "allocated_capacity": r.allocated_capacity,
            "actual_used": r.actual_used,
            "projects": r.projects,
            "notes": r.notes,
        }

    def _dict_to_capacity(self, d: dict) -> CapacityRecord:
        return CapacityRecord(
            constructor_id=d["constructor_id"],
            week_start=datetime.fromisoformat(d["week_start"]),
            allocated_capacity=d["allocated_capacity"],
            actual_used=d["actual_used"],
            projects=d.get("projects", {}),
            notes=d.get("notes", ""),
        )

    def _performance_to_dict(self, m: PerformanceMetrics) -> dict:
        return {
            "constructor_id": m.constructor_id,
            "project_id": m.project_id,
            "period_start": m.period_start.isoformat(),
            "period_end": m.period_end.isoformat(),
            "planned_items": m.planned_items,
            "completed_items": m.completed_items,
            "quality_score": m.quality_score,
            "on_time_delivery": m.on_time_delivery,
            "bugs_introduced": m.bugs_introduced,
            "bugs_resolved": m.bugs_resolved,
            "notes": m.notes,
        }

    def _dict_to_performance(self, d: dict) -> PerformanceMetrics:
        return PerformanceMetrics(
            constructor_id=d["constructor_id"],
            project_id=d["project_id"],
            period_start=datetime.fromisoformat(d["period_start"]),
            period_end=datetime.fromisoformat(d["period_end"]),
            planned_items=d["planned_items"],
            completed_items=d["completed_items"],
            quality_score=d["quality_score"],
            on_time_delivery=d["on_time_delivery"],
            bugs_introduced=d.get("bugs_introduced", 0),
            bugs_resolved=d.get("bugs_resolved", 0),
            notes=d.get("notes", ""),
        )
