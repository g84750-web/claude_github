"""보고서 생명주기 관리 모듈"""

import json, os
from datetime import datetime
from typing import Dict, List, Optional
from src.models import Feedback, InsightItem, Report, ReportContent, ReportStatus, ReportType, ReviewScore


class ReportStore:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)

    def _path(self, rid): return os.path.join(self.data_dir, f"{rid}.json")

    def save(self, report):
        data = {'id':report.id,'unit_id':report.unit_id,'report_type':report.report_type.value,
                'status':report.status.value,'submitter':report.submitter,'reviewer':report.reviewer,
                'created_at':report.created_at.isoformat(),
                'submitted_at':report.submitted_at.isoformat() if report.submitted_at else None,
                'reviewed_at':report.reviewed_at.isoformat() if report.reviewed_at else None,
                'feedback_sent_at':report.feedback_sent_at.isoformat() if report.feedback_sent_at else None,
                'deadline':report.deadline.isoformat() if report.deadline else None,
                'content':{'unit_id':report.content.unit_id,'report_type':report.content.report_type.value,
                           'period_start':report.content.period_start.isoformat(),
                           'period_end':report.content.period_end.isoformat(),
                           'insights':[{'metric':i.metric,'value':i.value,'target':i.target,'trend':i.trend,'comment':i.comment} for i in report.content.insights],
                           'items':report.content.items,'action_items':report.content.action_items,
                           'risks':report.content.risks,'next_period_plan':report.content.next_period_plan}}
        with open(self._path(report.id),'w',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2)

    def load(self, rid):
        p = self._path(rid)
        if not os.path.exists(p): return None
        with open(p,'r',encoding='utf-8') as f: return self._des(json.load(f))

    def list_reports(self, unit_id=None, report_type=None, status=None):
        reports = []
        for fn in os.listdir(self.data_dir):
            if not fn.endswith('.json'): continue
            with open(os.path.join(self.data_dir,fn),'r',encoding='utf-8') as f: data=json.load(f)
            if unit_id and data['unit_id']!=unit_id: continue
            if report_type and data['report_type']!=report_type.value: continue
            if status and data['status']!=status.value: continue
            reports.append(self._des(data))
        return sorted(reports, key=lambda r: r.created_at, reverse=True)

    def _des(self, data):
        c = data['content']
        content = ReportContent(unit_id=c['unit_id'], report_type=ReportType(c['report_type']),
            period_start=datetime.fromisoformat(c['period_start']), period_end=datetime.fromisoformat(c['period_end']),
            insights=[InsightItem(metric=i['metric'],value=i['value'],target=i.get('target'),trend=i.get('trend'),comment=i.get('comment')) for i in c.get('insights',[])],
            items=c.get('items',{}), action_items=c.get('action_items',[]), risks=c.get('risks',[]), next_period_plan=c.get('next_period_plan',''))
        return Report(id=data['id'],unit_id=data['unit_id'],report_type=ReportType(data['report_type']),
            status=ReportStatus(data['status']),content=content,created_at=datetime.fromisoformat(data['created_at']),
            submitted_at=datetime.fromisoformat(data['submitted_at']) if data.get('submitted_at') else None,
            reviewed_at=datetime.fromisoformat(data['reviewed_at']) if data.get('reviewed_at') else None,
            feedback_sent_at=datetime.fromisoformat(data['feedback_sent_at']) if data.get('feedback_sent_at') else None,
            deadline=datetime.fromisoformat(data['deadline']) if data.get('deadline') else None,
            submitter=data.get('submitter',''), reviewer=data.get('reviewer',''))


