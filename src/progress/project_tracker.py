"""구축 프로젝트 진척관리 및 종합 분석"""

from datetime import datetime
from typing import Dict, List, Optional

from src.progress.models import Milestone, Project, ProjectPhase, ProjectStatus


class ProjectTracker:
    """프로젝트 진척 현황 추적 및 분석"""

    def get_progress_summary(self, projects: List[Project]) -> Dict:
        """전체 프로젝트 진척 요약"""
        total = len(projects)
        if total == 0:
            return {
                "total": 0,
                "by_status": {},
                "avg_progress": 0.0,
                "delayed_count": 0,
                "on_track_count": 0,
                "completion_rate": 0.0,
            }

        by_status: Dict[str, int] = {}
        total_progress = 0.0
        delayed_count = 0

        for p in projects:
            status = p.status.value
            by_status[status] = by_status.get(status, 0) + 1
            total_progress += p.progress_rate
            if p.is_delayed():
                delayed_count += 1

        return {
            "total": total,
            "by_status": by_status,
            "avg_progress": round(total_progress / total, 1),
            "delayed_count": delayed_count,
            "on_track_count": total - delayed_count,
            "completion_rate": round(by_status.get("완료", 0) / total * 100, 1),
        }

    def get_milestone_status(self, project: Project) -> Dict:
        """프로젝트 마일스톤 현황"""
        total = len(project.milestones)
        if total == 0:
            return {
                "total": 0,
                "completed": 0,
                "delayed": 0,
                "pending": 0,
                "completion_rate": 0.0,
                "next_milestone": None,
            }

        completed = sum(1 for m in project.milestones if m.status == "completed")
        delayed = sum(1 for m in project.milestones if m.is_delayed())
        pending = total - completed

        return {
            "total": total,
            "completed": completed,
            "delayed": delayed,
            "pending": pending,
            "completion_rate": round(completed / total * 100, 1),
            "next_milestone": self._get_next_milestone(project),
        }

    def _get_next_milestone(self, project: Project) -> Optional[Dict]:
        pending = [m for m in project.milestones if m.status != "completed"]
        if not pending:
            return None
        next_m = min(pending, key=lambda m: m.planned_date)
        days_left = (next_m.planned_date - datetime.now()).days
        return {
            "name": next_m.name,
            "planned_date": next_m.planned_date.strftime("%Y-%m-%d"),
            "days_left": days_left,
            "is_at_risk": days_left < 7,
        }

    def get_delayed_projects(self, projects: List[Project]) -> List[Dict]:
        """지연 프로젝트 목록 (지연 일수 내림차순)"""
        delayed = []
        for p in projects:
            if p.is_delayed():
                variance = p.schedule_variance()
                overdue_days = (datetime.now() - p.planned_end_date).days
                delayed.append({
                    "id": p.id,
                    "name": p.name,
                    "unit_id": p.unit_id,
                    "progress_rate": p.progress_rate,
                    "schedule_variance": variance,
                    "overdue_days": max(overdue_days, 0),
                    "phase": p.phase.value,
                })
        return sorted(delayed, key=lambda x: x["overdue_days"], reverse=True)

    def get_phase_distribution(self, projects: List[Project]) -> Dict[str, int]:
        """단계별 프로젝트 분포"""
        dist: Dict[str, int] = {}
        for p in projects:
            phase = p.phase.value
            dist[phase] = dist.get(phase, 0) + 1
        return dist

    def generate_progress_report(self, projects: List[Project], unit_names: Dict[str, str]) -> str:
        """진척 현황 보고서 생성"""
        lines = []
        lines.append("=" * 65)
        lines.append("  구축 프로젝트 진척관리 현황 보고서")
        lines.append(f"  생성일시: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append("=" * 65)

        if not projects:
            lines.append("\n  등록된 프로젝트가 없습니다.")
            lines.append("=" * 65)
            return "\n".join(lines)

        summary = self.get_progress_summary(projects)
        lines.append("\n[전체 현황]")
        lines.append(f"  총 프로젝트 수      : {summary['total']}건")
        lines.append(f"  평균 진척률         : {summary['avg_progress']:.1f}%")
        lines.append(f"  완료율              : {summary['completion_rate']:.1f}%")
        lines.append(f"  정상 진행 중        : {summary['on_track_count']}건")
        lines.append(f"  지연 프로젝트       : {summary['delayed_count']}건")

        by_status = summary["by_status"]
        if by_status:
            lines.append("\n[상태별 현황]")
            for status, count in by_status.items():
                lines.append(f"  {status:<12} : {count}건")

        lines.append("\n[프로젝트별 진척률]")
        for p in sorted(projects, key=lambda x: -x.progress_rate):
            unit_name = unit_names.get(p.unit_id, p.unit_id)
            filled = int(p.progress_rate / 10)
            bar = "█" * filled + "░" * (10 - filled)
            variance = p.schedule_variance()
            variance_str = f"+{variance:.1f}%" if variance >= 0 else f"{variance:.1f}%"
            delay_mark = " [지연]" if p.is_delayed() else ""
            lines.append(
                f"  {p.name:<20} {bar} {p.progress_rate:.0f}%"
                f"  편차:{variance_str}{delay_mark}"
            )

        delayed = self.get_delayed_projects(projects)
        if delayed:
            lines.append(f"\n[지연 프로젝트 상세]")
            for d in delayed:
                lines.append(
                    f"  - {d['name']}: {d['phase']} 단계,"
                    f" 진척률 {d['progress_rate']:.0f}%,"
                    f" 편차 {d['schedule_variance']:.1f}%,"
                    f" 초과 {d['overdue_days']}일"
                )

        phase_dist = self.get_phase_distribution(projects)
        if phase_dist:
            lines.append("\n[단계별 분포]")
            for phase, count in phase_dist.items():
                lines.append(f"  {phase:<10} : {count}건")

        lines.append("=" * 65)
        return "\n".join(lines)
