"""
GCMS ETL — 원본 엑셀 → PKG-ICM 데이터셋

원본 : 2026년_솔루션구축센터_구축총괄실적현황_통합__PKG사업본부_YYMMDD.xlsx
시트 : GCMS A10(통합)구축진행현황
산식 : PKG 주간보고 작업지침 v2 §1-3 「계약공수 기준 공수 산정 — 확정 정책」
       (NSM 시스템 개발 시 그대로 구현될 정책)

사용법
  python etl_gcms.py <엑셀경로> [기준일 YYYY-MM-DD] [--assignee <담당자별.xlsx>] [--capa <CAPA.xlsx>]
  → data/gcms_full.json 생성
"""
import openpyxl, datetime as dt, json, os, sys, re
from collections import Counter, defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'data', 'gcms_full.json')
SHEET = 'GCMS A10(통합)구축진행현황'

# ── 부록 A. GCMS 컬럼 레퍼런스 (0-based) ────────────────────────
C = dict(no=0, code=1, customer=2, bizno=3, salesMain=4, salesRep=5,
         product=6, pjtType=7, eaType=8, module=9, dept=10, pm=11, status=12,
         orderDate=13, orderAmt=14, license=15, eduFee=16,
         licUnissued=17, eduUnissued=18, form=19, corpCnt=20, ctrType=21,
         revFlag=22, evidence=23, method=24, recv=25, install=26, start=27,
         licEvid=28, due=29, dueChg=30, done=31, billStart=32,
         mdStd=33, mdPlan=34, mdUsed=35, rate=36,
         upsell=41, foexRegion=43, region=44, ucPack=45, ctrStart=50, ctrEnd=51)

# ── 부록 B. 센터 매핑 ───────────────────────────────────────────
CENTER = {'솔루션구축1Unit': '1센터(서울/수도권)', '솔루션구축2Unit': '1센터(서울/수도권)',
          '솔루션구축3Unit': '1센터(서울/수도권)', '솔루션구축4Unit': '2센터(중부/호남권)',
          '솔루션구축5Unit': '3센터(부산/영남권)'}

# ── 구축구분 (Y열) ──────────────────────────────────────────────
M_1N, M_MIX, M_VISIT, M_SOLO = 'FoEX교육(1:N)', 'FoEX교육(1:N)+방문', '방문구축', 'FoEX교육(단독)'
FOEX_FAMILY = (M_1N, M_MIX)          # 계약공수 = 표준공수(AH), 무상공수 발생
FREE_COEF = 0.30                     # FoEX 효율계수
KEEP_BUCKETS = ('조기', '정시', '30일내')   # 납기 준수 판정 구간
CAPA_COEF = 22.0                     # 월가용 CAPA 계수 (2026.07~)
ACTIVE = ('진행', '지연')


def d(v):
    if isinstance(v, dt.datetime): return v.date()
    if isinstance(v, dt.date): return v
    if isinstance(v, str) and v.strip():
        for f in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d', '%Y/%m/%d'):
            try: return dt.datetime.strptime(v.strip(), f).date()
            except ValueError: pass
    return None


def s(v):
    return re.sub(r'\s+', ' ', str(v)).strip() if v is not None else ''


def n(v):
    if v is None or v == '': return 0.0
    try: return float(str(v).replace(',', ''))
    except ValueError: return 0.0


def iso(x):
    return x.isoformat() if x else None


