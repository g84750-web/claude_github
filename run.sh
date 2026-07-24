#!/bin/bash
# 서버 실행 (초기 설정 완료 후)
cd "$(dirname "$0")"
echo "서버 시작: http://127.0.0.1:8000"
python manage.py runserver
