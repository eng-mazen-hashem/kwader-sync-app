import { supabase } from '../supabaseClient';

const DEMO_EMPLOYEES = [
    { name: "أحمد عبدالله", pin: "1", salary: 8500 },
    { name: "محمد خالد", pin: "2", salary: 6000 },
    { name: "فهد سعود", pin: "3", salary: 7200 },
    { name: "سالم العتيبي", pin: "4", salary: 5500 },
    { name: "عمر الدوسري", pin: "5", salary: 9000 },
    { name: "ياسر القحطاني", pin: "6", salary: 4500 },
    { name: "سعد المطيري", pin: "7", salary: 6800 },
    { name: "نواف الشمري", pin: "8", salary: 5000 },
    { name: "خالد العنزي", pin: "9", salary: 7500 },
    { name: "مروان الحربي", pin: "10", salary: 5200 },
    { name: "تركي الزهراني", pin: "11", salary: 6400 },
    { name: "بدر الغامدي", pin: "12", salary: 4800 }
];

export async function setupWebDemo(companyId) {
    try {
        // 1. Create a Demo Device
        const { data: device, error: devErr } = await supabase
            .from('devices')
            .insert({
                company_id: companyId,
                device_name: 'جهاز المحاكاة (Demo)',
                serial_number: 'DEMO-' + Math.floor(Math.random() * 10000),
                ip_address: '127.0.0.1',
                port: 4370,
                status: 'connected',
                last_sync: new Date().toISOString()
            })
            .select()
            .single();

        if (devErr) throw new Error('فشل إنشاء جهاز المحاكاة: ' + devErr.message);

        // 2. Create Employees
        for (const emp of DEMO_EMPLOYEES) {
            // Check if exists
            const { data: existing } = await supabase
                .from('employees')
                .select('id')
                .eq('company_id', companyId)
                .eq('device_pin', emp.pin)
                .single();

            if (!existing) {
                await supabase.from('employees').insert({
                    company_id: companyId,
                    name: emp.name,
                    device_pin: emp.pin,
                    base_salary: emp.salary,
                    status: 'active'
                });
            }
        }

        // 3. Generate 7 Days of Raw Logs
        const days = 7;
        const logs = [];
        const processDates = new Set();
        let currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - days);

        const getRandomMinute = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

        for (let i = 0; i <= days; i++) {
            const dayOfWeek = currentDate.getDay();
            const dateStr = currentDate.toISOString().split('T')[0];

            if (dayOfWeek !== 5) { // Skip Friday
                processDates.add(dateStr);
                const isSaturday = dayOfWeek === 6;

                DEMO_EMPLOYEES.forEach(emp => {
                    if (isSaturday && Math.random() > 0.3) return;
                    const rand = Math.random();
                    if (rand < 0.2) return;

                    const baseStart = new Date(currentDate); baseStart.setHours(8, 0, 0, 0);
                    const baseEnd = new Date(currentDate); baseEnd.setHours(17, 0, 0, 0);

                    let inTime, outTime;
                    if (rand < 0.35) inTime = addMinutes(baseStart, getRandomMinute(10, 120));
                    else inTime = addMinutes(baseStart, getRandomMinute(-20, 5));

                    if (rand >= 0.35 && rand < 0.45) outTime = addMinutes(baseEnd, getRandomMinute(-120, -10));
                    else if (rand >= 0.45 && rand < 0.55) outTime = addMinutes(baseEnd, getRandomMinute(30, 180));
                    else outTime = addMinutes(baseEnd, getRandomMinute(0, 30));

                    logs.push({ company_id: companyId, device_id: device.id, user_pin: emp.pin, timestamp: inTime.toISOString(), status: '0', is_processed: true });
                    logs.push({ company_id: companyId, device_id: device.id, user_pin: emp.pin, timestamp: outTime.toISOString(), status: '1', is_processed: true });
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (logs.length > 0) {
            await supabase.from('raw_attendance_logs').insert(logs);
        }

        // 4. Process Attendance via RPC
        for (const pDate of Array.from(processDates)) {
            await supabase.rpc('process_daily_attendance', { p_company_id: companyId, p_date: pDate });
        }

        return { success: true, message: 'تم إنهاء الرفع السحابي وتوليد بيانات آخر 7 أيام.' };
    } catch (error) {
        console.error('Demo Setup Error:', error);
        return { success: false, message: error.message };
    }
}
