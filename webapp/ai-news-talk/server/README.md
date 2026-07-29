# 설정 동기화 서버

AI 글로벌 뉴스 톡의 설정·학습 진행률을 기기 간에 공유하기 위한 최소 API 서버입니다.
FastAPI + SQLite로 되어 있어 별도 DB 설치 없이 파일 하나로 동작합니다.

## 처음부터 끝까지 실행하기

### 1. 서버 띄우기

```bash
pip install -r requirements.txt          # 저장소 루트에서 (fastapi/uvicorn/httpx)
cd webapp/ai-news-talk/server
uvicorn app:app --port 8000
```

`Application startup complete.` 가 보이면 성공입니다. 확인:

```bash
curl http://localhost:8000/api/health
# {"ok":true,"service":"dzai-sync","version":"1.0.0"}
```

`sync.db` 파일이 현재 디렉터리에 자동으로 만들어집니다. 별도 DB 설치는 없습니다.
`http://localhost:8000/docs` 에서 대화형 API 문서도 볼 수 있습니다.

### 2. 앱 띄우기 — 반드시 `--local` 빌드

기본 빌드는 네트워크가 꺼져 있어 동기화가 동작하지 않습니다. 새 터미널에서:

```bash
npm install --no-save react@18 react-dom@18 @babel/core @babel/preset-react
node webapp/ai-news-talk/build-artifact.cjs local.html --local
python3 -m http.server 5500
```

브라우저에서 `http://localhost:5500/local.html` 을 엽니다.

### 3. 연결하기

`⏰ 시간설정 → ☁️ 서버 동기화`에서 **서버 주소**에 `http://localhost:8000` 을 넣고
**＋ 동기화 코드 발급**을 누르면 `DZAI-XXXX-XXXX-XXXX` 가 나옵니다.

다른 기기에서는 같은 화면에 **서버 주소와 그 코드**를 넣고 **코드로 연결**을 누릅니다.
이후 설정이 바뀌면 최대 8초 안에 자동으로 올라갑니다.

> 다른 기기에서 붙으려면 `localhost` 가 아니라 서버 PC의 실제 주소
> (`http://192.168.0.10:8000` 등)를 써야 하고, 서버도
> `uvicorn app:app --host 0.0.0.0 --port 8000` 으로 띄워야 합니다.

### Windows 명령 프롬프트에서

위 명령은 bash 기준입니다. `cmd.exe` 에서는 이렇게 씁니다.

| bash | cmd.exe |
|---|---|
| `cd "$(git rev-parse --show-toplevel)"` | `for /f %i in ('git rev-parse --show-toplevel') do cd %i` |
| `cd webapp/ai-news-talk/server` | `cd webapp\ai-news-talk\server` (역슬래시) |
| `python3` | `python` 또는 `py` |
| `명령 # 주석` | 주석을 같은 줄에 쓰지 말 것 (`#`을 인자로 넘깁니다) |

```bat
cd /d D:\Projects\claude_github
pip install -r requirements.txt

cd webapp\ai-news-talk\server
uvicorn app:app --port 8000
```

> `Could not import module "app"` 은 **서버 폴더가 아닌 곳에서 uvicorn을 실행했을 때** 납니다.
> `app.py` 가 있는 `webapp\ai-news-talk\server` 로 이동한 뒤 실행하세요.
> 루트에서 실행하려면 `uvicorn webapp.ai-news-talk.server.app:app` 이 아니라
> `uvicorn --app-dir webapp\ai-news-talk\server app:app --port 8000` 을 쓰면 됩니다.

