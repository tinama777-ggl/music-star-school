'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money=n=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(n);
const instruments=['Piano','Violin','Cello','Flute'];
const emptyDatabase=()=>({teachers:[],students:[],lessons:[],invoices:[],rates:[],profiles:[]});
let db=emptyDatabase();
let session=null,page='overview',filter='today',query='',teacherFilter='all',editKind='',editId=null,toastTimer;
let account=null,authenticatedUser=null,ready=false,loadVersion=0,writeBusy=false;
const service=window.MusicStarData;
let recovering=Boolean(window.MUSIC_STAR_RECOVERY),passwordBusy=false,authNotice='';
let calendarDate = today;
let calendarView = 'month';
const director=()=>session==='director';
const teacher=id=>db.teachers.find(t=>t.id===id);
const student=id=>db.students.find(s=>s.id===id);
const visibleStudents=()=>db.students.filter(s=>director()||s.teacher===session);
const visibleLessons=()=>db.lessons.filter(l=>visibleStudents().some(s=>s.id===l.student));
const visibleInvoices=()=>db.invoices.filter(i=>director()||i.teacher===session);
const hours=id=>db.lessons.filter(l=>(l.teacher||student(l.student)?.teacher)===id&&l.status==='Completed').reduce((n,l)=>n+l.duration/60,0);
const lessonRate=l=>db.rates.filter(r=>r.teacher_id===l.teacher&&r.effective_from<=l.date).sort((a,b)=>b.effective_from.localeCompare(a.effective_from))[0]?.hourly_rate;
const salary=id=>db.lessons.filter(l=>l.teacher===id&&l.status==='Completed').reduce((n,l)=>n+l.duration/60*(lessonRate(l)??0),0);
const missingRates=id=>db.lessons.filter(l=>l.teacher===id&&l.status==='Completed'&&lessonRate(l)===undefined).length;
const initials=name=>name.split(' ').map(x=>x[0]).slice(0,2).join('');
const avatar=name=>`<span class="avatar">${esc(initials(name))}</span>`;
const badge=(text,type=text)=>`<span class="badge ${esc(type.toLowerCase())}">${esc(text)}</span>`;
const icons={overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 11h18M8 3v4m8-4v4"/>',students:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m0-16a3 3 0 0 1 0 6m3 4a5 5 0 0 1 3 5"/>',teachers:'<path d="m2 8 10-5 10 5-10 5zM6 10v7q6 5 12 0v-7M22 8v8"/>',invoices:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6"/>',salary:'<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 9h2m14 7h2"/>'};
const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[k]}</svg>`;
const titles={overview:'Overview',schedule:'Lesson schedule',students:'Students',teachers:'Teachers',invoices:'Invoices',salary:'Hours & salary'};
function notify(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',3500)}
function render(){
  if(!ready)return;
  if(!director()&&['teachers','salary'].includes(page))page='overview';
  $('#nav').innerHTML=Object.entries(titles).filter(([k])=>director()||!['teachers','salary'].includes(k)).map(([k,v])=>`<button data-page="${k}" class="${page===k?'active':''}">${icon(k)}${v}</button>`).join('');
  $('#profile').innerHTML=avatar(account.full_name)+`<div><strong>${esc(account.full_name)}</strong><small>${director()?'School director':esc(teacher(session)?.instrument)+' teacher'}</small></div>`;
  $('#crumb').textContent=titles[page];
  $('#today').textContent=new Date().toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland',weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('#main').innerHTML=page==='overview'?overview():page==='schedule'?schedule():page==='students'?studentsPage():page==='teachers'?teachersPage():page==='invoices'?invoicesPage():salaryPage();
}
function showAuth(message='',allowLogin=true){
  ready=false;document.body.classList.add('signed-out');
  $('#main').innerHTML='';$('#nav').innerHTML='';$('#profile').innerHTML='';
  if($('#modal').open)$('#modal').close();
  if($('#password-dialog').open)$('#password-dialog').close();
  $('#login-form').hidden=!allowLogin;$('#auth-status').textContent=message;
  $('#forgot-password').hidden=!allowLogin;$('#reset-request-form').hidden=true;$('#new-password-form').hidden=true;
  $('#auth-title').textContent='Welcome back.';$('#auth-intro').textContent='Sign in to plan lessons, support your students, and keep the music going.';
  $('#auth-signout').hidden=!authenticatedUser;
  $('#retry-connection').hidden=!authenticatedUser;
}
async function acceptSession(authSession,force=false){
  const user=authSession?.user||null;
  if(!force&&!recovering&&ready&&user?.id===authenticatedUser?.id)return;
  const version=++loadVersion;authenticatedUser=user;account=null;session=null;db=emptyDatabase();
  if(!user){showAuth(authNotice||(recovering?'Your reset link is missing or has expired. Request a new link using Forgot password.':''),true);return;}
  if(recovering){showRecoveryForm();return;}
  showAuth('Loading your school workspace...',false);
  try{
    const loaded=await service.load(user.id);
    if(version!==loadVersion)return;
    account=loaded.profile;session=loaded.session;db=loaded.db;ready=true;
    $('#auth-error').textContent='';$('#login-password').value='';
    document.body.classList.remove('signed-out');render();
  }catch(error){if(version===loadVersion)showAuth(service.errorMessage(error),false);}
}
async function reloadRecords(){
  const userId=authenticatedUser?.id,version=loadVersion;
  if(!userId)return;
  const loaded=await service.load(userId);
  if(version!==loadVersion||authenticatedUser?.id!==userId)return;
  account=loaded.profile;session=loaded.session;db=loaded.db;render();
}
async function mutate(task,message){
  if(writeBusy||!ready)return false;
  writeBusy=true;const userId=authenticatedUser.id;
  try{
    await task();
    if(authenticatedUser?.id!==userId)return true;
    if($('#modal').open)$('#modal').close();
    try{await reloadRecords();notify(message);}
    catch(error){db=emptyDatabase();showAuth('Your change was saved, but records could not be refreshed. '+service.errorMessage(error),false);}
    return true;
  }catch(error){
    if(authenticatedUser?.id===userId){
      const message=service.errorMessage(error);
      if($('#modal').open)$('#form-error').textContent=message;else notify(message);
    }
    return false;
  }finally{writeBusy=false;}
}
const head=(title,sub,buttons)=>`<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div><div class="head-actions">${buttons}</div></div>`;
const add=(kind,text)=>`<button class="primary" data-add="${kind}">＋ &nbsp;${text}</button>`;
function stats(){const lessons=visibleLessons(),invoices=visibleInvoices(),pending=invoices.filter(i=>i.status==='Pending');const values=[['Lessons today',lessons.filter(l=>l.date===today).length,'schedule','On the calendar today'],['Active students',visibleStudents().length,'students','Growing, one lesson at a time'],[director()?'Teaching hours':'My teaching hours',lessons.filter(l=>l.status==='Completed').reduce((n,l)=>n+l.duration/60,0).toFixed(1)+'h','teachers','Completed lessons · all time'],['Outstanding invoices',money(pending.reduce((n,i)=>n+i.amount,0)),'invoices',pending.length+' invoices awaiting payment']];return `<section class="stats">${values.map(([label,value,k,note])=>`<article class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(k).replace('<svg ','<svg width="17" height="17" ')}</span></div><strong>${value}</strong><small>${note}</small></article>`).join('')}</section>`}
function overview(){return head(`A good day to make music<span style="color:#96a66e">.</span>`,director()?"Here's what's happening at your school today.":'Your students, your lessons, and a little more time for music.',`<button data-add="invoice">Create invoice</button>${add('lesson','Add lesson')}`)+stats()+`<div class="columns"><div>${schedulePanel(true)}<section class="panel"><div class="panel-head"><div><h2>A little less admin. A lot more music.</h2><p>Everything you need to keep your school in harmony.</p></div></div><div class="toolbar"><button data-page="students">Manage students ↗</button><button data-page="invoices">View invoices ↗</button>${director()?'<button data-page="salary">Review teaching hours ↗</button>':''}</div></section></div><div class="right-column"><article class="welcome"><p class="eyebrow">EVERY LESSON COUNTS</p><h2>Big dreams start<br>with small notes.</h2><p>Here’s to another day of helping your students shine.</p><span class="music-art" aria-hidden="true">♫</span></article>${teacherPreview()}${invoicePreview()}</div></div>`}
function calendarRange() {
  const anchor = new Date(calendarDate + 'T12:00:00');
  const start = new Date(anchor);
  if (calendarView === 'month') start.setDate(1);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
  const count = calendarView === 'week' ? 7 : Math.ceil(((new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12).getDay() + 6) % 7 + end.getDate()) / 7) * 7;
  return Array.from({length:count}, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return localDate(date);
  });
}
function schedule() {
  const dates = calendarRange();
  const anchor = new Date(calendarDate + 'T12:00:00');
  const dateLabel = date => new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', {day:'numeric',month:'short',year:'numeric'});
  const title = calendarView === 'month' ? anchor.toLocaleDateString('en-NZ', {month:'long', year:'numeric'}) : dateLabel(dates[0]) + ' to ' + dateLabel(dates[6]);
  const lessons = visibleLessons().filter(l => teacherFilter === 'all' || student(l.student)?.teacher === teacherFilter).sort((a,b) => a.time.localeCompare(b.time));
  const total = lessons.filter(l => dates.includes(l.date)).length;
  return head('A rhythm for every day.','Your lessons at a glance. Select a lesson to edit, or add one on any day.',add('lesson','Add lesson')) + `
    <section class="panel calendar-panel">
      <div class="calendar-toolbar">
        <div class="calendar-navigation"><button data-calendar-move="-1" aria-label="Previous ${calendarView}" title="Previous ${calendarView}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><button data-calendar-move="1" aria-label="Next ${calendarView}" title="Next ${calendarView}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button><h2 aria-live="polite">${esc(title)}</h2><button data-calendar-today>Today</button></div>
        <div class="calendar-controls">${director()?`<select id="teacher-filter" aria-label="Filter teacher"><option value="all">All teachers</option>${db.teachers.map(t=>`<option value="${t.id}" ${teacherFilter===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`:''}<div class="tabs" aria-label="Calendar view">${['month','week'].map(view=>`<button data-calendar-view="${view}" class="${calendarView===view?'active':''}" aria-pressed="${calendarView===view}">${view==='month'?'Month':'Week'}</button>`).join('')}</div></div>
      </div>
      <div class="calendar-scroll"><div class="calendar-grid ${calendarView==='week'?'week-view':''}" aria-label="${esc(title)} lesson calendar">
        ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>`<div class="calendar-weekday"><span>${day.slice(0,3)}</span></div>`).join('')}
        ${dates.map(date=>{
          const current = new Date(date+'T12:00:00');
          const daily = lessons.filter(l=>l.date===date);
          return `<section class="calendar-day ${current.getMonth()!==anchor.getMonth()&&calendarView==='month'?'outside-month':''} ${date===today?'is-today':''}" aria-label="${esc(dateLabel(date))}">
            <div class="calendar-day-head"><span class="day-number" ${date===today?'aria-current="date"':''}>${current.getDate()}</span><button class="calendar-add" data-calendar-add="${date}" aria-label="Add lesson on ${esc(dateLabel(date))}" title="Add lesson"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>
            <div class="calendar-events">${daily.map(l=>{
              const s = student(l.student), t = teacher(s.teacher);
              const endMinutes = Number(l.time.slice(0,2))*60+Number(l.time.slice(3))+l.duration;
              const endTime = String(Math.floor(endMinutes/60)).padStart(2,'0')+':'+String(endMinutes%60).padStart(2,'0');
              return `<article class="calendar-event ${t.instrument.toLowerCase()} ${l.status==='Cancelled'?'event-cancelled':''}"><button class="calendar-event-details" data-edit="lesson" data-id="${l.id}" aria-label="Edit ${esc(s.name)} lesson, ${esc(dateLabel(date))}, ${l.time}"><span class="event-time">${esc(l.time)} &ndash; ${endTime}</span><strong>${esc(s.name)}</strong><span>${esc(t.instrument)} &middot; ${l.duration} min</span><span class="event-teacher">${esc(t.name)}</span><span class="event-room">${esc(l.room)} &middot; ${esc(l.status)}</span></button><button class="calendar-delete" data-delete="lesson" data-id="${l.id}" aria-label="Delete ${esc(s.name)} lesson on ${esc(dateLabel(date))}" title="Delete lesson"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></article>`;
            }).join('')}</div>
          </section>`;
        }).join('')}
      </div></div>
      <div class="calendar-footer"><div class="calendar-legend">${instruments.map(i=>`<span><i class="${i.toLowerCase()}"></i>${i}</span>`).join('')}</div><span>${total} lesson${total===1?'':'s'} in view &middot; All times local</span></div>
    </section>`;
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-calendar-move')) {
    const date = new Date(calendarDate+'T12:00:00');
    if (calendarView === 'month') { date.setDate(1); date.setMonth(date.getMonth()+Number(button.dataset.calendarMove)); }
    else date.setDate(date.getDate()+Number(button.dataset.calendarMove)*7);
    calendarDate = localDate(date);
    render();
  }
  if (button.hasAttribute('data-calendar-today')) { calendarDate=today; render(); }
  if (button.dataset.calendarView) { calendarView=button.dataset.calendarView; render(); }
  if (button.dataset.calendarAdd) {
    openEditor('lesson');
    const field=$('#editor [name="date"]');
    if ($('#modal').open && field) { field.value=button.dataset.calendarAdd; updateRepeatPreview(); }
  }
});

