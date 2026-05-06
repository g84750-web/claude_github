"""자동화 피드백 생성기 - 분석 결과 기반 피드백 생성"""

import yaml
from datetime import datetime
from typing import List, Optional

from src.models import (
    Feedback, FeedbackAction, Report, ReviewScore
)
from src.insights.insight_analyzer import InsightAnalyzer


class FeedbackGenerator:
    """보고서 검토 결과 기반 자동 피드백 생성"""

    def __init__(self, schedule_config_path: str, units_config_path: str):
        with open(schedule_config_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        self.feedback_rules = cfg.get("feedback_rules", {})
        self.score_ranges = self.feedback_rules.get("score_ranges", {})

        with open(units_config_path, "r", encoding="utf-8") as f:
            units_cfg = yaml.safe_load(f)
        self.units = {u["id"]: u for u in units_cfg["units"]}
        self.analyzer = InsightAnalyzer(units_config_path, schedule_config_path)

    def determine_action(self, total_score: float) -> FeedbackAction:
        """점수에 따른 조치 결정"""
        for range_name, r in self.score_ranges.items():
            if r["min"] <= total_score <= r["max"]:
                action_str = r.get("action", "승인")
                action_map = {
                    "승인": FeedbackAction.APPROVED,
                    "승인_보완권고": FeedbackAction.APPROVED_WITH_RECOMMENDATION,
                    "보완요청": FeedbackAction.REVISION_REQUESTED,
                    "재제출요청": FeedbackAction.RESUBMISSION_REQUESTED,
                }
                return action_map.get(action_str, FeedbackAction.APPROVED)
        return FeedbackAction.APPROVED

    def generate_strengths(self, report: Report, score: ReviewScore) -> List[str]:
        """우수 항목 분석"""
        strengths = []
        unit_name = self.units.get(report.unit_id, {}).get("name", report.unit_id)

        if score.completeness >= 90:
            strengths.append(f"보고서 필수 항목 작성이 충실합니다. (완성도: {score.completeness:.0f}점)")
        if score.insight_quality >= 85:
            strengths.append(f"핵심 인사이트 수치 지표가 명확하게 기재되어 있습니다. (인사이트 품질: {score.insight_quality:.0f}점)")
        if score.action_items >= 80:
            strengths.append(f"실행 계획이 구체적으로 작성되어 있습니다. (실행계획: {score.action_items:.0f}점)")
        if score.timeliness >= 95:
            strengths.append("기한 내 적시에 제출되었습니다.")
        if len(report.content.risks) >= 2:
            strengths.append(f"리스크 {len(report.content.risks)}건을 사전에 식별하고 보고하였습니다.")
        if len(report.content.action_items) >= 3:
            strengths.append(f"실행 계획 {len(report.content.action_items)}건을 구체적으로 제시하였습니다.")

        return strengths if strengths else ["전반적으로 기준에 부합하는 보고서입니다."]

    def generate_improvements(self, report: Report, score: ReviewScore) -> List[str]:
        """개선 권고 사항 생성"""
        improvements = []

        if score.completeness < 80:
            missing_items = score.details.get("completeness_issues", "")
            if missing_items:
                improvements.append(f"누락 항목 보완 필요: {missing_items}")
            else:
                improvements.append("보고서 필수 항목 작성률을 80% 이상으로 개선하시기 바랍니다.")

        if score.insight_quality < 75:
            ins_issues = score.details.get("insight_issues", "")
            if ins_issues:
                improvements.append(f"인사이트 품질 개선: {ins_issues}")
            improvements.append("각 핵심 지표에 수치(%, 건수, 금액 등)와 목표값을 함께 기재해 주세요.")

        if score.action_items < 70:
            act_issues = score.details.get("action_issues", "")
            if act_issues:
                improvements.append(f"실행 계획 보완: {act_issues}")

        if score.timeliness < 100:
            time_issues = score.details.get("timeliness_issues", "")
            if time_issues:
                improvements.append(f"제출 일정 관리: {time_issues}")

        if not report.content.next_period_plan.strip():
            improvements.append("차기 기간 계획을 구체적으로 작성해 주세요.")

        return improvements

    def generate_required_revisions(self, report: Report, score: ReviewScore,
                                    action: FeedbackAction) -> List[str]:
        """필수 수정 사항 (보완요청/재제출요청 시)"""
        if action == FeedbackAction.APPROVED:
            return []

        revisions = []

        if score.completeness < 60:
            revisions.append("필수 보고 항목을 모두 작성하여 재제출하시기 바랍니다.")

        if score.insight_quality < 50:
            unit_cfg = self.units.get(report.unit_id, {})
            required = unit_cfg.get("key_insights", [])
            revisions.append(
                f"다음 핵심 인사이트 항목을 수치 포함하여 작성해 주세요: {', '.join(required[:3])}"
            )

        if score.action_items < 50:
            revisions.append("실행 계획(Action Items) 최소 2건 이상 구체적으로 기술해 주세요.")

        if action == FeedbackAction.RESUBMISSION_REQUESTED:
            revisions.append("위 사항을 모두 반영하여 48시간 내 재제출 바랍니다.")
        elif action == FeedbackAction.REVISION_REQUESTED:
            revisions.append("보완 사항을 반영하여 24시간 내 수정 제출 바랍니다.")

        return revisions

    def generate_summary(self, report: Report, score: ReviewScore,
                         action: FeedbackAction) -> str:
        """피드백 요약문 생성"""
        unit_name = self.units.get(report.unit_id, {}).get("name", report.unit_id)
        period_str = f"{report.content.period_start.strftime('%Y.%m.%d')}~{report.content.period_end.strftime('%Y.%m.%d')}"
        report_type_str = "주간" if report.report_type.value == "weekly" else "월간"

        label_map = {
            "excellent": "우수",
            "good": "양호",
            "needs_improvement": "보완필요",
            "insufficient": "미흡",
        }
        grade = "미흡"
        for range_name, r in self.score_ranges.items():
            if r["min"] <= score.total <= r["max"]:
                grade = label_map.get(range_name, r.get("label", ""))
                break

        action_desc = {
            FeedbackAction.APPROVED: "승인되었습니다",
            FeedbackAction.APPROVED_WITH_RECOMMENDATION: "승인되었습니다 (보완 사항 권고)",
            FeedbackAction.REVISION_REQUESTED: "보완 후 재제출 바랍니다",
            FeedbackAction.RESUBMISSION_REQUESTED: "전면 재제출 바랍니다",
        }

        summary = (
            f"[{unit_name}] {period_str} {report_type_str}보고서 검토 결과입니다.\n"
            f"종합 점수: {score.total:.1f}점 ({grade}) | "
            f"완성도: {score.completeness:.0f}점 | "
            f"인사이트: {score.insight_quality:.0f}점 | "
            f"실행계획: {score.action_items:.0f}점 | "
            f"적시성: {score.timeliness:.0f}점\n"
            f"검토 결과: {action_desc.get(action, '승인')}"
        )
        return summary

    def generate(self, report: Report,
                 previous_report: Optional[Report] = None) -> Feedback:
        """보고서 자동 피드백 생성"""
        score = self.analyzer.analyze(report)
        action = self.determine_action(score.total)

        # 이전 보고서 대비 변화 관찰
        observations = self.analyzer.compare_with_previous(report, previous_report)

        strengths = self.generate_strengths(report, score)
        improvements = self.generate_improvements(report, score)
        required_revisions = self.generate_required_revisions(report, score, action)
        summary = self.generate_summary(report, score, action)

        # 변화 관찰 내용을 개선 사항에 추가
        if observations and observations[0] != "이전 보고서가 없어 비교할 수 없습니다.":
            improvements.extend([f"[추이 분석] {obs}" for obs in observations])

        return Feedback(
            report_id=report.id,
            unit_id=report.unit_id,
            score=score,
            action=action,
            summary=summary,
            strengths=strengths,
            improvements=improvements,
            required_revisions=required_revisions,
            created_at=datetime.now(),
        )
