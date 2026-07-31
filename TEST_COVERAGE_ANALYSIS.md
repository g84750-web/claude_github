# 테스트 커버리지 분석 / Test Coverage Analysis

PKG 사업본부(구축) 업무보고 자동화 시스템

---

## 1. Baseline: current coverage is 0%

`tests/` contains only an empty `__init__.py`. **No test file has ever existed in this
repository** — verified against the full git history:

```
$ git log --stat --oneline    # tests/__init__.py is the only file ever added under tests/
$ python3 -m pytest tests/ -q
collected 0 items
```

Note that commits `f906e63` and `a9648e5` have messages claiming a CLI and tests were
uploaded (`... CLI, 테스트`), but neither the CLI module nor any test was actually
committed. Worth confirming whether those files exist locally somewhere and were simply
never pushed.

Statement counts, measured with `coverage` on an import-only run:

| Module | Stmts | Executed by logic tests | Notes |
|---|---:|---:|---|
| `src/models.py` | 94 | 0 | 87% of stmts are class/field declarations run at import |
| `src/insights/insight_analyzer.py` | 82 | 0 | scoring engine — highest risk |
| `src/reports/report_manager.py` | 89 | 0 | persistence + lifecycle |
| `src/scheduler/schedule_engine.py` | 72 | 0 | date math — highest bug density found |
| `src/feedback/feedback_generator.py` | 71 | 0 | grading → action mapping |
| `src/insights/trend_analyzer.py` | 36 | 0 | aggregate statistics |
| `src/notifications/notifier.py` | 31 | 0 | side-effecting I/O |
| **TOTAL** | **475** | **0** | ~300 statements are unexecuted function-body logic |

The "37%" that `coverage report` prints for a bare import is misleading — it is counting
`class`/`def`/field lines that execute at import time. **Real behavioural coverage is 0%.**

## 2. Test infrastructure is also missing

Before tests can be written productively, the scaffolding needs to exist:

- **No `pytest.ini` / `pyproject.toml` / `setup.cfg`** → no `pythonpath` setting. Every
  module does `from src.models import ...`, so tests only import correctly if the repo
  root happens to be on `sys.path`. This should be pinned explicitly.
- **No `conftest.py`** → no shared fixtures. Every test will otherwise re-create a
  `ScheduleEngine`, a `tmp_path` store, and sample `Report` objects by hand.
- **No CI workflow** (`.github/` does not exist) → nothing runs tests on push.
- **`coverage` is not in `requirements.txt`** (only `pyyaml` and `pytest`).
- **Config files are load-bearing but untested.** `config/schedule.yaml` and
  `config/units.yaml` drive scoring weights, deadlines, and reminder text. They are read
  at construction time with no schema validation.

---

## 3. Priority areas — ranked

Each item below was verified by executing the code, not by reading it. The bugs are listed
as evidence of *why* the area needs coverage; this document proposes tests, it does not
fix them.

### P0 — `ScheduleEngine.get_next_monthly_deadline()` (date math)

This function has two confirmed defects, both of which silently break the core scheduling
promise of the system.

**(a) Hard crash every November.** When called with a base date after November's deadline,
line 33 computes `base.month + 2` = 13 and `datetime()` raises:

```
from 2026-11-30 23:00 -> CRASH ValueError: month must be in 1..12
```

**(b) Months are silently skipped.** Whenever a month's last calendar day falls on a
weekend, the recursion overshoots and that month's deadline is never generated:

```
from 2026-01-31 -> 2026-03-31   # February skipped entirely
from 2026-04-30 -> 2026-06-30   # May skipped
from 2026-09-30 -> 2026-11-30   # October skipped
from 2026-12-31 -> 2027-03-31   # January AND February skipped
```

In 2026 that is four months with no monthly report deadline at all.

**Tests to add:** a parametrized sweep over all 12 months × (before deadline / after
deadline) asserting the returned deadline is (i) strictly in the future, (ii) in the
*immediately* following reporting period, (iii) a weekday. Add year-boundary and leap-year
(2028-02-29) cases. This single table would have caught both bugs.

### P0 — `FeedbackGenerator.determine_action()` (score → action mapping)

