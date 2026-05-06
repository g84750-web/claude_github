"""알림 및 에스컬레이션 모듈"""
import os
from datetime import datetime
from typing import List
import yaml
from src.models import Feedback, Report

class Notifier:
    def __init__(self, schedule_config_path, log_path='data/notifications.log'):
        with open(schedule_config_path, 'r', encoding='utf-8') as f: cfg = yaml.safe_load(f)
        self.config = cfg.get('notifications', {})
        self.log_path = log_path
        os.makedirs(os.path.dirname(os.path.abspath(log_path)), exist_ok=True)

    def _log(self, level, message):
        line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [{level}] {message}"
        print(line)
        with open(self.log_path, 'a', encoding='utf-8') as f: f.write(line + '\n')

    def send_reminder(self, unit_id, unit_name, report_type, deadline, message):
        self._log('REMINDER', f'[{unit_name}({unit_id})] {report_type} 보고 리마인더 | 마감: {deadline.strftime("%Y-%m-%d %H:%M")} | {message}')

    def send_submission_confirmation(self, report, unit_name):
        rt = '주간' if report.report_type.value=='weekly' else '월간'
        self._log('SUBMIT', f'[{unit_name}({report.unit_id})] {rt}보고서 제출 확인 | 보고서ID: {report.id} | 제출자: {report.submitter} | 제출일시: {report.submitted_at.strftime("%Y-%m-%d %H:%M") if report.submitted_at else "-"}')

    def send_review_started(self, report, unit_name):
        rt = '주간' if report.report_type.value=='weekly' else '월간'
        self._log('REVIEW', f'[{unit_name}({report.unit_id})] {rt}보고서 검토 시작 | 보고서ID: {report.id} | 검토자: {report.reviewer}')

    def send_feedback(self, feedback, unit_name):
        self._log('FEEDBACK', f'[{unit_name}({feedback.unit_id})] 피드백 발송 | 보고서ID: {feedback.report_id} | 종합점수: {feedback.score.total:.1f}점 | 조치: {feedback.action.value}\n  요약: {feedback.summary}\n  강점: {chr(59).join(feedback.strengths[:2])}\n  개선: {chr(59).join(feedback.improvements[:2]) if feedback.improvements else "없음"}')

    def send_escalation(self, unit_id, unit_name, report_type, escalate_to, hours_overdue):
        self._log('ESCALATION', f'[에스컬레이션] [{escalate_to}에게 보고] [{unit_name}({unit_id})] {report_type} 보고서 미제출 | 초과: {hours_overdue:.1f}시간')

    def send_bulk_status_report(self, status_lines, title='보고 현황'):
        self._log('STATUS', f'===== {title} =====')
        for line in status_lines: self._log('STATUS', f'  {line}')
        self._log('STATUS', '='*40)
