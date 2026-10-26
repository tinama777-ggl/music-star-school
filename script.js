const teachers = [
  { name: 'Sophia Lee', instrument: 'Piano', specialty: 'Beginner & grade 5', hours: 28, rate: 40, students: 12 },
  { name: 'Daniel Park', instrument: 'Violin', specialty: 'Strings ensemble', hours: 26, rate: 38, students: 10 },
  { name: 'Ava Brooks', instrument: 'Cello', specialty: 'Advanced performance', hours: 22, rate: 42, students: 8 },
  { name: 'Liam Chen', instrument: 'Flute', specialty: 'Band & breathing', hours: 24, rate: 36, students: 9 }
];

const lessons = [
  { teacher: 'Sophia Lee', instrument: 'Piano', student: 'Ella Stone', time: '2026-10-27 09:00', room: 'Studio A', status: 'Confirmed' },
  { teacher: 'Daniel Park', instrument: 'Violin', student: 'Noah James', time: '2026-10-27 11:30', room: 'Studio C', status: 'Pending' },
  { teacher: 'Ava Brooks', instrument: 'Cello', student: 'Mia Larkin', time: '2026-10-27 14:00', room: 'Studio B', status: 'Confirmed' },
  { teacher: 'Liam Chen', instrument: 'Flute', student: 'Zoe Hales', time: '2026-10-28 10:00', room: 'Studio D', status: 'Confirmed' },
  { teacher: 'Sophia Lee', instrument: 'Piano', student: 'Olivia Reed', time: '2026-10-28 15:30', room: 'Studio A', status: 'Pending' },
  { teacher: 'Daniel Park', instrument: 'Violin', student: 'James Turner', time: '2026-10-29 08:00', room: 'Studio C', status: 'Cancelled' }
];

const invoices = [
  { parent: 'Maria Turner', student: 'Daniel Turner', teacher: 'Sophia Lee', due: '2026-10-30', amount: 220, status: 'Paid' },
  { parent: 'Alex Green', student: 'Mia Green', teacher: 'Daniel Park', due: '2026-10-31', amount: 180, status: 'Pending' },
  { parent: 'Olivia Shaw', student: 'Noah Shaw', teacher: 'Ava Brooks', due: '2026-11-02', amount: 260, status: 'Overdue' },
  { parent: 'Sarah Cole', student: 'Emma Cole', teacher: 'Liam Chen', due: '2026-11-03', amount: 150, status: 'Paid' }
];

const stats = [
  { label: 'Active teachers', value: '22', trend: '+4%', tone: 'up', icon: '🎼', bg: 'rgba(70, 88, 255, 0.12)' },
  { label: 'Lessons today', value: '38', trend: '+12%', tone: 'up', icon: '📚', bg: 'rgba(29, 184, 111, 0.12)' },
  { label: 'Pending invoices', value: '$2.3k', trend: '-8%', tone: 'down', icon: '💳', bg: 'rgba(245, 158, 11, 0.12)' },
  { label: 'Hours worked', value: '196h', trend: '+6%', tone: 'up', icon: '⏱️', bg: 'rgba(138, 92, 246, 0.12)' }
];

const modules = [
  { name: 'Lesson Scheduling', description: 'View daily, weekly and monthly lesson timetables and manage attendance.', icon: '🗓️', color: '#edf3ff' },
  { name: 'Student Management', description: 'Track student records, contacts, instruments, progress and lesson history.', icon: '👩‍🎓', color: '#eefcf5' },
  { name: 'Invoice Management', description: 'Create invoices, monitor paid and unpaid balances, and email parents.', icon: '🧾', color: '#fff5e8' },
  { name: 'Teacher Hours', description: 'Monitor weekly and monthly teaching hours by teacher and instrument.', icon: '⏱️', color: '#f3f0ff' },
  { name: 'Salary Management', description: 'Calculate wages based on hourly rates and completed teaching hours.', icon: '💰', color: '#eff9ff' },
  { name: 'Director Dashboard', description: 'Monitor workloads, revenue, staff performance and school finances.', icon: '📊', color: '#fef2f2' }
];

const scheduleBody = document.getElementById('scheduleTableBody');
const teacherCards = document.getElementById('teacherCards');
const invoiceList = document.getElementById('invoiceList');
const salaryTableBody = document.getElementById('salaryTableBody');
const directorSummary = document.getElementById('directorSummary');
const statsGrid = document.getElementById('statsGrid');

function renderStats() {
  statsGrid.innerHTML = stats.map(stat => `
    <article class="stat-card">
      <div class="stat-top">
        <span class="stat-icon" style="background:${stat.bg};">${stat.icon}</span>
      </div>
      <div class="stat-value">
        <div>
          <p>${stat.label}</p>
          <h3>${stat.value}</h3>
        </div>
        <span class="trend ${stat.tone}">${stat.trend}</span>
      </div>
    </article>
  `).join('');
}