function schedulePanel(compact){let rows=visibleLessons().filter(l=>filter==='all'||(filter==='today'?l.date===today:l.date>today)).filter(l=>teacherFilter==='all'||student(l.student)?.teacher===teacherFilter).filter(l=>`${student(l.student)?.name} ${teacher(student(l.student)?.teacher)?.name}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));const count=rows.length;if(compact)rows=rows.slice(0,6);return `<section class="panel"><div class="panel-head"><div><h2>${compact?'Your lesson planner':'Lesson planner'}</h2><p>${filter==='today'?new Date(today+'T12:00').toLocaleDateString('en-NZ',{weekday:'long',month:'long',day:'numeric'}):'Your school, on schedule'}</p></div>${compact?'<button class="text-button" data-page="schedule">View full schedule ↗</button>':''}</div><div class="toolbar"><div class="tabs">${['today','upcoming','all'].map(f=>`<button data-filter="${f}" class="${filter===f?'active':''}">${{today:'Today',upcoming:'Upcoming',all:'All lessons'}[f]}</button>`).join('')}</div>${director()?`<select id="teacher-filter" aria-label="Filter teacher"><option value="all">All teachers</option>${db.teachers.map(t=>`<option value="${t.id}" ${teacherFilter===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`:''}</div><div class="table-wrap"><table><thead><tr><th>Student</th><th>Lesson</th><th>Teacher</th><th>Time</th><th>Status</th><th>Manage</th></tr></thead><tbody>${rows.map(l=>{const s=student(l.student),t=teacher(s?.teacher);return `<tr><td><div class="person">${avatar(s.name)}<div><strong>${esc(s.name)}</strong><small>${esc(s.level)}</small></div></div></td><td>${badge(t.instrument)}<small>${esc(l.room)}</small></td><td>${esc(t.name)}</td><td><strong>${esc(l.time)}</strong><small>${l.duration} min · ${esc(l.date.slice(5))}</small></td><td>${badge(l.status)}</td><td><div class="row-actions"><button data-edit="lesson" data-id="${l.id}">Edit</button><button class="danger" data-delete="lesson" data-id="${l.id}" aria-label="Delete lesson for ${esc(s.name)}">×</button></div></td></tr>`}).join('')}</tbody></table>${!rows.length?'<div class="empty">No lessons here yet. Add a lesson to get started.</div>':''}</div><div class="table-footer">${count} lesson${count===1?'':'s'} ${compact&&count>6?'· Showing the first 6':''} <span style="float:right">A little progress, every day.</span></div></section>`}
function teacherPreview(){const teachers=director()?db.teachers:db.teachers.filter(t=>t.id===session);return `<section class="panel"><div class="panel-head"><h2>${director()?'The teaching team':'Your teaching hours'}</h2><span class="badge">${teachers.length} ${director()?'teachers':'teacher'}</span></div>${teachers.slice(0,4).map(t=>`<div class="teacher-row">${avatar(t.name)}<div><strong>${esc(t.name)}</strong><small>${esc(t.instrument)} teacher</small></div><span>${hours(t.id).toFixed(1)}h</span></div>`).join('')}${director()?'<div class="panel-bottom"><button class="text-button" data-page="teachers">Meet your team ↗</button></div>':''}</section>`}
function invoicePreview(){const list=visibleInvoices().filter(i=>i.status==='Pending');return `<section class="panel"><div class="panel-head"><h2>Awaiting payment</h2><span class="badge pending">${list.length}</span></div>${list.slice(0,3).map(i=>`<div class="invoice-preview"><div><strong>${esc(i.parent)}</strong><small>${esc(i.studentName)} · ${money(i.amount)}</small></div><button data-pdf="${i.id}">PDF ↓</button></div>`).join('')||'<div class="empty">All caught up. Lovely!</div>'}<div class="panel-bottom"><button class="text-button" data-page="invoices">View all invoices ↗</button></div></section>`}
function studentsPage(){const list=visibleStudents().filter(s=>(s.name+' '+s.parent).toLowerCase().includes(query.toLowerCase()));return head('Every student, a rising star.','Keep student details, parent contacts, and lessons together.',add('student','Add student'))+`<section class="panel"><div class="panel-head"><h2>${director()?'All students':'My students'} <span class="badge">${visibleStudents().length}</span></h2><input id="search" placeholder="Search students…" aria-label="Search students" value="${esc(query)}"></div><div class="table-wrap"><table><thead><tr><th>Student</th><th>Instrument</th><th>Teacher</th><th>Parent / guardian</th><th>Manage</th></tr></thead><tbody>${list.map(s=>`<tr><td><div class="person">${avatar(s.name)}<div><strong>${esc(s.name)}</strong><small>${esc(s.level)}</small></div></div></td><td>${badge(teacher(s.teacher).instrument)}</td><td>${esc(teacher(s.teacher).name)}</td><td>${esc(s.parent)}<small>${esc(s.email)}</small></td><td><div class="row-actions"><button data-edit="student" data-id="${s.id}">Edit</button><button class="danger" data-delete="student" data-id="${s.id}">Delete</button></div></td></tr>`).join('')}</tbody></table>${!list.length?'<div class="empty">No students found.</div>':''}</div></section>`}
function teachersPage(){return head('Good teachers. Great possibilities.','Manage your teaching team and their hourly rates.',add('teacher','Add teacher'))+`<div class="grid-cards">${db.teachers.filter(t=>t.active).map(t=>`<article class="panel teacher-card">${avatar(t.name)}<h2>${esc(t.name)}</h2>${badge(t.instrument)}<p>${esc(t.email)}</p><div class="metrics"><div><strong>${db.students.filter(s=>s.teacher===t.id).length}</strong><small>Students</small></div><div><strong>${hours(t.id).toFixed(1)}h</strong><small>Completed</small></div><div><strong>${t.rate===null?'Not set':money(t.rate)}</strong><small>Hourly rate</small></div></div><div class="row-actions"><button data-edit="teacher" data-id="${t.id}">Edit teacher</button><button class="danger" data-delete="teacher" data-id="${t.id}">Archive</button></div></article>`).join('')}</div>`}
function invoicesPage(){return head('Simple invoices. Happy parents.','Create a parent invoice and download a PDF in a few clicks.',add('invoice','Create invoice'))+`<section class="panel"><div class="panel-head"><h2>All invoices</h2><span class="badge">${visibleInvoices().length} invoices</span></div><div class="table-wrap"><table><thead><tr><th>Invoice / student</th><th>Parent / guardian</th><th>Due date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${visibleInvoices().map(i=>`<tr><td><strong>${esc(i.number||i.id)}</strong><small>${esc(i.studentName)}</small></td><td>${esc(i.parent)}<small>${esc(i.email)}</small></td><td>${esc(i.due)}</td><td><strong>${money(i.amount)}</strong></td><td>${badge(i.status)}</td><td><div class="row-actions"><button data-pdf="${i.id}">PDF ↓</button><button data-paid="${i.id}">${i.status==='Paid'?'Mark unpaid':'Mark paid'}</button><button data-delete="invoice" data-id="${i.id}" class="danger">Delete</button></div></td></tr>`).join('')}</tbody></table>${!visibleInvoices().length?'<div class="empty">Your first invoice starts here. Create one above.</div>':''}</div></section>`}
function salaryPage(){const total=db.teachers.reduce((n,t)=>n+salary(t.id),0);return head('A clear view of every hour.','Completed lessons at the rate effective on each lesson date. Estimates before deductions.','')+`<section class="stats"><article class="stat"><div class="stat-top">Total teaching hours</div><strong>${db.teachers.reduce((n,t)=>n+hours(t.id),0).toFixed(1)}h</strong><small>Completed lessons · all time</small></article><article class="stat"><div class="stat-top">Estimated gross salary</div><strong>${money(total)}</strong><small>Uses historical hourly rates</small></article></section><section class="panel"><div class="panel-head"><h2>Teacher salary overview</h2></div><div class="table-wrap"><table><thead><tr><th>Teacher</th><th>Instrument</th><th>Completed hours</th><th>Current hourly rate</th><th>Estimated salary</th><th>Manage</th></tr></thead><tbody>${db.teachers.map(t=>`<tr><td><div class="person">${avatar(t.name)}<strong>${esc(t.name)}</strong></div></td><td>${badge(t.instrument)}</td><td>${hours(t.id).toFixed(2)}h</td><td>${t.rate===null?'Not set':money(t.rate)}</td><td><strong>${money(salary(t.id))}${missingRates(t.id)?`<small class="danger">${missingRates(t.id)} lesson(s) excluded: no rate for their date</small>`:''}</strong></td><td><button data-edit="teacher" data-id="${t.id}">Edit rate</button></td></tr>`).join('')}</tbody></table></div></section>`}
const input=(label,name,value='',type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" required ${extra}></label>`;
const select=(label,name,options,value)=>`<label>${label}<select name="${name}" required>${options.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
function canAccess(kind,id){if(!ready)return false;if(kind==='teacher')return director();if(!id)return true;if(kind==='student')return visibleStudents().some(s=>s.id===id);if(kind==='lesson')return visibleLessons().some(l=>l.id===id);return visibleInvoices().some(i=>i.id===id)}
// Calendar-day arithmetic keeps recurring lessons at the same local time across DST.
function weeklyLessonDates(firstDate, count) {
  const date = new Date(firstDate + 'T12:00:00');
  return Array.from({length: count}, (_, index) => {
    const occurrence = new Date(date);
    occurrence.setDate(date.getDate() + index * 7);
    return localDate(occurrence);
  });
}
function lessonConflict(candidate, excludedId = null) {
  if (candidate.status === 'Cancelled') return false;
  const start = Number(candidate.time.slice(0, 2)) * 60 + Number(candidate.time.slice(3));
  return db.lessons.some(existing => {
    if (existing.id === excludedId || existing.date !== candidate.date || existing.status === 'Cancelled') return false;
    const otherStart = Number(existing.time.slice(0, 2)) * 60 + Number(existing.time.slice(3));
    return start < otherStart + existing.duration && start + candidate.duration > otherStart && (
      student(existing.student)?.teacher === student(candidate.student)?.teacher ||
      existing.student === candidate.student ||
      existing.room.trim().toLowerCase() === candidate.room.trim().toLowerCase()
    );
  });
}
function updateRepeatPreview() {
  const repeat = $('#editor [name="repeat"]');
  if (!repeat) return;
  const weekly = repeat.value === 'weekly';
  const weeks = $('#editor [name="weeks"]');
  weeks.disabled = !weekly;
  weeks.closest('label').hidden = !weekly;
  const date = $('#editor [name="date"]').value;
  const count = Number(weeks.value);
  const preview = $('#repeat-preview');
  if (!weekly) { preview.textContent = 'Creates one lesson.'; return; }
  if (!date || !Number.isInteger(count) || count < 2 || count > 52) {
    preview.textContent = 'Choose a start date and between 2 and 52 lessons.';
    return;
  }
  const dates = weeklyLessonDates(date, count);
  const format = value => new Date(value + 'T12:00:00').toLocaleDateString('en-NZ', {day:'numeric', month:'short', year:'numeric'});
  const day = new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', {weekday:'long'});
  preview.textContent = `${count} lessons, every ${day}, from ${format(dates[0])} to ${format(dates[count - 1])}. Includes the first lesson. Each lesson can be edited or deleted separately.`;
}
function openEditor(kind,id=null){if(!canAccess(kind,id))return;editKind=kind;editId=id;const collection={student:'students',teacher:'teachers',lesson:'lessons',invoice:'invoices'}[kind],item=db[collection].find(i=>i.id===id)||{};if(['lesson','invoice'].includes(kind)&&!visibleStudents().length){notify('Add a student first.');return}if(kind==='student'&&!db.teachers.some(t=>t.active)){notify('Add a teacher first.');return}$('#editor').reset();$('#form-error').textContent='';$('#dialog-title').textContent=(id?'Edit ':'New ')+kind;let fields='';if(kind==='teacher')fields=input('Full name','name',item.name)+select('Instrument','instrument',instruments.map(i=>[i,i]),item.instrument)+input('Email','email',item.email,'email')+input('Hourly rate (NZD)','rate',item.rate??45,'number','min="0" max="10000" step="0.01"')+input('Rate effective from','effective',today,'date')+select('Sign-in account (optional)','userId',[['','Link later'],...db.profiles.filter(p=>p.role==='teacher'&&(p.id===item.userId||!db.teachers.some(t=>t.userId===p.id))).map(p=>[p.id,p.full_name])],item.userId||'')+'<p class="form-note">Create staff sign-in accounts in Supabase Authentication and run the teacher setup query before linking them here. Rate changes apply from the selected date. Earlier rates are kept.</p>';if(kind==='student')fields=input('Student name','name',item.name)+input('Level','level',item.level||'Beginner')+input('Parent / guardian','parent',item.parent)+input('Parent email','email',item.email,'email')+(director()?select('Teacher','teacher',db.teachers.filter(t=>t.active).map(t=>[t.id,t.name+' · '+t.instrument]),item.teacher):'');if(kind==='lesson')fields=select('Student','student',visibleStudents().map(s=>[s.id,s.name+' · '+teacher(s.teacher).instrument]),item.student)+input('Date','date',item.date||today,'date')+input('Start time','time',item.time||'09:00','time')+input('Duration (minutes)','duration',item.duration||45,'number','min="15" max="240" step="5"')+input('Room','room',item.room||'Studio A')+select('Attendance','status',['Scheduled','Completed','Cancelled'].map(s=>[s,s]),item.status)+(id?'<p class="recurrence-note">Changes apply to this lesson only.</p>':select('Repeat','repeat',[['once','Does not repeat'],['weekly','Every week']],'once')+input('Number of lessons (including first)','weeks',10,'number','min="2" max="52" step="1"')+'<p class="recurrence-note" id="repeat-preview" aria-live="polite"></p>');if(kind==='invoice')fields=select('Student','student',visibleStudents().map(s=>[s.id,s.name]),item.student)+input('Due date','due',item.due||today,'date')+input('Amount (NZD)','amount',item.amount??180,'number','min="0.01" max="100000" step="0.01"')+input('Description','description',item.description||'Music tuition');$('#fields').innerHTML=fields;const userSelect=$('#editor [name="userId"]');if(userSelect)userSelect.required=false;updateRepeatPreview();$('#modal').showModal()}
$('#editor').addEventListener('submit',async event=>{
  event.preventDefault();
  if(writeBusy||!canAccess(editKind,editId))return;
  const data=Object.fromEntries(new FormData(event.target));
  for(const key in data)data[key]=data[key].trim();
  $('#form-error').textContent='';
  if(Object.entries(data).some(([key,value])=>key!=='userId'&&!value)){$('#form-error').textContent='Please complete every field.';return;}
  if(editKind==='student'){
    data.teacher=director()?data.teacher:session;
    if(!teacher(data.teacher))return;
    if(editId&&student(editId)?.teacher!==data.teacher&&db.lessons.some(l=>l.student===editId)){$('#form-error').textContent='Remove the existing lessons before assigning a different teacher.';return;}
  }
  if(editKind==='lesson'){
    if(!visibleStudents().some(s=>s.id===data.student))return;
    const start=Number(data.time.slice(0,2))*60+Number(data.time.slice(3));
    const duration=Number(data.duration);
    if(!Number.isInteger(duration)||duration<15||duration>240||duration%5||start+duration>1440){$('#form-error').textContent='Choose a valid duration and finish before midnight.';return;}
    const repeating=!editId&&data.repeat==='weekly';
    if(repeating&&data.status!=='Scheduled'){$('#form-error').textContent='New weekly lessons must have Scheduled attendance. Record completion on each individual lesson.';return;}
    const count=repeating?Number(data.weeks):1;
    if(!Number.isInteger(count)||count<1||count>52||(repeating&&count<2)){$('#form-error').textContent='Choose between 2 and 52 weekly lessons.';return;}
    const conflict=weeklyLessonDates(data.date,count).find(date=>lessonConflict({...data,date,duration},editId));
    if(conflict){$('#form-error').textContent=`A teacher, student, or room is already booked on ${conflict} at ${data.time}. No lessons were saved.`;return;}
  }
  const kind=editKind,id=editId,context=db;
  const buttons=Array.from($('#editor').querySelectorAll('button'));buttons.forEach(b=>b.disabled=true);
  try{await mutate(()=>service.save(kind,id,data,context),kind==='lesson'&&data.repeat==='weekly'?`${data.weeks} weekly lessons saved.`:'Saved to your school database.');}
  finally{buttons.forEach(b=>b.disabled=false);}
});
async function remove(kind,id){
  if(writeBusy||!canAccess(kind,id))return;
  if(kind==='teacher'&&db.students.some(s=>s.teacher===id)){notify('Reassign or remove this teacher?s students before archiving the teacher.');return;}
  const message=kind==='student'?'Delete this student and their lessons? Issued invoices will be kept.':kind==='teacher'?'Archive this teacher? Their sign-in access to teaching records will be removed; financial history is kept.':`Delete this ${kind}?`;
  if(confirm(message))await mutate(()=>service.remove(kind,id),kind==='teacher'?'Teacher archived.':'Record deleted.');
}
// Generate a vector A4 invoice: selectable text, embedded layout, no external PDF dependency.
function buildInvoicePdf(invoice) {
  invoice={...invoice,id:invoice.number||invoice.id};
  const colors = {green:'0.153 0.388 0.302', ink:'0.145 0.227 0.196', muted:'0.45 0.50 0.46', line:'0.88 0.90 0.86', pale:'0.95 0.97 0.93', white:'1 1 1'};
  const clean = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\x20-\x7e\n]/g,'?');
  const literal = value => clean(value).replace(/[\\()]/g,'\\$&').replace(/\n/g,' ');
  const pages = [];
  let commands = [], y = 0;
  const rect = (x,top,w,h,color) => commands.push(`${colors[color]} rg ${x} ${842-top-h} ${w} ${h} re f`);
  const rule = top => commands.push(`${colors.line} RG 0.7 w 44 ${842-top} m 551 ${842-top} l S`);
  const text = (value,x,top,size=10,bold=false,color='ink') => commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${colors[color]} rg 1 0 0 1 ${x} ${842-top-size} Tm (${literal(value)}) Tj ET`);
  const wrap = (value,width,size=10) => {
    const limit = Math.max(1,Math.floor(width/(size*0.62)));
    return clean(value).split('\n').flatMap(paragraph => {
      const words=paragraph.split(/\s+/).filter(Boolean), lines=[];
      let line='';
      for (let word of words) {
        if (line && line.length+word.length+1>limit) {lines.push(line);line='';}
        while(word.length>limit) { if(line){lines.push(line);line='';}lines.push(word.slice(0,limit));word=word.slice(limit); }
        if(word)line+=(line?' ':'')+word;
      }
      if(line||!lines.length)lines.push(line);
      return lines;
    });
  };
  const footer = () => {
    rule(777);
    text('MUSIC STAR SCHOOL',44,792,8,true,'green');
    text('Thank you for making room for music.',44,807,8,false,'muted');
    text(`Page ${pages.length+1}`,510,800,8,false,'muted');
    pages.push(commands.join('\n'));
  };
  const newPage = (continued=false) => {
    commands=[];
    rect(0,0,595,7,'green');
    text('music star',44,34,25,true,'green');
    text('MUSIC SCHOOL',45,67,8,true,'muted');
    text(continued?'INVOICE / CONTINUED':'INVOICE',continued?383:422,38,continued?13:24,true);
    y=100;
    if(continued){rule(94);text(invoice.id,44,108,10,true);y=140;}
  };
  const ensure = height => {if(y+height>750){footer();newPage(true);}};
  const paragraph = (value,x,width,size=10,bold=false,color='ink') => {
    for(const line of wrap(value,width,size)){ensure(size+7);text(line,x,y,size,bold,color);y+=size+7;}
  };
  const dateLabel = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value+'T12:00:00').toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}) : String(value||'');
  const amount = Number(invoice.amount);
  if(!Number.isFinite(amount)||amount<0)throw new Error('Invalid invoice amount');
  const currency = value => 'NZ$ '+value.toLocaleString('en-NZ',{minimumFractionDigits:2,maximumFractionDigits:2});
  const amountText = currency(amount), paid=invoice.status==='Paid';
  const rightMoney = (value,top,size=11,bold=false,color='ink') => {
    // Standard Helvetica widths for currency, digits, comma, period, and spaces.
    const width=Array.from(value).reduce((sum,c)=>sum+(c===' '?.278:c==='.'||c===','?.278:c==='N'?.722:c==='Z'?.611:.556),0)*size;
    text(value,535-width,top,size,bold,color);
  };
  newPage();
  rect(44,101,507,43,'pale');
  text('INVOICE NUMBER',57,110,7,true,'muted');
  text(invoice.id,57,122,10,true);
  text('DUE DATE',294,110,7,true,'muted');
  text(dateLabel(invoice.due),294,122,10,true);
  text(paid?'PAID':'AWAITING PAYMENT',431,117,8,true,'green');
  y=167;
  if(invoice.issued){text('ISSUED '+dateLabel(invoice.issued),44,y,8,false,'muted');y+=24;}
  text('BILL TO',44,y,8,true,'muted');y+=20;
  paragraph(invoice.parent,44,485,13,true);
  paragraph(invoice.email,44,485,10,false,'muted');
  y+=18;rule(y);y+=20;
  text('STUDENT',44,y,8,true,'muted');y+=17;
  paragraph(invoice.studentName,44,485,11,true);
  y+=8;text('TEACHER',44,y,8,true,'muted');y+=17;
  paragraph(teacher(invoice.teacher)?.name||'Former teacher',44,485,10);
  y+=22;ensure(80);
  const tableHeader=()=>{rect(44,y,507,30,'green');text('DESCRIPTION',57,y+10,8,true,'white');text('QTY',393,y+10,8,true,'white');text('AMOUNT (NZD)',461,y+10,8,true,'white');y+=44;};
  tableHeader();
  const description=wrap(invoice.description||'Music tuition',310,11);
  description.forEach((line,index)=>{
    if(y+20>750){footer();newPage(true);tableHeader();}
    text(line,57,y,11,index===0);
    if(index===0){text('1',402,y,11);rightMoney(amountText,y,11,true);}
    y+=18;
  });
  y+=13;rule(y);y+=24;ensure(175);
  text('Subtotal',350,y,10,false,'muted');rightMoney(amountText,y);y+=26;
  rect(335,y,216,48,'pale');text('TOTAL',349,y+17,10,true,'green');rightMoney(amountText,y+14,16,true,'green');y+=65;
  text('Amount paid',350,y,10,false,'muted');rightMoney(currency(paid?amount:0),y);y+=24;
  text('BALANCE DUE',350,y,10,true);rightMoney(currency(paid?0:amount),y,12,true,'green');y+=44;
  ensure(115);rule(y);y+=20;
  text(paid?'PAYMENT RECEIVED':'PAYMENT INFORMATION',44,y,8,true,'green');y+=20;
  paragraph(paid?'Thank you. This invoice has been marked as paid.':'Please arrange payment by the due date using the payment details provided by your teacher or the school.',44,485,9,false,'muted');
  y+=8;paragraph('Payment reference: '+invoice.id,44,485,9,true);
  footer();
  const objects=[null,'','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  const pageIds=[];
  pages.forEach(stream=>{
    const pageId=objects.length+1,streamId=pageId+1;
    pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[0]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pages.length} >>`;
  let output='%PDF-1.4\n';const offsets=[0];
  objects.forEach((object,index)=>{offsets.push(output.length);output+=`${index+1} 0 obj\n${object}\nendobj\n`;});
  const xref=output.length;
  output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return output;
}
function pdf(id) {
  const invoice=visibleInvoices().find(item=>item.id===id);
  if(!invoice)return;
  const url=URL.createObjectURL(new Blob([buildInvoicePdf(invoice)],{type:'application/pdf'}));
  const link=document.createElement('a');
  link.href=url;link.download=(invoice.number||invoice.id)+'.pdf';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Invoice PDF downloaded.');
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||!ready)return;
  if(button.dataset.page){page=button.dataset.page;query='';render();}
  if(button.dataset.filter){filter=button.dataset.filter;render();}
  if(button.dataset.add)openEditor(button.dataset.add);
  if(button.dataset.edit)openEditor(button.dataset.edit,button.dataset.id);
  if(button.dataset.delete)remove(button.dataset.delete,button.dataset.id);
  if(button.dataset.pdf)pdf(button.dataset.pdf);
  if(button.dataset.paid){const invoice=visibleInvoices().find(i=>i.id===button.dataset.paid);if(invoice)mutate(()=>service.markPaid(invoice.id,invoice.status==='Paid'?'Pending':'Paid'),'Invoice status updated.');}
});
document.addEventListener('change',event=>{if(event.target.id==='teacher-filter'){teacherFilter=event.target.value;render();}});
document.addEventListener('input',event=>{if(event.target.id==='search'){query=event.target.value;const pos=event.target.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);}});
$('#close').onclick=$('#cancel').onclick=()=>{if(!writeBusy)$('#modal').close();};
$('#modal').addEventListener('cancel',event=>{if(writeBusy)event.preventDefault();});
$('#modal').addEventListener('click',event=>{if(!writeBusy&&event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#modal').close();}});
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!service)return;
  recovering=false;authNotice='';clearRecoveryUrl();
  $('#auth-error').textContent='';$('#login-button').disabled=true;
  try{
    const result=await service.client.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
    if(result.error)throw result.error;
    await acceptSession(result.data.session);
  }catch(error){$('#auth-error').textContent=service.errorMessage(error);}
  finally{$('#login-button').disabled=false;}
});
async function signOut(){
  if(!service)return;
  recovering=false;clearPasswordFields();clearRecoveryUrl();
  const {error}=await service.client.auth.signOut({scope:'local'});
  if(error){notify(service.errorMessage(error));return;}
  page='overview';query='';teacherFilter='all';await acceptSession(null,true);
}
$('#sign-out').onclick=$('#auth-signout').onclick=signOut;
$('#retry-connection').onclick=async()=>{const {data,error}=await service.client.auth.getSession();if(error){showAuth(service.errorMessage(error),true);return;}acceptSession(data.session,true);};
$('#refresh-data').onclick=async()=>{
  const button=$('#refresh-data');button.disabled=true;
  try{await reloadRecords();notify('School records refreshed.');}
  catch(error){db=emptyDatabase();showAuth(service.errorMessage(error),false);}
  finally{button.disabled=false;}
};
function clearPasswordFields(){
  for(const id of ['current-password','changed-password','changed-confirm','recovery-password','recovery-confirm'])$('#'+id).value='';
}
function passwordError(error){
  if(error.code==='reauthentication_needed'||error.code==='reauthentication_not_valid')return 'Please sign out and sign in again, then retry changing your password.';
  if(error.code==='same_password')return 'Choose a password different from your current password.';
  return service.errorMessage(error);
}
function validNewPassword(password,confirmation,errorElement){
  if(password.length<8){errorElement.textContent='Use a password with at least 8 characters.';return false;}
  if(password!==confirmation){errorElement.textContent='The new passwords do not match.';return false;}
  return true;
}
function clearRecoveryUrl(){
  const url=new URL(location.href);url.searchParams.delete('reset');history.replaceState(null,'',url.pathname+url.search+url.hash);
}
function resetReturnUrl(){
  const url=new URL('./',location.href);url.searchParams.set('reset','password');return url.href;
}
function showRecoveryForm(){
  showAuth('',false);
  $('#auth-title').textContent='Set a new password.';
  $('#auth-intro').textContent='Choose a new password for your Music Star account.';
  $('#new-password-form').hidden=false;
  $('#retry-connection').hidden=true;
}
$('#forgot-password').onclick=()=>{
  authNotice='';
  showAuth('',false);
  $('#auth-title').textContent='Forgot your password?';
  $('#auth-intro').textContent='Enter your account email and we will send you a link to reset your password.';
  $('#reset-request-form').hidden=false;
  $('#reset-email').value=$('#login-email').value;
  $('#reset-request-error').textContent='';$('#reset-request-success').textContent='';
  $('#reset-email').focus();
};
$('#back-to-login').onclick=()=>{recovering=false;clearRecoveryUrl();showAuth('',true);};
$('#reset-request-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!service)return;
  const button=event.target.querySelector('[type="submit"]');if(button.disabled)return;
  button.disabled=true;$('#reset-request-error').textContent='';$('#reset-request-success').textContent='';
  try{
    const {error}=await service.client.auth.resetPasswordForEmail($('#reset-email').value.trim(),{redirectTo:resetReturnUrl()});
    if(error)throw error;
    $('#reset-request-success').textContent='If an account exists for this email, a reset link has been requested. Check your inbox and spam folder.';
  }catch(error){$('#reset-request-error').textContent=passwordError(error);}
  finally{button.disabled=false;}
});
$('#change-password').onclick=()=>{
  if(!ready||passwordBusy)return;
  $('#change-password-form').reset();$('#password-error').textContent='';$('#password-dialog').showModal();
};
$('#password-close').onclick=$('#password-cancel').onclick=()=>{if(!passwordBusy){$('#password-dialog').close();clearPasswordFields();}};
$('#password-dialog').addEventListener('cancel',event=>{if(passwordBusy)event.preventDefault();else clearPasswordFields();});
$('#change-password-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!ready||passwordBusy)return;
  const password=$('#changed-password').value,confirmation=$('#changed-confirm').value,current=$('#current-password').value;
  $('#password-error').textContent='';
  if(!current){$('#password-error').textContent='Enter your current password.';return;}
  if(!validNewPassword(password,confirmation,$('#password-error')))return;
  if(password===current){$('#password-error').textContent='Choose a password different from your current password.';return;}
  passwordBusy=true;const userId=authenticatedUser.id;
  const buttons=[...event.target.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
  try{
    const {error}=await service.client.auth.updateUser({password,current_password:current});
    if(error)throw error;
    if(authenticatedUser?.id===userId){$('#password-dialog').close();clearPasswordFields();notify('Your password has been updated.');}
  }catch(error){if(authenticatedUser?.id===userId)$('#password-error').textContent=passwordError(error);}
  finally{passwordBusy=false;buttons.forEach(button=>button.disabled=false);}
});
$('#new-password-form').addEventListener('submit',async event=>{
  event.preventDefault();if(passwordBusy||!service)return;
  $('#recovery-error').textContent='';
  const password=$('#recovery-password').value;
  if(!validNewPassword(password,$('#recovery-confirm').value,$('#recovery-error')))return;
  passwordBusy=true;const button=event.target.querySelector('[type="submit"]');button.disabled=true;
  try{
    const {data,error:sessionError}=await service.client.auth.getSession();
    if(sessionError)throw sessionError;
    if(!data.session)throw new Error('Your reset session has expired. Request a new reset link.');
    const {error}=await service.client.auth.updateUser({password});
    if(error)throw error;
    recovering=false;authNotice='Your password has been updated. Sign in with your new password.';clearPasswordFields();
    const url=new URL(location.href);url.searchParams.delete('reset');url.hash='';history.replaceState(null,'',url.pathname+url.search);
    await signOut();
    if(!authenticatedUser)showAuth('Your password has been updated. Sign in with your new password.',true);
  }catch(error){$('#recovery-error').textContent=passwordError(error);}
  finally{passwordBusy=false;button.disabled=false;}
});
if(!service){showAuth('The sign-in service could not load. Refresh the page or check your connection.',false);}
else{
  service.client.auth.onAuthStateChange((event,authSession)=>{
    if(event==='PASSWORD_RECOVERY'){recovering=true;setTimeout(()=>acceptSession(authSession,true),0);return;}
    if(event==='SIGNED_OUT'){recovering=false;clearPasswordFields();}
    if(['SIGNED_OUT','SIGNED_IN','INITIAL_SESSION'].includes(event))setTimeout(()=>acceptSession(authSession),0);
  });
  service.client.auth.getSession().then(({data,error})=>{
    if(error)showAuth(service.errorMessage(error),true);else acceptSession(data.session);
  }).catch(error=>showAuth(service.errorMessage(error),true));
}

$('#editor').addEventListener('input', event => {
  if (['repeat', 'weeks', 'date'].includes(event.target.name)) updateRepeatPreview();
});
$('#editor').addEventListener('change', event => {
  if (['repeat', 'weeks', 'date'].includes(event.target.name)) updateRepeatPreview();
});
