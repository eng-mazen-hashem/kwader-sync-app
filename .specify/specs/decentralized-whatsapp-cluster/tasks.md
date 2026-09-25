# Implementation Tasks: Decentralized WhatsApp Cluster
# قائمة مهام تنفيذ عنقود الواتساب اللامركزي والمزامنة الذكية

**Feature Code**: `TASKS-002-WA-CLUSTER`  
**Specification**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Status**: Ready for Execution  

---

## 📋 Task Checklist Summary

- [ ] **Phase 1: Database Infrastructure & Distributed RPCs** (قاعدة البيانات وعقود الإيجار)
- [ ] **Phase 2: Baileys Engine & Cloud Auth State Adapter** (محرك Baileys ومحول المصادقة السحابي)
- [ ] **Phase 3: Distributed Lease Manager & Failover Loop** (نظام انتخاب القائد وإدارة الـ Failover)
- [ ] **Phase 4: Resilient Message Queue & Anti-Ban Throttling** (طابور الرسائل وحماية الحظر)
- [ ] **Phase 5: Sync Agent Packaging & PE Subsystem GUI** (الدمج في برنامج المزامنة وحزمة البايناري)
- [ ] **Phase 6: Multi-Client Failover Verification & QA** (اختبارات السقوط والمحاكاة الحية)

---

## Phase 1: Database Infrastructure & Distributed RPCs

- [ ] **T01**: إنشاء ملف ترحيل SQL لقاعدة البيانات `20260925_decentralized_baileys_cluster.sql`
- [ ] **T02**: إنشاء وتحديث جدول `whatsapp_channels` لدعم تعدد القنوات وأرقام الدورات (`current_epoch`)
- [ ] **T03**: إنشاء جدول `whatsapp_session_keys` لتخزين مفاتيح Baileys التشفيرية بحجم < 500KB مشفرة
- [ ] **T04**: إنشاء دالة `acquire_whatsapp_lease(p_node_id, p_channel_id, p_lease_duration, p_health_score)` الذرية
- [ ] **T05**: إنشاء دالة `renew_whatsapp_heartbeat(p_node_id, p_channel_id, p_epoch)` للنبضات الدورية
- [ ] **T06**: إنشاء دالة `release_whatsapp_lease(p_node_id, p_channel_id, p_reason)` للتسليم السلس السريع
- [ ] **T07**: تفعيل `Supabase Realtime` للجداول (`whatsapp_channels`, `whatsapp_nodes`) لتمكين التنبيه اللحظي

---

## Phase 2: Baileys Engine & Cloud Auth State Adapter

- [ ] **T08**: إعداد حزمة `kwader-whatsapp-decentralized` مع `@whiskeysockets/baileys` و `@supabase/supabase-js`
- [ ] **T09**: تطوير محول التشفير المتماثل `encryption.js` (تشفير AES-256-GCM لمفاتيح الجلسة)
- [ ] **T10**: برمجة محول المصادقة السحابي `cloudAuthState.js` المتوافق مع مواصفات Baileys:
  - تطبيق دالة `readData(type, id)` لجلب المفاتيح من `whatsapp_session_keys`
  - تطبيق دالة `writeData(type, id, data)` لكتابة المفاتيح المشفرة في السحابة
  - تطبيق دالة `removeData(type, id)` لإزالة المفاتيح منتهية الصلاحية
- [ ] **T11**: معالجة أحداث `creds.update` لحفظ أحدث توكنات المصادقة اللحظية ذرياً
- [ ] **T12**: تهيئة اتصال Baileys الأولي (`makeWASocket`) وإعداد البارامترات:
  - إخفاء المتصفح واختيار هوية جهاز نظيفة (`KWADER Desktop Sync`)
  - إدارة الاتصال التلقائي وإعادة المحاولة الذكية
- [ ] **T13**: إدارة استخراج وعرض رمز الاستجابة السريعة (QR Code) عند تهيئة الجلسة لأول مرة فقط
- [ ] **T14**: حفظ رقم هاتف الحساب المتصل وحالته في `whatsapp_channels` فور اكتمال الاقتران
- [ ] **T15**: اختبار استعادة الجلسة في بيئة محلية مستقلة بدون الحاجة لمسح الـ QR ثانية

---

## Phase 3: Distributed Lease Manager & Failover Loop

- [ ] **T16**: تطوير وحدة `leaseManager.js` لإدارة عقود الإيجار والانتخاب:
  - خوارزمية التنافس على القيادة وحيازة القفل
  - حلقة إرسال نبضات القلب كل 5 ثوانٍ
  - رصد انتهاء صلاحية إيجار القائد الحالي (> 15s)