`config/schedule.yaml` defines score ranges as integer `min`/`max` pairs (`90–100`,
`75–89`, `60–74`, `0–59`), but scores are rounded to **one decimal** by
`InsightAnalyzer.compute_total_score()`. Fractional scores in the gaps match no range and
fall through to the `return FeedbackAction.APPROVED` default:

```
score  89.5 -> 승인          # should be 승인_보완권고
score  74.5 -> 승인          # should be 보완요청
score  59.5 -> 승인          # should be 재제출요청  ← failing report auto-approved
```

A report scoring 59.5 (미흡) is **approved**. This is the most damaging bug in the
codebase — it inverts the outcome for the worst reports.

It also desyncs from `generate_summary()`, which uses the same range lookup with a
`'미흡'` fallback, so a 59.5-point report is labelled 미흡 in the summary text while
carrying an 승인 action.

**Tests to add:** boundary-value tests at `0, 59, 59.5, 60, 74, 74.5, 75, 89, 89.5, 90,
100` asserting the action, plus an invariant test that `determine_action()` and the grade
label in `generate_summary()` never disagree. Also assert the ranges in the YAML are
contiguous and cover `[0, 100]`.

### P1 — `ReportManager.get_overdue_reports()` (false escalations)

Overdue detection compares schedule entries against reports with status `SUBMITTED`
**only**. Once a report advances to `UNDER_REVIEW` / `REVIEWED` / `APPROVED`, it drops out
of the "submitted" set and is re-flagged as overdue:

```
after SUBMITTED  -> 0 overdue
after REVIEWED   -> 1 overdue   # the report was submitted on time
```

Because `Notifier.send_escalation()` reports to 사업본부장, this generates false
escalations against units that submitted correctly.

**Tests to add:** one test per `ReportStatus` asserting overdue-ness, and a full-lifecycle
test (DRAFT → SUBMITTED → UNDER_REVIEW → REVIEWED → APPROVED) asserting the report is
never flagged overdue after submission.

### P1 — `ReportStore` persistence (round-trip + malformed input)

Serialization is hand-rolled in `save()`/`_des()` with no shared schema, so the two can
drift silently. Round-trip fidelity currently holds (verified, including microseconds),
which makes it exactly the kind of property worth locking down before someone adds a
field to `ReportContent` and forgets one of the two methods.

`list_reports()` also crashes on any unexpected `.json` file in the data directory:

```
$ echo '{"hello": 1}' > data/reports/junk.json
CRASH KeyError: 'content'
```

**Tests to add:** a round-trip property test over a fully-populated `Report` (all optional
timestamps set, non-ASCII text, multiple insights) asserting field-by-field equality; a
test that every `ReportContent`/`Report` dataclass field survives the round-trip (guards
against drift); malformed/truncated/non-report JSON handling; and filter combinations for
`list_reports(unit_id=, report_type=, status=)` including the empty-directory case.

### P1 — `InsightAnalyzer` scoring (the system's core judgement)

82 statements, zero coverage, and every branch produces a number that decides a unit's
grade. Untested behaviours worth pinning:

- `analyze_completeness()` — 0 / partial / all items filled; whitespace-only values (the
  `.strip()` path); a unit with no configured items returning `100.0`; an **unknown
  `unit_id`**, which currently returns a perfect 100.0 rather than erroring.
- `analyze_insight_quality()` — the 50/50 coverage-vs-quality blend, empty insight list,
  more insights than expected (the `min(..., 100.0)` clamp).
- `analyze_action_items()` — the three penalties stack to a floor of 15.0; assert
  `max(score, 0.0)` actually holds.
- `analyze_timeliness()` — on-time, exactly-at-deadline, late enough to clamp to 0.0.
- `compute_total_score()` — assert the four YAML weights sum to 100 (a config typo here
  silently rescales every score in the system).

### P2 — `InsightItem.has_numeric_value()` (unguarded `AttributeError`)

Only `ValueError` is caught, so any non-`str` value crashes:

```
'85%'   -> True
'1,200' -> True
'N/A'   -> False
None    -> CRASH AttributeError: 'NoneType' object has no attribute 'replace'
85      -> CRASH AttributeError: 'int' object has no attribute 'replace'
```

`value` is typed `str`, but it is populated from deserialized JSON, so a null in a stored
report propagates a crash up through `analyze_insight_quality()` → `generate()`.

