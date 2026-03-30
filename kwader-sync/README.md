# KWADER Sync Agent 🔗

> ربط أجهزة البصمة ZKTeco بقاعدة بيانات Supabase السحابية

---

## متطلبات التشغيل

```
Python 3.10+
pip install -r requirements.txt
```

---

## تشغيل في وضع التطوير

```bash
python main.py
```

---

## بناء EXE

```bash
python build_exe.py
```

سيظهر الملف في مجلد `dist/`.

### إصلاح مشاكل شائعة عند البناء

| المشكلة | الحل |
|---------|------|
| `Ordinal 380` أو `libssl` | يتم حلها تلقائياً بالسكريبت |
| `ModuleNotFoundError: flet_core` | `pip install flet --upgrade` |
| `No module named 'zk'` | `pip install pyzk` |
| `icon.ico not found` | ضع أيقونة باسم `icon.ico` في مجلد `assets/` |
| نافذة سوداء تظهر | تأكد من `console=False` في `main.spec` |

---

## هيكل الجداول في Supabase

### جدول `attendance`
```sql
create table attendance (
  id          bigserial primary key,
  employee_id text not null,
  punch_time  timestamptz,
  punch_type  int,          -- 0=دخول, 1=خروج
  device_ip   text,
  license_key text,
  synced_at   timestamptz default now()
);
```

### جدول `licenses`
```sql
create table licenses (
  id           bigserial primary key,
  key          text unique not null,
  company_name text,
  active       boolean default true,
  expires_at   timestamptz
);
```

---

## المتغيرات البيئية (اختياري)

انسخ `.env.example` إلى `.env` وأدخل القيم:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJ...
LICENSE_KEY=XXXX-XXXX-XXXX-XXXX
```
