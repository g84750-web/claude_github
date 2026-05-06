# PKG 사업본부(구축) 업무보고 자동화 시스템

PKG 사업본부 구축 부문 각 유닛의 **주간/월간 업무보고 스케줄링·검토·피드백을 자동화**하는 시스템입니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 스케줄 자동 생성 | 매주 금요일 17:00 / 매월 마지막 영업일 17:00 마감 자동 계산 |
| 리마인더 발송 | D-2일, 당일 오전 자동 알림 |
| 보고서 초안 생성 | 유닛별 필수 항목 템플릿 자동 생성 |
| 자동 검토 | 완성도·인사이트품질·실행계획·적시성 4개 기준 점수화 |
| 자동 피드백 | 점수 기반 승인/보완요청/재제출 자동 판정 및 피드백 생성 |
| 에스컬레이션 | 마감 2시간 초과 미제출 시 사업본부장 자동 에스컬레이션 |
| 대시보드 | 전 유닛 제출현황 터미널 대시보드 |

---

## 대상 유닛

- **PM 유닛** - 프로젝트 관리 및 일정 통제
- **개발 유닛** - 소프트웨어 개발 및 구현
- **인프라 유닛** - 서버/네트워크/클라우드 구축
- **품질보증 유닛** - 테스트 및 품질 관리
- **영업/사업관리 유닛** - 영업·계약·사업 관리
- **지원 유닛** - 행정·인력·자원 지원

---

## 검토 기준

| 항목 | 가중치 | 기준 |
|------|--------|------|
| 완성도 | 30% | 필수 항목 작성률 80% 이상 |
| 인사이트 품질 | 30% | 핵심 지표 수치/목표 포함 |
| 실행 계획 | 20% | Action Items 명확성 |
| 적시성 | 20% | 기한 내 제출 (시간당 5점 감점) |

| 종합 점수 | 등급 | 조치 |
|-----------|------|------|
| 90~100 | 우수 | 승인 |
| 75~89 | 양호 | 승인 + 보완 권고 |
| 60~74 | 보완필요 | 보완 요청 |
| 0~59 | 미흡 | 재제출 요청 |

---

## 프로젝트 구조

```
.
├── main.py                    # CLI 진입점
├── requirements.txt
├── config/
│   ├── units.yaml             # 유닛 및 핵심 인사이트 설정
│   └── schedule.yaml          # 스케줄 및 검토 기준 설정
├── src/
│   ├── models.py              # 데이터 모델
│   ├── automation.py          # 자동화 오케스트레이터
│   ├── scheduler/
│   │   └── schedule_engine.py # 스케줄 계산 엔진
│   ├── reports/
│   │   └── report_manager.py  # 보고서 CRUD 및 워크플로우
│   ├── insights/
│   │   └── insight_analyzer.py# 핵심 인사이트 분석
│   ├── feedback/
│   │   └── feedback_generator.py # 자동 피드백 생성
│   └── notifications/
│       └── notifier.py        # 알림 및 에스컬레이션
└── data/                      # 런타임 데이터 (자동 생성)
    ├── reports/               # 보고서 JSON 저장
    ├── feedback/              # 피드백 JSON 저장
    └── notifications.log      # 알림 로그
```

---

## 설치 및 실행

```bash
# 의존성 설치 (Python 3.8+ 필요)
pip install -r requirements.txt

# 전체 워크플로우 데모
python main.py demo

# 현황 대시보드
python main.py dashboard

# 스케줄 조회
python main.py schedule

# 유닛별 보고서 초안 생성
python main.py create --unit PM --type weekly

# 데모 데이터로 보고서 제출
python main.py submit --unit PM --type weekly

# 제출된 모든 보고서 자동 검토
python main.py review --all

# 특정 보고서 검토
python main.py review --id <보고서ID>

# 리마인더 발송
python main.py remind

# 에스컬레이션 처리
python main.py escalate
```

---

## 핵심 설정 변경

### 유닛 추가/수정: `config/units.yaml`
```yaml
units:
  - id: "NEW_UNIT"
    name: "신규 유닛명"
    key_insights:
      - "핵심 지표 1"
      - "핵심 지표 2"
    weekly_items:
      - "주간 필수 항목 1"
    monthly_items:
      - "월간 필수 항목 1"
```

### 스케줄/기준 수정: `config/schedule.yaml`
- `schedule.weekly.deadline_time`: 주간보고 마감 시각
- `review_criteria.*.weight`: 검토 기준 가중치
- `feedback_rules.score_ranges`: 점수 등급 기준
