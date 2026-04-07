from django.contrib import admin
from .models import ERPModule, MenuItem, PrintForm, ERPVariable


@admin.register(ERPModule)
class ERPModuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'icon', 'order']
    ordering = ['order']


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['module', 'menu_type', 'name', 'code', 'order']
    list_filter = ['module', 'menu_type']
    ordering = ['module', 'menu_type', 'order']


@admin.register(PrintForm)
class PrintFormAdmin(admin.ModelAdmin):
    list_display = ['name', 'menu_item', 'is_default', 'created_at']
    list_filter = ['menu_item__module', 'is_default']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ERPVariable)
class ERPVariableAdmin(admin.ModelAdmin):
    list_display = ['label', 'key', 'category', 'sample_value']
    list_filter = ['category']
    search_fields = ['key', 'label']
