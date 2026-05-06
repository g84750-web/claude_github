"""핵심 인사이트 분석기 - 유닛별 보고서 핵심 지표 분석"""

import re
from typing import Dict, List, Optional, Tuple

import yaml

from src.models import InsightItem, Report, ReportContent, ReviewScore


class InsightAnalyzer:
    """보고서 핵심 인사이트 분석 및 품질 평가"""

    def __init__(self, units_config_path: str, schedule_config_path: str):
        with open(units_config_path, "r", encoding="utf-8") as f:
            units_cfg = yaml.safe_load(f)
        with open(schedule_config_path, "r", encoding="utf-8") as f:
            schedule_cfg = yaml.safe_load(f)

        self.units = {u["id"]: u for u in units_cfg["units"]}
        self.criteria = schedule_cfg.get("review_criteria", {})

    def analyze_completeness(self, report: Report) -> Tuple[float, List[str]]:
        """필수 항목 작성 완성도 분석"""
        unit_cfg = self.units.get(report.unit_id, {})
        items_key = "weekly_items" if report.report_type.value == "weekly" else "monthly_items"
        required_items = unit_cfg.get(items_key, [])

        if not required_items:
            return 100.0, []

        missing = []
        filled = 0
        for item in required_items:
            value = report.content.items.get(item, "").strip()
            if value:
                filled += 1
            else:
                missing.append(item)

        score = (filled / len(required_items)) * 100
        return score, missing

    def analyze_insight_quality(self, report: Report) -> Tuple[float, List[str]]:
        """핵심 인사이트 수치 포함 여부 및 품질 분석"""
        unit_cfg = self.units.get(report.unit_id, {})
        expected_insights = unit_cfg.get("key_insights", [])

        if not expected_insights:
            return 100.0, []

        issues = []
        score_parts = []

        for insight in report.content.insights:
            if insight.has_numeric_value():
                score_parts.append(100.0)
            else:
                score_parts.append(50.0)
                issues.append(f"'{insight.metric}' 항목에 수치가 없습니다.")

            if insight.target is None:
                issues.append(f"'{insight.metric}' 항목에 목표값이 없습니다.")

        # 기대 인사이트 대비 실제 작성 비율
        coverage_ratio = len(report.content.insights) / len(expected_insights) if expected_insights else 1.0
        coverage_score = min(coverage_ratio * 100, 100.0)

        if len(report.content.insights) < len(expected_insights):
            missing_count = len(expected_insights) - len(report.content.insights)
            issues.append(f"핵심 인사이트 {missing_count}개 항목이 누락되었습니다.")

        quality_score = sum(score_parts) / len(score_parts) if score_parts else 0.0
        final_score = (coverage_score * 0.5) + (quality_score * 0.5)
        return final_score, issues

    def analyze_action_items(self, report: Report) -> Tuple[float, List[str]]:
        """실행 계획 및 다음 단계 분석"""
        issues = []
        score = 100.0

        if not report.content.action_items:
            issues.append("실행 계획(Action Items)이 없습니다.")
            score -= 40.0

        if not report.content.next_period_plan.strip():
            issues.append("차기 계획이 작성되지 않았습니다.")
            score -= 30.0

        if len(report.content.action_items) < 2:
            issues.append("실행 계획이 너무 적습니다. 최소 2개 이상 권장합니다.")
            score -= 15.0

        return max(score, 0.0), issues

    def analyze_timeliness(self, report: Report) -> Tuple[float, List[str]]:
        """제출 기한 준수 여부 분석"""
        issues = []

        if not report.submitted_at or not report.deadline:
            return 100.0, []

        if report.submitted_at <= report.deadline:
            return 100.0, []

        # 지각 시 시간당 감점
        hours_late = (report.submitted_at - report.deadline).total_seconds() / 3600
        penalty_per_hour = self.criteria.get("timeliness", {}).get("late_penalty_per_hour", 5)
        score = max(100.0 - (hours_late * penalty_per_hour), 0.0)
        issues.append(f"마감 {hours_late:.1f}시간 후 제출 (감점: {100-score:.0f}점)")
        return score, issues

    def compute_total_score(self, completeness: float, insight_quality: float,
                            action_items: float, timeliness: float) -> float:
        """가중치 적용 총점 계산"""
        w_comp = self.criteria.get("completeness", {}).get("weight", 30) / 100
        w_ins = self.criteria.get("insight_quality", {}).get("weight", 30) / 100
        w_act = self.criteria.get("action_items", {}).get("weight", 20) / 100
        w_time = self.criteria.get("timeliness", {}).get("weight", 20) / 100

        total = (completeness * w_comp +
                 insight_quality * w_ins +
                 action_items * w_act +
                 timeliness * w_time)
        return round(total, 1)

    def analyze(self, report: Report) -> ReviewScore:
        """보고서 종합 분석"""
        comp_score, comp_issues = self.analyze_completeness(report)
        ins_score, ins_issues = self.analyze_insight_quality(report)
        act_score, act_issues = self.analyze_action_items(report)
        time_score, time_issues = self.analyze_timeliness(report)
        total = self.compute_total_score(comp_score, ins_score, act_score, time_score)

        details = {}
        if comp_issues:
            details["completeness_issues"] = "; ".join(comp_issues)
        if ins_issues:
            details["insight_issues"] = "; ".join(ins_issues)
        if act_issues:
            details["action_issues"] = "; ".join(act_issues)
        if time_issues:
            details["timeliness_issues"] = "; ".join(time_issues)

        return ReviewScore(
            completeness=round(comp_score, 1),
            insight_quality=round(ins_score, 1),
            action_items=round(act_score, 1),
            timeliness=round(time_score, 1),
            total=total,
            details=details,
        )

    def extract_key_metrics(self, report: Report) -> Dict[str, str]:
        """보고서에서 핵심 수치 지표 추출"""
        metrics = {}
        for insight in report.content.insights:
            metrics[insight.metric] = insight.value

        # 텍스트 항목에서 수치 패턴 추출
        number_pattern = re.compile(r"(\d+(?:\.\d+)?)\s*%")
        for key, value in report.content.items.items():
            numbers = number_pattern.findall(value)
            if numbers:
                metrics[f"{key}_수치"] = f"{numbers[0]}%"

        return metrics

    def compare_with_previous(self, current: Report,
                               previous: Optional[Report]) -> List[str]:
        """이전 보고서 대비 변화 분석"""
        if not previous:
            return ["이전 보고서가 없어 비교할 수 없습니다."]

        observations = []
        curr_metrics = self.extract_key_metrics(current)
        prev_metrics = self.extract_key_metrics(previous)

        for metric, curr_val in curr_metrics.items():
            if metric in prev_metrics:
                try:
                    curr_num = float(curr_val.replace("%", "").replace(",", ""))
                    prev_num = float(prev_metrics[metric].replace("%", "").replace(",", ""))
                    diff = curr_num - prev_num
                    if abs(diff) >= 5:
                        direction = "상승" if diff > 0 else "하락"
                        observations.append(
                            f"[{metric}] {prev_num:.1f} → {curr_num:.1f} ({direction} {abs(diff):.1f})"
                        )
                except ValueError:
                    pass

        return observations if observations else ["전기 대비 주요 변화 없음"]
