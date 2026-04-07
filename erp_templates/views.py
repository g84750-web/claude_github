from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ERPModule, MenuItem, PrintForm, ERPVariable
from .serializers import (
    ERPModuleSerializer,
    MenuItemSerializer, MenuItemSimpleSerializer,
    PrintFormSerializer, PrintFormSummarySerializer,
    ERPVariableSerializer,
)


def app_view(request):
    """메인 앱 HTML 서빙"""
    import os
    html_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'index.html')
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return HttpResponse(content, content_type='text/html; charset=utf-8')


class ERPModuleViewSet(viewsets.ModelViewSet):
    queryset = ERPModule.objects.all()
    serializer_class = ERPModuleSerializer

    @action(detail=True, methods=['get'])
    def menus(self, request, pk=None):
        """모듈의 메뉴 목록"""
        module = self.get_object()
        menu_type = request.query_params.get('type')
        qs = module.menu_items.all()
        if menu_type in ('input', 'output'):
            qs = qs.filter(menu_type=menu_type)
        serializer = MenuItemSerializer(qs, many=True)
        return Response(serializer.data)


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.select_related('module').prefetch_related('print_forms')
    serializer_class = MenuItemSerializer

    def get_serializer_class(self):
        if self.action == 'list':
            return MenuItemSimpleSerializer
        return MenuItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        module_id = self.request.query_params.get('module')
        menu_type = self.request.query_params.get('type')
        if module_id:
            qs = qs.filter(module_id=module_id)
        if menu_type in ('input', 'output'):
            qs = qs.filter(menu_type=menu_type)
        return qs


class PrintFormViewSet(viewsets.ModelViewSet):
    queryset = PrintForm.objects.select_related('menu_item__module')
    serializer_class = PrintFormSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        menu_item_id = self.request.query_params.get('menu_item')
        if menu_item_id:
            qs = qs.filter(menu_item_id=menu_item_id)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return PrintFormSummarySerializer
        return PrintFormSerializer

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """기본양식으로 설정"""
        form = self.get_object()
        PrintForm.objects.filter(menu_item=form.menu_item).update(is_default=False)
        form.is_default = True
        form.save()
        return Response({'status': 'ok', 'id': form.id})

    @action(detail=True, methods=['post'])
    def save_canvas(self, request, pk=None):
        """캔버스 데이터 저장"""
        form = self.get_object()
        canvas_data = request.data.get('canvas_data')
        if canvas_data is None:
            return Response({'error': 'canvas_data 필드가 필요합니다.'}, status=status.HTTP_400_BAD_REQUEST)
        form.canvas_data = canvas_data
        form.save(update_fields=['canvas_data', 'updated_at'])
        return Response({'status': 'saved', 'id': form.id, 'updated_at': form.updated_at})


class ERPVariableViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ERPVariable.objects.all()
    serializer_class = ERPVariableSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if category:
            qs = qs.filter(category=category)
        if search:
            qs = qs.filter(key__icontains=search) | qs.filter(label__icontains=search)
        return qs
