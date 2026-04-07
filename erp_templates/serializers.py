from rest_framework import serializers
from .models import ERPModule, MenuItem, PrintForm, ERPVariable


class PrintFormSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintForm
        fields = [
            'id', 'menu_item', 'name', 'description',
            'canvas_data', 'thumbnail', 'is_default',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class PrintFormSummarySerializer(serializers.ModelSerializer):
    """목록용 경량 시리얼라이저 (canvas_data 제외)"""
    class Meta:
        model = PrintForm
        fields = ['id', 'menu_item', 'name', 'description', 'thumbnail', 'is_default', 'updated_at']


class MenuItemSerializer(serializers.ModelSerializer):
    print_forms = PrintFormSummarySerializer(many=True, read_only=True)
    menu_type_display = serializers.CharField(source='get_menu_type_display', read_only=True)

    class Meta:
        model = MenuItem
        fields = ['id', 'module', 'menu_type', 'menu_type_display', 'name', 'code', 'icon', 'order', 'print_forms']


class MenuItemSimpleSerializer(serializers.ModelSerializer):
    menu_type_display = serializers.CharField(source='get_menu_type_display', read_only=True)

    class Meta:
        model = MenuItem
        fields = ['id', 'module', 'menu_type', 'menu_type_display', 'name', 'code', 'icon', 'order']


class ERPModuleSerializer(serializers.ModelSerializer):
    menu_items = MenuItemSimpleSerializer(many=True, read_only=True)

    class Meta:
        model = ERPModule
        fields = ['id', 'name', 'code', 'icon', 'order', 'menu_items']


class ERPVariableSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = ERPVariable
        fields = ['id', 'category', 'category_display', 'key', 'label', 'description', 'sample_value']
