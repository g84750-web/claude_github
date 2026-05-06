"""자동화 피드백 생성기"""
import yaml
from datetime import datetime
from typing import List, Optional
from src.models import Feedback, FeedbackAction, Report, ReviewScore
from src.insights.insight_analyzer import InsightAnalyzer

class FeedbackGenerator:
    def __init__(self, schedule_config_path, units_config_path):
        with open(schedule_config_path, 'r', encoding='utf-8') as f: cfg = yaml.safe_load(f)
        self.feedback_rules = cfg.get('feedback_rules', {})
        self.score_ranges = self.feedback_rules.get('score_ranges', {})
        with open(units_config_path, 'r', encoding='utf-8') as f: units_cfg = yaml.safe_load(f)
        self.units = {u['id']: u for u in units_cfg['units']}
        self.analyzer = InsightAnalyzer(units_config_path, schedule_config_path)

    def determine_action(self, total_score):
        for _, r in self.score_ranges.items():
            if r['min'] <= total_score <= r['max']:
                return {'승인':FeedbackAction.APPROVED,'승인_보완권고':FeedbackAction.APPROVED_WITH_RECOMMENDATION,
                        '보완요청':FeedbackAction.REVISION_REQUESTED,'재제출요청':FeedbackAction.RESUBMISSION_REQUESTED}.get(r.get('action','승인'), FeedbackAction.APPROVED)
        return FeedbackAction.APPROVED

    def generate_strengths(self, report, score):
        s = []
        if score.completeness >= 90: s.append(f'보고서 필수 항목 작성이 충실합니다. (완성도: {score.completeness:.0f}점)')
        if score.insight_quality >= 85: s.append(f'핵심 인사이트 수치 지표가 명확하게 기재되어 있습니다. (인사이트 품질: {score.insight_quality:.0f}점)')
        if score.action_items >= 80: s.append(f'실행 계획이 구체적으로 작성되어 있습니다. (실행계획: {score.action_items:.0f}점)')
        if score.timeliness >= 95: s.append('기한 내 적시에 제출되었습니다.')
        if len(report.content.risks) >= 2: s.append(f'리스크 {len(report.content.risks)}건을 사전에 식별하고 보고하였습니다.')
        if len(report.content.action_items) >= 3: s.append(f'실행 계획 {len(report.content.action_items)}건을 구체적으로 제시하였습니다.')
        return s if s else ['전반적으로 기준에 부합하는 보고서입니다.']

    def generate_improvements(self, report, score):
        imp = []
        if score.completeness < 80:
            mi = score.details.get('completeness_issues','')
            imp.append(f'누락 항목 보완 필요: {mi}' if mi else '보고서 필수 항목 작성률을 80% 이상으로 개선하시기 바랍니다.')
        if score.insight_quality < 75:
            ii = score.details.get('insight_issues','')
            if ii: imp.append(f'인사이트 품질 개선: {ii}')
            imp.append('각 핵심 지표에 수치(%, 건수, 금액 등)와 목표값을 함께 기재해 주세요.')
        if score.action_items < 70:
            ai = score.details.get('action_issues','')
            if ai: imp.append(f'실행 계획 보완: {ai}')
        if score.timeliness < 100:
            ti = score.details.get('timeliness_issues','')
            if ti: imp.append(f'제출 일정 관리: {ti}')
        if not report.content.next_period_plan.strip(): imp.append('차기 기간 계획을 구체적으로 작성해 주세요.')
        return imp

    def generate_required_revisions(self, report, score, action):
        if action == FeedbackAction.APPROVED: return []
        rev = []
        if score.completeness < 60: rev.append('필수 보고 항목을 모두 작성하여 재제출하시기 바랍니다.')
        if score.insight_quality < 50:
            required = self.units.get(report.unit_id,{}).get('key_insights',[])
            rev.append(f'다음 핵심 인사이트 항목을 수치 포함하여 작성해 주세요: {", ".join(required[:3])}')
        if score.action_items < 50: rev.append('실행 계획(Action Items) 최소 2건 이상 구체적으로 기술해 주세요.')
        rev.append('위 사항을 모두 반영하여 48시간 내 재제출 바랍니다.' if action==FeedbackAction.RESUBMISSION_REQUESTED else '보완 사항을 반영하여 24시간 내 수정 제출 바랍니다.')
        return rev

    def generate_summary(self, report, score, action):
        unit_name = self.units.get(report.unit_id,{}).get('name', report.unit_id)
        period = f"{report.content.period_start.strftime('%Y.%m.%d')}~{report.content.period_end.strftime('%Y.%m.%d')}"
        rt = '주간' if report.report_type.value=='weekly' else '월간'
        label_map = {'excellent':'우수','good':'양호','needs_improvement':'보완필요','insufficient':'미흡'}
        grade = next((label_map.get(k, r.get('label','')) for k,r in self.score_ranges.items() if r['min']<=score.total<=r['max']), '미흡')
        action_desc = {FeedbackAction.APPROVED:'승인되었습니다', FeedbackAction.APPROVED_WITH_RECOMMENDATION:'승인되었습니다 (보완 사항 권고)',
                       FeedbackAction.REVISION_REQUESTED:'보완 후 재제출 바랍니다', FeedbackAction.RESUBMISSION_REQUESTED:'전면 재제출 바랍니다'}
        return (f'[{unit_name}] {period} {rt}보고서 검토 결과입니다.\n'
                f'종합 점수: {score.total:.1f}점 ({grade}) | 완성도: {score.completeness:.0f}점 | 인사이트: {score.insight_quality:.0f}점 | 실행계획: {score.action_items:.0f}점 | 적시성: {score.timeliness:.0f}점\n'
                f'검토 결과: {action_desc.get(action, "승인")}')

    def generate(self, report, previous_report=None):
        score = self.analyzer.analyze(report)
        action = self.determine_action(score.total)
        obs = self.analyzer.compare_with_previous(report, previous_report)
        strengths = self.generate_strengths(report, score)
        improvements = self.generate_improvements(report, score)
        if obs and obs[0] != '이전 보고서가 없어 비교할 수 없습니다.':
            improvements.extend([f'[추이 분석] {o}' for o in obs])
        return Feedback(report_id=report.id, unit_id=report.unit_id, score=score, action=action,
                        summary=self.generate_summary(report, score, action), strengths=strengths,
                        improvements=improvements, required_revisions=self.generate_required_revisions(report,score,action), created_at=datetime.now())
