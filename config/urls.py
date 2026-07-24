from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from erp_templates.views import app_view, simulation_view

urlpatterns = [
    path('', app_view, name='app'),
    path('simulation/', simulation_view, name='simulation'),
    path('admin/', admin.site.urls),
    path('api/', include('erp_templates.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) \
  + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
