"""구축자 실적 분석 및 생산성 향상 모듈"""

from datetime import datetime
from typing import Dict, List

from src.progress.models import Constructor, PerformanceMetrics


class PerformanceAnalyzer:
    """실적 분석 및 생산성 향상 인사이트 도출"""

    PRODUCTIVITY_EXCELLENT = 85.0
    PRODUCTIVITY_GOOD = 70.0
    PRODUCTIVITY_WARNING = 55.0

    def get_individual_performance(
        self,
        constructor_id: str,
        metrics: List[PerformanceMetrics],
    ) -> Dict:
        """개인 실적 요약"""
        personal = [m for m in metrics if m.constructor_id == constructor_id]
        if not personal:
            return {"constructor_id": constructor_id, "total_records": 0}

        avg_completion = sum(m.completion_rate for m in personal) / len(personal)
        avg_quality = sum(m.quality_score for m in personal) / len(personal)
        avg_on_time = sum(m.on_time_delivery for m in personal) / len(personal)
        avg_productivity = sum(m.productivity_score for m in personal) / len(personal)
        total_bugs = sum(m.bugs_introduced for m in personal)
        resolved_bugs = sum(m.bugs_resolved for m in personal)

        return {
            "constructor_id": constructor_id,
            "total_records": len(personal),
            "avg_completion_rate": round(avg_completion, 1),
            "avg_quality_score": round(avg_quality, 1),
            "avg_on_time_delivery": round(avg_on_time, 1),
            "avg_productivity_score": round(avg_productivity, 1),
            "total_bugs_introduced": total_bugs,
            "total_bugs_resolved": resolved_bugs,
            "bug_resolution_rate": (
                round(resolved_bugs / total_bugs * 100, 1) if total_bugs > 0 else 100.0
            ),
            "performance_grade": self._grade(avg_productivity),
        }

    def get_team_performance(
        self,
        constructors: List[Constructor],
        metrics: List[PerformanceMetrics],
    ) -> Dict:
        """팀 전체 실적 요약"""
        if not metrics:
            return {
                "total_constructors": len(constructors),
                "total_metrics": 0,
                "avg_productivity": 0.0,
                "avg_completion": 0.0,
                "avg_quality": 0.0,
                "excellent_count": 0,
                "warning_count": 0,
            }

        all_productivity = [m.productivity_score for m in metrics]
        all_completion = [m.completion_rate for m in metrics]
        all_quality = [m.quality_score for m in metrics]
        n = len(metrics)

        return {
            "total_constructors": len(constructors),
            "total_metrics": n,
            "avg_productivity": round(sum(all_productivity) / n, 1),
            "avg_completion": round(sum(all_completion) / n, 1),
            "avg_quality": round(sum(all_quality) / n, 1),
            "excellent_count": sum(1 for p in all_productivity if p >= self.PRODUCTIVITY_EXCELLENT),
            "warning_count": sum(1 for p in all_productivity if p < self.PRODUCTIVITY_WARNING),
        }

    def get_productivity_trend(
        self,
        constructor_id: str,
        metrics: List[PerformanceMetrics],
        last_n: int = 6,
    ) -> List[Dict]:
        """개인 생산성 추이 (최근 N건)"""
        personal = sorted(
            [m for m in metrics if m.constructor_id == constructor_id],
            key=lambda m: m.period_start,
        )[-last_n:]
        return [
            {
                "period": m.period_start.strftime("%Y-%m"),
                "productivity": m.productivity_score,
                "completion": m.completion_rate,
                "quality": m.quality_score,
                "on_time": m.on_time_delivery,
            }
            for m in personal
        ]

    def get_improvement_suggestions(
        self,
        constructor: Constructor,
        metrics: List[PerformanceMetrics],
    ) -> List[str]:
        """개인별 생산성 향상 제안"""
        perf = self.get_individual_performance(constructor.id, metrics)
        if perf.get("total_records", 0) == 0:
            return ["실적 데이터가 없습니다. 실적을 입력해주세요."]

        suggestions = []
        avg_completion = perf["avg_completion_rate"]
        avg_quality = perf["avg_quality_score"]
        avg_on_time = perf["avg_on_time_delivery"]
        bug_res_rate = perf["bug_resolution_rate"]

        if avg_completion < 70:
            suggestions.append(
                f"완료율({avg_completion:.1f}%) 개선: 작업 분할(Task Breakdown)로 가시성 확보"
            )
        if avg_quality < 70:
            suggestions.append(
                f"품질 점수({avg_quality:.1f}점) 개선: 코드 리뷰·단위 테스트 강화"
            )
        if avg_on_time < 75:
            suggestions.append(
                f"납기 준수율({avg_on_time:.1f}%) 개선: 일별 진척 체크 및 조기 이슈 보고"
            )
        if bug_res_rate < 80:
            suggestions.append(
                f"버그 해결율({bug_res_rate:.1f}%) 개선: 근본 원인 분석(RCA) 적용"
            )

        if not suggestions:
            suggestions.append(
                f"우수한 실적 유지 중 (생산성: {perf['avg_productivity_score']:.1f}점). 현 방식 지속 권장"
            )

        return suggestions

    def generate_performance_report(
        self,
        constructors: List[Constructor],
        metrics: List[PerformanceMetrics],
    ) -> str:
        """실적 분석 보고서 생성"""
        lines = []
        lines.append("=" * 65)
        lines.append("  구축자 실적 분석 및 생산성 향상 보고서")
        lines.append(f"  생성일시: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append("=" * 65)

        if not constructors:
            lines.append("\n  등록된 구축자가 없습니다.")
            lines.append("=" * 65)
            return "\n".join(lines)

        team_perf = self.get_team_performance(constructors, metrics)
        lines.append("\n[팀 전체 실적 현황]")
        lines.append(f"  총 구축자 수        : {team_perf['total_constructors']}명")
        lines.append(f"  분석 실적 건수      : {team_perf['total_metrics']}건")
        lines.append(f"  팀 평균 생산성      : {team_perf['avg_productivity']:.1f}점")
        lines.append(f"  팀 평균 완료율      : {team_perf['avg_completion']:.1f}%")
        lines.append(f"  팀 평균 품질 점수   : {team_perf['avg_quality']:.1f}점")
        lines.append(f"  우수 인원 (85점↑)  : {team_perf['excellent_count']}명")
        lines.append(f"  주의 인원 (55점↓)  : {team_perf['warning_count']}명")

        lines.append("\n[구축자별 실적]")
        lines.append(f"  {'이름':<12} {'완료율':<8} {'품질':<8} {'납기준수':<10} {'생산성':<10} {'등급'}")
        lines.append("  " + "-" * 58)
        for c in constructors:
            perf = self.get_individual_performance(c.id, metrics)
            if perf.get("total_records", 0) == 0:
                lines.append(f"  {c.name:<12} {'(데이터 없음)'}")
                continue
            lines.append(
                f"  {c.name:<12}"
                f" {perf['avg_completion_rate']:<8.1f}"
                f" {perf['avg_quality_score']:<8.1f}"
                f" {perf['avg_on_time_delivery']:<10.1f}"
                f" {perf['avg_productivity_score']:<10.1f}"
                f" {perf['performance_grade']}"
            )

        lines.append("\n[생산성 향상 제안]")
        for c in constructors:
            suggestions = self.get_improvement_suggestions(c, metrics)
            lines.append(f"\n  [{c.name}]")
            for s in suggestions:
                lines.append(f"    • {s}")

        lines.append("=" * 65)
        return "\n".join(lines)

    def _grade(self, productivity_score: float) -> str:
        if productivity_score >= self.PRODUCTIVITY_EXCELLENT:
            return "A (우수)"
        elif productivity_score >= self.PRODUCTIVITY_GOOD:
            return "B (양호)"
        elif productivity_score >= self.PRODUCTIVITY_WARNING:
            return "C (보통)"
        return "D (주의)"
