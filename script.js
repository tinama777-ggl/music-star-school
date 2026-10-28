'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=localDate(new Date());
const money=n=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(n);
const instruments=['Piano','Violin','Cello','Flute'];
const seed={teachers:[{id:'t1',name:'Sophia Lee',instrument:'Piano',rate:45,email:'sophia@example.com'},{id:'t2',name:'Daniel Park',instrument:'Violin',rate:48,email:'daniel@example.com'},{id:'t3',name:'Ava Brooks',instrument:'Cello',rate:50,email:'ava@example.com'},{id:'t4',name:'Liam Chen',instrument:'Flute',rate:42,email:'liam@example.com'}],students:[{id:'s1',name:'Ella Stone',teacher:'t1',parent:'Maria Stone',email:'maria@example.com',level:'Grade 3'},{id:'s2',name:'Noah James',teacher:'t2',parent:'Alex James',email:'alex@example.com',level:'Beginner'},{id:'s3',name:'Mia Larkin',teacher:'t3',parent:'Sarah Larkin',email:'sarah@example.com',level:'Grade 4'},{id:'s4',name:'Zoe Hales',teacher:'t4',parent:'Olivia Hales',email:'olivia@example.com',level:'Grade 2'},{id:'s5',name:'Oliver Reed',teacher:'t1',parent:'James Reed',email:'james@example.com',level:'Grade 1'},{id:'s6',name:'Lucas Turner',teacher:'t2',parent:'Emma Turner',email:'emma@example.com',level:'Grade 3'}],lessons:[],invoices:[]};
seed.lessons=seed.students.map((s,i)=>({id:'l'+i,student:s.id,date:today,time:['09:00','10:00','11:00','13:00','14:00','15:00'][i],duration:i%2?45:60,room:'Studio '+String.fromCharCode(65+i%4),status:i<2?'Completed':'Scheduled'}));
seed.invoices=[{id:'INV-1001',student:'s1',teacher:'t1',studentName:'Ella Stone',parent:'Maria Stone',email:'maria@example.com',amount:180,description:'4 piano lessons',due:today,status:'Pending'},{id:'INV-1002',student:'s2',teacher:'t2',studentName:'Noah James',parent:'Alex James',email:'alex@example.com',amount:160,description:'4 violin lessons',due:today,status:'Paid'}];
let db;try{db=JSON.parse(localStorage.getItem('musicstar-v2'))||structuredClone(seed)}catch{db=structuredClone(seed)}
let session='director',page='overview',filter='today',query='',teacherFilter='all',editKind='',editId=null,toastTimer;
let calendarDate = today;
let calendarView = 'month';
const director=()=>session==='director';
const teacher=id=>db.teachers.find(t=>t.id===id);
const student=id=>db.students.find(s=>s.id===id);
const visibleStudents=()=>db.students.filter(s=>director()||s.teacher===session);
const visibleLessons=()=>db.lessons.filter(l=>visibleStudents().some(s=>s.id===l.student));
const visibleInvoices=()=>db.invoices.filter(i=>director()||i.teacher===session);
const hours=id=>db.lessons.filter(l=>student(l.student)?.teacher===id&&l.status==='Completed').reduce((n,l)=>n+l.duration/60,0);
const initials=name=>name.split(' ').map(x=>x[0]).slice(0,2).join('');
const avatar=name=>`<span class="avatar">${esc(initials(name))}</span>`;
const badge=(text,type=text)=>`<span class="badge ${esc(type.toLowerCase())}">${esc(text)}</span>`;
const icons={overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 11h18M8 3v4m8-4v4"/>',students:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m0-16a3 3 0 0 1 0 6m3 4a5 5 0 0 1 3 5"/>',teachers:'<path d="m2 8 10-5 10 5-10 5zM6 10v7q6 5 12 0v-7M22 8v8"/>',invoices:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6"/>',salary:'<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 9h2m14 7h2"/>'};
const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[k]}</svg>`;
const titles={overview:'Overview',schedule:'Lesson schedule',students:'Students',teachers:'Teachers',invoices:'Invoices',salary:'Hours & salary'};
function notify(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',3500)}
function save(){try{localStorage.setItem('musicstar-v2',JSON.stringify(db))}catch{notify('Browser storage is unavailable. Changes will last for this session.')}render()}
function render(){if(!director()&&['teachers','salary'].includes(page))page='overview';$('#nav').innerHTML=Object.entries(titles).filter(([k])=>director()||!['teachers','salary'].includes(k)).map(([k,v])=>`<button data-page="${k}" class="${page===k?'active':''}">${icon(k)}${v}</button>`).join('');$('#session').innerHTML='<option value="director">Olivia Reed · Director</option>'+db.teachers.map(t=>`<option value="${t.id}">${esc(t.name)} · Teacher</option>`).join('');$('#session').value=session;const name=director()?'Olivia Reed':teacher(session)?.name||'';$('#profile').innerHTML=avatar(name)+`<div><strong>${esc(name)}</strong><small>${director()?'School director':esc(teacher(session)?.instrument)+' teacher'}</small></div>`;$('#crumb').textContent=titles[page];$('#today').textContent=new Date().toLocaleDateString('en-NZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'});$('#main').innerHTML=page==='overview'?overview():page==='schedule'?schedule():page==='students'?studentsPage():page==='teachers'?teachersPage():page==='invoices'?invoicesPage():salaryPage()}
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
function teachersPage(){return head('Good teachers. Great possibilities.','Manage your teaching team and their hourly rates.',add('teacher','Add teacher'))+`<div class="grid-cards">${db.teachers.map(t=>`<article class="panel teacher-card">${avatar(t.name)}<h2>${esc(t.name)}</h2>${badge(t.instrument)}<p>${esc(t.email)}</p><div class="metrics"><div><strong>${db.students.filter(s=>s.teacher===t.id).length}</strong><small>Students</small></div><div><strong>${hours(t.id).toFixed(1)}h</strong><small>Completed</small></div><div><strong>${money(t.rate)}</strong><small>Hourly rate</small></div></div><div class="row-actions"><button data-edit="teacher" data-id="${t.id}">Edit teacher</button><button class="danger" data-delete="teacher" data-id="${t.id}">Delete</button></div></article>`).join('')}</div>`}
function invoicesPage(){return head('Simple invoices. Happy parents.','Create a parent invoice and download a PDF in a few clicks.',add('invoice','Create invoice'))+`<section class="panel"><div class="panel-head"><h2>All invoices</h2><span class="badge">${visibleInvoices().length} invoices</span></div><div class="table-wrap"><table><thead><tr><th>Invoice / student</th><th>Parent / guardian</th><th>Due date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${visibleInvoices().map(i=>`<tr><td><strong>${esc(i.id)}</strong><small>${esc(i.studentName)}</small></td><td>${esc(i.parent)}<small>${esc(i.email)}</small></td><td>${esc(i.due)}</td><td><strong>${money(i.amount)}</strong></td><td>${badge(i.status)}</td><td><div class="row-actions"><button data-pdf="${i.id}">PDF ↓</button><button data-paid="${i.id}">${i.status==='Paid'?'Mark unpaid':'Mark paid'}</button><button data-delete="invoice" data-id="${i.id}" class="danger">Delete</button></div></td></tr>`).join('')}</tbody></table>${!visibleInvoices().length?'<div class="empty">Your first invoice starts here. Create one above.</div>':''}</div></section>`}
function salaryPage(){const total=db.teachers.reduce((n,t)=>n+hours(t.id)*t.rate,0);return head('A clear view of every hour.','All-time completed lessons × current hourly rate. Estimates before deductions.','')+`<section class="stats"><article class="stat"><div class="stat-top">Total teaching hours</div><strong>${db.teachers.reduce((n,t)=>n+hours(t.id),0).toFixed(1)}h</strong><small>Completed lessons · all time</small></article><article class="stat"><div class="stat-top">Estimated gross salary</div><strong>${money(total)}</strong><small>Based on current teacher rates</small></article></section><section class="panel"><div class="panel-head"><h2>Teacher salary overview</h2></div><div class="table-wrap"><table><thead><tr><th>Teacher</th><th>Instrument</th><th>Completed hours</th><th>Hourly rate</th><th>Estimated salary</th><th>Manage</th></tr></thead><tbody>${db.teachers.map(t=>`<tr><td><div class="person">${avatar(t.name)}<strong>${esc(t.name)}</strong></div></td><td>${badge(t.instrument)}</td><td>${hours(t.id).toFixed(2)}h</td><td>${money(t.rate)}</td><td><strong>${money(hours(t.id)*t.rate)}</strong></td><td><button data-edit="teacher" data-id="${t.id}">Edit rate</button></td></tr>`).join('')}</tbody></table></div></section>`}
const input=(label,name,value='',type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" required ${extra}></label>`;
const select=(label,name,options,value)=>`<label>${label}<select name="${name}" required>${options.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
function canAccess(kind,id){if(kind==='teacher')return director();if(!id)return true;if(kind==='student')return visibleStudents().some(s=>s.id===id);if(kind==='lesson')return visibleLessons().some(l=>l.id===id);return visibleInvoices().some(i=>i.id===id)}
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
function openEditor(kind,id=null){if(!canAccess(kind,id))return;editKind=kind;editId=id;const collection={student:'students',teacher:'teachers',lesson:'lessons',invoice:'invoices'}[kind],item=db[collection].find(i=>i.id===id)||{};if(['lesson','invoice'].includes(kind)&&!visibleStudents().length){notify('Add a student first.');return}if(kind==='student'&&!db.teachers.length){notify('Add a teacher first.');return}$('#editor').reset();$('#form-error').textContent='';$('#dialog-title').textContent=(id?'Edit ':'New ')+kind;let fields='';if(kind==='teacher')fields=input('Full name','name',item.name)+select('Instrument','instrument',instruments.map(i=>[i,i]),item.instrument)+input('Email','email',item.email,'email')+input('Hourly rate (NZD)','rate',item.rate??45,'number','min="0" max="10000" step="0.01"');if(kind==='student')fields=input('Student name','name',item.name)+input('Level','level',item.level||'Beginner')+input('Parent / guardian','parent',item.parent)+input('Parent email','email',item.email,'email')+(director()?select('Teacher','teacher',db.teachers.map(t=>[t.id,t.name+' · '+t.instrument]),item.teacher):'');if(kind==='lesson')fields=select('Student','student',visibleStudents().map(s=>[s.id,s.name+' · '+teacher(s.teacher).instrument]),item.student)+input('Date','date',item.date||today,'date')+input('Start time','time',item.time||'09:00','time')+input('Duration (minutes)','duration',item.duration||45,'number','min="15" max="240" step="5"')+input('Room','room',item.room||'Studio A')+select('Attendance','status',['Scheduled','Completed','Cancelled'].map(s=>[s,s]),item.status)+(id?'<p class="recurrence-note">Changes apply to this lesson only.</p>':select('Repeat','repeat',[['once','Does not repeat'],['weekly','Every week']],'once')+input('Number of lessons (including first)','weeks',10,'number','min="2" max="52" step="1"')+'<p class="recurrence-note" id="repeat-preview" aria-live="polite"></p>');if(kind==='invoice')fields=select('Student','student',visibleStudents().map(s=>[s.id,s.name]),item.student)+input('Due date','due',item.due||today,'date')+input('Amount (NZD)','amount',item.amount??180,'number','min="0.01" max="100000" step="0.01"')+input('Description','description',item.description||'Music tuition');$('#fields').innerHTML=fields;updateRepeatPreview();$('#modal').showModal()}
$('#editor').addEventListener('submit',e=>{e.preventDefault();if(!canAccess(editKind,editId))return;const data=Object.fromEntries(new FormData(e.target));for(const key in data)data[key]=data[key].trim();if(Object.values(data).some(v=>!v)){ $('#form-error').textContent='Please complete every field.';return}const collections={student:'students',teacher:'teachers',lesson:'lessons',invoice:'invoices'},list=db[collections[editKind]],index=list.findIndex(i=>i.id===editId);if(editKind==='student'){data.teacher=director()?data.teacher:session;if(!teacher(data.teacher))return;if(index>=0&&list[index].teacher!==data.teacher&&db.lessons.some(l=>l.student===editId)){ $('#form-error').textContent='Remove this student’s existing lessons before changing their teacher.';return}}if(editKind==='teacher')data.rate=Number(data.rate);if(editKind==='lesson') {
  if (!visibleStudents().some(s => s.id === data.student)) return;
  data.duration = Number(data.duration);
  const start = Number(data.time.slice(0,2)) * 60 + Number(data.time.slice(3));
  if (!Number.isFinite(start) || !Number.isInteger(data.duration) || data.duration < 15 || data.duration > 240 || data.duration % 5 || start + data.duration > 1440) {
    $('#form-error').textContent = 'Choose a valid duration and finish before midnight.';
    return;
  }
  const repeating = !editId && data.repeat === 'weekly';
  const count = repeating ? Number(data.weeks) : 1;
  if (!Number.isInteger(count) || count < 1 || count > 52 || (repeating && count < 2)) {
    $('#form-error').textContent = 'Choose between 2 and 52 weekly lessons.';
    return;
  }
  delete data.repeat;
  delete data.weeks;
  const dates = weeklyLessonDates(data.date, count);
  const conflictDate = dates.find(date => lessonConflict({...data, date}, editId));
  if (conflictDate) {
    const dateLabel = new Date(conflictDate + 'T12:00:00').toLocaleDateString('en-NZ', {day:'numeric', month:'long', year:'numeric'});
    $('#form-error').textContent = `A teacher, student, or room is already booked on ${dateLabel} at ${data.time}. ${repeating ? 'No lessons were added. Change the time, room, or number of lessons and try again.' : 'Choose another time or room.'}`;
    return;
  }
  // Validate the whole series before adding any records.
  if (repeating) {
    const seriesId = uid();
    list.push(...dates.map(date => ({...data, date, id:uid(), seriesId})));
    $('#modal').close();
    save();
    notify(`${count} weekly lessons added.`);
    return;
  }
}if(editKind==='invoice'){const s=visibleStudents().find(s=>s.id===data.student);if(!s)return;Object.assign(data,{teacher:s.teacher,studentName:s.name,parent:s.parent,email:s.email,amount:Number(data.amount),status:'Pending',issued:today})}if(index>=0)list[index]={...list[index],...data};else list.push({...data,id:editKind==='invoice'?'INV-'+Date.now():uid()});$('#modal').close();save();notify('Saved. Everything is up to date.')});
function remove(kind,id){if(!canAccess(kind,id))return;const key={student:'students',teacher:'teachers',lesson:'lessons',invoice:'invoices'}[kind];if(kind==='teacher'&&db.students.some(s=>s.teacher===id)){notify('Reassign or remove this teacher’s students first.');return}if(!confirm(kind==='student'?'Delete this student and their lessons? Existing invoices will be kept.':`Delete this ${kind}?`))return;db[key]=db[key].filter(i=>i.id!==id);if(kind==='student')db.lessons=db.lessons.filter(l=>l.student!==id);save();notify('Deleted successfully.')}
// Generate a vector A4 invoice: selectable text, embedded layout, no external PDF dependency.
function buildInvoicePdf(invoice) {
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
  link.href=url;link.download=invoice.id+'.pdf';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Invoice PDF downloaded.');
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.page){page=b.dataset.page;query='';render()}if(b.dataset.filter){filter=b.dataset.filter;render()}if(b.dataset.add)openEditor(b.dataset.add);if(b.dataset.edit)openEditor(b.dataset.edit,b.dataset.id);if(b.dataset.delete)remove(b.dataset.delete,b.dataset.id);if(b.dataset.pdf)pdf(b.dataset.pdf);if(b.dataset.paid){const i=visibleInvoices().find(i=>i.id===b.dataset.paid);if(i){i.status=i.status==='Paid'?'Pending':'Paid';save();notify('Invoice status updated.')}}});
$('#session').addEventListener('change',e=>{session=e.target.value;teacherFilter='all';query='';$('#modal').close();render()});document.addEventListener('change',e=>{if(e.target.id==='teacher-filter'){teacherFilter=e.target.value;render()}});document.addEventListener('input',e=>{if(e.target.id==='search'){query=e.target.value;const pos=e.target.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(pos,pos)}});$('#close').onclick=$('#cancel').onclick=()=>$('#modal').close();$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close()}});render();

$('#editor').addEventListener('input', event => {
  if (['repeat', 'weeks', 'date'].includes(event.target.name)) updateRepeatPreview();
});
$('#editor').addEventListener('change', event => {
  if (['repeat', 'weeks', 'date'].includes(event.target.name)) updateRepeatPreview();
});
