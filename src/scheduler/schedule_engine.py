"""PKG 사업본부(구축) 보고 스케줄 엔진"""

import os
import uuid
import yaml
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from src.models import Report, ReportContent, ReportStatus, ReportType, ScheduleEntry


def load_config(config_path: str) -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_units_config(config_path: str) -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


class ScheduleEngine:
    """주간/월간 보고 스케줄 관리 엔진"""

    def __init__(self, schedule_config_path: str, units_config_path: str):
        self.config = load_config(schedule_config_path)
        self.units_config = load_units_config(units_config_path)
        self.schedule_cfg = self.config["schedule"]
        self.units = {u["id"]: u for u in self.units_config["units"]}

    def get_next_weekly_deadline(self, from_date: Optional[datetime] = None) -> datetime:
        """다음 주간보고 마감일시 계산 (매주 금요일 17:00)"""
        base = from_date or datetime.now()
        weekday = base.weekday()  # 0=월요일, 4=금요일
        days_until_friday = (4 - weekday) % 7
        if days_until_friday == 0 and base.hour >= 17:
            days_until_friday = 7
        deadline_date = base + timedelta(days=days_until_friday)
        h, m = map(int, self.schedule_cfg["weekly"]["deadline_time"].split(":"))
        return deadline_date.replace(hour=h, minute=m, second=0, microsecond=0)

    def get_next_monthly_deadline(self, from_date: Optional[datetime] = None) -> datetime:
        """다음 월간보고 마감일시 계산 (매월 마지막 영업일 17:00)"""
        base = from_date or datetime.now()
        # 다음 달 1일에서 하루 전 = 이번 달 마지막 날
        if base.month == 12:
            last_day = datetime(base.year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = datetime(base.year, base.month + 1, 1) - timedelta(days=1)

        # 마지막 영업일 찾기 (토/일 제외)
        while last_day.weekday() >= 5:
            last_day -= timedelta(days=1)

        h, m = map(int, self.schedule_cfg["monthly"]["deadline_time"].split(":"))
        deadline = last_day.replace(hour=h, minute=m, second=0, microsecond=0)

        # 이미 지난 경우 다음 달로
        if deadline <= base:
            if base.month == 12:
                next_month_base = datetime(base.year + 1, 2, 1)
            else:
                next_month_base = datetime(base.year, base.month + 2, 1)
            return self.get_next_monthly_deadline(next_month_base - timedelta(days=1))
        return deadline

    def get_weekly_period(self, deadline: datetime) -> Tuple[datetime, datetime]:
        """주간보고 해당 주의 시작/종료일 계산"""
        period_end = deadline - timedelta(days=1)  # 금요일 전날(목요일)까지
        period_start = period_end - timedelta(days=6)  # 7일 전
        return period_start.replace(hour=0, minute=0, second=0), period_end.replace(hour=23, minute=59, second=59)

    def get_monthly_period(self, deadline: datetime) -> Tuple[datetime, datetime]:
        """월간보고 해당 월의 시작/종료일 계산"""
        period_start = deadline.replace(day=1, hour=0, minute=0, second=0)
        period_end = deadline.replace(hour=23, minute=59, second=59)
        return period_start, period_end

    def generate_schedule_entries(self, from_date: Optional[datetime] = None) -> List[ScheduleEntry]:
        """전체 유닛의 스케줄 엔트리 생성"""
        entries = []
        base = from_date or datetime.now()

        weekly_deadline = self.get_next_weekly_deadline(base)
        monthly_deadline = self.get_next_monthly_deadline(base)

        for unit_id in self.units:
            entries.append(ScheduleEntry(
                unit_id=unit_id,
                report_type=ReportType.WEEKLY,
                deadline=weekly_deadline,
            ))
            entries.append(ScheduleEntry(
                unit_id=unit_id,
                report_type=ReportType.MONTHLY,
                deadline=monthly_deadline,
            ))

        return entries

    def create_report_template(self, unit_id: str, report_type: ReportType,
                               deadline: Optional[datetime] = None) -> Report:
        """유닛별 보고서 템플릿 생성"""
        if unit_id not in self.units:
            raise ValueError(f"유닛 ID '{unit_id}'가 존재하지 않습니다.")

        now = datetime.now()
        if deadline is None:
            if report_type == ReportType.WEEKLY:
                deadline = self.get_next_weekly_deadline(now)
            else:
                deadline = self.get_next_monthly_deadline(now)

        if report_type == ReportType.WEEKLY:
            period_start, period_end = self.get_weekly_period(deadline)
        else:
            period_start, period_end = self.get_monthly_period(deadline)

        unit_cfg = self.units[unit_id]
        items_key = "weekly_items" if report_type == ReportType.WEEKLY else "monthly_items"
        items = {item: "" for item in unit_cfg.get(items_key, [])}

        content = ReportContent(
            unit_id=unit_id,
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
            items=items,
        )

        report_id = f"{unit_id}_{report_type.value}_{now.strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        return Report(
            id=report_id,
            unit_id=unit_id,
            report_type=report_type,
            status=ReportStatus.DRAFT,
            content=content,
            created_at=now,
            deadline=deadline,
            submitter=unit_cfg.get("head", ""),
        )

    def get_reminder_messages(self, entry: ScheduleEntry, now: Optional[datetime] = None) -> List[str]:
        """마감 시간 기준 알림 메시지 생성"""
        now = now or datetime.now()
        messages = []
        hours_left = (entry.deadline - now).total_seconds() / 3600

        if entry.report_type == ReportType.WEEKLY:
            reminders = self.schedule_cfg["weekly"].get("reminder_times", [])
            for r in reminders:
                day_map = {"Monday": 0, "Tuesday": 1, "Wednesday": 2,
                           "Thursday": 3, "Friday": 4}
                target_day = day_map.get(r["day"], -1)
                if now.weekday() == target_day:
                    h, m = map(int, r["time"].split(":"))
                    if now.hour == h and now.minute < m + 10:
                        messages.append(r["message"])
        else:
            reminders = self.schedule_cfg["monthly"].get("reminder_days_before", [])
            for r in reminders:
                days_before = r["days"]
                if 0 <= hours_left / 24 <= days_before + 0.1:
                    messages.append(r["message"])

        if hours_left < 0:
            messages.append(
                f"[마감초과] {entry.unit_id} {entry.report_type.value} 보고서가 "
                f"{abs(hours_left):.1f}시간 전에 마감되었습니다."
            )
        elif hours_left < 2:
            messages.append(
                f"[긴급] {entry.unit_id} {entry.report_type.value} 보고서 마감까지 "
                f"{hours_left:.1f}시간 남았습니다."
            )

        return messages

    def check_escalation_needed(self, entry: ScheduleEntry,
                                submitted: bool,
                                now: Optional[datetime] = None) -> bool:
        """에스컬레이션 필요 여부 확인"""
        if submitted:
            return False
        now = now or datetime.now()
        escalation_hours = self.config.get("notifications", {}).get(
            "escalation", {}).get("hours_after_deadline", 2)
        hours_overdue = (now - entry.deadline).total_seconds() / 3600
        return hours_overdue >= escalation_hours
