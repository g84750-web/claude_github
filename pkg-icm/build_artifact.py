"""
PKG 구축통합관리 — Artifact 배포본 빌드

index_standalone.html → artifact.html

Artifact 런타임 제약에 맞춰 조정한다.
  · 문서 골격(<!doctype>/<html>/<head>/<body>)은 배포 시 자동으로 감싸지므로 제거
  · 외부 호스트 요청이 CSP로 차단되므로 웹폰트 @import 제거 → 한글 시스템 폰트 스택으로 대체
  · 디자인 시스템(PKG Weekly v70 화이트 기반 토큰)은 그대로 유지

사용법
  python build_artifact.py        (index_standalone.html 이 먼저 빌드되어 있어야 함)
"""
import os, re, sys


def pause(msg='\n엔터를 누르면 종료합니다...'):
    """더블클릭 실행 시에만 멈춘다. 파이프라인 자동 실행 시에는 그대로 진행."""
    if os.environ.get('PKG_NOPAUSE') or not sys.stdin.isatty():
        return
    try:
        input(msg)
    except (EOFError, KeyboardInterrupt):
        pass

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'index_standalone.html')
OUT = os.path.join(BASE, 'artifact.html')

TITLE = 'PKG 구축통합관리'

# 한글 시스템 폰트 스택 — 웹폰트를 쓰지 않고 OS 기본 한글 폰트를 사용한다
FONT_STACK = ("'Pretendard','Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',"
              "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',"
              "'Helvetica Neue',Arial,sans-serif")


def main():
    if not os.path.exists(SRC):
        print('[X] index_standalone.html 이 없습니다. 먼저 build_standalone.py 를 실행하세요.')
        sys.exit(1)

    html = open(SRC, encoding='utf-8').read()
    print(f'원본: index_standalone.html ({len(html)/1048576:.2f} MB)')

    # ── 1) <style> 블록 추출 (head 안에 있음) ──────────────────────
    m = re.search(r'<style>(.*?)</style>', html, re.S)
    if not m:
        print('[X] <style> 블록을 찾지 못했습니다.'); sys.exit(1)
    css = m.group(1)

    # ── 2) 웹폰트 @import 제거 (CSP 차단 대상) ────────────────────
    css_before = len(css)
    css = re.sub(r'@import\s+url\([^)]*\);\s*', '', css)
    print(f'  웹폰트 @import 제거: {css_before - len(css)}자')

    # ── 3) 폰트 스택 교체 + 라이트 테마 명시 ──────────────────────
    css = css.replace(
        "font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic',sans-serif;",
        f'font-family:{FONT_STACK};')
    # PKG Weekly v70 디자인 시스템이 화이트 기반으로 확정되어 있어 라이트 단일 테마로 고정한다.
    # (브라우저가 폼 컨트롤을 다크로 강제 렌더링하지 않도록 color-scheme 을 명시)
    css = css.replace(':root{', ':root{\n  color-scheme: light;\n', 1)

    # ── 4) <body> 내용 추출 ───────────────────────────────────────
    mb = re.search(r'<body>(.*)</body>', html, re.S)
    if not mb:
        print('[X] <body> 를 찾지 못했습니다.'); sys.exit(1)
    body = mb.group(1)

    # ── 5) 조립 (문서 골격 없이 내용만) ───────────────────────────
    out = f'<title>{TITLE}</title>\n<style>\n{css}\n</style>\n{body.strip()}\n'

    # ── 6) 검증 ──────────────────────────────────────────────────
    # 문서 골격 태그 (<header> 는 정상 태그이므로 오탐 제외)
    for pat, why in [(r'<!DOCTYPE', '문서 골격'), (r'<html\b', '문서 골격'),
                     (r'<head\b(?!er)', '문서 골격'), (r'<body\b', '문서 골격'),
                     (r'fonts\.googleapis\.com', '외부 폰트')]:
        if re.search(pat, out, re.I):
            print(f'  [!] 잔존: {pat} ({why})')
    # 실제 네트워크 요청만 검사 (XML 네임스페이스·안내문구 문자열은 제외)
    ext = re.findall(r'(?:src|href)\s*=\s*["\']https?://[^"\']+', out)
    imp = re.findall(r'@import[^;]*https?://', out)
    fetch = re.findall(r'fetch\(\s*["\']https?://', out)
    print(f'  외부 네트워크 요청: {len(ext) + len(imp) + len(fetch)}건'
          + (f' {(ext + imp + fetch)[:3]}' if (ext or imp or fetch) else ' — 없음 (완전 자립)'))

    open(OUT, 'w', encoding='utf-8').write(out)
    print(f'\n생성: artifact.html ({os.path.getsize(OUT)/1048576:.2f} MB)')


if __name__ == '__main__':
    main()
