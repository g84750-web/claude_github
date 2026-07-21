#!/bin/bash
# ERP 인쇄양식 에디터 - 초기 설정 및 서버 실행 스크립트

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=== ERP 인쇄양식 에디터 설정 시작 ==="

# 패키지 설치
echo "[1/4] 의존성 패키지 설치..."
pip install -r requirements.txt -q

# 마이그레이션
echo "[2/4] 데이터베이스 마이그레이션..."
python manage.py migrate --run-syncdb

# 초기 데이터 로드
echo "[3/4] 초기 데이터 로드..."
python manage.py loaddata erp_templates/fixtures/initial_data.json

# 슈퍼유저 생성 (옵션)
echo "[4/4] 관리자 계정 생성 (건너뛰려면 Ctrl+C)..."
python manage.py createsuperuser --username admin --email admin@example.com 2>/dev/null || echo "  → 관리자 계정이 이미 존재합니다"

echo ""
echo "=== 설정 완료! 서버를 시작합니다 ==="
echo "  앱 주소:  http://127.0.0.1:8000"
echo "  관리자:   http://127.0.0.1:8000/admin"
echo "  API:      http://127.0.0.1:8000/api/"
echo ""
python manage.py runserver
