from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'modules', views.ERPModuleViewSet, basename='module')
router.register(r'menus', views.MenuItemViewSet, basename='menu')
router.register(r'forms', views.PrintFormViewSet, basename='form')
router.register(r'variables', views.ERPVariableViewSet, basename='variable')

urlpatterns = [
    path('', include(router.urls)),
]