def load(path, today):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if SHEET not in wb.sheetnames:
        raise SystemExit(f'시트 없음: {SHEET} (보유: {wb.sheetnames})')
    ws = wb[SHEET]
    raw = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        code = r[C['code']]
        if not code or s(code) in ('', '프로젝트 코드'):   # 유효행 판정
            continue
        raw.append(r)
    wb.close()

    out = []
    for r in raw:
        unit = s(r[C['dept']]).replace('본사(', '').replace(')', '')
        status, method = s(r[C['status']]), s(r[C['method']])
        mdStd, mdPlan, mdUsed = n(r[C['mdStd']]), n(r[C['mdPlan']]), n(r[C['mdUsed']])
        start = d(r[C['start']])
        bp = d(r[C['dueChg']]) or d(r[C['due']])          # BP = AE 1순위 → AD 2순위
        done = d(r[C['done']])

        rec = dict(
            no=int(n(r[C['no']])) or len(out) + 1,
            code=s(r[C['code']]), customer=s(r[C['customer']]), bizno=s(r[C['bizno']]),
            product=s(r[C['product']]), server='SaaS' if 'SaaS' in s(r[C['product']]) else '구축형',
            pjtType=s(r[C['pjtType']]), module=s(r[C['module']]),
            dept=s(r[C['dept']]), unit=unit, center=CENTER.get(unit, '미매핑'),
            pm=s(r[C['pm']]), status=status, method=method,
            evidence=s(r[C['evidence']]), form=s(r[C['form']]), revFlag=s(r[C['revFlag']]),
            upsell=s(r[C['upsell']]), region=s(r[C['region']]),
            regionGrp=s(r[C['region']]).split('/')[0] if s(r[C['region']]) else '미지정',
            ucPack=s(r[C['ucPack']]),
            orderAmt=n(r[C['orderAmt']]), license=n(r[C['license']]), eduFee=n(r[C['eduFee']]),
            orderDate=iso(d(r[C['orderDate']])),
            recvDate=iso(d(r[C['recv']])), startDate=iso(start),
            installDate=iso(d(r[C['install']])),
            dueDate=iso(d(r[C['due']])), dueChgDate=iso(d(r[C['dueChg']])),
            bpDate=iso(bp), doneDate=iso(done),
            ctrStart=iso(d(r[C['ctrStart']])), ctrEnd=iso(d(r[C['ctrEnd']])),
            mdStd=mdStd, mdPlan=mdPlan, mdUsed=mdUsed,
        )

        # ── 납기 판정 (G2) ────────────────────────────────────────
        #   ① 납기준수율        : BP = 변경완료예정일(AE) 1순위 → 구축완료예정일(AD) 2순위
        #   ② 기본 구축기간 준수율: 구축완료예정일(AD) 단독 — 납기 변경(연장) 미반영
        def bucket(delta):
            return (None if delta is None else
                    '조기' if delta < 0 else '정시' if delta == 0 else '30일내' if delta <= 30
                    else '1M초과' if delta <= 60 else '2M초과' if delta <= 90 else '3M초과')

        due0 = d(r[C['due']])
        rec['dlvDelta'] = (done - bp).days if (status == '완료' and done and bp) else None
        rec['dlvBucket'] = bucket(rec['dlvDelta'])
        rec['dlvBaseDelta'] = (done - due0).days if (status == '완료' and done and due0) else None
        rec['dlvBaseBucket'] = bucket(rec['dlvBaseDelta'])
        # 납기 변경(연장)으로 준수 판정이 뒤바뀐 건
        rec['dlvExtended'] = bool(
            rec['dlvBucket'] in KEEP_BUCKETS and rec['dlvBaseBucket'] not in KEEP_BUCKETS)

        # ── 계약공수 기준 공수 산정 (G3) — 현진행 건만 ────────────
        rec.update(mdContract=0.0, mdPaidUn=0.0, mdFreeUn1=0.0, mdFinalUn=0.0,
                   remainRate=None, spRule=None)
        if status in ACTIVE:
            # 특수규칙 ③ 프로젝트구분=추가 & 모듈구분=기타 & 표준공수=0 & 예상공수=0 → 공수 0
            if rec['pjtType'] == '추가' and rec['module'] == '기타' and mdStd == 0 and mdPlan == 0:
                rec['spRule'] = '공수0'
            else:
                contract = mdStd if method in FOEX_FAMILY else mdPlan
                rec['mdContract'] = contract

                # 구축진행율(가상) = 경과기간 ÷ 구축기간(AB ~ AE→AD)
                # ※ 상한 1.0만 적용. 착수 전(음수 진행율)은 하한 클램프하지 않는다.
                #   AK(진행률%) 컬럼은 사용 금지 — FoEX(1:N) 예상공수 0 고정으로 신뢰 불가
                if start and bp and bp > start:
                    if today > bp:
                        remain = 0.05           # 특수규칙 ② 경과 미완료 → 잔여율 5% (상한 없음)
                        # 잔여율은 FoEX 1:N계열의 무상공수 산정에만 사용된다.
                        # 방문구축·FoEX(단독)은 유상(AI−AJ)만 쓰므로 규칙 적용 대상이 아니다.
                        if method in FOEX_FAMILY:
                            rec['spRule'] = '경과5%'
                    else:
                        remain = 1.0 - min(1.0, (today - start).days / (bp - start).days)
                else:
                    remain = 1.0
                rec['remainRate'] = round(remain, 6)

                if method == M_1N:                                  # 전량 무상
                    rec['mdFreeUn1'] = contract * remain
                elif method == M_MIX:                               # 유상 + 무상
                    rec['mdPaidUn'] = max(0.0, mdPlan - mdUsed)
                    rec['mdFreeUn1'] = max(0.0, mdStd - mdPlan) * remain
                else:                                               # 방문구축 / FoEX(단독)
                    rec['mdPaidUn'] = max(0.0, mdPlan - mdUsed)

                rec['mdFinalUn'] = rec['mdPaidUn'] + rec['mdFreeUn1'] * FREE_COEF
        out.append(rec)
    return out


