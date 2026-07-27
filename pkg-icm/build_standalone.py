"""
PKG 구축통합관리 — Standalone 빌드 스크립트

CSS · JS · JSON 데이터를 index.html 하나로 합쳐
웹서버 없이 더블클릭만으로 열리는 index_standalone.html 을 만듭니다.

사용법
  이 폴더에서 터미널 열고:   python build_standalone.py
  (또는 이 파일을 더블클릭)
"""
import json, os, re, sys


def pause(msg='\n엔터를 누르면 종료합니다...'):
    """더블클릭 실행 시에만 멈춘다. 파이프라인 자동 실행 시에는 그대로 진행."""
    if os.environ.get('PKG_NOPAUSE') or not sys.stdin.isatty():
        return
    try:
        input(msg)
    except (EOFError, KeyboardInterrupt):
        pass

BASE = os.path.dirname(os.path.abspath(__file__))
SRC_HTML = os.path.join(BASE, 'index.html')
OUT_HTML = os.path.join(BASE, 'index_standalone.html')
DATA_JSON = os.path.join(BASE, 'data', 'gcms_full.json')
CSS_FILES = ['css/app.css']
JS_FILES = ['js/ingest.js', 'js/data.js', 'js/kpi.js', 'js/views.js', 'js/app.js']


def die(msg):
    print(f'\n[X] {msg}')
    pause()
    sys.exit(1)


def read(path):
    full = os.path.join(BASE, path)
    if not os.path.exists(full):
        die(f'파일을 찾을 수 없습니다: {path}')
    with open(full, encoding='utf-8') as f:
        return f.read()


def main():
    print('=' * 60)
    print(' PKG 구축통합관리 — Standalone 빌드')
    print('=' * 60)

    if not os.path.exists(SRC_HTML):
        die('index.html 을 찾을 수 없습니다.')
    if not os.path.exists(DATA_JSON):
        die('data/gcms_data.json 을 찾을 수 없습니다.')

    html = read('index.html')

    print('\n[1/4] 데이터 로드...')
    with open(DATA_JSON, encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict):
        print(f"      기준일 {data.get('meta', {}).get('asOf', '—')} · "
              f"프로젝트 {len(data.get('rows', [])):,}건 · 배정 {len(data.get('assignees', [])):,}행")
    else:
        print(f'      프로젝트 {len(data):,}건')

    print('[2/4] CSS 인라인...')
    css = '\n'.join(read(p) for p in CSS_FILES)
    # 외부 폰트(@import)는 오프라인에서 실패해도 무해하므로 유지
    html = re.sub(
        r'<link rel="stylesheet" href="css/app\.css">',
        f'<style>\n{css}\n</style>',
        html
    )

    print('[3/4] JS + 데이터 인라인...')
    js = '\n'.join(f'/* ===== {p} ===== */\n' + read(p) for p in JS_FILES)
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    bundle = (
        '<script>\n'
        f'window.__GCMS_DATA__ = {payload};\n'
        '</script>\n'
        f'<script>\n{js}\n</script>'
    )
    # 개별 <script src="js/*.js"> 태그를 통째로 번들로 교체
    html = re.sub(
        r'(<script src="js/ingest\.js"></script>\s*)'
        r'(<script src="js/data\.js"></script>\s*)'
        r'(<script src="js/kpi\.js"></script>\s*)'
        r'(<script src="js/views\.js"></script>\s*)'
        r'(<script src="js/app\.js"></script>)',
        lambda m: bundle,
        html
    )

    if 'js/app.js"></script>' in html or 'css/app.css' in html:
        die('index.html 구조가 예상과 다릅니다. 원본 index.html 을 사용하세요.')

    print('[4/4] 파일 저장...')
    with open(OUT_HTML, 'w', encoding='utf-8') as f:
        f.write(html)

    size = os.path.getsize(OUT_HTML) / 1024
    print('\n' + '=' * 60)
    print(f' [O] 완료  ->  index_standalone.html  ({size:,.0f} KB)')
    print('=' * 60)
    print('\n 이 파일을 더블클릭하면 브라우저에서 바로 열립니다.')
    print(' (웹서버 불필요 / 인터넷 없이도 동작)')
    pause()


if __name__ == '__main__':
    main()
