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
python -m pytest test_sync_server.py -q
```

37개 테스트가 코드 발급·정규화, 저장소 왕복, 낙관적 동시성 충돌, 크기 제한,
유니코드 왕복, 재기동 후 데이터 보존, HTTP 계층 상태코드, 속도 제한을 덮습니다.
