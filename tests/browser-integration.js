(async()=>{
 const results=[];
 const assert=(value,message)=>{if(!value)throw Error(message)};
 const waitFor=async condition=>{for(let i=0;i<150;i++){if(condition())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out waiting for UI');};
 const check=async(name,fn)=>{try{await fn();results.push('PASS '+name)}catch(error){results.push('FAIL '+name+': '+error.message)}};
 const fill=(name,value)=>{const field=$('#editor [name="'+name+'"]');field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));};
 const submit=async()=>{$('#editor').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!writeBusy)};
 const login=async email=>{$('#login-email').value=email;$('#login-password').value='fixture-password';$('#login-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>ready);};
 await waitFor(()=>!$('#login-form').hidden);
 await check('signed-out view contains no demo records',()=>{assert(!ready,'unexpected ready');assert($('#main').textContent==='','records shown');assert(!$('#session'),'preview selector remains');assert(!calls.some(c=>c.table==='students'),'signed-out student query');});
 await check('forgot password requests an email without revealing account existence',async()=>{
  $('#forgot-password').click();assert(!$('#reset-request-form').hidden&&$('#login-form').hidden,'reset form');
  $('#reset-email').value='one@example.test';$('#reset-request-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await waitFor(()=>!$('#reset-request-form [type="submit"]').disabled);
  assert(resetCalls.at(-1).options.redirectTo.endsWith('?reset=password'),'reset return URL');
  assert($('#reset-request-success').textContent.includes('If an account exists'),'account enumeration');
  $('#back-to-login').click();
 });
 await check('reset email errors are shown and can be retried',async()=>{
  $('#forgot-password').click();$('#reset-email').value='one@example.test';resetFailNext=true;
  $('#reset-request-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await waitFor(()=>!$('#reset-request-form [type="submit"]').disabled);
  assert($('#reset-request-error').textContent.includes('Please wait'),'email error missing');$('#back-to-login').click();
 });
 await check('director sign-in loads database account and records',async()=>{await login('director@example.test');assert(director(),'director role');assert(db.students.length===2,'student load');assert($('#profile').textContent.includes('Test Director'),'profile name');assert(!document.body.classList.contains('signed-out'),'login not dismissed');});
 await check('historical salary rates apply by lesson date',()=>{assert(salary(testIds.t1)===80,'expected 30 + 50');assert(hours(testIds.t1)===2,'completed hours');});
 await check('student save maps fields and reloads server data',async()=>{openEditor('student');fill('name','New Student');fill('parent','New Parent');fill('email','new@example.test');fill('teacher',testIds.t1);await submit();const saved=fixture.students.find(s=>s.name==='New Student');assert(saved.parent_name==='New Parent','parent mapping');assert(db.students.some(s=>s.id===saved.id),'server refresh missing');});
 await check('failed save retains form and avoids optimistic records',async()=>{openEditor('student');fill('name','Should Not Save');fill('parent','Parent');fill('email','fail@example.test');fill('teacher',testIds.t1);failNext=true;await submit();assert($('#modal').open,'form closed on failure');assert($('#form-error').textContent.includes('Simulated'),'error missing');assert(!db.students.some(s=>s.name==='Should Not Save'),'optimistic record');$('#modal').close();});
 await check('weekly lessons use atomic database RPC',async()=>{openEditor('lesson');fill('student',testIds.s1);fill('date','2027-02-01');fill('time','10:00');fill('repeat','weekly');fill('weeks','4');updateRepeatPreview();await submit();const call=calls.find(c=>c.rpc==='create_weekly_lessons');assert(call?.payload.p_count===4,'RPC count');assert(db.lessons.filter(l=>l.seriesId).length===4,'reload series');});
 await check('recurring failure leaves all occurrences unsaved',async()=>{const count=db.lessons.length;openEditor('lesson');fill('student',testIds.s1);fill('date','2027-04-01');fill('time','12:00');fill('repeat','weekly');fill('weeks','3');failNext=true;await submit();assert(db.lessons.length===count,'partial records');assert($('#form-error').textContent.includes('No lessons were saved'),'conflict error');$('#modal').close();});
 await check('invoice uses server number, snapshots and PDF display',async()=>{openEditor('invoice');fill('student',testIds.s1);fill('due','2027-02-01');fill('amount','180');await submit();const invoice=db.invoices[0];assert(invoice.number==='INV-TEST-100','invoice number');assert(invoice.parent==='Parent One','billing snapshot');assert(buildInvoicePdf(invoice).includes('(INV-TEST-100)'),'PDF uses UUID');assert(!buildInvoicePdf(invoice).includes('('+invoice.id+')'),'UUID exposed as invoice number');});
 await check('invoice payment status persists',async()=>{const i=db.invoices[0];await mutate(()=>service.markPaid(i.id,'Paid'),'Updated');assert(db.invoices[0].status==='Paid','status reload');assert(buildInvoicePdf(db.invoices[0]).includes('(NZ$ 0.00)'),'paid balance');});
 await check('teacher save and rate use one RPC',async()=>{openEditor('teacher',testIds.t1);fill('rate','55');await submit();const call=calls.filter(c=>c.rpc==='save_teacher').at(-1);assert(call.payload.p_rate===55&&call.payload.p_id===testIds.t1,'rate mapping');assert(db.teachers.find(t=>t.id===testIds.t1).rate===55,'rate refresh');});
 await check('director can open password settings',()=>{$('#change-password').click();assert($('#password-dialog').open,'password dialog');});
 await check('password mismatch never calls Supabase',async()=>{
  const count=passwordCalls.length;$('#current-password').value='fixture-password';$('#changed-password').value='a-new-password';$('#changed-confirm').value='different-password';
  $('#change-password-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  assert(passwordCalls.length===count,'mismatch sent');assert($('#password-error').textContent.includes('do not match'),'mismatch error');
 });
 await check('incorrect current password leaves the dialog open',async()=>{
  $('#current-password').value='incorrect-password';$('#changed-password').value=$('#changed-confirm').value='a-new-password';
  $('#change-password-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!passwordBusy);
  assert($('#password-dialog').open&&$('#password-error').textContent.includes('incorrect'),'current password failure');
 });
 await check('password change verifies current password and clears inputs',async()=>{
  $('#current-password').value='fixture-password';
  $('#change-password-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!passwordBusy);
  assert(passwordCalls.at(-1).current_password==='fixture-password','verification missing');assert(!$('#password-dialog').open,'dialog not closed');assert($('#changed-password').value===''&&$('#current-password').value==='','passwords retained');assert(ready,'workspace lost');
 });
 await check('sign-out clears business records and UI',async()=>{await signOut();assert(!ready&&db.students.length===0,'data retained');assert($('#main').textContent==='','UI retained');});
 await check('teacher sign-in uses linked teacher ID and limited navigation',async()=>{await login('one@example.test');assert(session===testIds.t1,'wrong teacher ID');assert(db.students.every(s=>s.teacher===testIds.t1),'fixture adapter filtered records');assert(!$('#nav [data-page="teachers"]')&&!$('#nav [data-page="salary"]'),'privileged nav');assert(db.rates.length===0,'salary data loaded');assert(!canAccess('teacher',testIds.t1),'teacher management guard');});
 await check('teachers can change their own password',async()=>{
  $('#change-password').click();$('#current-password').value='fixture-password';$('#changed-password').value=$('#changed-confirm').value='teacher-new-password';
  $('#change-password-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!passwordBusy);
  assert(!$('#password-dialog').open&&session===testIds.t1,'teacher password change');
 });
 await check('teacher form cannot select another teacher',()=>{openEditor('student');assert(!$('#editor [name="teacher"]'),'assignment selector present');$('#modal').close();});
 await check('switching accounts clears previous user records',async()=>{await signOut();await login('two@example.test');assert(session===testIds.t2,'wrong account');assert(db.students.every(s=>s.teacher===testIds.t2),'previous records retained');});
 await check('calendar and main pages render without corrupted labels',()=>{for(const p of ['overview','schedule','students','invoices']){page=p;render();assert(!/[?\uFFFD]/.test($('#main').textContent),'corrupt text on '+p);}});
 await check('unlinked account gets a blocked-access screen',async()=>{fakeUser={id:'99999999-0000-4000-8000-000000000000'};await acceptSession({user:fakeUser},true);assert(!ready&&$('#main').textContent==='','unlinked account entered');assert($('#auth-status').textContent.includes('not been activated'),'missing access message');});
 await check('late load cannot repopulate signed-out records',async()=>{fakeUser={id:testIds.director};const pending=acceptSession({user:fakeUser},true);await acceptSession(null,true);await pending;assert(!ready&&db.students.length===0,'stale load repopulated records');});
 await check('recovery callback shows password form without loading school data',async()=>{
  fakeUser={id:testIds.b};authCallback('PASSWORD_RECOVERY',{user:fakeUser});await waitFor(()=>!$('#new-password-form').hidden);
  assert(recovering&&!ready&&$('#main').textContent==='','recovery entered workspace');
 });
 await check('recovery password mismatch is rejected locally',()=>{
  const count=passwordCalls.length;$('#recovery-password').value='new-recovery-password';$('#recovery-confirm').value='wrong-confirmation';
  $('#new-password-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert(passwordCalls.length===count,'mismatch sent');assert($('#recovery-error').textContent.includes('do not match'),'recovery mismatch');
 });
 await check('failed recovery preserves the form for retry',async()=>{
  $('#recovery-confirm').value=$('#recovery-password').value;passwordFailNext=true;
  $('#new-password-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!passwordBusy);
  assert(!$('#new-password-form').hidden&&$('#recovery-error').textContent.includes('temporarily'),'recovery failure');
 });
 await check('expired recovery session cannot update a password',async()=>{
  fakeUser=null;const count=passwordCalls.length;$('#new-password-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!passwordBusy);
  assert(passwordCalls.length===count,'expired session sent');assert($('#recovery-error').textContent.includes('expired'),'expired message');
 });
 await check('successful recovery updates password and returns to sign-in',async()=>{
  fakeUser={id:testIds.b};history.replaceState(null,'',location.pathname+'?reset=password');
  $('#new-password-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!passwordBusy);
  assert(passwordCalls.at(-1).password==='new-recovery-password'&&!passwordCalls.at(-1).current_password,'recovery payload');
  assert(!ready&&!authenticatedUser&&!recovering,'recovery session retained');assert(!$('#login-form').hidden&&$('#auth-status').textContent.includes('updated'),'success screen');assert(!location.search.includes('reset='),'recovery URL retained');assert($('#recovery-password').value==='','password retained');
 });
 const pre=document.createElement('pre');pre.id='test-results';pre.textContent=results.join('\n');document.body.replaceChildren(pre);
})().catch(error=>{document.body.innerHTML='<pre id="test-results">FAIL harness: '+String(error)+'</pre>'});
