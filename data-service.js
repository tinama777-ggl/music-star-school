/* Supabase adapter. All business records live in Postgres; RLS controls access. */
(() => {
  'use strict';
  const config = window.MUSIC_STAR_CONFIG;
  if (!window.supabase || !config) return;
  // Capture recovery intent before the SDK consumes the redirect fragment.
  window.MUSIC_STAR_RECOVERY = new URLSearchParams(location.search).get('reset') === 'password' || new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
  const client = window.supabase.createClient(config.url, config.publishableKey);
  const checked = result => { if (result.error) throw result.error; return result.data; };
  async function rows(table) {
    const all=[];
    for(let from=0;;from+=500){
      const batch=checked(await client.from(table).select('*').order('id').range(from,from+499));
      all.push(...batch);
      if(batch.length<500)return all;
    }
  }
  function mapRecords(teachers, students, lessons, invoices, rates, profiles) {
    const schoolToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    return {
      teachers:teachers.map(t=>{
        const current=rates.filter(r=>r.teacher_id===t.id&&r.effective_from<=schoolToday).sort((a,b)=>b.effective_from.localeCompare(a.effective_from))[0];
        return {id:t.id,userId:t.user_id,name:t.name,instrument:t.instrument,email:t.email,active:t.active,rate:current?Number(current.hourly_rate):null};
      }),
      students:students.map(s=>({id:s.id,teacher:s.teacher_id,name:s.name,parent:s.parent_name,email:s.parent_email,level:s.level,active:s.active})),
      lessons:lessons.map(l=>({id:l.id,student:l.student_id,teacher:l.teacher_id,date:l.lesson_date,time:l.start_time.slice(0,5),duration:l.duration_minutes,room:l.room,status:l.status,seriesId:l.series_id})),
      invoices:invoices.map(i=>({id:i.id,number:i.invoice_number,student:i.student_id,teacher:i.teacher_id,studentName:i.student_name,parent:i.parent_name,email:i.parent_email,description:i.description,amount:Number(i.amount),due:i.due_date,issued:i.issued_date,status:i.status})),
      rates:rates.map(r=>({...r,hourly_rate:Number(r.hourly_rate)})),profiles
    };
  }
  async function load(userId) {
    const profile=checked(await client.from('profiles').select('*').eq('id',userId).maybeSingle());
    if(!profile?.active)throw new Error('Your account has not been activated for Music Star. Ask the director to link your sign-in account.');
    const [teachers,students,lessons,invoices,rates,profiles]=await Promise.all([
      rows('teachers'),rows('students'),rows('lessons'),rows('invoices'),
      profile.role==='director'?rows('teacher_rates'):Promise.resolve([]),
      profile.role==='director'?rows('profiles'):Promise.resolve([profile])
    ]);
    const ownTeacher=teachers.find(t=>t.user_id===userId&&t.active);
    if(profile.role!=='director'&&!ownTeacher)throw new Error('Your sign-in account is not linked to an active teacher. Ask the director to complete your teacher setup.');
    return {profile,session:profile.role==='director'?'director':ownTeacher.id,db:mapRecords(teachers,students,lessons,invoices,rates,profiles)};
  }
  async function write(table,id,payload) {
    const query=id?client.from(table).update(payload).eq('id',id):client.from(table).insert(payload);
    const data=checked(await query.select('id'));
    if(!data?.length)throw new Error('This record is no longer available, or you do not have permission to change it.');
    return data;
  }
  async function save(kind,id,data,context) {
    if(kind==='student')return write('students',id,{name:data.name,teacher_id:data.teacher,parent_name:data.parent,parent_email:data.email,level:data.level});
    if(kind==='teacher')return checked(await client.rpc('save_teacher',{
      p_id:id,p_name:data.name,p_instrument:data.instrument,p_email:data.email,
      p_rate:Number(data.rate),p_effective_from:data.effective,p_user_id:data.userId||null
    }));
    if(kind==='lesson'){
      if(!id&&data.repeat==='weekly')return checked(await client.rpc('create_weekly_lessons',{
        p_student_id:data.student,p_first_date:data.date,p_start_time:data.time,
        p_duration_minutes:Number(data.duration),p_room:data.room,p_count:Number(data.weeks)
      }));
      const pupil=context.students.find(s=>s.id===data.student);
      if(!pupil)throw new Error('Please choose an available student.');
      return write('lessons',id,{student_id:data.student,teacher_id:pupil.teacher,lesson_date:data.date,start_time:data.time,duration_minutes:Number(data.duration),room:data.room,status:data.status});
    }
    if(kind==='invoice'){
      const pupil=context.students.find(s=>s.id===data.student);
      if(!pupil)throw new Error('Please choose an available student.');
      // The database trigger supplies the billing snapshots from the selected student.
      return write('invoices',id,{student_id:pupil.id,teacher_id:pupil.teacher,description:data.description,amount:Number(data.amount),due_date:data.due,status:'Pending'});
    }
    throw new Error('Unknown record type.');
  }
  async function remove(kind,id) {
    if(kind==='teacher')return write('teachers',id,{active:false});
    const table={student:'students',lesson:'lessons',invoice:'invoices'}[kind];
    const data=checked(await client.from(table).delete().eq('id',id).select('id'));
    if(!data?.length)throw new Error('This record was not deleted. Refresh and check your access.');
    return data;
  }
  function errorMessage(error) {
    if(error.code==='23P01')return 'A teacher, student, or room is already booked at this time. No lessons were saved. Refresh to see the latest schedule, then choose another time or room.';
    if(error.code==='23503')return 'This record has linked records. Reassign or remove its lessons first, or archive the teacher to keep their history.';
    if(error.code==='42501')return 'Your account does not have permission for this action. Ask the director to check your access.';
    if(error.code==='PGRST202')return 'The teacher save function is missing. Run supabase/05-teacher-save.sql in the Supabase SQL Editor.';
    if(error.code==='23505')return 'That account or record is already linked. Check the details and try again.';
    if(error.code==='23514'||error.code==='23502')return 'Check the required fields, lesson time, duration, and amount, then try again.';
    return error.message||'Could not connect. Please check your connection and try again.';
  }
  window.MusicStarData={client,load,save,remove,errorMessage,mapRecords,
    markPaid:(id,status)=>write('invoices',id,{status})};
})();
