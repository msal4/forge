-- ============================================
-- Sarray Forge - Arabic & English Seed Data
-- Migration: 003_arabic_seed_data.sql
-- ============================================

-- ============================================
-- SEED ISSUES (Mix of Arabic and English)
-- ============================================

INSERT INTO issues (project_id, issue_number, title, description, status, priority, reporter_id, assignee_id, labels) VALUES
-- Arabic Issues
(1, 100, 'إصلاح مشكلة تسجيل الدخول', 'المستخدمون يواجهون مشاكل في تسجيل الدخول عند استخدام كلمات مرور طويلة.

## خطوات إعادة الإنتاج
1. افتح صفحة تسجيل الدخول
2. أدخل كلمة مرور أطول من 50 حرف
3. اضغط على زر الدخول

## السلوك المتوقع
يجب أن يتم تسجيل الدخول بنجاح', 'to_inscribe', 'critical', 1, 2, '["bug", "auth"]'),

(1, 101, 'تحسين أداء قاعدة البيانات', 'الاستعلامات بطيئة جداً عند وجود أكثر من 1000 سجل.

- [ ] تحليل الاستعلامات البطيئة
- [ ] إضافة الفهارس المناسبة
- [ ] تحسين الـ JOIN queries', 'carving', 'high', 2, 1, '["performance", "database"]'),

(1, 102, 'إضافة دعم اللغة العربية', 'نحتاج دعم كامل للغة العربية في الواجهة.

**المهام:**
- [x] إضافة ملفات الترجمة
- [ ] تعديل اتجاه النص RTL
- [ ] اختبار جميع الصفحات', 'carving', 'high', 1, 1, '["i18n", "feature"]'),

(1, 103, 'توثيق واجهة برمجة التطبيقات', 'كتابة توثيق شامل لجميع نقاط النهاية API endpoints.

| النقطة | الوصف |
|--------|-------|
| /api/users | إدارة المستخدمين |
| /api/issues | إدارة المهام |
| /api/docs | إدارة المستندات |', 'to_inscribe', 'medium', 2, NULL, '["docs"]'),

(1, 104, 'تصميم صفحة الإعدادات', 'تصميم وتنفيذ صفحة إعدادات المستخدم الجديدة.', 'baked', 'low', 1, 2, '["ui", "feature"]'),

(1, 105, 'مراجعة الأمان', 'إجراء مراجعة أمنية شاملة للتطبيق.

## قائمة التحقق
- [ ] فحص ثغرات XSS
- [ ] فحص ثغرات SQL Injection
- [ ] مراجعة صلاحيات الوصول
- [ ] تدقيق التشفير', 'to_inscribe', 'critical', 2, 1, '["security", "audit"]'),

(1, 106, 'تحديث مكتبات الواجهة', 'تحديث React و Tailwind لأحدث الإصدارات.', 'baked', 'medium', 1, 1, '["dependencies"]'),

(1, 107, 'إصلاح عرض التاريخ', 'التواريخ لا تظهر بالتنسيق العربي الصحيح.', 'carving', 'low', 2, 2, '["bug", "i18n"]'),

(1, 108, 'إضافة إشعارات البريد', 'إرسال إشعارات بالبريد عند تحديث المهام.

```go
func SendNotification(email, subject, body string) error {
    // TODO: implement
}
```', 'to_inscribe', 'medium', 1, NULL, '["feature", "notifications"]'),

(1, 109, 'تحسين تجربة الموبايل', 'الواجهة غير متجاوبة على الهواتف الذكية.', 'to_inscribe', 'high', 2, 1, '["mobile", "ui"]'),

-- English Issues
(1, 110, 'Implement dark mode', 'Add dark mode support for better night-time usage.

## Requirements
- Toggle in settings
- System preference detection
- Persist user choice', 'to_inscribe', 'medium', 1, 2, '["feature", "ui"]'),

(1, 111, 'Fix memory leak in WebSocket', 'Memory usage increases over time when WebSocket connections are open.', 'carving', 'high', 2, 1, '["bug", "performance"]'),

(1, 112, 'Add export to PDF', 'Users want to export documents and issues to PDF format.', 'to_inscribe', 'low', 1, NULL, '["feature"]'),

(1, 113, 'تنظيف الكود القديم', 'حذف الملفات والدوال غير المستخدمة من المشروع.', 'baked', 'low', 2, 2, '["cleanup"]'),

(1, 114, 'اختبار الوحدات', 'كتابة اختبارات للوظائف الأساسية.

- [ ] اختبار تسجيل الدخول
- [ ] اختبار إنشاء المهام
- [ ] اختبار رفع الملفات', 'to_inscribe', 'high', 1, 1, '["testing"]'),

(1, 115, 'إصلاح خطأ الرفع', 'رفع الملفات الكبيرة يفشل بدون رسالة خطأ واضحة.', 'carving', 'critical', 2, 2, '["bug", "upload"]');

-- ============================================
-- SEED DOCS (Mix of Arabic and English)
-- ============================================

INSERT INTO docs (slug, title, content, author_id, sort_order) VALUES
('welcome-ar', 'مرحباً بكم في سراي فورج', '# مرحباً بكم في سراي فورج

هذه الأداة الداخلية لإدارة دورة حياة التطبيقات.

## الميزات الرئيسية

- **اللوح** - تتبع المهام بأسلوب كانبان
- **المكتبة** - توثيق بتنسيق ماركداون
- **المخزن** - إدارة الإصدارات والملفات

## اختصارات لوحة المفاتيح

| الاختصار | الإجراء |
|----------|---------|
| `Ctrl+K` | فتح لوحة الأوامر |
| `g i` | الذهاب للمهام |
| `g d` | الذهاب للمستندات |
| `g r` | الذهاب للإصدارات |
| `c` | إنشاء عنصر جديد |

## البدء السريع

1. سجل دخولك باسم المستخدم
2. استكشف الأقسام المختلفة
3. أنشئ مهمتك الأولى!', 1, 1),

('architecture-ar', 'هيكل المشروع', '# هيكل المشروع

## الواجهة الخلفية

- **Go 1.22+** - لغة البرمجة الأساسية
- **SQLite** - قاعدة البيانات
- **net/http** - مكتبة HTTP القياسية

## الواجهة الأمامية

- **React 18** - إطار العمل
- **TypeScript** - لغة البرمجة
- **Tailwind CSS** - التنسيق

## هيكل الملفات

```
sarray-forge/
├── cmd/server/         # نقطة البداية
├── internal/           # الكود الداخلي
│   ├── handlers/       # معالجات HTTP
│   ├── models/         # النماذج
│   └── db/            # قاعدة البيانات
├── migrations/         # ملفات الترحيل
└── web/               # الواجهة الأمامية
```', 2, 2),

('api-guide-ar', 'دليل واجهة البرمجة', '# دليل واجهة البرمجة

جميع النقاط تبدأ بـ `/api`.

## المصادقة

### تسجيل الدخول

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "zahra",
  "password": "admin"
}
```

## المهام

### قائمة المهام

```http
GET /api/issues
Authorization: Bearer <token>
```

### إنشاء مهمة

```http
POST /api/issues
Content-Type: application/json

{
  "title": "مهمة جديدة",
  "description": "وصف المهمة",
  "priority": "high"
}
```

## رموز الحالة

| الرمز | المعنى |
|-------|--------|
| 200 | نجاح |
| 201 | تم الإنشاء |
| 400 | طلب خاطئ |
| 401 | غير مصرح |
| 404 | غير موجود |
| 500 | خطأ في الخادم |', 1, 3),

('deployment-guide', 'Deployment Guide', '# Deployment Guide

## Prerequisites

- Go 1.22 or higher
- Node.js 18+ (for building frontend)
- SQLite 3

## Build Steps

```bash
# Build backend
go build -o forge ./cmd/server

# Build frontend
cd web && bun run build
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8080 |
| `DB_PATH` | Database file | ./data/forge.db |
| `SESSION_SECRET` | Cookie secret | (required) |

## Running in Production

```bash
./forge -port 8080 -db ./data/forge.db
```', 2, 4);

-- ============================================
-- SEED RELEASES (100+ releases with Arabic/English mix)
-- ============================================

INSERT INTO releases (version, title, description, author_id, is_draft, published_at) VALUES
-- Recent releases
('v3.0.0', 'الإصدار الرئيسي الثالث', '# الإصدار 3.0.0

## الميزات الجديدة
- دعم كامل للغة العربية
- واجهة مستخدم محسنة
- أداء أفضل بنسبة 50%

## التغييرات الجذرية
- تغيير هيكل API
- تحديث متطلبات النظام', 1, 0, datetime('now', '-1 day')),

('v2.9.0', 'تحسينات الأداء', '## التحسينات
- تحسين سرعة التحميل
- تقليل استهلاك الذاكرة
- إصلاح 15 خطأ', 2, 0, datetime('now', '-3 days')),

('v2.8.5', 'إصلاحات أمنية', '## الإصلاحات الأمنية
- إصلاح ثغرة XSS
- تحديث مكتبات التشفير
- تحسين التحقق من الهوية', 1, 0, datetime('now', '-5 days')),

('v2.8.4', 'Bug Fixes', '## Fixed
- Fixed login timeout issue
- Fixed file upload progress
- Fixed date formatting', 2, 0, datetime('now', '-7 days')),

('v2.8.3', 'إصلاحات طفيفة', 'إصلاح مشاكل في العرض على الموبايل.', 1, 0, datetime('now', '-10 days')),

('v2.8.2', 'Hotfix', 'Critical fix for database connection pooling.', 2, 0, datetime('now', '-12 days')),

('v2.8.1', 'تصحيح الترجمة', 'تصحيح أخطاء في الترجمة العربية.', 1, 0, datetime('now', '-14 days')),

('v2.8.0', 'دعم الملفات الكبيرة', '## الجديد
- دعم رفع ملفات حتى 500 ميجابايت
- شريط تقدم محسن
- استئناف الرفع المتقطع', 2, 0, datetime('now', '-16 days')),

('v2.7.5', 'Performance Update', 'Improved query performance for large datasets.', 1, 0, datetime('now', '-18 days')),

('v2.7.4', 'تحسين البحث', 'تحسين نتائج البحث وسرعته.', 2, 0, datetime('now', '-20 days')),

('v2.7.3', 'UI Improvements', '- Better button styling\n- Fixed modal animations\n- Improved form validation', 1, 0, datetime('now', '-22 days')),

('v2.7.2', 'إصلاح الطباعة', 'إصلاح مشاكل طباعة المستندات.', 2, 0, datetime('now', '-24 days')),

('v2.7.1', 'Stability Fix', 'Fixed crashes when editing large documents.', 1, 0, datetime('now', '-26 days')),

('v2.7.0', 'محرر ماركداون جديد', '## الميزات
- محرر WYSIWYG
- معاينة فورية
- دعم الجداول والقوائم', 2, 0, datetime('now', '-28 days')),

('v2.6.9', 'Security Patch', 'Updated dependencies to fix CVE-2024-1234.', 1, 0, datetime('now', '-30 days')),

('v2.6.8', 'تحسين التنقل', 'اختصارات لوحة مفاتيح جديدة.', 2, 0, datetime('now', '-32 days')),

('v2.6.7', 'Accessibility', 'Improved screen reader support.', 1, 0, datetime('now', '-34 days')),

('v2.6.6', 'إصلاح الإشعارات', 'إصلاح مشكلة عدم وصول الإشعارات.', 2, 0, datetime('now', '-36 days')),

('v2.6.5', 'Bug Fixes', 'Various bug fixes and improvements.', 1, 0, datetime('now', '-38 days')),

('v2.6.4', 'تحسين الذاكرة', 'تقليل استهلاك الذاكرة بنسبة 30%.', 2, 0, datetime('now', '-40 days')),

('v2.6.3', 'Mobile Fixes', 'Fixed touch interactions on mobile devices.', 1, 0, datetime('now', '-42 days')),

('v2.6.2', 'إصلاح التصدير', 'إصلاح تصدير البيانات بتنسيق CSV.', 2, 0, datetime('now', '-44 days')),

('v2.6.1', 'Hotfix', 'Fixed critical login issue.', 1, 0, datetime('now', '-46 days')),

('v2.6.0', 'لوحة التحكم الجديدة', '## الجديد
- رسوم بيانية تفاعلية
- إحصائيات في الوقت الفعلي
- تقارير قابلة للتخصيص', 2, 0, datetime('now', '-48 days')),

('v2.5.9', 'Performance', 'Optimized database queries.', 1, 0, datetime('now', '-50 days')),

('v2.5.8', 'تصحيح RTL', 'تصحيح اتجاه النص في بعض العناصر.', 2, 0, datetime('now', '-52 days')),

('v2.5.7', 'UI Polish', 'Refined colors and spacing.', 1, 0, datetime('now', '-54 days')),

('v2.5.6', 'إصلاح الجلسات', 'إصلاح انتهاء صلاحية الجلسات المبكر.', 2, 0, datetime('now', '-56 days')),

('v2.5.5', 'Dependency Update', 'Updated all npm packages.', 1, 0, datetime('now', '-58 days')),

('v2.5.4', 'تحسين الصور', 'ضغط الصور المرفوعة تلقائياً.', 2, 0, datetime('now', '-60 days')),

('v2.5.3', 'Bug Fixes', 'Fixed 8 reported bugs.', 1, 0, datetime('now', '-62 days')),

('v2.5.2', 'إصلاح الفلاتر', 'إصلاح فلاتر البحث المتقدم.', 2, 0, datetime('now', '-64 days')),

('v2.5.1', 'Hotfix', 'Fixed file download issue.', 1, 0, datetime('now', '-66 days')),

('v2.5.0', 'نظام التعليقات', '## الميزات الجديدة
- تعليقات على المهام
- إشارة للمستخدمين
- تنسيق ماركداون في التعليقات', 2, 0, datetime('now', '-68 days')),

('v2.4.9', 'API Improvements', 'Added pagination to all list endpoints.', 1, 0, datetime('now', '-70 days')),

('v2.4.8', 'تحسين الأمان', 'تشفير أقوى للبيانات الحساسة.', 2, 0, datetime('now', '-72 days')),

('v2.4.7', 'Form Validation', 'Improved client-side validation.', 1, 0, datetime('now', '-74 days')),

('v2.4.6', 'إصلاح الترتيب', 'إصلاح ترتيب المهام في لوحة كانبان.', 2, 0, datetime('now', '-76 days')),

('v2.4.5', 'Error Handling', 'Better error messages for users.', 1, 0, datetime('now', '-78 days')),

('v2.4.4', 'تحسين السحب والإفلات', 'تجربة سحب وإفلات أفضل.', 2, 0, datetime('now', '-80 days')),

('v2.4.3', 'Logging', 'Enhanced server logging.', 1, 0, datetime('now', '-82 days')),

('v2.4.2', 'إصلاح التكرار', 'إصلاح مشكلة العناصر المكررة.', 2, 0, datetime('now', '-84 days')),

('v2.4.1', 'Hotfix', 'Fixed memory leak.', 1, 0, datetime('now', '-86 days')),

('v2.4.0', 'البحث المتقدم', '## الجديد
- بحث بالفلاتر المتعددة
- حفظ عمليات البحث
- بحث في المرفقات', 2, 0, datetime('now', '-88 days')),

('v2.3.9', 'CSS Cleanup', 'Removed unused styles.', 1, 0, datetime('now', '-90 days')),

('v2.3.8', 'تحسين التحميل', 'تحميل أسرع للصفحة الرئيسية.', 2, 0, datetime('now', '-92 days')),

('v2.3.7', 'Keyboard Nav', 'Added more keyboard shortcuts.', 1, 0, datetime('now', '-94 days')),

('v2.3.6', 'إصلاح الروابط', 'إصلاح الروابط المعطلة في المستندات.', 2, 0, datetime('now', '-96 days')),

('v2.3.5', 'Code Cleanup', 'Refactored handler code.', 1, 0, datetime('now', '-98 days')),

('v2.3.4', 'تحسين الخطوط', 'خطوط أوضح للغة العربية.', 2, 0, datetime('now', '-100 days')),

('v2.3.3', 'Cache Fix', 'Fixed browser caching issues.', 1, 0, datetime('now', '-102 days')),

('v2.3.2', 'إصلاح العرض', 'إصلاح مشاكل العرض في سفاري.', 2, 0, datetime('now', '-104 days')),

('v2.3.1', 'Hotfix', 'Fixed crash on startup.', 1, 0, datetime('now', '-106 days')),

('v2.3.0', 'نظام الصلاحيات', '## الجديد
- أدوار المستخدمين
- صلاحيات مخصصة
- سجل النشاطات', 2, 0, datetime('now', '-108 days')),

('v2.2.9', 'Test Coverage', 'Added more unit tests.', 1, 0, datetime('now', '-110 days')),

('v2.2.8', 'تحسين التصدير', 'تصدير أسرع للتقارير الكبيرة.', 2, 0, datetime('now', '-112 days')),

('v2.2.7', 'Docker Support', 'Added Dockerfile and compose.', 1, 0, datetime('now', '-114 days')),

('v2.2.6', 'إصلاح الوقت', 'إصلاح عرض المنطقة الزمنية.', 2, 0, datetime('now', '-116 days')),

('v2.2.5', 'Bug Fixes', 'Fixed 5 reported issues.', 1, 0, datetime('now', '-118 days')),

('v2.2.4', 'تحسين API', 'تحسين أداء واجهة البرمجة.', 2, 0, datetime('now', '-120 days')),

('v2.2.3', 'Documentation', 'Updated API docs.', 1, 0, datetime('now', '-122 days')),

('v2.2.2', 'إصلاح الاستيراد', 'إصلاح استيراد البيانات من CSV.', 2, 0, datetime('now', '-124 days')),

('v2.2.1', 'Hotfix', 'Fixed session handling.', 1, 0, datetime('now', '-126 days')),

('v2.2.0', 'الوضع الليلي', '## الجديد
- وضع داكن كامل
- اكتشاف تفضيل النظام
- حفظ الاختيار', 2, 0, datetime('now', '-128 days')),

('v2.1.9', 'Performance', 'Reduced bundle size.', 1, 0, datetime('now', '-130 days')),

('v2.1.8', 'تحسين النماذج', 'تحقق أفضل من صحة البيانات.', 2, 0, datetime('now', '-132 days')),

('v2.1.7', 'Accessibility', 'Added ARIA labels.', 1, 0, datetime('now', '-134 days')),

('v2.1.6', 'إصلاح التمرير', 'إصلاح مشاكل التمرير في القوائم الطويلة.', 2, 0, datetime('now', '-136 days')),

('v2.1.5', 'Security', 'Updated auth tokens.', 1, 0, datetime('now', '-138 days')),

('v2.1.4', 'تحسين الأيقونات', 'أيقونات أوضح وأجمل.', 2, 0, datetime('now', '-140 days')),

('v2.1.3', 'Bug Fixes', 'Fixed dropdown issues.', 1, 0, datetime('now', '-142 days')),

('v2.1.2', 'إصلاح الحذف', 'إصلاح حذف العناصر المتعددة.', 2, 0, datetime('now', '-144 days')),

('v2.1.1', 'Hotfix', 'Fixed login redirect.', 1, 0, datetime('now', '-146 days')),

('v2.1.0', 'إدارة الملفات', '## الجديد
- معاينة الملفات
- تنظيم بالمجلدات
- مشاركة الملفات', 2, 0, datetime('now', '-148 days')),

('v2.0.9', 'Optimization', 'Lazy loading for images.', 1, 0, datetime('now', '-150 days')),

('v2.0.8', 'تحسين البحث', 'نتائج بحث أدق.', 2, 0, datetime('now', '-152 days')),

('v2.0.7', 'UI Fixes', 'Fixed button alignment.', 1, 0, datetime('now', '-154 days')),

('v2.0.6', 'إصلاح النسخ', 'إصلاح نسخ النص للحافظة.', 2, 0, datetime('now', '-156 days')),

('v2.0.5', 'Migration', 'Database schema updates.', 1, 0, datetime('now', '-158 days')),

('v2.0.4', 'تحسين التنبيهات', 'تنبيهات أوضح للمستخدم.', 2, 0, datetime('now', '-160 days')),

('v2.0.3', 'Bug Fixes', 'Various fixes.', 1, 0, datetime('now', '-162 days')),

('v2.0.2', 'إصلاح اللغة', 'تصحيح نصوص الواجهة.', 2, 0, datetime('now', '-164 days')),

('v2.0.1', 'Hotfix', 'Critical security fix.', 1, 0, datetime('now', '-166 days')),

('v2.0.0', 'الإصدار الثاني الكبير', '# الإصدار 2.0.0

## الميزات الرئيسية
- إعادة تصميم كاملة للواجهة
- محرك بحث جديد
- دعم متعدد اللغات
- تحسينات كبيرة في الأداء

## ملاحظات الترقية
يرجى مراجعة دليل الترقية قبل التحديث.', 2, 0, datetime('now', '-168 days')),

('v1.9.9', 'Final 1.x Release', 'Last release before 2.0.', 1, 0, datetime('now', '-170 days')),

('v1.9.8', 'تحضير للإصدار 2', 'تحضيرات الترقية للإصدار الثاني.', 2, 0, datetime('now', '-172 days')),

('v1.9.7', 'Stability', 'Improved error handling.', 1, 0, datetime('now', '-174 days')),

('v1.9.6', 'إصلاحات نهائية', 'إصلاحات أخيرة قبل الإصدار 2.', 2, 0, datetime('now', '-176 days')),

('v1.9.5', 'Performance', 'Query optimizations.', 1, 0, datetime('now', '-178 days')),

('v1.9.4', 'تحسين الاستقرار', 'تحسين استقرار النظام.', 2, 0, datetime('now', '-180 days')),

('v1.9.3', 'Bug Fixes', 'Fixed reported bugs.', 1, 0, datetime('now', '-182 days')),

('v1.9.2', 'إصلاح الذاكرة', 'إصلاح تسريب الذاكرة.', 2, 0, datetime('now', '-184 days')),

('v1.9.1', 'Hotfix', 'Emergency fix.', 1, 0, datetime('now', '-186 days')),

('v1.9.0', 'تقارير متقدمة', '## الجديد
- تقارير مخصصة
- تصدير لـ Excel
- جدولة التقارير', 2, 0, datetime('now', '-188 days')),

('v1.8.5', 'Security Update', 'Patched vulnerabilities.', 1, 0, datetime('now', '-190 days')),

('v1.8.4', 'تحسين الواجهة', 'تحسينات بصرية متعددة.', 2, 0, datetime('now', '-192 days')),

('v1.8.3', 'API Update', 'New API endpoints.', 1, 0, datetime('now', '-194 days')),

('v1.8.2', 'إصلاح المزامنة', 'إصلاح مشاكل المزامنة.', 2, 0, datetime('now', '-196 days')),

('v1.8.1', 'Hotfix', 'Fixed data loss bug.', 1, 0, datetime('now', '-198 days')),

('v1.8.0', 'التكامل مع GitHub', '## الجديد
- ربط مع GitHub Issues
- مزامنة تلقائية
- Webhooks', 2, 0, datetime('now', '-200 days')),

('v1.7.5', 'Performance', 'Caching improvements.', 1, 0, datetime('now', '-205 days')),

('v1.7.0', 'المرفقات', 'دعم إرفاق الملفات بالمهام.', 2, 0, datetime('now', '-210 days')),

('v1.6.0', 'Notifications', 'In-app notification system.', 1, 0, datetime('now', '-220 days')),

('v1.5.0', 'التقويم', 'عرض المهام في تقويم.', 2, 0, datetime('now', '-230 days')),

('v1.4.0', 'Templates', 'Issue templates feature.', 1, 0, datetime('now', '-240 days')),

('v1.3.0', 'البحث', 'محرك بحث متقدم.', 2, 0, datetime('now', '-250 days')),

('v1.2.0', 'Comments', 'Comment system added.', 1, 0, datetime('now', '-260 days')),

('v1.1.0', 'المستندات', 'نظام المستندات الجديد.', 2, 0, datetime('now', '-270 days')),

('v1.0.0', 'الإصدار الأول', '# الإصدار الأول من سراي فورج

مرحباً بكم في أول إصدار رسمي!

## الميزات
- إدارة المهام
- لوحة كانبان
- المستخدمين والصلاحيات', 1, 0, datetime('now', '-300 days'));
