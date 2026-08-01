# Axogram Pro

لوحة تحكم عربية لإدارة حسابات وحملات تيليجرام.

> هذه النسخة أصبحت **بنية Full Stack أولية** داخل نفس المستودع:
>
> - **Frontend:** React + TypeScript + Vite + Tailwind
> - **Backend:** FastAPI + SQLAlchemy
> - **Database:** PostgreSQL
> - **Queue/Worker:** Redis + RQ
> - **Deploy:** Docker Compose + Nginx

## البنية الحالية

```text
axogramv1/
├── src/                  # الواجهة الحالية
├── backend/              # API + auth + DB models + uploads
├── nginx/                # إعداد Nginx
├── docker-compose.yml    # تشغيل كامل على سيرفر واحد
├── Dockerfile.web        # بناء الواجهة وخدمتها عبر Nginx
└── backend/Dockerfile    # بناء الـ API
```

## ما تم تجهيزه الآن

### Backend
- تسجيل دخول JWT
- مستخدم افتراضي Admin
- CRUD للحسابات
- CRUD للبروكسيات
- إعدادات محفوظة داخل قاعدة البيانات مع **تشفير القيم الحساسة**
- تقارير Dashboard أساسية
- سجل نشاط Audit Log
- رفع ملفات وحفظ metadata
- seed data افتراضي لأول تشغيل

### Frontend
- شاشة تسجيل دخول
- ربط Home بإحصائيات Dashboard من الـ API
- ربط صفحة Settings بالـ API الحقيقي
- Logout فعلي
- Proxy dev server للـ API أثناء التطوير

## بيانات الدخول الافتراضية

عند أول تشغيل:

- **Username:** `admin`
- **Password:** `Admin123!`

> غيّرها فورًا في بيئة الإنتاج.

## تشغيل محلي سريع

### 1) الواجهة
```bash
pnpm install
pnpm dev
```

### 2) الباك اند محليًا
يفضل استخدام بيئة Python منفصلة:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> تحتاج PostgreSQL وRedis محليًا، أو استخدم Docker Compose مباشرة.

## التشغيل الكامل عبر Docker Compose

### 1) انسخ ملف البيئة
```bash
cp .env.example .env
```

### 2) شغّل النظام
```bash
docker compose up --build
```

### 3) افتح التطبيق
- الواجهة: `http://localhost`
- API docs: `http://localhost/api/docs`
- Health: `http://localhost/api/v1/health`

## النشر على VPS واحد

المستهدف:
- Ubuntu 22.04+
- Docker + Docker Compose Plugin
- DNS يشير إلى السيرفر
- يفضل لاحقًا إضافة HTTPS عبر Nginx Proxy Manager أو Certbot

### خطوات مختصرة
```bash
git clone <repo>
cd axogramv1
cp .env.example .env
nano .env   # غيّر القيم السرية
sudo docker compose up -d --build
```

## ملاحظات مهمة

- ملفات التخزين تحفظ داخل `backend/storage`
- القيم الحساسة داخل الإعدادات تُخزن مشفرة في قاعدة البيانات
- هذا الأساس جاهز للتوسع، لكن **الوحدات الكبيرة مثل Telegram execution الفعلي، الحملات، Mass DM، الـ queues المتقدمة، والاستئناف الذكي ما زالت تحتاج ربطًا وتنفيذًا إضافيًا**

## الخطوات التالية المقترحة

1. ربط وحدات الحسابات والبروكسيات بالكامل بالـ API
2. بناء تكامل Telethon الحقيقي
3. إضافة jobs فعلية للمهام الطويلة
4. إضافة جدولة وتشغيل حملات حقيقي
5. إضافة اختبارات وHardening للإنتاج
