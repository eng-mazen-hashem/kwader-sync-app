-- ─── get_weekly_attendance_chart ─────────────────────────────────────────────
--
-- الغرض: تجميع سجلات الحضور لآخر 7 أيام لشركة محددة في استعلام واحد.
--         تُحل مشكلة 7 استعلامات داخل حلقة for في Dashboard.js القديم.
--
-- المدخلات:
--   p_company_id  UUID     — معرّف الشركة (data isolation إلزامي)
--   p_day_names   JSONB    — كائن JSON يُعيّن رقم اليوم (0-6) → اسمه المترجم
--                            مثال: {"0":"الأحد","1":"الإثنين",...}
--
-- المخرجات (SETOF):
--   day_label  TEXT    — اسم اليوم بلغة الشركة (من p_day_names)
--   present    BIGINT  — عدد الحاضرين
--   late       BIGINT  — عدد المتأخرين
--   absent     BIGINT  — عدد الغائبين
--
-- الإرجاع: مصفوفة 7 صفوف مرتبة من الأقدم (اليوم - 6) إلى اليوم الحالي.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_weekly_attendance_chart(
    p_company_id  UUID,
    p_day_names   JSONB
)
RETURNS TABLE (
    day_label  TEXT,
    present    BIGINT,
    late       BIGINT,
    absent     BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- تعمل بصلاحيات المالك، محمية بشرط company_id في الـ WHERE
AS $$
DECLARE
    v_today    DATE := CURRENT_DATE;
    v_day      DATE;
    v_dow      INT;   -- day of week: 0=Sunday ... 6=Saturday
    i          INT;
BEGIN
    -- نولّد 7 أيام: من (اليوم - 6) حتى اليوم
    FOR i IN 0..6 LOOP
        v_day := v_today - (6 - i);           -- أقدم → أحدث
        v_dow := EXTRACT(DOW FROM v_day)::INT; -- 0=Sun, 6=Sat (PostgreSQL standard)

        RETURN QUERY
        SELECT
            -- ترجمة رقم اليوم إلى الاسم من الكائن JSON المُمرَّر
            COALESCE(p_day_names ->> v_dow::TEXT, v_day::TEXT)  AS day_label,

            -- COUNT FILTER أسرع من CASE WHEN في PostgreSQL
            COUNT(*) FILTER (WHERE pa.status = 'present')  AS present,
            COUNT(*) FILTER (WHERE pa.status = 'late')     AS late,
            COUNT(*) FILTER (WHERE pa.status = 'absent')   AS absent

        FROM processed_attendance pa
        WHERE
            pa.company_id = p_company_id   -- عزل البيانات — القانون 2 من الميثاق
            AND pa.date   = v_day;

    END LOOP;
END;
$$;


-- ─── RLS: منح الصلاحية للمستخدمين المسجلين فقط ──────────────────────────────
-- (SECURITY DEFINER تعمل بصلاحيات المالك، لكن نُضيف GRANT صريح)
GRANT EXECUTE ON FUNCTION get_weekly_attendance_chart(UUID, JSONB)
    TO authenticated;

-- REVOKE من anonymous لمنع الاستدعاء بدون مصادقة
REVOKE EXECUTE ON FUNCTION get_weekly_attendance_chart(UUID, JSONB)
    FROM anon;


-- ─── اختبار سريع ─────────────────────────────────────────────────────────────
-- شغّله في Supabase SQL Editor بعد الإنشاء:
--
-- SELECT * FROM get_weekly_attendance_chart(
--     'YOUR-COMPANY-UUID-HERE',
--     '{"0":"الأحد","1":"الإثنين","2":"الثلاثاء","3":"الأربعاء","4":"الخميس","5":"الجمعة","6":"السبت"}'::JSONB
-- );
--
-- النتيجة المتوقعة: 7 صفوف، كل صف = يوم (day_label, present, late, absent)
-- ─────────────────────────────────────────────────────────────────────────────
