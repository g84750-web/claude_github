"""핵심 인사이트 분석기 단위 테스트"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from datetime import datetime

from src.insights.insight_analyzer import InsightAnalyzer
from src.models import InsightItem, Report, ReportContent, ReportStatus, ReportType
from src.scheduler.schedule_engine import ScheduleEngine

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE_CFG = os.path.join(BASE, "config/schedule.yaml")
UNITS_CFG = os.path.join(BASE, "config/units.yaml")


def make_report(unit_id="PM", report_type=ReportType.WEEKLY,
                items=None, insights=None, action_items=None,
                next_plan="차주 계획 작성 완료") -> Report:
    engine = ScheduleEngine(SCHEDULE_CFG, UNITS_CFG)
    report = engine.create_report_template(unit_id, report_type)
    if items:
        report.content.items.update(items)
    if insights:
        report.content.insights = insights
    if action_items:
        report.content.action_items = action_items
    report.content.next_period_plan = next_plan
    return report


class TestInsightAnalyzer(unittest.TestCase):

    def setUp(self):
        self.analyzer = InsightAnalyzer(UNITS_CFG, SCHEDULE_CFG)

    def test_completeness_full(self):
        """모든 항목 작성 시 완성도 100점"""
        engine = ScheduleEngine(SCHEDULE_CFG, UNITS_CFG)
        report = engine.create_report_template("PM", ReportType.WEEKLY)
        for key in report.content.items:
            report.content.items[key] = "작성 완료된 내용입니다."
        score, missing = self.analyzer.analyze_completeness(report)
        self.assertEqual(score, 100.0)
        self.assertEqual(len(missing), 0)

    def test_completeness_empty(self):
        """항목 미작성 시 완성도 0점"""
        engine = ScheduleEngine(SCHEDULE_CFG, UNITS_CFG)
        report = engine.create_report_template("PM", ReportType.WEEKLY)
        # 모든 항목 비워두기
        for key in report.content.items:
            report.content.items[key] = ""
        score, missing = self.analyzer.analyze_completeness(report)
        self.assertEqual(score, 0.0)

    def test_insight_numeric_value_detected(self):
        """수치가 있는 인사이트 항목 정상 인식"""
        item = InsightItem(metric="진행률", value="75%")
        self.assertTrue(item.has_numeric_value())

    def test_insight_non_numeric(self):
        """수치가 없는 인사이트 항목 인식"""
        item = InsightItem(metric="현황", value="진행 중")
        self.assertFalse(item.has_numeric_value())

    def test_action_items_penalty(self):
        """실행 계획 없을 때 점수 감점"""
        report = make_report(action_items=[], next_plan="")
        score, issues = self.analyzer.analyze_action_items(report)
        self.assertLess(score, 100.0)
        self.assertGreater(len(issues), 0)

    def test_action_items_full(self):
        """실행 계획 3개 이상 작성 시 감점 없음"""
        report = make_report(
            action_items=["계획1", "계획2", "계획3"],
            next_plan="차주 계획 충실히 작성"
        )
        score, issues = self.analyzer.analyze_action_items(report)
        self.assertEqual(score, 100.0)

    def test_timeliness_on_time(self):
        """기한 내 제출 시 100점"""
        report = make_report()
        report.deadline = datetime(2026, 5, 8, 17, 0)
        report.submitted_at = datetime(2026, 5, 8, 16, 0)
        score, issues = self.analyzer.analyze_timeliness(report)
        self.assertEqual(score, 100.0)

    def test_timeliness_late(self):
        """1시간 지연 제출 시 감점"""
        report = make_report()
        report.deadline = datetime(2026, 5, 8, 17, 0)
        report.submitted_at = datetime(2026, 5, 8, 18, 0)
        score, issues = self.analyzer.analyze_timeliness(report)
        self.assertLess(score, 100.0)
        self.assertGreater(len(issues), 0)

    def test_total_score_range(self):
        """종합 점수는 0~100 사이"""
        report = make_report(
            items={k: "내용" for k in make_report().content.items},
            insights=[InsightItem("진행률", "80%", "85%", "상승")],
            action_items=["계획1", "계획2"],
            next_plan="차주 계획"
        )
        score = self.analyzer.analyze(report)
        self.assertGreaterEqual(score.total, 0.0)
        self.assertLessEqual(score.total, 100.0)


if __name__ == "__main__":
    unittest.main()