function renderTeachers() {
  teacherCards.innerHTML = teachers.map((teacher, index) => {
    const availability = index % 2 === 0 ? 'Available' : 'Booked';
    return `
      <article class="teacher-card">
        <div class="teacher-top">
          <div class="teacher-avatar">${teacher.name.split(' ').map(n => n[0]).slice(0,2).join('')}</div>
          <span class="pill ${availability === 'Available' ? 'success' : 'warning'}">${availability}</span>
        </div>
        <h4>${teacher.name}</h4>
        <p class="teacher-role">${teacher.instrument} teacher</p>
        <small>${teacher.specialty}</small>
        <div class="teacher-meta">
          <span>${teacher.students} students</span>
          <strong>${teacher.hours}h</strong>
        </div>
      </article>
    `;
  }).join('');
}

function renderSchedule(filter = 'all') {
  const filtered = lessons.filter((lesson) => {
    if (filter === 'today') {
      return lesson.time.startsWith('2026-10-27');
    }
    if (filter === 'upcoming') {
      return !lesson.time.startsWith('2026-10-27');
    }
    return true;
  });

  scheduleBody.innerHTML = filtered.map((lesson) => `
    <tr>
      <td>${lesson.teacher}</td>
      <td>${lesson.instrument}</td>
      <td>${lesson.student}</td>
      <td>${new Date(lesson.time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
      <td><span class="status-pill ${lesson.status.toLowerCase()}">${lesson.status}</span></td>
      <td>${lesson.room}</td>
    </tr>
  `).join('');
}

function renderInvoices() {
  invoiceList.innerHTML = invoices.map((invoice) => `
    <article class="invoice-item">
      <div>
        <strong>${invoice.parent}</strong>
        <div class="invoice-meta">
          <span>${invoice.student} • ${invoice.teacher}</span>
          <span>Due ${invoice.due}</span>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="invoice-amount">$${invoice.amount}</div>
        <span class="status-pill ${invoice.status.toLowerCase().replace(' ', '-')}">${invoice.status}</span>
      </div>
    </article>
  `).join('');
}

function renderDirectorSummary() {
  const totalHours = teachers.reduce((sum, teacher) => sum + teacher.hours, 0);
  const avgPay = teachers.reduce((sum, teacher) => sum + teacher.rate, 0) / teachers.length;
  const totalRevenue = invoices.filter(inv => inv.status !== 'Pending').reduce((sum, inv) => sum + inv.amount, 0);

  directorSummary.innerHTML = `
    <div class="director-item">
      <span>Total weekly hours</span>
      <strong>${totalHours}h</strong>
    </div>
    <div class="director-item">
      <span>Average rate</span>
      <strong>$${avgPay.toFixed(0)}/hr</strong>
    </div>
    <div class="director-item">
      <span>Collected revenue</span>
      <strong>$${totalRevenue}</strong>
    </div>
  `;
}

function renderSalaryTable() {
  salaryTableBody.innerHTML = teachers.map((teacher) => `
    <tr>
      <td>${teacher.name}</td>
      <td>${teacher.hours}h</td>
      <td>$${teacher.rate}/hr</td>
      <td>$${(teacher.hours * teacher.rate).toFixed(0)}</td>
    </tr>
  `).join('');
}

function populateTeacherSelects() {
  const options = teachers.map((teacher) => `<option value="${teacher.name}">${teacher.name} (${teacher.instrument})</option>`).join('');
  document.getElementById('invoiceTeacher').innerHTML = `<option value="">Select teacher</option>${options}`;
  document.getElementById('lessonTeacher').innerHTML = `<option value="">Select teacher</option>${options}`;
}

function attachEvents() {
  document.querySelectorAll('.filter').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      renderSchedule(button.dataset.filter);
    });
  });

  document.querySelectorAll('.role-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
    });
  });

  document.getElementById('invoiceForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const parentName = document.getElementById('parentName').value.trim();
    const studentName = document.getElementById('studentName').value.trim();
    const teacherName = document.getElementById('invoiceTeacher').value;
    const amount = Number(document.getElementById('invoiceAmount').value);

    if (!parentName || !studentName || !teacherName || !amount) return;

    invoices.unshift({
      parent: parentName,
      student: studentName,
      teacher: teacherName,
      due: '2026-11-08',
      amount,
      status: 'Pending'
    });

    renderInvoices();
    renderDirectorSummary();
    event.target.reset();
  });

  document.getElementById('lessonForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const student = document.getElementById('lessonStudent').value.trim();
    const teacherName = document.getElementById('lessonTeacher').value;
    const date = document.getElementById('lessonDate').value;
    const time = document.getElementById('lessonTime').value;

    if (!student || !teacherName || !date || !time) return;

    const teacher = teachers.find((item) => item.name === teacherName);
    lessons.unshift({
      teacher: teacherName,
      instrument: teacher ? teacher.instrument : 'General',
      student,
      time: `${date} ${time}`,
      room: teacher ? `Studio ${teacher.instrument.slice(0, 1)}` : 'Studio A',
      status: 'Confirmed'
    });

    renderSchedule(document.querySelector('.filter.active')?.dataset.filter || 'all');
    event.target.reset();
  });
}

renderStats();
renderTeachers();
renderSchedule();
renderInvoices();
renderDirectorSummary();
renderSalaryTable();
populateTeacherSelects();
attachEvents();
