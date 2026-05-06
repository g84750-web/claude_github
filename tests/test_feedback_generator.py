"""자동 피드백 생성기 단위 테스트"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest

from src.feedback.feedback_generator import FeedbackGenerator
from src.models import FeedbackAction, InsightItem, ReportType
from src.scheduler.schedule_engine import ScheduleEngine

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE_CFG = os.path.join(BASE, "config/schedule.yaml")
UNITS_CFG = os.path.join(BASE, "config/units.yaml")


def make_full_report(unit_id="PM"):
    engine = ScheduleEngine(SCHEDULE_CFG, UNITS_CFG)
    report = engine.create_report_template(unit_id, ReportType.WEEKLY)
    for key in report.content.items:
        report.content.items[key] = f"{key} 상세 내용 작성 완료"
    report.content.insights = [
        InsightItem("프로젝트 진행률 (%)", "85%", "80%", "상승"),
        InsightItem("마일스톤 달성 현황", "4/5건", "5/5건", "유지"),
        InsightItem("리스크 항목 수 및 등급", "2건", "2건 이하", "하락"),
        InsightItem("이슈 해결률", "92%", "90%", "상승"),
        InsightItem("일정 준수율 (%)", "95%", "90%", "상승"),
    ]
    report.content.action_items = ["리스크 대응 계획 수립", "마일스톤 5번 착수", "주간 점검 실시"]
    report.content.next_period_plan = "마일스톤 5번 완료 및 최종 검수 준비"
    return report


def make_poor_report(unit_id="PM"):
    engine = ScheduleEngine(SCHEDULE_CFG, UNITS_CFG)
    report = engine.create_report_template(unit_id, ReportType.WEEKLY)
    return report  # 모든 항목 비어있음


class TestFeedbackGenerator(unittest.TestCase):

    def setUp(self):
        self.gen = FeedbackGenerator(SCHEDULE_CFG, UNITS_CFG)

    def test_full_report_approved(self):
        """충실한 보고서는 승인 판정"""
        report = make_full_report()
        feedback = self.gen.generate(report)
        self.assertIn(feedback.action, [
            FeedbackAction.APPROVED,
            FeedbackAction.APPROVED_WITH_RECOMMENDATION
        ])

    def test_poor_report_resubmission(self):
        """빈 보고서는 재제출 또는 보완요청 판정"""
        report = make_poor_report()
        feedback = self.gen.generate(report)
        self.assertIn(feedback.action, [
            FeedbackAction.RESUBMISSION_REQUESTED,
            FeedbackAction.REVISION_REQUESTED
        ])

    def test_feedback_has_summary(self):
        """피드백에 요약문이 반드시 포함"""
        report = make_full_report()
        feedback = self.gen.generate(report)
        self.assertGreater(len(feedback.summary), 0)

    def test_feedback_has_strengths(self):
        """충실한 보고서에는 강점 항목이 있어야 함"""
        report = make_full_report()
        feedback = self.gen.generate(report)
        self.assertGreater(len(feedback.strengths), 0)

    def test_poor_report_has_required_revisions(self):
        """미흡 보고서에는 필수 수정 사항 제시"""
        report = make_poor_report()
        feedback = self.gen.generate(report)
        if feedback.action in (FeedbackAction.RESUBMISSION_REQUESTED,
                               FeedbackAction.REVISION_REQUESTED):
            self.assertGreater(len(feedback.required_revisions), 0)

    def test_score_total_in_range(self):
        """종합 점수는 0~100"""
        for report in [make_full_report(), make_poor_report()]:
            feedback = self.gen.generate(report)
            self.assertGreaterEqual(feedback.score.total, 0.0)
            self.assertLessEqual(feedback.score.total, 100.0)

    def test_determine_action_thresholds(self):
        """점수별 조치 판정 경계값 확인"""
        self.assertEqual(
            self.gen.determine_action(95.0), FeedbackAction.APPROVED
        )
        self.assertEqual(
            self.gen.determine_action(80.0), FeedbackAction.APPROVED_WITH_RECOMMENDATION
        )
        self.assertEqual(
            self.gen.determine_action(65.0), FeedbackAction.REVISION_REQUESTED
        )
        self.assertEqual(
            self.gen.determine_action(40.0), FeedbackAction.RESUBMISSION_REQUESTED
        )


if __name__ == "__main__":
    unittest.main()
