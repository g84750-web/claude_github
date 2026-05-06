"""구축자 역량(Capacity) 관리"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from src.progress.models import CapacityRecord, Constructor


class CapacityManager:
    """구축자 capa 분석 및 배정 관리"""

    OVERLOAD_THRESHOLD = 90.0
    UNDERUTIL_THRESHOLD = 60.0

    def get_team_capacity_summary(
        self,
        constructors: List[Constructor],
        records: List[CapacityRecord],
        week_start: Optional[datetime] = None,
    ) -> Dict:
        """팀 전체 역량 현황 요약"""
        week_start = week_start or self._current_week_start()
        week_records = [r for r in records if r.week_start.date() == week_start.date()]

        total_max = sum(c.max_capacity for c in constructors)
        total_allocated = sum(r.allocated_capacity for r in week_records)
        total_actual = sum(r.actual_used for r in week_records)

        overloaded_count = sum(1 for r in week_records if r.is_overloaded)

        return {
            "week_start": week_start.strftime("%Y-%m-%d"),
            "total_constructors": len(constructors),
            "total_max_capacity": total_max,
            "total_allocated": total_allocated,
            "total_actual_used": total_actual,
            "team_utilization": round(total_actual / total_max * 100, 1) if total_max > 0 else 0.0,
            "overloaded_count": overloaded_count,
            "available_capacity": round(total_max - total_allocated, 1),
        }

    def get_constructor_workload(
        self,
        constructor: Constructor,
        records: List[CapacityRecord],
        last_n_weeks: int = 4,
    ) -> List[Dict]:
        """구축자별 최근 N주 업무 부하 추이"""
        now = datetime.now()
        result = []
        for i in range(last_n_weeks, 0, -1):
            week_start = self._week_start(now - timedelta(weeks=i - 1))
            record = next(
                (r for r in records
                 if r.constructor_id == constructor.id
                 and r.week_start.date() == week_start.date()),
                None,
            )
            week_label = week_start.strftime("%m/%d")
            if record:
                result.append({
                    "week": week_label,
                    "allocated": record.allocated_capacity,
                    "actual": record.actual_used,
                    "utilization": record.utilization_rate,
                    "overloaded": record.is_overloaded,
                    "available": record.available_capacity,
                    "projects": record.projects,
                })
            else:
                result.append({
                    "week": week_label,
                    "allocated": 0.0,
                    "actual": 0.0,
                    "utilization": 0.0,
                    "overloaded": False,
                    "available": constructor.max_capacity,
                    "projects": {},
                })
        return result

    def get_overloaded_constructors(
        self,
        constructors: List[Constructor],
        records: List[CapacityRecord],
        week_start: Optional[datetime] = None,
    ) -> List[Dict]:
        """과부하 구축자 목록"""
        week_start = week_start or self._current_week_start()
        week_records = {r.constructor_id: r for r in records
                        if r.week_start.date() == week_start.date()}
        result = []
        for c in constructors:
            rec = week_records.get(c.id)
            if rec and rec.is_overloaded:
                result.append({
                    "constructor_id": c.id,
                    "name": c.name,
                    "allocated": rec.allocated_capacity,
                    "excess": round(rec.allocated_capacity - 100.0, 1),
                    "projects": list(rec.projects.keys()),
                })
        return result

    def suggest_rebalancing(
        self,
        constructors: List[Constructor],
        records: List[CapacityRecord],
        week_start: Optional[datetime] = None,
    ) -> List[str]:
        """부하 재분배 권고안 생성"""
        week_start = week_start or self._current_week_start()
        week_records = {r.constructor_id: r for r in records
                        if r.week_start.date() == week_start.date()}

        overloaded = []
        underutilized = []

        for c in constructors:
            rec = week_records.get(c.id)
            if rec:
                if rec.allocated_capacity > self.OVERLOAD_THRESHOLD:
                    overloaded.append((c, rec))
                elif rec.allocated_capacity < self.UNDERUTIL_THRESHOLD:
                    underutilized.append((c, rec))

        suggestions = []
        for oc, orec in overloaded:
            if orec.allocated_capacity > 100.0:
                excess = round(orec.allocated_capacity - 100.0, 1)
                label = f"[과부하] {oc.name}: 현재 {orec.allocated_capacity:.0f}% 배정 (초과 +{excess}%) → 즉시 재분배 필요"
            else:
                label = f"[주의] {oc.name}: 현재 {orec.allocated_capacity:.0f}% 배정 (한계 근접) → 추가 배정 주의"
            suggestions.append(label)

        for uc, urec in underutilized:
            avail = round(100.0 - urec.allocated_capacity, 1)
            suggestions.append(
                f"[여유] {uc.name}: 현재 {urec.allocated_capacity:.0f}% 배정"
                f" (여유 {avail}%) → 추가 업무 배정 가능"
            )

        if overloaded and underutilized:
            for oc, _ in overloaded:
                for uc, _ in underutilized:
                    suggestions.append(
                        f"  → {oc.name}의 업무 일부를 {uc.name}에게 이관 검토"
                    )

        if not suggestions:
            suggestions.append("현재 팀 역량 배분이 적정 수준입니다.")

        return suggestions

    def generate_capacity_report(
        self,
        constructors: List[Constructor],
        records: List[CapacityRecord],
    ) -> str:
        """역량 현황 보고서 생성"""
        lines = []
        lines.append("=" * 65)
        lines.append("  구축자 역량(Capacity) 현황 보고서")
        lines.append(f"  생성일시: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append("=" * 65)

        if not constructors:
            lines.append("\n  등록된 구축자가 없습니다.")
            lines.append("=" * 65)
            return "\n".join(lines)

        summary = self.get_team_capacity_summary(constructors, records)
        lines.append(f"\n[팀 역량 현황 ({summary['week_start']} 주간)]")
        lines.append(f"  총 구축자 수        : {summary['total_constructors']}명")
        lines.append(f"  팀 전체 가용 역량   : {summary['total_max_capacity']:.0f}%")
        lines.append(f"  현재 배정 역량      : {summary['total_allocated']:.0f}%")
        lines.append(f"  팀 활용률           : {summary['team_utilization']:.1f}%")
        lines.append(f"  잔여 가용 역량      : {summary['available_capacity']:.0f}%")
        lines.append(f"  과부하 인원         : {summary['overloaded_count']}명")

        week_start = self._current_week_start()
        week_records = {r.constructor_id: r for r in records
                        if r.week_start.date() == week_start.date()}

        lines.append("\n[구축자별 역량 현황]")
        lines.append(f"  {'이름':<12} {'역할':<10} {'배정(%)':<10} {'실사용(%)':<10} {'상태'}")
        lines.append("  " + "-" * 55)

        sorted_constructors = sorted(
            constructors,
            key=lambda c: -(week_records[c.id].allocated_capacity if c.id in week_records else 0.0),
        )
        for c in sorted_constructors:
            rec = week_records.get(c.id)
            alloc = rec.allocated_capacity if rec else 0.0
            actual = rec.actual_used if rec else 0.0
            if rec and rec.is_overloaded:
                status = "⚠ 과부하"
            elif alloc < self.UNDERUTIL_THRESHOLD:
                status = "○ 여유"
            else:
                status = "✔ 정상"
            lines.append(f"  {c.name:<12} {c.role:<10} {alloc:<10.0f} {actual:<10.0f} {status}")

        suggestions = self.suggest_rebalancing(constructors, records)
        lines.append("\n[역량 재분배 권고]")
        for s in suggestions:
            lines.append(f"  {s}")

        lines.append("=" * 65)
        return "\n".join(lines)

    @staticmethod
    def _current_week_start() -> datetime:
        return CapacityManager._week_start(datetime.now())

    @staticmethod
    def _week_start(dt: datetime) -> datetime:
        return (dt - timedelta(days=dt.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
