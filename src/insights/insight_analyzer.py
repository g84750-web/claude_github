"""핵심 인사이트 분석기"""
import re
from typing import Dict, List, Optional, Tuple
import yaml
from src.models import InsightItem, Report, ReviewScore

class InsightAnalyzer:
    def __init__(self, units_config_path, schedule_config_path):
        with open(units_config_path, 'r', encoding='utf-8') as f: units_cfg = yaml.safe_load(f)
        with open(schedule_config_path, 'r', encoding='utf-8') as f: schedule_cfg = yaml.safe_load(f)
        self.units = {u['id']: u for u in units_cfg['units']}
        self.criteria = schedule_cfg.get('review_criteria', {})

    def analyze_completeness(self, report):
        unit_cfg = self.units.get(report.unit_id, {})
        items_key = 'weekly_items' if report.report_type.value == 'weekly' else 'monthly_items'
        required = unit_cfg.get(items_key, [])
        if not required: return 100.0, []
        missing = [item for item in required if not report.content.items.get(item, '').strip()]
        filled = len(required) - len(missing)
        return (filled / len(required)) * 100, missing

    def analyze_insight_quality(self, report):
        unit_cfg = self.units.get(report.unit_id, {})
        expected = unit_cfg.get('key_insights', [])
        if not expected: return 100.0, []
        issues, score_parts = [], []
        for ins in report.content.insights:
            score_parts.append(100.0 if ins.has_numeric_value() else 50.0)
            if not ins.has_numeric_value(): issues.append(f"'{ins.metric}' 항목에 수치가 없습니다.")
            if ins.target is None: issues.append(f"'{ins.metric}' 항목에 목표값이 없습니다.")
        cov = min(len(report.content.insights) / len(expected) * 100, 100.0)
        if len(report.content.insights) < len(expected):
            issues.append(f"핵심 인사이트 {len(expected)-len(report.content.insights)}개 항목이 누락되었습니다.")
        qual = sum(score_parts) / len(score_parts) if score_parts else 0.0
        return (cov * 0.5) + (qual * 0.5), issues

    def analyze_action_items(self, report):
        issues, score = [], 100.0
        if not report.content.action_items: issues.append('실행 계획(Action Items)이 없습니다.'); score -= 40.0
        if not report.content.next_period_plan.strip(): issues.append('차기 계획이 작성되지 않았습니다.'); score -= 30.0
        if len(report.content.action_items) < 2: issues.append('실행 계획이 너무 적습니다. 최소 2개 이상 권장합니다.'); score -= 15.0
        return max(score, 0.0), issues

    def analyze_timeliness(self, report):
        if not report.submitted_at or not report.deadline: return 100.0, []
        if report.submitted_at <= report.deadline: return 100.0, []
        hours_late = (report.submitted_at - report.deadline).total_seconds() / 3600
        penalty = self.criteria.get('timeliness', {}).get('late_penalty_per_hour', 5)
        score = max(100.0 - (hours_late * penalty), 0.0)
        return score, [f'마감 {hours_late:.1f}시간 후 제출 (감점: {100-score:.0f}점)']

    def compute_total_score(self, completeness, insight_quality, action_items, timeliness):
        wc = self.criteria.get('completeness',{}).get('weight',30)/100
        wi = self.criteria.get('insight_quality',{}).get('weight',30)/100
        wa = self.criteria.get('action_items',{}).get('weight',20)/100
        wt = self.criteria.get('timeliness',{}).get('weight',20)/100
        return round(completeness*wc + insight_quality*wi + action_items*wa + timeliness*wt, 1)

    def analyze(self, report):
        cs, ci = self.analyze_completeness(report)
        is_, ii = self.analyze_insight_quality(report)
        as_, ai = self.analyze_action_items(report)
        ts, ti = self.analyze_timeliness(report)
        total = self.compute_total_score(cs, is_, as_, ts)
        details = {}
        if ci: details['completeness_issues'] = '; '.join(ci)
        if ii: details['insight_issues'] = '; '.join(ii)
        if ai: details['action_issues'] = '; '.join(ai)
        if ti: details['timeliness_issues'] = '; '.join(ti)
        return ReviewScore(completeness=round(cs,1), insight_quality=round(is_,1), action_items=round(as_,1), timeliness=round(ts,1), total=total, details=details)

    def extract_key_metrics(self, report):
        metrics = {ins.metric: ins.value for ins in report.content.insights}
        pat = re.compile(r'(\d+(?:\.\d+)?)\s*%')
        for key, value in report.content.items.items():
            nums = pat.findall(value)
            if nums: metrics[f'{key}_수치'] = f'{nums[0]}%'
        return metrics

    def compare_with_previous(self, current, previous):
        if not previous: return ['이전 보고서가 없어 비교할 수 없습니다.']
        obs = []
        cm, pm = self.extract_key_metrics(current), self.extract_key_metrics(previous)
        for metric, cv in cm.items():
            if metric in pm:
                try:
                    cn = float(cv.replace('%','').replace(',','')); pn = float(pm[metric].replace('%','').replace(',',''))
                    diff = cn - pn
                    if abs(diff) >= 5: obs.append(f'[{metric}] {pn:.1f} → {cn:.1f} ({"상승" if diff>0 else "하락"} {abs(diff):.1f})')
                except ValueError: pass
        return obs if obs else ['전기 대비 주요 변화 없음']