앱 빌드에는 [Node.js](https://nodejs.org) 가 필요합니다(`node` 명령이 없다면 미설치).
설치가 어렵다면 빌드를 건너뛰고 이미 만들어진 `local.html` 을 받아서 쓰면 됩니다 —
빌드 산출물은 자체 완결형이라 그 파일 하나만 있으면 동작합니다.

```bat
cd /d D:\Projects\claude_github
python -m http.server 5500
```

## 경험하기 코너 AI 실행 (선택)

체험 카드 1번(엑셀 표 → 3줄 요약)은 앱 안에서 바로 실행됩니다. 브라우저가
Anthropic API를 직접 부를 수 없으므로(CORS, 그리고 키가 사용자에게 노출됩니다)
이 서버를 거치고, **키는 서버에만** 둡니다.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
uvicorn app:app --port 8000
```

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/ai/status` | 기능이 켜져 있는지 (`enabled`, `reason`, `model`) |
| `POST` | `/api/ai/summarize` | 카드 1 — `{table, note?}` → 3줄 요약 + 최대 변화 + 예상질문 3개 |
| `POST` | `/api/ai/agent-run` | 카드 3 — `{instruction, sample}` → 지시문을 따른 결과 + 개선점 3개 |
| `POST` | `/api/ai/meeting-tasks` | 카드 2 — `{transcript}` → 과제 표 + 이번 주 지연 위험 |
| `POST` | `/api/ai/doc-ask` | 카드 5 — `{question, docs[]}` → 문서 근거 답변 + 인용 원문 |

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | 없으면 이 기능만 꺼집니다 |
| `DZAI_AI_MODEL` | `claude-opus-5` | |
| `DZAI_AI_EFFORT` | `medium` | `low`~`max` |
| `DZAI_AI_MAX_TOKENS` | `4000` | |
| `DZAI_AI_TIMEOUT` | `90` | 초 |

### 카드 2 — 회의 음성 녹음

녹음과 받아쓰기는 **브라우저 기능**입니다. Claude Messages API는 오디오를 받지
않으므로 서버로 음성을 보내지 않습니다.

- **녹음** — `MediaRecorder` (webm/opus). 파일은 브라우저 메모리에만 있고,
  `⬇ 음성 저장`으로 내려받아야 남습니다. 화면을 닫으면 사라집니다.
- **받아쓰기** — `SpeechRecognition` (Chrome·Edge 전용, `ko-KR`).
- **과제 추출** — 받아쓰기 텍스트만 `/api/ai/meeting-tasks`로 보냅니다.

> ⚠️ **받아쓰기는 음성을 브라우저 제조사 서버로 전송합니다.** Chrome의 음성
> 인식이 그렇게 동작하며, 앱이 우회할 수 없습니다. 대외비 회의에는 받아쓰기를
> 끄고 녹음만 하거나 메모를 직접 입력하도록 화면에 고지해 두었습니다.

마이크는 **보안 컨텍스트**에서만 열립니다 — `https://` 또는 `http://localhost`.
다른 PC에서 `http://192.168.0.x:5500`으로 접속하면 브라우저가 마이크를 막습니다.
그 경우 녹음 패널이 이유를 표시하고, 메모 직접 입력으로는 계속 쓸 수 있습니다.

서버가 없으면 **규칙 기반 추출**로 떨어집니다. 행동을 지시하는 문장을 고르고
직함이 붙은 담당자(`김민수 과장`, `영업팀`)와 날짜 표현(`다음 주 수요일`,
`이번 주 금요일`)을 뽑습니다. 선행조건·리스크는 규칙으로 신뢰성 있게 잡히지
않아 대부분 `미지정`으로 남으며, 화면에서 그렇다고 밝힙니다.

### 카드 5 — AI 사전 (첨부 문서 질의응답)

첨부 파일을 **두 갈래로** 처리합니다.

| 형식 | 어디서 읽나 | 서버로 가는 것 |
|---|---|---|
| `.docx` `.xlsx` `.pptx` `.csv` `.txt` 등 | **브라우저** | 뽑아낸 텍스트만 |
| `.pdf`, 이미지(캡처) | 모델이 직접 | **원본 바이트**(base64) |

오피스 파일은 셋 다 ZIP이라 `DecompressionStream('deflate-raw')`으로 풀어
안의 XML에서 글자만 꺼냅니다 — 아티팩트는 외부 스크립트를 못 불러오므로
(CSP) 라이브러리를 쓸 수 없기 때문입니다. 엑셀은 공유 문자열과 시트 이름을
살려 **탭 구분 표**로 되돌리고, 빈 칸이 건너뛰어진 행도 열 위치를 맞춥니다.
한글 CSV가 CP949로 저장돼 오는 경우가 흔해, UTF-8로 깨지면 `euc-kr`로 한 번
더 시도합니다.

이미지는 긴 변 **2576px**(모델이 받는 최대치)로 맞추고, 지원하지 않는 형식은
캔버스로 PNG로 바꿔 보냅니다. `.hwp`, `.xls` 같은 옛 형식은 읽지 못한다고
그 자리에서 밝히고 대안(PDF로 저장)을 안내합니다.

`/api/ai/doc-ask`는 텍스트·PDF·이미지를 **한 요청의 콘텐츠 블록으로 섞어**
보냅니다. 시스템 프롬프트가 세 가지를 못박습니다 — 문서에 없으면 지어내지 말
것, 사전 지식으로 문서를 보완하지 말 것, 근거는 원문 그대로 인용할 것. 응답
스키마에 `found`와 `citations`가 필수라, 모델은 근거를 대거나 "문서에 없음"을
택해야 합니다.

> ⚠️ **PDF·이미지는 원본이 이 서버로 전송됩니다.** 대외비 문서는 사내에서
> 직접 띄운 서버에만 연결해 쓰십시오. 서버 주소를 넣지 않으면 파일은 브라우저
> 밖으로 나가지 않습니다. 화면에도 같은 내용을 고지해 두었습니다.

서버가 없으면 **로컬 검색**으로 떨어집니다. 질문의 낱말(조사를 떼고)이 가장 많이
겹치는 3줄 묶음을 찾아 원문 그대로 보여줄 뿐, 요약이나 판단은 하지 않습니다 —
화면에서 그렇다고 밝히고 `로컬 검색` 배지를 답니다. PDF·이미지는 이 경로로
읽을 수 없어 검색에서 빠지며, 몇 건이 빠졌는지 표시합니다.

### 카드 3 — 미니 에이전트

지시문 **조립과 점검은 브라우저에서** 합니다. **업무명 한 칸만** 채우면 만들어지고,
비어 있는 칸은 기본값으로 메운 뒤 그렇게 했다고 화면에서 밝힙니다. 출력 항목은
줄바꿈뿐 아니라 쉼표·가운뎃점·①②③으로 적어도 항목으로 쪼개져, 각각 `## n. 제목`
틀이 됩니다 — 결과 모양을 고정하는 것이 이 카드의 핵심입니다. 분량은
간결/표준/상세 3단계로 고를 수 있습니다.

점검은 5가지입니다 — 비어 있는 칸, 출력 항목 개수, 출력 형식 명시 여부,
금지사항 개수, 모호한 표현(`알아서`, `적절히`, `필요시` 등). 모호어는 모델이
알아서 메우는 지점이라, 나중에 품질 문제로 돌아옵니다.

`/api/ai/agent-run`은 그 지시문을 **샘플 입력에 실제로 적용**해 결과를 내고, 따라
하면서 지시문에 없어 임의로 판단해야 했던 지점을 짚어 줍니다. 카드의 3단계
("실제 사례로 테스트하고 지시문을 고친다")가 이 호출입니다.

시험 실행만은 모델이 필요해 서버가 없으면 할 수 없습니다. 그럴 때는 지시문을
복사해 Claude·ChatGPT에 붙여넣으라고 화면에서 안내합니다 — 없는 기능을 있는
것처럼 보이게 하지 않습니다.

**키가 없어도 카드는 동작합니다.** 서버가 `503`을 돌려주면 앱은 그것을 신호로
받아 브라우저에서 표를 직접 계산합니다 — 행 수, 합계·평균, 변동이 가장 큰 항목과
변화율을 표에서 뽑아 3줄로 보여주고, `로컬 계산` 배지를 답니다. 원인 추정처럼
데이터에 없는 것은 "표만으로는 알 수 없다"고 밝힙니다. AI 응답일 때만 `AI 생성`
배지가 붙으므로 둘을 혼동할 일이 없습니다.

응답은 구조화 출력(JSON 스키마)으로 받습니다. 배열 길이는 스키마로 강제할 수
없어 서버에서 3개로 맞춥니다. 안전 분류기가 거절하면 `502`로 돌려주고,
`fallbacks: "default"`를 켜 두어 서버가 대체 모델로 다시 시도합니다.

### 명령줄만으로 확인하기

앱 없이 API만 시험해 볼 수도 있습니다.

```bash
# 코드 발급
curl -X POST http://localhost:8000/api/sync \
     -H 'Content-Type: application/json' \
     -d '{"settings":{"times":["08:30"]}}'

# 조회 (대소문자·하이픈 없이 넣어도 됩니다)
curl http://localhost:8000/api/sync/DZAI-XXXX-XXXX-XXXX

# 저장
curl -X PUT http://localhost:8000/api/sync/DZAI-XXXX-XXXX-XXXX \
     -H 'Content-Type: application/json' \
     -d '{"settings":{"times":["09:00"]},"baseRev":1}'

# 삭제
curl -X DELETE http://localhost:8000/api/sync/DZAI-XXXX-XXXX-XXXX
```

### 환경변수
| 이름 | 기본값 | 설명 |
|---|---|---|
| `DZAI_SYNC_DB` | `sync.db` | SQLite 파일 경로 |
| `DZAI_SYNC_ORIGINS` | `*` | CORS 허용 오리진, 쉼표 구분 |
| `DZAI_SYNC_RPM` | `60` | IP당 분당 허용 요청 수 |

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/health` | 상태 확인 |
| `POST` | `/api/sync` | 새 동기화 코드 발급 (`201`) |
| `GET` | `/api/sync/{code}` | 설정 조회 |
| `PUT` | `/api/sync/{code}` | 설정 저장 |
| `DELETE` | `/api/sync/{code}` | 코드와 데이터 삭제 (`204`) |

`PUT` 본문에 `baseRev`를 넣으면 낙관적 동시성 제어가 걸립니다. 서버의 현재 `rev`와
다르면 저장하지 않고 `409`와 함께 서버의 현재 상태를 돌려줍니다. 클라이언트는 이때
서버 값을 받아들이고 사용자에게 알립니다 — 다른 기기의 저장을 조용히 덮어쓰지 않습니다.

```
409 응답 본문
{"detail": {"message": "...", "server": {"code": "...", "settings": {...}, "rev": 2, ...}}}
```

`baseRev`를 생략하면 마지막 쓰기가 이깁니다.

## 동기화 코드

`DZAI-XXXX-XXXX-XXXX` 형식이며, 본문 12자를 혼동되는 글자(`I` `O` `0` `1`)를 뺀
32자 알파벳에서 뽑습니다. 경우의 수는 32¹² ≈ 1.15 × 10¹⁸ 입니다.
입력할 때는 대소문자·하이픈·공백을 가리지 않습니다 (`dzaiabcdefghjklm` 도 동일하게 인식).

## 보안 전제

이 서버에는 계정과 비밀번호가 없습니다. **코드를 아는 사람이 곧 소유자**입니다.
따라서 운영 시 다음을 지켜야 합니다.

- **HTTPS 뒤에 두십시오.** 코드가 평문으로 오갑니다.
- 코드는 사내 메신저 등 신뢰할 수 있는 경로로만 공유하십시오.
- IP당 분당 요청 수 제한이 걸려 있어 무작위 대입은 느려지지만, 공개 인터넷에
  그대로 노출할 것을 전제로 설계되지 않았습니다. 사내망 또는 접근이 통제된
  환경에서 쓰는 것을 권장합니다.
- `DZAI_SYNC_ORIGINS`로 CORS 허용 오리진을 실제 배포 도메인으로 좁히십시오.

저장되는 것은 화면 설정과 학습 진행률뿐입니다. 개인정보나 뉴스 본문은 저장하지 않습니다.

## 유지보수

오래 쓰이지 않은 코드는 `SyncStore.purge_stale(days)`로 정리할 수 있습니다.

```python
from store import SyncStore
print(SyncStore("sync.db").purge_stale(days=180), "건 정리")
```

## 테스트

```bash
cd webapp/ai-news-talk/server
python -m pytest -q
```

80개 테스트입니다. `test_sync_server.py` 37개가 코드 발급·정규화, 저장소 왕복,
낙관적 동시성 충돌, 크기 제한, 유니코드 왕복, 재기동 후 데이터 보존, HTTP 계층
상태코드, 속도 제한을 덮습니다.

`test_ai.py` 43개는 실제 API 키 없이 돕니다 — SDK를 대역으로 갈아끼워 모델·구조화
출력·표 본문이 실제로 실려 나가는지, 거절이 `502`가 되는지, 키가 없을 때 `503`으로
떨어지는지, `fallbacks`를 모르는 SDK에서도 요약이 되는지, 그리고 진짜 오류를
조용히 삼키지 않는지를 봅니다. AI 사전(카드 5)은 PDF가 `document` 블록으로,
이미지가 `image` 블록으로, 텍스트가 파일명과 함께 나가는지와, 시스템 프롬프트에
"지어내지 마라"·"문서에 없음"이 실제로 들어 있는지를 고정합니다.

> 실 API 호출 자체는 키가 있는 환경에서 한 번 확인해 보십시오. 위 테스트는 요청
> 형태와 응답 처리를 고정할 뿐, 모델이 실제로 무엇을 돌려주는지는 검증하지 않습니다.