- [ ] **T17**: حماية الـ Split-Brain عبر التحقق المستمر من رقم الدورة (`current_epoch`):
  - إذا تم رصد رقم دورة أحدث، تقوم العقدة الحالية بقطع اتصال واتساب فوراً والتراجع إلى وضع Standby
- [ ] **T18**: الربط مع `Supabase Realtime`:
  - استقبال إشعار فوري عند إخلاء القفل (`release_whatsapp_lease`) لبدء الانتخاب في أقل من ثانية
- [ ] **T19**: محرك حساب تقييم الصحة (Health Score Engine):
  - رصد نسبة الذاكرة الحرة (Free RAM)
  - قياس استقرار وزمن استجابة الشبكة نحو خوادم واتساب والسحابة
- [ ] **T20**: المعالجة الذاتية للانقطاع الطبيعي (Graceful Shutdown on App Exit / Windows Reboot)
- [ ] **T21**: المعالجة الذاتية لانهيار القائد المفاجئ (Uncooperative Failover on Power Cut / Crash)
- [ ] **T22**: اختبار سقوط القائد مع وجود عقدتين والتأكد من بقاء الجلسة وانتقالها 100% بدون QR

---

## Phase 4: Resilient Message Queue & Anti-Ban Throttling

- [ ] **T23**: تطوير معالج طابور الرسائل `queueProcessor.js`:
  - حجز الرسائل بنظام `FOR UPDATE SKIP LOCKED` لمنع التكرار
  - دعم الأولويات (`Priority 10` للـ OTP و `Priority 1` للتقارير)
- [ ] **T24**: تطبيق خوارزمية عدم التكرار (Idempotency Key Verification)
- [ ] **T25**: بناء محرك مكافحة الحظر (Anti-Ban Throttling Engine):
  - فاصل زمني عشوائي ديناميكي (Jitter 2.5s - 6.0s)
  - محاكاة الكتابة البشرية (`sendPresenceUpdate('composing')`)
- [ ] **T26**: الربط مع المساعد الذكي وخدمة العملاء الآلية (`aiOrchestrator.js`) للرد اللحظي
- [ ] **T27**: توجيه الرسائل الواردة وتحديث حالة التسليم (`delivered` / `read`)
- [ ] **T28**: نظام إعادة المحاولة الأسي الذكي (Exponential Backoff) وقفل الأمان عند تلقي تحذيرات الحظر

---

## Phase 5: Sync Agent Packaging & PE Subsystem GUI

- [ ] **T29**: تجميع تطبيق العنقود باستخدام `pkg` إلى ملف تنفيذي خفيف الحجم (`~15MB` فقط)
- [ ] **T30**: تطبيق سكربت تصحيح الـ PE Subsystem لتشغيل الملف بوضع GUI صامت (Subsystem 2)
- [ ] **T31**: تحديث `WhatsappNodeManager` في برنامج بايثون (`sync-agent/app.py`):
  - تشغيل المحرك المطور فورياً من المسار الداخلي
  - مراقبة حالة العملية وإعادة إطلاقها في حال توقفها (Watchdog)
  - دعم تمرير معرّف الشركة (`company_id`) والقناة (`channel_id`)
- [ ] **T32**: ضبط تسجيل السجلات بترميز UTF-8 آمن في `%APPDATA%\sync-agent\whatsapp-node.log`
- [ ] **T33**: تحديث سكربت التثبيت `installer/kwader_sync.nsi` للتحقق من تشغيل الخدمة مع إقلاع الجهاز
- [ ] **T34**: بناء واختبار حزمة التثبيت الشاملة `KWADER_Sync_Setup.exe`

---

## Phase 6: Multi-Client Failover Verification & QA

- [ ] **T35**: اختبار الاقتران المبدئي (Initial QR Pairing) وتوثيق زمن حفظ المفاتيح السحابية
- [ ] **T36**: اختبار المحاكاة الحية لسقوط القائد أثناء إرسال رسائل من الطابور (In-Flight Failover)
- [ ] **T37**: اختبار إعادة تشغيل جهاز القائد والتحقق من عدم حدوث أي تضارب (Split-Brain Prevention)
- [ ] **T38**: قياس استهلاك الذاكرة (RAM Benchmark) والتأكد من بقائها تحت 60MB
- [ ] **T39**: رفع حزمة التحديث عبر GitHub Releases وتحديث روابط السحابة OTA
- [ ] **T40**: اعتماد الوثيقة والتحقق من مطابقتها الكاملة لدستور المشروع (Constitution Compliant)
