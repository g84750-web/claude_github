"""통계 및 트렌드 분석"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from src.models import FeedbackAction, Report, ReportStatus, ReportType

class TrendAnalyzer:
    def submission_rate(self, reports, total_units, report_type):
        if total_units == 0: return 0.0
        submitted = sum(1 for r in reports if r.report_type==report_type and r.status!=ReportStatus.DRAFT)
        return round((submitted/total_units)*100, 1)

    def on_time_rate(self, reports):
        wd = [r for r in reports if r.submitted_at and r.deadline]
        if not wd: return 0.0
        return round(sum(1 for r in wd if r.submitted_at<=r.deadline)/len(wd)*100, 1)

    def avg_score_by_unit(self, feedbacks):
        scores = defaultdict(list)
        for fb in feedbacks: scores[fb.unit_id].append(fb.score.total)
        return {uid: round(sum(s)/len(s),1) for uid, s in scores.items()}

    def score_trend(self, feedbacks, unit_id, last_n=4):
        fbs = sorted([fb for fb in feedbacks if fb.unit_id==unit_id], key=lambda fb: fb.created_at)[-last_n:]
        return [{'date': fb.created_at.strftime('%Y-%m-%d'), 'score': fb.score.total, 'action': fb.action.value} for fb in fbs]

    def approval_rate(self, feedbacks):
        if not feedbacks: return 0.0
        approved = sum(1 for fb in feedbacks if fb.action in (FeedbackAction.APPROVED, FeedbackAction.APPROVED_WITH_RECOMMENDATION))
        return round((approved/len(feedbacks))*100, 1)

    def generate_summary_report(self, reports, feedbacks, unit_names):
        lines = ['='*60, '  PKG 사업본부(구축) 업무보고 현황 요약', f'  생성일시: {datetime.now().strftime("%Y-%m-%d %H:%M")}', '='*60]
        total_units = len(unit_names)
        lines += ['', '[전체 현황]',
                  f'  주간보고 제출률    : {self.submission_rate(reports, total_units, ReportType.WEEKLY):.1f}%',
                  f'  월간보고 제출률    : {self.submission_rate(reports, total_units, ReportType.MONTHLY):.1f}%',
                  f'  기한 내 제출률     : {self.on_time_rate(reports):.1f}%',
                  f'  보고서 승인률      : {self.approval_rate(feedbacks):.1f}%']
        avg = self.avg_score_by_unit(feedbacks)
        if avg:
            lines.append('\n[유닛별 평균 점수]')
            for uid, score in sorted(avg.items(), key=lambda x: -x[1]):
                bar = '█'*int(score/10) + '░'*(10-int(score/10))
                lines.append(f'  {unit_names.get(uid,uid):<20} {bar} {score:.1f}점')
        lines.append('='*60)
        return '\n'.join(lines)
