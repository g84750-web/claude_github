"""
PKG 구축통합관리 — 주간 갱신 원클릭 파이프라인

원본 엑셀 → 데이터 갱신 → 실행본 생성 → 배포본 생성 을 한 번에 수행한다.

사용법
  python update.py <GCMS.xlsx> [--assignee <담당자별.xlsx>] [--asof YYYY-MM-DD]

예시
  python update.py 2026년_솔루션구축센터_구축총괄실적현황_통합__PKG사업본부_260731.xlsx \
                   --assignee 상세_구축_진행_현황_담당자별_20260731.xlsx

수행 단계
  [1] etl_gcms.py        원본 엑셀 → data/gcms_full.json  (항등식 검증 출력)
  [2] build_standalone.py  → index_standalone.html  (더블클릭 실행본)
  [3] build_artifact.py    → artifact.html          (웹 배포본)

완료 후 재배포
  Claude Code 세션에서 아래와 같이 요청하면 같은 링크에 갱신된다.
    "artifact.html 재배포해줘"
  ※ 다른 세션에서 배포하는 경우 기존 URL을 함께 알려주어야 같은 링크가 유지된다.
"""
import os, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable or 'python3'

STEPS = [
    ('데이터 갱신 (ETL + 항등식 검증)', 'etl_gcms.py', True),
    ('실행본 생성 (index_standalone.html)', 'build_standalone.py', False),
    ('배포본 생성 (artifact.html)', 'build_artifact.py', False),
]


def run(script, args):
    env = dict(os.environ, PKG_NOPAUSE='1')     # 자동 실행 — 엔터 대기 없음
    r = subprocess.run([PY, os.path.join(BASE, script), *args], env=env, cwd=BASE)
    return r.returncode == 0


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__)
        sys.exit(0)

    src = argv[0]
    if not os.path.exists(src):
        print(f'[X] 원본 엑셀을 찾을 수 없습니다: {src}')
        sys.exit(1)

    etl_args = [os.path.abspath(src)]
    if '--asof' in argv:
        etl_args.append(argv[argv.index('--asof') + 1])
    if '--assignee' in argv:
        etl_args += ['--assignee', os.path.abspath(argv[argv.index('--assignee') + 1])]

    total = len(STEPS)
    for i, (title, script, pass_args) in enumerate(STEPS, 1):
        print(f'\n{"═" * 66}\n  [{i}/{total}] {title}\n{"═" * 66}')
        if not run(script, etl_args if pass_args else []):
            print(f'\n[X] {script} 단계에서 중단되었습니다. 위 메시지를 확인하세요.')
            sys.exit(1)

    print(f'\n{"═" * 66}')
    print('  갱신 완료')
    print(f'{"═" * 66}')
    for f in ('data/gcms_full.json', 'index_standalone.html', 'artifact.html'):
        p = os.path.join(BASE, f)
        if os.path.exists(p):
            print(f'   {f:28} {os.path.getsize(p) / 1048576:6.2f} MB')
    print("""
  다음 단계
   · 로컬 확인   index_standalone.html 더블클릭
   · 링크 재배포  Claude Code 세션에서 "artifact.html 재배포해줘" 요청
                (같은 URL로 갱신됨 — 새 링크가 생기지 않음)
""")


if __name__ == '__main__':
    main()
