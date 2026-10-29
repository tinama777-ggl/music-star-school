// Read-only checks using the real SDK/project in an isolated, signed-out browser.
(async()=>{
 const checks=[];
 const record=(name,value)=>checks.push((value?'PASS ':'FAIL ')+name);
 if(!window.MusicStarData){record('SDK initialized',false);}
 else{
  const {data,error}=await service.client.auth.getSession();
  record('SDK initializes without a saved account',!error&&!data.session);
  await new Promise(resolve=>setTimeout(resolve,150));
  record('real sign-in screen is visible',document.body.classList.contains('signed-out')&&!$('#login-form').hidden&&getComputedStyle($('#login-form')).display!=='none');
  record('signed-out workspace has no business records',$('#main').textContent===''&&!ready);
  for(const table of ['profiles','teachers','teacher_rates','students','lessons','invoices']){
   const result=await service.client.from(table).select('id').limit(1);
   record('live anonymous '+table+' access denied',result.error?.code==='42501');
  }
 }
 const pre=document.createElement('pre');pre.id='test-results';pre.hidden=true;pre.textContent=checks.join('\n');document.body.append(pre);
})().catch(error=>{const pre=document.createElement('pre');pre.id='test-results';pre.textContent='FAIL live smoke: '+error.message;document.body.append(pre);});
