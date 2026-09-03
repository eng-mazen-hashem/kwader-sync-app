require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://olcrtfeobetvddocbmns.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sY3J0ZmVvYmV0dmRkb2NibW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MzYyMTcsImV4cCI6MjA4ODQxMjIxN30.QgMDWdPN7VWr6fNmoUh1YBx3bTpalNYQL90AuuHqV7s'
);

async function seedAttendance() {
  const { data: employees, error: empErr } = await supabase.from('employees').select('id, company_id').limit(10);
  if (empErr || !employees.length) {
    console.error('Failed to fetch employees:', empErr);
    return;
  }

  const { data: companyUsers, error: cuErr } = await supabase.from('company_users').select('company_id').limit(1);
  const { data: companies, error: compErr } = await supabase.from('companies').select('id').limit(1);

  console.log('Employees found:', employees.length);
  
  for (const employee of employees) {
    const records = [];
    const now = new Date();
    
    // Generate records for the last 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      // Skip weekends (Friday/Saturday) commonly
      if (d.getDay() === 5 || d.getDay() === 6) continue;

      const random = Math.random();
      let status = 'present';
      let hours = 8;
      
      if (random > 0.85) {
        status = 'absent';
        hours = 0;
      } else if (random > 0.70) {
        status = 'late';
        hours = (Math.random() * 2 + 5).toFixed(1); // 5 to 7 hours
      }

      records.push({
        company_id: employee.company_id,
        employee_id: employee.id,
        date: dateStr,
        status: status,
        total_hours: hours,
        created_at: new Date().toISOString()
      });
    }

    // Insert or Upsert
    const { error } = await supabase.from('processed_attendance').upsert(records, { onConflict: 'company_id, employee_id, date' });
    if (error) {
       console.error('Error inserting for employee', employee.id, error);
       // if conflict fails due to no constraint, try inserting if possible, or skip dupes.
    } else {
       console.log('Inserted attendance for employee', employee.id);
    }
  }
}

seedAttendance();
