"""스케줄 엔진 단위 테스트"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from datetime import datetime

from src.scheduler.schedule_engine import ScheduleEngine
from src.models import ReportType

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE_CFG = os.path.join(BASE, "config/schedule.yaml")
UNITS_CFG = os.path.join(BASE, "config/units.yaml")


class TestScheduleEngine(unittest.TestCase):

    def setUp(self):
        self.engine = ScheduleEngine(SCHEDULE_CFG, UNITS_CFG)

    def test_weekly_deadline_is_friday(self):
        """주간보고 마감일은 반드시 금요일"""
        deadline = self.engine.get_next_weekly_deadline()
        self.assertEqual(deadline.weekday(), 4, "주간보고 마감일이 금요일이 아닙니다")

    def test_weekly_deadline_time_is_17(self):
        """주간보고 마감 시각은 17:00"""
        deadline = self.engine.get_next_weekly_deadline()
        self.assertEqual(deadline.hour, 17)
        self.assertEqual(deadline.minute, 0)

    def test_monthly_deadline_is_not_weekend(self):
        """월간보고 마감일은 주말이 아닌 영업일"""
        deadline = self.engine.get_next_monthly_deadline()
        self.assertLess(deadline.weekday(), 5, "월간보고 마감일이 주말입니다")

    def test_schedule_entries_count(self):
        """스케줄 엔트리는 유닛 수 × 2 (주간+월간)"""
        entries = self.engine.generate_schedule_entries()
        unit_count = len(self.engine.units)
        self.assertEqual(len(entries), unit_count * 2)

    def test_all_units_have_entries(self):
        """모든 유닛에 주간·월간 스케줄이 존재"""
        entries = self.engine.generate_schedule_entries()
        weekly_units = {e.unit_id for e in entries if e.report_type == ReportType.WEEKLY}
        monthly_units = {e.unit_id for e in entries if e.report_type == ReportType.MONTHLY}
        expected = set(self.engine.units.keys())
        self.assertEqual(weekly_units, expected)
        self.assertEqual(monthly_units, expected)

    def test_create_report_template_pm(self):
        """PM 유닛 주간보고 템플릿 정상 생성"""
        report = self.engine.create_report_template("PM", ReportType.WEEKLY)
        self.assertEqual(report.unit_id, "PM")
        self.assertEqual(report.report_type, ReportType.WEEKLY)
        self.assertIsNotNone(report.deadline)
        self.assertGreater(len(report.content.items), 0)

    def test_invalid_unit_raises(self):
        """존재하지 않는 유닛 ID는 ValueError 발생"""
        with self.assertRaises(ValueError):
            self.engine.create_report_template("INVALID", ReportType.WEEKLY)

    def test_weekly_period_is_7_days(self):
        """주간 보고 기간은 7일"""
        deadline = self.engine.get_next_weekly_deadline()
        start, end = self.engine.get_weekly_period(deadline)
        delta = end - start
        self.assertGreaterEqual(delta.days, 6)

    def test_monthly_period_starts_on_first(self):
        """월간 보고 기간 시작일은 해당 월 1일"""
        deadline = self.engine.get_next_monthly_deadline()
        start, _ = self.engine.get_monthly_period(deadline)
        self.assertEqual(start.day, 1)


if __name__ == "__main__":
    unittest.main()
