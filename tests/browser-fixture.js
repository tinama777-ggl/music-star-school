// Fake Supabase client: these tests never sign in to or mutate the real project.
const testIds={director:'00000000-0000-4000-8000-000000000001',a:'00000000-0000-4000-8000-000000000002',b:'00000000-0000-4000-8000-000000000003',t1:'10000000-0000-4000-8000-000000000001',t2:'10000000-0000-4000-8000-000000000002',s1:'20000000-0000-4000-8000-000000000001',s2:'20000000-0000-4000-8000-000000000002'};
const fixture={
  profiles:[{id:testIds.director,full_name:'Test Director',role:'director',active:true},{id:testIds.a,full_name:'Teacher One',role:'teacher',active:true},{id:testIds.b,full_name:'Teacher Two',role:'teacher',active:true}],
  teachers:[{id:testIds.t1,user_id:testIds.a,name:'Teacher One',email:'one@example.test',instrument:'Piano',active:true},{id:testIds.t2,user_id:testIds.b,name:'Teacher Two',email:'two@example.test',instrument:'Violin',active:true}],
  students:[{id:testIds.s1,teacher_id:testIds.t1,name:'Student One',parent_name:'Parent One',parent_email:'parent1@example.test',level:'Beginner',active:true},{id:testIds.s2,teacher_id:testIds.t2,name:'Student Two',parent_name:'Parent Two',parent_email:'parent2@example.test',level:'Grade 1',active:true}],
  teacher_rates:[{id:'r1',teacher_id:testIds.t1,hourly_rate:30,effective_from:'2026-01-01'},{id:'r2',teacher_id:testIds.t1,hourly_rate:50,effective_from:'2026-10-15'}],
  lessons:[{id:'l1',student_id:testIds.s1,teacher_id:testIds.t1,lesson_date:'2026-10-01',start_time:'09:00:00',duration_minutes:60,room:'A',status:'Completed'},{id:'l2',student_id:testIds.s1,teacher_id:testIds.t1,lesson_date:'2026-10-20',start_time:'09:00:00',duration_minutes:60,room:'A',status:'Completed'}],invoices:[]
};
const calls=[];let fakeUser=null,authCallback,failNext=false,passwordFailNext=false,resetFailNext=false;
const passwordCalls=[],resetCalls=[];
function accessible(table){
  const profile=fixture.profiles.find(p=>p.id===fakeUser?.id);
  if(!profile)return [];
  if(profile.role==='director')return fixture[table];
  const own=fixture.teachers.find(t=>t.user_id===fakeUser.id)?.id;
  return fixture[table].filter(row=>table==='profiles'?row.id===fakeUser.id:table==='teachers'?row.id===own:table==='teacher_rates'?false:row.teacher_id===own);
}
function builder(table){
  let action='select',payload,filters=[],single=false,start=0,end=Infinity;
  const query={
    select(){return query},order(){return query},range(a,b){start=a;end=b;return query},eq(key,value){filters.push([key,value]);return query},
    maybeSingle(){single=true;return query},insert(value){action='insert';payload=value;return query},update(value){action='update';payload=value;return query},delete(){action='delete';return query},
    then(resolve,reject){return Promise.resolve().then(()=>{
      calls.push({table,action,payload:structuredClone(payload),filters});
      if(failNext&&action!=='select'){failNext=false;return {data:null,error:{message:'Simulated connection failure'}};}
      let selected=accessible(table).filter(row=>filters.every(([k,v])=>row[k]===v));
      if(action==='insert'){
        const row={...payload,id:crypto.randomUUID()};
        if(table==='students')row.active=true;
        if(table==='invoices'){
          const s=fixture.students.find(s=>s.id===row.student_id);
          Object.assign(row,{invoice_number:'INV-TEST-100',student_name:s.name,parent_name:s.parent_name,parent_email:s.parent_email,issued_date:'2026-10-29'});
        }
        fixture[table].push(row);selected=[row];
      }
      if(action==='update')selected.forEach(row=>Object.assign(row,payload));
      if(action==='delete'){
        const ids=selected.map(row=>row.id);fixture[table]=fixture[table].filter(row=>!ids.includes(row.id));
        if(table==='students'){fixture.lessons=fixture.lessons.filter(l=>!ids.includes(l.student_id));fixture.invoices.forEach(i=>{if(ids.includes(i.student_id))i.student_id=null;});}
      }
      const data=selected.slice(start,end+1);
      return {data:structuredClone(single?data[0]||null:data),error:null};
    }).then(resolve,reject);}
  };return query;
}
const fakeClient={from:builder,auth:{
  async getSession(){return {data:{session:fakeUser?{user:fakeUser}:null},error:null}},
  onAuthStateChange(callback){authCallback=callback;return {data:{subscription:{unsubscribe(){}}}}},
  async signInWithPassword({email,password}){
    if(password!=='fixture-password')return {error:{message:'Invalid login credentials'}};
    fakeUser={id:email==='director@example.test'?testIds.director:email==='one@example.test'?testIds.a:testIds.b};
    authCallback?.('SIGNED_IN',{user:fakeUser});return {data:{session:{user:fakeUser}},error:null};
  },
  async updateUser(attributes){
    passwordCalls.push({...attributes});
    if(!fakeUser)return {error:{message:'Auth session missing'}};
    if(passwordFailNext){passwordFailNext=false;return {error:{message:'Password update temporarily unavailable'}};}
    if(attributes.current_password&&attributes.current_password!=='fixture-password')return {error:{message:'Current password is incorrect'}};
    return {data:{user:fakeUser},error:null};
  },
  async resetPasswordForEmail(email,options){resetCalls.push({email,options});if(resetFailNext){resetFailNext=false;return {error:{message:'Please wait before requesting another email'}};}return {data:{},error:null};},
  async signOut(){fakeUser=null;authCallback?.('SIGNED_OUT',null);return {error:null}}
},async rpc(name,payload){
  calls.push({rpc:name,payload:structuredClone(payload)});
  if(failNext){failNext=false;return {data:null,error:{code:'23P01',message:'Conflict'}};}
  if(name==='create_weekly_lessons'){
    const s=fixture.students.find(s=>s.id===payload.p_student_id);
    const series=crypto.randomUUID();
    for(let i=0;i<payload.p_count;i++){
      const d=new Date(payload.p_first_date+'T12:00:00');d.setDate(d.getDate()+i*7);
      fixture.lessons.push({id:crypto.randomUUID(),student_id:s.id,teacher_id:s.teacher_id,lesson_date:[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),start_time:payload.p_start_time,duration_minutes:payload.p_duration_minutes,room:payload.p_room,status:'Scheduled',series_id:series});
    }
  }
  if(name==='save_teacher'){
    let t=fixture.teachers.find(t=>t.id===payload.p_id);
    if(!t){t={id:crypto.randomUUID(),active:true};fixture.teachers.push(t);}
    Object.assign(t,{name:payload.p_name,instrument:payload.p_instrument,email:payload.p_email,user_id:payload.p_user_id});
    fixture.teacher_rates.push({id:crypto.randomUUID(),teacher_id:t.id,hourly_rate:payload.p_rate,effective_from:payload.p_effective_from});
    return {data:t.id,error:null};
  }
  return {data:[],error:null};
}};
window.supabase={createClient:()=>fakeClient};