**Tests to add:** parametrized cases covering `%`, thousands separators, negatives,
decimals, empty string, `None`, `int`, and mixed text like `"85% 달성"`.

### P2 — Reminder logic in `ScheduleEngine.get_reminder_messages()`

Monthly reminders use `0 <= hours_left/24 <= r['days'] + 0.1`, which matches **every**
threshold at or above the remaining time, so multiple reminders fire at once:

```
1 day before deadline ->
   - 월간보고 제출 마감 5일 전입니다.
   - 월간보고 제출 마감 2일 전입니다.
```

Both the 5-day and 2-day notices are sent one day out. The weekly path has a related
issue: `now.minute < m + 10` is unbounded, so a reminder configured for `:55` fires for
the entire hour.

**Tests to add:** assert exactly one reminder per threshold crossing; the weekly
day/time-window match including the minute boundary; the `hours_left < 0` (마감초과) and
`< 2` (긴급) messages; and the exact-boundary case at 17:00 on Friday, where
`get_next_weekly_deadline()` currently rolls to the following week (verified — worth
pinning as intended behaviour or fixing).

### P2 — `TrendAnalyzer` aggregates

All six methods are pure functions over lists — the cheapest coverage in the repo.
Division-by-zero guards (`total_units == 0`, empty `feedbacks`, no reports with both
`submitted_at` and `deadline`) all exist but are unverified. `generate_summary_report()`
builds a bar chart with `'█' * int(score/10) + '░' * (10 - int(score/10))`, which produces
an 11-character bar at exactly 100.0 — a rendering test would catch it.

### P3 — `Notifier` I/O

`_log()` both prints and appends to a file. Tests should use `tmp_path` for `log_path` and
`capsys` for stdout, and assert log lines are written for each notification type. Note
`Notifier.__init__` calls `os.makedirs` on the log directory as a side effect of
construction — worth a test that a bare filename (no directory component) doesn't break.

---

## 4. Proposed test layout

```
conftest.py                          # pythonpath, shared fixtures
pytest.ini                           # pythonpath = ., testpaths = tests
tests/
  conftest.py                        # sample_report, engine, tmp store fixtures
  test_models.py                     # P2  has_numeric_value, is_overdue, hours_until_deadline
  test_schedule_engine.py            # P0  the 12-month deadline table, reminders, escalation
  test_report_manager.py             # P1  round-trip, lifecycle guards, overdue, list filters
  test_insight_analyzer.py           # P1  four scorers + weighting + compare_with_previous
  test_feedback_generator.py         # P0  score→action boundaries, summary consistency
  test_trend_analyzer.py             # P2  aggregates, empty inputs, bar rendering
  test_notifier.py                   # P3  log file + stdout
  test_config_validation.py          # P1  YAML schema: weights sum to 100, ranges contiguous
```

Suggested fixtures in `tests/conftest.py`: `engine` (a `ScheduleEngine` over the real
config), `store` (a `ReportManager` on `tmp_path`), `sample_report` (a fully-populated
`Report`), and `frozen_now` (a fixed `datetime` — every module calls `datetime.now()`
directly, so time must be injected via the existing `now=`/`from_date=` parameters).

## 5. Recommended sequence

1. **Add the scaffolding first** — `pytest.ini` with `pythonpath = .`, `conftest.py`
   fixtures, `coverage` in `requirements.txt`, and a GitHub Actions workflow running
   `pytest --cov=src`. Without this, nothing else is repeatable.
2. **Write the P0 tests as failing tests** — the monthly-deadline table and the
   score-boundary table. Both encode correct behaviour and both fail today; they become
   the specification for the fixes.
3. **Fix the P0 bugs**, then P1 and P2.
4. **Set a coverage floor in CI** — start at 60% and ratchet up. `src/models.py`,
   `trend_analyzer.py`, and `notifier.py` are cheap wins that get there quickly;
   `insight_analyzer.py` and `schedule_engine.py` are where the value is.

**A note on scope:** the two P0 items are not hypothetical edge cases — a November crash
and the auto-approval of failing reports both affect normal production operation. I would
treat them as bugs to fix now, with the tests written alongside, rather than as a coverage
backlog item.
