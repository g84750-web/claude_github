"""보고서 제출 현황 통계 및 트렌드 분석"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from src.models import FeedbackAction, Report, ReportStatus, ReportType


class TrendAnalyzer:
    """유닛별·기간별 보고 현황 통계 및 트렌드 분석"""

    def submission_rate(self, reports: List[Report],
                        total_units: int,
                        report_type: ReportType) -> float:
        """특정 보고 유형의 제출률 계산 (%)"""
        submitted = sum(
            1 for r in reports
            if r.report_type == report_type
            and r.status != ReportStatus.DRAFT
        )
        if total_units == 0:
            return 0.0
        return round((submitted / total_units) * 100, 1)

    def on_time_rate(self, reports: List[Report]) -> float:
        """기한 내 제출률 계산 (%)"""
        with_deadline = [r for r in reports if r.submitted_at and r.deadline]
        if not with_deadline:
            return 0.0
        on_time = sum(1 for r in with_deadline if r.submitted_at <= r.deadline)
        return round((on_time / len(with_deadline)) * 100, 1)

    def avg_score_by_unit(self, feedbacks: List) -> Dict[str, float]:
        """유닛별 평균 점수 계산"""
        scores_by_unit: Dict[str, List[float]] = defaultdict(list)
        for fb in feedbacks:
            scores_by_unit[fb.unit_id].append(fb.score.total)
        return {
            unit_id: round(sum(scores) / len(scores), 1)
            for unit_id, scores in scores_by_unit.items()
        }

    def score_trend(self, feedbacks: List, unit_id: str, last_n: int = 4) -> List[Dict]:
        """특정 유닛의 최근 N회 점수 추이"""
        unit_feedbacks = sorted(
            [fb for fb in feedbacks if fb.unit_id == unit_id],
            key=lambda fb: fb.created_at,
        )[-last_n:]
        return [
            {
                "date": fb.created_at.strftime("%Y-%m-%d"),
                "score": fb.score.total,
                "action": fb.action.value,
            }
            for fb in unit_feedbacks
        ]

    def approval_rate(self, feedbacks: List) -> float:
        """승인률 계산 (%)"""
        if not feedbacks:
            return 0.0
        approved = sum(
            1 for fb in feedbacks
            if fb.action in (FeedbackAction.APPROVED,
                             FeedbackAction.APPROVED_WITH_RECOMMENDATION)
        )
        return round((approved / len(feedbacks)) * 100, 1)

    def weekly_submission_calendar(self, reports: List[Report],
                                   weeks: int = 4) -> Dict[str, Dict[str, str]]:
        """최근 N주 유닛별 제출 캘린더 생성"""
        now = datetime.now()
        calendar: Dict[str, Dict[str, str]] = {}

        for i in range(weeks, 0, -1):
            week_end = now - timedelta(weeks=i - 1)
            week_label = f"W{weeks - i + 1} ({week_end.strftime('%m/%d')}주)"
            calendar[week_label] = {}

        unit_ids = list({r.unit_id for r in reports})
        for unit_id in unit_ids:
            unit_reports = [r for r in reports if r.unit_id == unit_id
                            and r.report_type == ReportType.WEEKLY]
            for week_label in calendar:
                calendar[week_label][unit_id] = "미제출"

            for report in unit_reports:
                if report.submitted_at:
                    for j, week_label in enumerate(calendar.keys()):
                        week_end = now - timedelta(weeks=weeks - j - 1)
                        week_start = week_end - timedelta(days=7)
                        if week_start <= report.submitted_at <= week_end:
                            status = "제출완료" if report.status != ReportStatus.DRAFT else "초안"
                            calendar[week_label][unit_id] = status

        return calendar

    def generate_summary_report(self, reports: List[Report],
                                 feedbacks: List,
                                 unit_names: Dict[str, str]) -> str:
        """전체 현황 요약 보고서 텍스트 생성"""
        lines = []
        lines.append("=" * 60)
        lines.append("  PKG 사업본부(구축) 업무보고 현황 요약")
        lines.append(f"  생성일시: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append("=" * 60)

        # 제출 현황
        total_units = len(unit_names)
        weekly_rate = self.submission_rate(reports, total_units, ReportType.WEEKLY)
        monthly_rate = self.submission_rate(reports, total_units, ReportType.MONTHLY)
        on_time = self.on_time_rate(reports)
        approve_rate = self.approval_rate(feedbacks)

        lines.append("\n[전체 현황]")
        lines.append(f"  주간보고 제출률    : {weekly_rate:.1f}%")
        lines.append(f"  월간보고 제출률    : {monthly_rate:.1f}%")
        lines.append(f"  기한 내 제출률     : {on_time:.1f}%")
        lines.append(f"  보고서 승인률      : {approve_rate:.1f}%")

        # 유닛별 평균 점수
        avg_scores = self.avg_score_by_unit(feedbacks)
        if avg_scores:
            lines.append("\n[유닛별 평균 점수]")
            for unit_id, score in sorted(avg_scores.items(), key=lambda x: -x[1]):
                unit_name = unit_names.get(unit_id, unit_id)
                bar = "█" * int(score / 10) + "░" * (10 - int(score / 10))
                lines.append(f"  {unit_name:<20} {bar} {score:.1f}점")

        lines.append("=" * 60)
        return "\n".join(lines)
