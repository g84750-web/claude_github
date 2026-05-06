"""PKG 사업본부(구축) 보고 스케줄 엔진"""

import os, uuid, yaml
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from src.models import Report, ReportContent, ReportStatus, ReportType, ScheduleEntry

def load_config(p):
    with open(p, 'r', encoding='utf-8') as f: return yaml.safe_load(f)

class ScheduleEngine:
    def __init__(self, schedule_config_path, units_config_path):
        self.config = load_config(schedule_config_path)
        self.units_config = load_config(units_config_path)
        self.schedule_cfg = self.config['schedule']
        self.units = {u['id']: u for u in self.units_config['units']}

    def get_next_weekly_deadline(self, from_date=None):
        base = from_date or datetime.now()
        days = (4 - base.weekday()) % 7
        if days == 0 and base.hour >= 17: days = 7
        d = base + timedelta(days=days)
        h, m = map(int, self.schedule_cfg['weekly']['deadline_time'].split(':'))
        return d.replace(hour=h, minute=m, second=0, microsecond=0)

    def get_next_monthly_deadline(self, from_date=None):
        base = from_date or datetime.now()
        last = datetime(base.year + (1 if base.month==12 else 0), 1 if base.month==12 else base.month+1, 1) - timedelta(days=1)
        while last.weekday() >= 5: last -= timedelta(days=1)
        h, m = map(int, self.schedule_cfg['monthly']['deadline_time'].split(':'))
        dl = last.replace(hour=h, minute=m, second=0, microsecond=0)
        if dl <= base:
            nb = datetime(base.year + (1 if base.month==12 else 0), 2 if base.month==12 else base.month+2, 1)
            return self.get_next_monthly_deadline(nb - timedelta(days=1))
        return dl

    def get_weekly_period(self, deadline):
        e = deadline - timedelta(days=1)
        s = e - timedelta(days=6)
        return s.replace(hour=0,minute=0,second=0), e.replace(hour=23,minute=59,second=59)

    def get_monthly_period(self, deadline):
        return deadline.replace(day=1,hour=0,minute=0,second=0), deadline.replace(hour=23,minute=59,second=59)

    def generate_schedule_entries(self, from_date=None):
        base = from_date or datetime.now()
        wd = self.get_next_weekly_deadline(base)
        md = self.get_next_monthly_deadline(base)
        return [ScheduleEntry(unit_id=uid, report_type=rt, deadline=dl)
                for uid in self.units for rt,dl in [(ReportType.WEEKLY,wd),(ReportType.MONTHLY,md)]]

    def create_report_template(self, unit_id, report_type, deadline=None):
        if unit_id not in self.units: raise ValueError(f"유닛 ID '{unit_id}'가 존재하지 않습니다.")
        now = datetime.now()
        if deadline is None:
            deadline = self.get_next_weekly_deadline(now) if report_type==ReportType.WEEKLY else self.get_next_monthly_deadline(now)
        ps, pe = self.get_weekly_period(deadline) if report_type==ReportType.WEEKLY else self.get_monthly_period(deadline)
        unit_cfg = self.units[unit_id]
        items_key = 'weekly_items' if report_type==ReportType.WEEKLY else 'monthly_items'
        items = {item: '' for item in unit_cfg.get(items_key, [])}
        content = ReportContent(unit_id=unit_id, report_type=report_type, period_start=ps, period_end=pe, items=items)
        rid = f"{unit_id}_{report_type.value}_{now.strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        return Report(id=rid, unit_id=unit_id, report_type=report_type, status=ReportStatus.DRAFT,
                      content=content, created_at=now, deadline=deadline, submitter=unit_cfg.get('head',''))

    def get_reminder_messages(self, entry, now=None):
        now = now or datetime.now()
        msgs = []
        hours_left = (entry.deadline - now).total_seconds() / 3600
        if entry.report_type == ReportType.WEEKLY:
            for r in self.schedule_cfg['weekly'].get('reminder_times',[]):
                dm = {'Monday':0,'Tuesday':1,'Wednesday':2,'Thursday':3,'Friday':4}
                if now.weekday()==dm.get(r['day'],-1):
                    h,m = map(int, r['time'].split(':'))
                    if now.hour==h and now.minute < m+10: msgs.append(r['message'])
        else:
            for r in self.schedule_cfg['monthly'].get('reminder_days_before',[]):
                if 0 <= hours_left/24 <= r['days']+0.1: msgs.append(r['message'])
        if hours_left < 0: msgs.append(f"[마감초과] {entry.unit_id} {entry.report_type.value} 보고서가 {abs(hours_left):.1f}시간 전에 마감되었습니다.")
        elif hours_left < 2: msgs.append(f"[긴급] {entry.unit_id} {entry.report_type.value} 보고서 마감까지 {hours_left:.1f}시간 남았습니다.")
        return msgs

    def check_escalation_needed(self, entry, submitted, now=None):
        if submitted: return False
        now = now or datetime.now()
        eh = self.config.get('notifications',{}).get('escalation',{}).get('hours_after_deadline',2)
        return (now - entry.deadline).total_seconds()/3600 >= eh