def verify(rows, today, headcount=82):
    """항등식 검증 — 작업지침 v2 §5-1"""
    st = Counter(r['status'] for r in rows)
    total, done = len(rows), st.get('완료', 0)
    act = [r for r in rows if r['status'] in ACTIVE]

    yr = Counter(int(r['recvDate'][:4]) for r in rows if r['recvDate'])
    carry = sum(v for k, v in yr.items() if k < today.year)
    new = yr.get(today.year, 0)

    dlv = Counter(r['dlvBucket'] for r in rows if r['dlvBucket'])
    keep = dlv['조기'] + dlv['정시'] + dlv['30일내']
    dlvB = Counter(r['dlvBaseBucket'] for r in rows if r['dlvBaseBucket'])
    keepB = dlvB['조기'] + dlvB['정시'] + dlvB['30일내']
    extended = sum(1 for r in rows if r.get('dlvExtended'))

    g = defaultdict(lambda: dict(cnt=0, contract=0.0, plan=0.0, used=0.0,
                                 paid=0.0, free=0.0, final=0.0))
    for r in act:
        a = g[r['method']]
        a['cnt'] += 1
        a['contract'] += r['mdContract']; a['plan'] += r['mdPlan']
        a['used'] += 0.0 if r['method'] == M_1N else r['mdUsed']   # 1:N 투입은 산정 제외
        a['paid'] += r['mdPaidUn']; a['free'] += r['mdFreeUn1']; a['final'] += r['mdFinalUn']

    T = {k: sum(a[k] for a in g.values()) for k in ('cnt', 'contract', 'plan', 'used', 'paid', 'free', 'final')}
    un1 = T['paid'] + T['free']
    conv = T['contract'] - un1
    capa = headcount * CAPA_COEF

    # 계약기간준수율 (G4, 설치형 전용)
    pop = [r for r in rows if r['pjtType'] == '신규' and r['product'] == 'Amaranth10'
           and r['ctrStart'] and r['ctrEnd'] and r['code'] != 'PAC240528003']
    cfin = [r for r in pop if r['status'] == '완료']
    cok = sum(1 for r in cfin if r['doneDate'] and r['doneDate'] <= r['ctrEnd'])

    return dict(
        asOf=today.isoformat(), headcount=headcount, capaCoef=CAPA_COEF, capa=capa,
        total=total, status=dict(st), done=done,
        doneRate=round(done / total * 100, 2), active=len(act),
        carry=carry, new=new, carryByYear={str(k): v for k, v in sorted(yr.items())},
        delivery=dict(dlv), deliveryKeep=keep, deliveryRate=round(keep / done * 100, 1) if done else None,
        deliveryBase=dict(dlvB), deliveryBaseKeep=keepB,
        deliveryBaseJudged=sum(dlvB.values()),
        deliveryBaseRate=round(keepB / sum(dlvB.values()) * 100, 1) if sum(dlvB.values()) else None,
        deliveryExtended=extended,
        methodAgg={k: {kk: round(vv, 1) for kk, vv in v.items()} for k, v in g.items()},
        md=dict(contract=round(T['contract'], 1), plan=round(T['plan'], 1), used=round(T['used'], 1),
                paidUn=round(T['paid'], 1), freeUn1=round(T['free'], 1),
                un1=round(un1, 1), converted=round(conv, 1), finalUn=round(T['final'], 1)),
        delayM=round(T['final'] / capa, 2) if capa else None,
        spRule=dict(Counter(r['spRule'] for r in rows if r['spRule'])),
        contractTerm=dict(
            pop=len(pop) + 1, popEx=len(pop), fin=len(cfin), ok=cok, over=len(cfin) - cok,
            rate=round(cok / len(cfin) * 100, 1) if cfin else None,
            # 예외 = 변경완료예정일(AE) 보유 건 → 계약기간이 아닌 기본 구축기간(AD) 기준으로 판정
            exception=sum(1 for r in cfin if r['dueChgDate']),
            baseKeep=sum(1 for r in cfin if r['dlvBaseBucket'] in KEEP_BUCKETS),
            baseRate=round(sum(1 for r in cfin if r['dlvBaseBucket'] in KEEP_BUCKETS)
                           / len(cfin) * 100, 1) if cfin else None),
        orderAmtM=round(sum(r['orderAmt'] for r in rows) / 1_000_000),
        identity=dict(
            statusSum=sum(st.values()) == total,
            carrySum=carry + new == total,
            deliverySum=keep + dlv['1M초과'] + dlv['2M초과'] + dlv['3M초과'] == done,
            mdIdentity=abs(T['contract'] - (conv + un1)) < 0.5,
        ),
    )


