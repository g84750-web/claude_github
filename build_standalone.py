"""
사용법:
  이 파일과 index.html, gcms_data.json 을 같은 폴더에 두고
  터미널에서 실행:  python build_standalone.py

결과: index_standalone.html 이 생성됩니다.
"""
import json, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

html_path  = os.path.join(BASE_DIR, 'index.html')
json_path  = os.path.join(BASE_DIR, 'gcms_data.json')
out_path   = os.path.join(BASE_DIR, 'index_standalone.html')

# 파일 존재 확인
for p, name in [(html_path,'index.html'), (json_path,'gcms_data.json')]:
    if not os.path.exists(p):
        print(f'❌ {name} 파일을 찾을 수 없습니다. 같은 폴더에 있는지 확인하세요.')
        input('엔터를 누르면 종료합니다...')
        exit(1)

print('파일 읽는 중...')
with open(html_path, encoding='utf-8') as f:
    html = f.read()

with open(json_path, encoding='utf-8') as f:
    data = json.load(f)

print(f'  → 프로젝트 {len(data):,}건 로드 완료')

json_str = json.dumps(data, ensure_ascii=False, separators=(',', ':'))

old = """fetch('gcms_data.json')
  .then(r => r.json())
  .then(data => {
    ALL_DATA = data;
    filteredData = [...data];
    init();
  })
  .catch(() => {
    document.querySelector('.container').innerHTML = '<div class="card" style="color:#dc2626;padding:2rem;">⚠️ gcms_data.json 파일을 불러올 수 없습니다. 웹서버 환경에서 실행해주세요.</div>';
  });"""

new = f"""(function() {{
  ALL_DATA = {json_str};
  filteredData = [...ALL_DATA];
  init();
}})();"""

if old not in html:
    print('❌ index.html 구조가 맞지 않습니다. 원본 index.html 파일을 사용하세요.')
    input('엔터를 누르면 종료합니다...')
    exit(1)

new_html = html.replace(old, new)

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(new_html)

size_kb = os.path.getsize(out_path) / 1024
print(f'\n✅ 완료! index_standalone.html 생성됨 ({size_kb:.0f}KB)')
print('   → 이 파일을 더블클릭하면 브라우저에서 바로 열립니다.')
input('\n엔터를 누르면 종료합니다...')