class FeedbackStore:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)

    def save(self, feedback):
        p = os.path.join(self.data_dir, f"fb_{feedback.report_id}.json")
        data = {'report_id':feedback.report_id,'unit_id':feedback.unit_id,'action':feedback.action.value,
                'summary':feedback.summary,'strengths':feedback.strengths,'improvements':feedback.improvements,
                'required_revisions':feedback.required_revisions,'created_at':feedback.created_at.isoformat(),
                'score':{'completeness':feedback.score.completeness,'insight_quality':feedback.score.insight_quality,
                         'action_items':feedback.score.action_items,'timeliness':feedback.score.timeliness,
                         'total':feedback.score.total,'details':feedback.score.details}}
        with open(p,'w',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2)

    def load(self, report_id):
        from src.models import FeedbackAction
        p = os.path.join(self.data_dir, f"fb_{report_id}.json")
        if not os.path.exists(p): return None
        with open(p,'r',encoding='utf-8') as f: data=json.load(f)
        score = ReviewScore(**{k:data['score'][k] for k in ['completeness','insight_quality','action_items','timeliness','total','details']})
        return Feedback(report_id=data['report_id'],unit_id=data['unit_id'],score=score,
                        action=FeedbackAction(data['action']),summary=data['summary'],
                        strengths=data.get('strengths',[]),improvements=data.get('improvements',[]),
                        required_revisions=data.get('required_revisions',[]),
                        created_at=datetime.fromisoformat(data['created_at']))


class ReportManager:
    def __init__(self, reports_dir, feedback_dir):
        self.store = ReportStore(reports_dir)
        self.feedback_store = FeedbackStore(feedback_dir)

    def submit_report(self, report, submitter=''):
        if report.status not in (ReportStatus.DRAFT, ReportStatus.REVISION_REQUESTED, ReportStatus.RESUBMISSION_REQUESTED):
            raise ValueError(f"제출 불가 상태입니다: {report.status.value}")
        report.status = ReportStatus.SUBMITTED
        report.submitted_at = datetime.now()
        if submitter: report.submitter = submitter
        self.store.save(report)
        return report

    def start_review(self, report, reviewer=''):
        if report.status != ReportStatus.SUBMITTED: raise ValueError(f"검토 시작 불가 상태입니다: {report.status.value}")
        report.status = ReportStatus.UNDER_REVIEW
        if reviewer: report.reviewer = reviewer
        self.store.save(report)
        return report

    def complete_review(self, report):
        if report.status != ReportStatus.UNDER_REVIEW: raise ValueError(f"검토 완료 불가 상태입니다: {report.status.value}")
        report.status = ReportStatus.REVIEWED
        report.reviewed_at = datetime.now()
        self.store.save(report)
        return report

    def send_feedback(self, report, feedback):
        from src.models import FeedbackAction
        self.feedback_store.save(feedback)
        report.feedback_sent_at = datetime.now()
        m = {FeedbackAction.APPROVED:ReportStatus.APPROVED, FeedbackAction.APPROVED_WITH_RECOMMENDATION:ReportStatus.APPROVED,
             FeedbackAction.REVISION_REQUESTED:ReportStatus.REVISION_REQUESTED, FeedbackAction.RESUBMISSION_REQUESTED:ReportStatus.RESUBMISSION_REQUESTED}
        report.status = m.get(feedback.action, ReportStatus.FEEDBACK_SENT)
        self.store.save(report)
        return report

    def get_pending_reports(self): return self.store.list_reports(status=ReportStatus.SUBMITTED)
    def get_unit_reports(self, unit_id): return self.store.list_reports(unit_id=unit_id)
    def get_report(self, rid): return self.store.load(rid)
    def get_feedback(self, rid): return self.feedback_store.load(rid)

    def get_overdue_reports(self, entries):
        overdue = []
        submitted = {f"{r.unit_id}_{r.report_type.value}" for r in self.store.list_reports(status=ReportStatus.SUBMITTED)}
        for e in entries:
            key = f"{e.unit_id}_{e.report_type.value}"
            if e.deadline < datetime.now() and key not in submitted:
                overdue.append({'unit_id':e.unit_id,'report_type':e.report_type.value,'deadline':e.deadline,
                                'hours_overdue':(datetime.now()-e.deadline).total_seconds()/3600})
        return overdue
