# PKG 사업본부(구축) 업무보고 자동화 시스템 — 상세 사용 설명서

> 이 설명서는 시스템을 처음 접하는 담당자도 쉽게 따라할 수 있도록 작성되었습니다.

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [파일 구조 설명](#2-파일-구조-설명)
3. [설치 방법](#3-설치-방법)
4. [빠른 시작 (데모)](#4-빠른-시작-데모)
5. [명령어 상세 설명](#5-명령어-상세-설명)
6. [자동화 설정 (cron)](#6-자동화-설정-cron)
7. [설정 파일 수정 방법](#7-설정-파일-수정-방법)
8. [보고서 작성 방법](#8-보고서-작성-방법)
9. [검토 기준 및 점수 산출](#9-검토-기준-및-점수-산출)
10. [피드백 해석 방법](#10-피드백-해석-방법)
11. [자주 묻는 질문 (FAQ)](#11-자주-묻는-질문-faq)
12. [오류 해결 방법](#12-오류-해결-방법)

---

## 1. 시스템 개요

이 시스템은 PKG 사업본부(구축) 내 **6개 유닛**의 주간·월간 업무보고를 자동으로 관리합니다.

### 무엇을 자동으로 해주나요?

```
유닛장이 보고서 작성 → 시스템이 자동으로 검토 → 점수와 피드백을 자동 발송
```

| 자동화 항목 | 설명 |
|------------|------|
| 스케줄 관리 | 매주 금요일 17:00 / 매월 마지막 영업일 17:00 마감을 자동 계산 |
| 리마인더 발송 | D-2일(수요일), 당일(금요일) 오전에 자동 알림 |
| 보고서 검토 | 제출 즉시 4가지 기준으로 자동 점수화 |
| 피드백 생성 | 점수에 따라 승인/보완요청/재제출 자동 판정 |
| 에스컬레이션 | 마감 2시간 초과 시 사업본부장 자동 보고 |
| 통계/트렌드 | 유닛별 점수 추이 및 제출 현황 자동 집계 |

### 대상 유닛

| 유닛 ID | 유닛명 | 역할 |
|---------|--------|------|
| PM | PM 유닛 | 프로젝트 관리·일정 통제 |
| DEV | 개발 유닛 | 소프트웨어 개발·구현 |
| INFRA | 인프라 유닛 | 서버·네트워크·클라우드 구축 |
| QA | 품질보증 유닛 | 테스트·품질 관리 |
| BIZ | 영업/사업관리 유닛 | 영업·계약·사업 관리 |
| SUPPORT | 지원 유닛 | 행정·인력·자원 지원 |

---

## 2. 파일 구조 설명

```
claude_github/
│
├── main.py                 ← 모든 명령어의 시작점 (여기서 실행)
├── runner.py               ← 백그라운드 자동 실행기
├── requirements.txt        ← 필요한 Python 패키지 목록
│
├── config/                 ← ★ 설정 파일 (필요 시 수정)
│   ├── units.yaml          ← 유닛 목록 및 핵심 인사이트 기준 정의
│   └── schedule.yaml       ← 마감일·검토기준·피드백 규칙 설정
│
├── src/                    ← 시스템 핵심 코드 (수정 불필요)
│   ├── models.py           ← 데이터 구조 정의
│   ├── automation.py       ← 전체 자동화 흐름 제어
│   ├── scheduler/          ← 스케줄 계산 엔진
│   ├── reports/            ← 보고서 저장·관리
│   ├── insights/           ← 인사이트 분석·통계
│   ├── feedback/           ← 자동 피드백 생성
│   └── notifications/      ← 알림·에스컬레이션
│
├── data/                   ← 런타임 데이터 (자동 생성됨)
│   ├── reports/            ← 제출된 보고서 저장 (JSON 파일)
│   ├── feedback/           ← 생성된 피드백 저장 (JSON 파일)
│   ├── notifications.log   ← 알림 로그 기록
│   └── runner.log          ← 자동 실행 로그
│
├── scripts/
│   └── crontab_example.txt ← cron 자동 실행 설정 예시
│
└── tests/                  ← 자동화 테스트 코드
    ├── test_scheduler.py
    ├── test_insight_analyzer.py
    └── test_feedback_generator.py
```

---

## 3. 설치 방법

### 사전 준비

- **Python 3.8 이상** 필요
  - 확인 방법: 터미널에서 `python --version` 또는 `python3 --version` 입력
  - 없으면: https://python.org 에서 다운로드

### 설치 단계

**Step 1. 저장소 받기**

```bash
# GitHub에서 코드 받기
git clone https://github.com/g84750-web/claude_github.git

# 프로젝트 폴더로 이동
cd claude_github
```

**Step 2. 가상환경 만들기** (권장 — 다른 프로그램과 충돌 방지)

```bash
# 가상환경 생성
python -m venv venv

# 가상환경 활성화
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

**Step 3. 필요 패키지 설치**

```bash
pip install -r requirements.txt
```

설치 완료 확인:
```
Successfully installed pyyaml-6.x
```

**Step 4. 설치 확인**

```bash
python main.py --help
```

아래와 같이 출력되면 성공입니다:
```
usage: main.py [-h] {dashboard,schedule,create,...} ...
PKG 사업본부(구축) 업무보고 자동화 시스템
```

---

## 4. 빠른 시작 (데모)

설치 후 가장 먼저 **데모를 실행**하여 전체 흐름을 확인하세요.

```bash
python main.py demo
```

이 명령 하나로 다음을 자동으로 실행합니다:
1. 현황 대시보드 표시
2. 6개 유닛 보고서 자동 생성·제출
3. 전체 자동 검토·피드백 발송
4. 최종 현황 표시

**데모 결과 확인:**
```bash
# 생성된 보고서 파일 확인
ls data/reports/

# 생성된 피드백 파일 확인
ls data/feedback/

# 알림 로그 확인
cat data/notifications.log
```

---

## 5. 명령어 상세 설명

### 5-1. dashboard — 현황 대시보드

```bash
python main.py dashboard
```

**언제 사용하나요?**
- 아침에 출근하자마자 전체 제출 현황을 한눈에 보고 싶을 때

**출력 예시:**
```
=================================================================
  PKG 사업본부(구축) 업무보고 현황 대시보드
  기준시각: 2026-05-08 09:00:00
=================================================================
[주간보고 현황]
유닛명                  마감일시                 제출현황
-----------------------------------------------------------------
PM 유닛                2026-05-08 17:00     ✔ 제출완료
개발 유닛                2026-05-08 17:00     ○ 대기중
인프라 유닛               2026-05-08 17:00     ⚠ 마감초과
```

- ✔ 제출완료: 정상 제출됨
- ○ 대기중: 아직 마감 전, 미제출
- ⚠ 마감초과: 마감이 지났는데 미제출 → 즉시 연락 필요

---

### 5-2. schedule — 스케줄 조회

```bash
python main.py schedule
```

**언제 사용하나요?**
- 이번 주/이번 달 마감일이 언제인지 확인할 때

**출력 예시:**
```
유닛ID     보고유형   마감일시                D-Day
------------------------------------------------------------
PM         주간      2026-05-08 17:00       D-2
DEV        주간      2026-05-08 17:00       D-2
PM         월간      2026-05-29 17:00       D-23
```

---

### 5-3. create — 보고서 초안 생성

```bash
# 형식
python main.py create --unit [유닛ID] --type [weekly 또는 monthly]

# 예시: PM 유닛 주간보고 초안 생성
python main.py create --unit PM --type weekly

# 예시: DEV 유닛 월간보고 초안 생성
python main.py create --unit DEV --type monthly
```

**언제 사용하나요?**
- 보고서를 작성하기 시작할 때 빈 양식을 만들고 싶을 때

**결과:**
```
보고서 초안이 생성되었습니다.
  보고서 ID : PM_weekly_20260508_abc123
  유닛      : PM 유닛 (PM)
  마감일시  : 2026-05-08 17:00
  저장위치  : data/reports/PM_weekly_20260508_abc123.json
```

생성된 JSON 파일을 텍스트 편집기로 열어 내용을 작성한 후 제출하면 됩니다.

---

### 5-4. submit — 데모 보고서 제출

```bash
# 형식
python main.py submit --unit [유닛ID] --type [weekly 또는 monthly]

# 예시: PM 유닛 주간보고 샘플 제출
python main.py submit --unit PM --type weekly
```

> ⚠️ 이 명령은 **샘플 데이터**로 제출을 테스트합니다.
> 실제 운영 시에는 코드에서 `fill_and_submit()` 함수를 직접 호출하거나,
> 생성된 JSON 파일을 작성 후 API를 통해 제출합니다.

---

### 5-5. review — 보고서 검토 및 피드백

```bash
# 제출된 모든 보고서 한 번에 검토
python main.py review --all

# 특정 보고서 하나만 검토
python main.py review --id PM_weekly_20260508_abc123
```

**출력 예시:**
```
[검토 결과]
  보고서 ID  : PM_weekly_20260506070543_4f61f8
  종합 점수  : 97.0점
  조치       : 승인

  요약:
  [PM 유닛] 2026.05.01~2026.05.07 주간보고서 검토 결과입니다.
  종합 점수: 97.0점 (우수) | 완성도: 100점 | 인사이트: 90점 | ...

  우수 항목:
    + 보고서 필수 항목 작성이 충실합니다. (완성도: 100점)
    + 기한 내 적시에 제출되었습니다.

  개선 권고:
    - 핵심 인사이트 수치 지표를 더 상세하게 작성하세요.
```

---

### 5-6. remind — 리마인더 발송

```bash
python main.py remind
```

**언제 사용하나요?**
- cron에 등록하거나, 수동으로 알림을 보내고 싶을 때
- 보통 수요일 오전, 금요일 오전에 실행

알림은 `data/notifications.log`에 기록됩니다.

---

### 5-7. escalate — 에스컬레이션 처리

```bash
python main.py escalate
```

**언제 사용하나요?**
- 마감 후 2시간이 지나도 미제출인 유닛이 있을 때
- cron에 등록하여 매일 오후 7시에 자동 실행 권장

에스컬레이션 발생 시 `data/notifications.log`에 기록:
```
[2026-05-08 19:00:00] [ESCALATION] [사업본부장에게 보고] [인프라 유닛] 주간보고 미제출 | 초과: 2.0시간
```

---

### 5-8. stats — 통계 및 트렌드 분석

```bash
# 전체 현황 통계
python main.py stats

# 특정 유닛 점수 추이 포함
python main.py stats --unit PM
```

**출력 예시:**
```
[전체 현황]
  주간보고 제출률    : 100.0%
  월간보고 제출률    : 0.0%
  기한 내 제출률     : 100.0%
  보고서 승인률      : 100.0%

[유닛별 평균 점수]
  PM 유닛                █████████░ 97.0점
  개발 유닛                ████████░░ 87.2점

[PM 유닛 점수 추이]
  2026-05-06  █████████ 97.0점  (승인)
```

---

### 5-9. demo — 전체 워크플로우 데모

```bash
python main.py demo
```

처음 설치 후 시스템 전체를 테스트할 때 사용합니다.
모든 유닛의 샘플 보고서를 자동으로 생성·제출·검토·피드백합니다.

---

## 6. 자동화 설정 (cron)

**cron**은 정해진 시간에 자동으로 명령어를 실행하는 Linux/Mac 기능입니다.

### 설정 방법

```bash
# crontab 편집기 열기
crontab -e
```

편집기가 열리면 아래 내용을 붙여넣고 저장하세요.
`/경로/claude_github` 부분을 실제 설치 경로로 바꾸세요.

```cron
# 매일 오전 9시: 리마인더 + 자동 처리 (월~금)
0 9 * * 1-5 cd /경로/claude_github && python runner.py --once >> data/cron.log 2>&1

# 매일 오후 5시: 마감 직후 자동 처리
0 17 * * 1-5 cd /경로/claude_github && python runner.py --once >> data/cron.log 2>&1

# 매일 오후 7시: 에스컬레이션 확인
0 19 * * 1-5 cd /경로/claude_github && python main.py escalate >> data/cron.log 2>&1
```

### 백그라운드 상시 실행 방법

```bash
# 60분 간격으로 계속 실행 (터미널을 닫아도 유지)
nohup python runner.py --interval 60 &

# 실행 확인
ps aux | grep runner.py

# 중지
kill [프로세스번호]
```

---

## 7. 설정 파일 수정 방법

### 7-1. 유닛 추가 (`config/units.yaml`)

새 유닛을 추가하려면 `config/units.yaml` 파일을 열어 아래 형식으로 추가하세요.

```yaml
units:
  # ... 기존 유닛들 ...

  - id: "NEW"              # ← 영문 약어 (대문자, 고유해야 함)
    name: "신규 유닛"       # ← 한글 유닛명
    description: "역할 설명"
    head: "유닛장 이름"
    key_insights:          # ← 이 유닛의 핵심 측정 지표 (5개 내외 권장)
      - "핵심 지표 1"
      - "핵심 지표 2"
    weekly_items:          # ← 주간보고 필수 작성 항목
      - "주간 진행 현황"
      - "금주 완료 작업"
      - "차주 계획"
      - "현안 및 리스크"
    monthly_items:         # ← 월간보고 필수 작성 항목
      - "월간 현황 요약"
      - "주요 성과"
      - "차월 계획"
```

> 수정 후 `main.py`의 `--unit` 선택지에도 새 ID를 추가해야 합니다.
> (`main.py` 파일에서 `choices=["PM", "DEV", ...]` 부분 수정)

---

### 7-2. 마감 시각 변경 (`config/schedule.yaml`)

```yaml
schedule:
  weekly:
    deadline_time: "17:00"   # ← 원하는 시각으로 변경 (예: "18:00")
  monthly:
    deadline_time: "17:00"
```

---

### 7-3. 검토 기준 가중치 변경 (`config/schedule.yaml`)

```yaml
review_criteria:
  completeness:
    weight: 30       # 완성도 가중치 (%)
  insight_quality:
    weight: 30       # 인사이트품질 가중치 (%)
  action_items:
    weight: 20       # 실행계획 가중치 (%)
  timeliness:
    weight: 20       # 적시성 가중치 (%)
                     # ↑ 4개 합계가 반드시 100이 되어야 함
```

---

### 7-4. 점수 등급 기준 변경 (`config/schedule.yaml`)

```yaml
feedback_rules:
  score_ranges:
    excellent:
      min: 90          # 90점 이상 → 우수 → 승인
      max: 100
    good:
      min: 75          # 75~89점 → 양호 → 승인+보완권고
      max: 89
    needs_improvement:
      min: 60          # 60~74점 → 보완필요 → 보완요청
      max: 74
    insufficient:
      min: 0           # 59점 이하 → 미흡 → 재제출
      max: 59
```

---

## 8. 보고서 작성 방법

### 보고서 JSON 파일 구조

`python main.py create --unit PM --type weekly` 실행 후
`data/reports/` 폴더의 JSON 파일을 열면 아래와 같은 구조가 나타납니다.

```json
{
  "id": "PM_weekly_20260508_abc123",
  "unit_id": "PM",
  "report_type": "weekly",
  "status": "초안",
  "content": {
    "items": {
      "주간 진행 현황": "",        ← 여기에 내용 작성
      "금주 완료 작업": "",
      "차주 계획": "",
      "현안 및 리스크": ""
    },
    "insights": [               ← 핵심 인사이트 (수치 포함 필수)
      {
        "metric": "프로젝트 진행률 (%)",
        "value": "75%",         ← 반드시 수치 포함
        "target": "80%",        ← 목표값
        "trend": "상승",         ← 상승/하락/유지
        "comment": "전주 대비 3% 향상"
      }
    ],
    "action_items": [           ← 실행 계획 (최소 2개 이상)
      "리스크 대응 계획 수립",
      "마일스톤 점검 미팅 실시"
    ],
    "risks": [                  ← 리스크 항목
      "외부 API 연동 지연 - 고위험"
    ],
    "next_period_plan": "다음 주 주요 계획 작성"
  }
}
```

### 좋은 보고서 작성 팁

**핵심 인사이트 작성 시:**
```
✗ 나쁜 예: "value": "진행 중"          → 수치 없음 → 감점
✓ 좋은 예: "value": "75%"             → 수치 포함 → 만점
✓ 더 좋은 예: "value": "75%", "target": "80%", "trend": "상승"
```

**실행 계획 작성 시:**
```
✗ 나쁜 예: "계속 진행"                 → 구체성 없음 → 감점
✓ 좋은 예: "5월 10일까지 API 명세 확정 후 개발팀 공유"
```

---

## 9. 검토 기준 및 점수 산출

보고서가 제출되면 시스템이 4가지 기준으로 자동 평가합니다.

### 점수 계산 방식

```
종합점수 = 완성도(30%) + 인사이트품질(30%) + 실행계획(20%) + 적시성(20%)
```

| 항목 | 가중치 | 만점 조건 | 감점 조건 |
|------|--------|-----------|-----------|
| 완성도 | 30% | 필수 항목 100% 작성 | 미작성 항목 1개당 감점 |
| 인사이트 품질 | 30% | 모든 지표에 수치·목표 포함 | 수치 없는 지표는 50% 점수 |
| 실행 계획 | 20% | Action Items 3개+, 차주 계획 작성 | 없을 시 40점 감점 |
| 적시성 | 20% | 마감 전 제출 | 1시간 초과당 5점 감점 |

### 등급 및 조치

| 점수 | 등급 | 조치 | 의미 |
|------|------|------|------|
| 90~100 | 우수 | **승인** | 즉시 승인 처리 |
| 75~89 | 양호 | **승인 + 보완 권고** | 승인하되 개선 사항 안내 |
| 60~74 | 보완필요 | **보완 요청** | 수정 후 24시간 내 재제출 |
| 0~59 | 미흡 | **재제출 요청** | 전면 재작성 후 48시간 내 제출 |

---

## 10. 피드백 해석 방법

피드백 파일은 `data/feedback/fb_[보고서ID].json`에 저장됩니다.

```json
{
  "score": {
    "completeness": 100.0,      ← 완성도 점수
    "insight_quality": 90.0,    ← 인사이트 품질 점수
    "action_items": 100.0,      ← 실행계획 점수
    "timeliness": 100.0,        ← 적시성 점수
    "total": 97.0               ← 종합 점수
  },
  "action": "승인",             ← 조치 결과
  "summary": "...",             ← 요약문
  "strengths": [                ← 잘한 점
    "보고서 필수 항목 작성이 충실합니다."
  ],
  "improvements": [             ← 개선 권고 사항
    "인사이트 수치를 더 상세하게 작성해 주세요."
  ],
  "required_revisions": []      ← 필수 수정 사항 (보완요청 시 채워짐)
}
```

---

## 11. 자주 묻는 질문 (FAQ)

**Q. 보고서를 제출했는데 피드백이 안 와요.**

`python main.py review --all` 명령을 실행하세요.
자동 실행(cron)이 설정되어 있지 않으면 수동으로 실행해야 합니다.

---

**Q. 마감일을 변경하고 싶어요.**

`config/schedule.yaml` 파일에서 `deadline_time` 값을 변경하세요.
주간 마감일 요일은 현재 코드에서 금요일로 고정되어 있으며,
변경이 필요하면 `src/scheduler/schedule_engine.py`의
`get_next_weekly_deadline()` 함수에서 `weekday() == 4` 부분을 수정하세요.
(0=월, 1=화, 2=수, 3=목, 4=금, 5=토, 6=일)

---

**Q. 새 유닛을 추가하려면 어떻게 하나요?**

1. `config/units.yaml`에 유닛 정보 추가 (위 7-1 참고)
2. `main.py`에서 `choices=["PM", "DEV", ...]` 목록에 새 ID 추가

---

**Q. 데이터를 초기화하고 싶어요.**

```bash
rm -rf data/reports/ data/feedback/ data/notifications.log
```

> ⚠️ 삭제한 데이터는 복구되지 않습니다.

---

**Q. 테스트를 실행하려면?**

```bash
python -m pytest tests/ -v
```

25개 테스트가 모두 통과해야 정상입니다.

---

## 12. 오류 해결 방법

### "ModuleNotFoundError: No module named 'yaml'"

```bash
pip install -r requirements.txt
```

### "FileNotFoundError: config/units.yaml"

실행 위치가 잘못된 경우입니다. `claude_github` 폴더 안에서 실행하세요.

```bash
cd /경로/claude_github
python main.py dashboard
```

### "ValueError: 유닛 ID 'XXX'가 존재하지 않습니다"

유닛 ID가 잘못되었습니다. 사용 가능한 ID: `PM`, `DEV`, `INFRA`, `QA`, `BIZ`, `SUPPORT`

### 보고서 파일이 너무 많이 쌓일 때

```bash
# 30일 이상 된 보고서 삭제 (Mac/Linux)
find data/reports/ -mtime +30 -delete
find data/feedback/ -mtime +30 -delete
```

### cron이 실행되지 않을 때

```bash
# cron 서비스 상태 확인
systemctl status cron

# 로그 확인
tail -f data/cron.log
```

---

## 부록: 전체 명령어 요약표

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `dashboard` | 전체 제출 현황 대시보드 | `python main.py dashboard` |
| `schedule` | 마감일 스케줄 조회 | `python main.py schedule` |
| `create` | 보고서 초안 생성 | `python main.py create --unit PM --type weekly` |
| `submit` | 데모 보고서 제출 | `python main.py submit --unit PM --type weekly` |
| `review --all` | 전체 자동 검토 | `python main.py review --all` |
| `review --id` | 특정 보고서 검토 | `python main.py review --id PM_weekly_...` |
| `remind` | 리마인더 발송 | `python main.py remind` |
| `escalate` | 에스컬레이션 처리 | `python main.py escalate` |
| `stats` | 통계 분석 | `python main.py stats --unit PM` |
| `demo` | 전체 워크플로우 데모 | `python main.py demo` |
| (runner) | 주기적 자동 실행 | `python runner.py --interval 60` |
| (runner) | 1회 즉시 실행 | `python runner.py --once` |
| (test) | 테스트 실행 | `python -m pytest tests/ -v` |
