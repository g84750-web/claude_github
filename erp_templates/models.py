from django.db import models


class ERPModule(models.Model):
    """ERP 모듈 (구매관리, 영업관리, 재고관리, 회계, 인사)"""
    name = models.CharField(max_length=50, verbose_name='모듈명')
    code = models.CharField(max_length=20, unique=True, verbose_name='모듈코드')
    icon = models.CharField(max_length=10, default='📦', verbose_name='아이콘')
    order = models.PositiveIntegerField(default=0, verbose_name='순서')

    class Meta:
        ordering = ['order']
        verbose_name = 'ERP 모듈'
        verbose_name_plural = 'ERP 모듈'

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    """메뉴 항목 (입력메뉴 / 출력메뉴)"""
    MENU_TYPE_CHOICES = [
        ('input', '입력메뉴'),
        ('output', '출력메뉴'),
    ]

    module = models.ForeignKey(
        ERPModule,
        on_delete=models.CASCADE,
        related_name='menu_items',
        verbose_name='ERP 모듈',
    )
    menu_type = models.CharField(
        max_length=10,
        choices=MENU_TYPE_CHOICES,
        default='input',
        verbose_name='메뉴 유형',
    )
    name = models.CharField(max_length=100, verbose_name='메뉴명')
    code = models.CharField(max_length=30, verbose_name='메뉴코드')
    icon = models.CharField(max_length=10, default='📝', verbose_name='아이콘')
    order = models.PositiveIntegerField(default=0, verbose_name='순서')

    class Meta:
        ordering = ['menu_type', 'order']
        verbose_name = '메뉴 항목'
        verbose_name_plural = '메뉴 항목'
        unique_together = [('module', 'code')]

    def __str__(self):
        return f'{self.module.name} > {self.get_menu_type_display()} > {self.name}'


class PrintForm(models.Model):
    """인쇄양식"""
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name='print_forms',
        verbose_name='메뉴 항목',
    )
    name = models.CharField(max_length=100, verbose_name='양식명')
    description = models.TextField(blank=True, verbose_name='설명')
    canvas_data = models.JSONField(default=dict, blank=True, verbose_name='캔버스 데이터')
    thumbnail = models.ImageField(
        upload_to='thumbnails/',
        null=True, blank=True,
        verbose_name='썸네일',
    )
    is_default = models.BooleanField(default=False, verbose_name='기본양식')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일')

    class Meta:
        ordering = ['-is_default', 'name']
        verbose_name = '인쇄양식'
        verbose_name_plural = '인쇄양식'

    def __str__(self):
        return f'{self.menu_item} > {self.name}'


class ERPVariable(models.Model):
    """ERP 변수"""
    CATEGORY_CHOICES = [
        ('company', '회사정보'),
        ('purchase', '구매'),
        ('sales', '영업'),
        ('inventory', '재고'),
        ('accounting', '회계'),
        ('hr', '인사'),
        ('common', '공통'),
    ]

    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='common',
        verbose_name='카테고리',
    )
    key = models.CharField(max_length=100, unique=True, verbose_name='변수키')
    label = models.CharField(max_length=100, verbose_name='변수명(한글)')
    description = models.TextField(blank=True, verbose_name='설명')
    sample_value = models.CharField(max_length=200, blank=True, verbose_name='샘플값')

    class Meta:
        ordering = ['category', 'key']
        verbose_name = 'ERP 변수'
        verbose_name_plural = 'ERP 변수'

    def __str__(self):
        return f'{self.label} ({{{self.key}}})'