# ══════════════════════════════════════════════════════════════════
#  담당자별 상세 (배정·투입 원천) — 화면정의서 slide21 공수현황(개인)
#  원본: 상세 구축 진행 현황(담당자별).xlsx / 시트 '상세 구축 진행 현황(담당자별)'
# ══════════════════════════════════════════════════════════════════
A_SHEET = '상세 구축 진행 현황(담당자별)'
A = dict(code=1, customer=2, dept=10, pm=11, status=12, method=24,
         mdStd=33, mdPlan=34, mdUsed=35, moduleOwners=46,
         person=65, personModule=66, personPlan=67, personUsed=68, personUn=69,
         addUsed=70, migUsed=71, outUsed=72, lastDate=73)


def load_assignees(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if A_SHEET not in wb.sheetnames:
        raise SystemExit(f'시트 없음: {A_SHEET} (보유: {wb.sheetnames})')
    ws = wb[A_SHEET]
    seen, out = set(), []
    for r in ws.iter_rows(min_row=2, values_only=True):
        code, person = s(r[A['code']]), s(r[A['person']])
        if not code or code == '프로젝트 코드' or not person:
            continue
        key = (code, person, s(r[A['personModule']]))
        if key in seen:                       # 동일 프로젝트×담당자×모듈 중복행 제거
            continue
        seen.add(key)
        # 프로젝트 속성(고객사·PM·구축구분 등)은 code로 조인 — 중복 저장하지 않는다
        out.append(dict(
            code=code, status=s(r[A['status']]),
            unit=s(r[A['dept']]).replace('본사(', '').replace(')', ''),
            person=person, module=s(r[A['personModule']]),
            mdPlan=n(r[A['personPlan']]), mdUsed=n(r[A['personUsed']]),
            mdUn=n(r[A['personUn']]),
            mdAdd=n(r[A['addUsed']]), mdMig=n(r[A['migUsed']]), mdOut=n(r[A['outUsed']]),
            lastDate=iso(d(r[A['lastDate']])),
        ))
    wb.close()
    return out



# ══════════════════════════════════════════════════════════════════
#  구축인력풀 (CAPA 인력마스터) — 구축인력 CAPA 관리 v2
#  시트 ①가용판정규칙 / ②인력마스터 / ④월별변동이력
# ══════════════════════════════════════════════════════════════════
P_SHEET = '②인력마스터'
P_RULE = '①가용판정규칙'
P_HIST = '④월별변동이력'
P = dict(no=0, name=1, grade=2, kind=3, center=4, region=5, module=6, career=7,
         joinDate=8, placeDate=9, isBuild=10, unavailReason=11, availFrom=12, evalDone=13)

# 규칙 ⑲ 집계 제외 그룹 — 본부장·영업구축지원·옴니UC·인턴
EXCLUDE_KINDS = ('인턴',)
GRADES = ['유닛장', '부장', '차장', '과장', '대리', '사원', '인턴']


def judge_person(r, asof, eval_months=1):
    """①가용판정규칙 우선순위 판정 — 구축제외 > 비가용 > 평가중 > 가용"""
    if s(r[P['isBuild']]).upper() != 'Y':
        return '구축제외'                                   # ① 구축직무=N
    if s(r[P['kind']]) in EXCLUDE_KINDS:
        return '구축제외'                                   # ① 제외 그룹(인턴 등)
    if s(r[P['unavailReason']]):
        return '비가용'                                     # ② 비가용사유 보유
    if s(r[P['kind']]) == '전환배치':
        # ③ 전환배치 & 기준일 < 배치일 + 평가기간  → 1차평가 미완
        if s(r[P['evalDone']]) == '평가중':
            return '평가중'
        pd = d(r[P['placeDate']])
        if pd and asof < pd + dt.timedelta(days=int(eval_months * 30.44)):
            return '평가중'
    return '가용'                                           # ④ 그 외


def load_capa(path, gcms_asof):
    wb = openpyxl.load_workbook(path, data_only=True)
    if P_SHEET not in wb.sheetnames:
        raise SystemExit(f'시트 없음: {P_SHEET} (보유: {wb.sheetnames})')

    # ── 기준일 · 평가기간 (①가용판정규칙) ──
    asof, eval_months = None, 1.0
    if P_RULE in wb.sheetnames:
        for row in wb[P_RULE].iter_rows(values_only=True):
            cells = [s(c) for c in row]
            for i, c in enumerate(cells):
                if '기준일' in c and i + 1 < len(row):
                    asof = d(row[i + 1]) or asof
                if '평가기간' in c and i + 1 < len(row):
                    try: eval_months = float(row[i + 1])
                    except (TypeError, ValueError): pass
    asof = asof or gcms_asof

    # ── ②인력마스터 ──
    rows = list(wb[P_SHEET].iter_rows(values_only=True))
    people = []
    for r in rows[2:]:
        if not r[P['name']] or not s(r[P['name']]):
            continue
        st = judge_person(r, asof, eval_months)
        people.append(dict(
            name=s(r[P['name']]), grade=s(r[P['grade']]), kind=s(r[P['kind']]),
            center=s(r[P['center']]), region=s(r[P['region']]),
            module=s(r[P['module']]).replace('-', ''), career=n(r[P['career']]),
            joinDate=iso(d(r[P['joinDate']])), placeDate=iso(d(r[P['placeDate']])),
            isBuild=s(r[P['isBuild']]).upper() == 'Y',
            unavailReason=s(r[P['unavailReason']]),
            availFrom=iso(d(r[P['availFrom']])),
            evalDone=s(r[P['evalDone']]).replace('-', ''),
            status=st,
        ))

    # ── ④월별변동이력 (전체 집계 블록) ──
    hist = []
    if P_HIST in wb.sheetnames:
        hrows = list(wb[P_HIST].iter_rows(values_only=True))
        months, base = [], None
        for r in hrows[:4]:
            cells = [s(c) for c in r]
            if '변동유형' in cells:
                i = cells.index('변동유형')
                months = [s(x) for x in r[i + 1:] if s(x)]
                base = i
                break
        if base is not None:
            for r in hrows:
                lab = s(r[base]) if base < len(r) else ''
                if lab in ('입사', '퇴사', '휴직', '복직', '전환배치', '전보', '순증감(In-Out)'):
                    vals = [n(x) for x in r[base + 1:base + 1 + len(months)]]
                    if any(vals) and not any(h['type'] == lab for h in hist):
                        hist.append(dict(type=lab, months=months, values=vals))
    wb.close()

    # ── 집계 ──
    cnt = Counter(p['status'] for p in people)
    centers = sorted({p['center'] for p in people if p['center']})
    byCenter = []
    for c in centers:
        sub = [p for p in people if p['center'] == c]
        sc = Counter(p['status'] for p in sub)
        byCenter.append(dict(
            center=c, region=(sub[0]['region'] if sub else ''), total=len(sub),
            excluded=sc['구축제외'], unavailable=sc['비가용'], evaluating=sc['평가중'],
            available=sc['가용'],
            rate=round(sc['가용'] / len(sub) * 100, 1) if sub else 0))
    byGrade = []
    for g in GRADES:
        sub = [p for p in people if p['grade'] == g]
        if not sub: continue
        byGrade.append(dict(grade=g, total=len(sub),
                            available=sum(1 for p in sub if p['status'] == '가용'),
                            byCenter={c: sum(1 for p in sub if p['center'] == c and p['status'] == '가용')
                                      for c in centers}))
    return dict(
        asOf=asof.isoformat(), evalMonths=eval_months, capaCoef=CAPA_COEF,
        total=len(people), status=dict(cnt), available=cnt['가용'],
        capa=round(cnt['가용'] * CAPA_COEF),
        byCenter=byCenter, byGrade=byGrade, centers=centers,
        reasons=dict(Counter(p['unavailReason'] for p in people if p['unavailReason'])),
        history=hist, people=people,
    )


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    argv = [a for a in sys.argv[1:] if not a.startswith('--')]
    apath = cpath = None
    for i, a in enumerate(sys.argv):
        if a == '--assignee' and i + 1 < len(sys.argv):
            apath = sys.argv[i + 1]
            argv = [x for x in argv if x != apath]
        if a == '--capa' and i + 1 < len(sys.argv):
            cpath = sys.argv[i + 1]
            argv = [x for x in argv if x != cpath]
    src = argv[0]
    today = dt.date.fromisoformat(argv[1]) if len(argv) > 1 else None
    if not today:                                   # 파일명 YYMMDD → 기준일
        m = re.search(r'(\d{6})(?=\D*$)', os.path.basename(src))
        today = dt.date(2000 + int(m.group(1)[:2]), int(m.group(1)[2:4]), int(m.group(1)[4:])) if m else dt.date.today()

    print(f'원본  : {os.path.basename(src)}')
    print(f'기준일: {today}')
    rows = load(src, today)
    v = verify(rows, today)

    print(f'\n총접수 {v["total"]:,} = 이월 {v["carry"]} + 신규 {v["new"]}   '
          f'{"OK" if v["identity"]["carrySum"] else "FAIL"}')
    print(f'상태별 {v["status"]}  합계검증 {"OK" if v["identity"]["statusSum"] else "FAIL"}')
    print(f'완료율 {v["doneRate"]}%  현진행 {v["active"]}')
    print(f'납기준수 {v["deliveryKeep"]}/{v["done"]} = {v["deliveryRate"]}%  '
          f'{"OK" if v["identity"]["deliverySum"] else "FAIL"}')
    print(f'기본 구축기간 준수 {v["deliveryBaseKeep"]}/{v["deliveryBaseJudged"]} = {v["deliveryBaseRate"]}%'
          f'  (납기 변경으로 준수 전환 {v["deliveryExtended"]}건)')
    m = v['md']
    print(f'\n계약공수 {m["contract"]:,} = 투입환산 {m["converted"]:,} + 미투입1차 {m["un1"]:,}  '
          f'{"OK" if v["identity"]["mdIdentity"] else "FAIL"}')
    print(f'미투입1차 {m["un1"]:,} = 유상 {m["paidUn"]:,} + 무상 {m["freeUn1"]:,}')
    print(f'최종미투입 {m["finalUn"]:,} = 유상 {m["paidUn"]:,} + 무상×30% {round(m["freeUn1"]*0.3,1):,}')
    print(f'구축지연 {v["delayM"]}M = {m["finalUn"]:,} ÷ CAPA {v["capa"]:,.0f}')
    print(f'특수규칙 {v["spRule"]}')
    ct = v['contractTerm']
    print(f'계약기간준수율 {ct["ok"]}/{ct["fin"]} = {ct["rate"]}%  (모집단 {ct["pop"]}→{ct["popEx"]})')
    print(f'  └ 예외(변경완료예정일 보유) {ct["exception"]}건 → 기본 구축기간(AD) 기준 '
          f'{ct["baseKeep"]}/{ct["fin"]} = {ct["baseRate"]}%')

    assignees, aMeta = [], None
    if apath:
        assignees = load_assignees(apath)
        m2 = re.search(r'(\d{8})(?=\D*$)', os.path.basename(apath))
        aDate = f'{m2.group(1)[:4]}-{m2.group(1)[4:6]}-{m2.group(1)[6:]}' if m2 else None
        people = sorted({a['person'] for a in assignees})
        act = [a for a in assignees if a['status'] in ACTIVE]
        aMeta = dict(asOf=aDate, rows=len(assignees), people=len(people),
                     activeRows=len(act),
                     activePeople=len({a['person'] for a in act}),
                     mdPlan=round(sum(a['mdPlan'] for a in act), 1),
                     mdUsed=round(sum(a['mdUsed'] for a in act), 1))
        print(f'\n[담당자별] 기준일 {aDate} · 배정 {len(assignees):,}행 · 담당자 {len(people)}명'
              f' · 현진행 배정 {len(act):,}행')
        if aDate and aDate != today.isoformat():
            print(f'  ※ 기준일 불일치 (GCMS {today} vs 담당자별 {aDate}) — 화면에 기준일 병기 필요')

    capa = None
    if cpath:
        capa = load_capa(cpath, today)
        st = capa['status']
        print(f'\n[구축인력풀] 기준일 {capa["asOf"]} · 인력 {capa["total"]}명')
        print(f'  가용 {st.get("가용",0)} · 평가중 {st.get("평가중",0)} · '
              f'비가용 {st.get("비가용",0)} · 구축제외 {st.get("구축제외",0)}')
        print(f'  산출 월가용 CAPA {capa["capa"]:,} m/d ({capa["available"]}명 × {CAPA_COEF})')
        if capa['available'] != v['headcount']:
            print(f'  ※ 현행 CAPA 스킬값 {v["headcount"]}명과 {capa["available"] - v["headcount"]:+d}명 차이 '
                  f'— 확정 실측값 재현을 위해 KPI 산출에는 {v["headcount"]}명을 유지하고 인력풀 값은 참고로 병기')

    v['assigneeMeta'] = aMeta
    v['capaMeta'] = ({k: val for k, val in capa.items() if k != 'people'} if capa else None)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    payload = dict(meta=v, rows=rows)
    if assignees:
        payload['assignees'] = assignees
    if capa:
        payload['people'] = capa['people']
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    print(f'\n생성: {OUT}  ({os.path.getsize(OUT)/1024:,.0f} KB, 프로젝트 {len(rows):,}건'
          f'{f", 배정 {len(assignees):,}행" if assignees else ""})')


if __name__ == '__main__':
    main()
