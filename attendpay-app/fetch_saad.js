require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Fetch companies to find Ben Lakaza
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name');
  
  if (compError) {
    console.error('Error fetching companies:', compError);
    return;
  }
  
  const company = companies.find(c => c.name && c.name.includes('لاكازا'));
  if (!company) {
    console.log('Company Ben Lakaza not found. Available:', companies.map(c => c.name));
    return;
  }
  console.log('Found company:', company.name);

  // Fetch employees for this company
  const { data: allEmployees, error: empError } = await supabase
    .from('employees')
    .select('id, name, company_id')
    .eq('company_id', company.id);
    
  if (empError) {
    console.error('Error fetching employee:', empError);
    return;
  }
  
  const employees = allEmployees.filter(e => e.name && e.name.includes('سعد'));
  
  if (!employees || employees.length === 0) {
    console.log('Employee not found');
    return;
  }
  
  const targetEmp = employees.find(e => e.name.includes('سعد الدين صديق') || e.name.includes('سعد الدين'));
  const empId = targetEmp ? targetEmp.id : employees[0].id;
  console.log('Found employee:', targetEmp || employees[0]);
  
  // Just query shift_employees instead of trying e.shift_id
  const { data: shiftEmp } = await supabase.from('shift_employees').select('shift_id').eq('employee_id', empId);
  if (shiftEmp && shiftEmp.length > 0) {
      const { data: shift } = await supabase.from('shifts').select('*').eq('id', shiftEmp[0].shift_id).single();
      console.log('Shift from shift_employees:', shift);
  }

  // Find attendance
  console.log('Fetching processed attendance for months 5 and 6...');
  const { data: attendance, error: attError } = await supabase
    .from('processed_attendance')
    .select('*')
    .eq('employee_id', empId)
    .gte('date', '2026-05-01')
    .lte('date', '2026-06-30')
    .order('date', { ascending: true });
    
  if (attError) {
    console.error('Error fetching attendance:', attError);
    return;
  }
  
  console.log(`Found ${attendance.length} processed attendance records.`);
  attendance.forEach(a => {
    console.log(`${a.date} | In: ${a.check_in_time} | Out: ${a.check_out_time} | Inverted? (In > Out typically implies overnight, but if it says Out then In it might be wrong)`);
  });

  // Fetch raw logs
  console.log('\nFetching raw logs...');
  const { data: raw, error: rawError } = await supabase
    .from('raw_attendance_logs')
    .select('*')
    .eq('employee_id', empId)
    .gte('log_time', '2026-05-01T00:00:00Z')
    .lte('log_time', '2026-06-30T23:59:59Z')
    .order('log_time', { ascending: true });

  if (rawError) {
     console.error('Error fetching raw logs', rawError);
  } else {
     console.log(`Found ${raw.length} raw logs.`);
     raw.slice(0, 20).forEach(r => {
        console.log(`Log: ${r.log_time} | Type: ${r.log_type} (maybe missing type or state: ${r.state || r.punch_type || r.attendance_state}) | Device: ${r.device_sn}`);
     });
     if (raw.length > 20) console.log('... more raw logs');
  }
}

run();
