/**
 * test_queue.js — سكريبت اختبار النظام اللامركزي
 * التشغيل: node test_queue.js [رقم_الهاتف] [الرسالة]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://olcrtfeobetvddocbmns.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_V-q33ausDk-VQmYXP3JzyA_0i6E3PiJ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const phone   = process.argv[2] || '201000000000';
    const message = process.argv[3] || '🧪 رسالة اختبار من نظام كوادر اللامركزي!\n✅ إذا وصلت هذه الرسالة، فالنظام يعمل بشكل مثالي!';

    console.log('\n════════════════════════════════════════');
    console.log('  اختبار نظام طابور الواتساب اللامركزي  ');
    console.log('════════════════════════════════════════');
    console.log('📱 الهاتف:', phone);

    const { data, error } = await supabase
        .from('whatsapp_queue')
        .insert({ phone: phone.replace(/\D/g, ''), message, status: 'pending' })
        .select();

    if (error) {
        console.error('❌ فشل إدراج الرسالة في الطابور:', error.message);
        console.error('⚠️  تأكد من تشغيل SQL migration أولاً في Supabase!');
        process.exit(1);
    }

    console.log('✅ تم إدراج الرسالة في الطابور! ID:', data[0].id);
    console.log('⏳ انتظار 10 ثوانٍ للتحقق من الحالة...');

    await new Promise(r => setTimeout(r, 10000));

    const { data: updated } = await supabase
        .from('whatsapp_queue')
        .select('status, processed_at, node_id, error')
        .eq('id', data[0].id)
        .single();

    if (updated.status === 'sent') {
        console.log('✅ تم الإرسال بنجاح! عبر Node:', updated.node_id);
    } else if (updated.status === 'pending') {
        console.log('🟡 الرسالة ما زالت pending — لا يوجد LEADER نشط. شغّل server.js أولاً.');
    } else if (updated.status === 'failed') {
        console.log('❌ فشل الإرسال:', updated.error);
    }
}

main().catch(console.error);
