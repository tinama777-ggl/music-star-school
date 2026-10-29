"""Run from project root while localhost:8000 serves this folder.
Uses an isolated Edge profile and fake Supabase client; no live database writes.
Requires websocket-client (the setup checks installed it in the system temp folder).
"""
from pathlib import Path
import base64, json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request, uuid
sys.path.insert(0,str(Path(tempfile.gettempdir())/'music-star-browser-tools'))
import websocket
root=Path(__file__).resolve().parent.parent
page=root/('integration-check-'+uuid.uuid4().hex+'.html')
profile=Path(tempfile.mkdtemp(prefix='music-star-tests-')).resolve()
process=None;connection=None
live='--live' in sys.argv
try:
    html=(root/'index.html').read_text(encoding='utf-8-sig')
    html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
    # Avoid third-party font requests in deterministic UI tests.
    if not live:html=html.replace('<link rel="stylesheet" href="styles.css">','')
    sources=['vendor/supabase-2.118.0.js','supabase-config.js','data-service.js','script.js','tests/live-smoke.js'] if live else ['tests/browser-fixture.js','supabase-config.js','data-service.js','script.js','tests/browser-integration.js']
    scripts=''.join('<script src="'+src+'"></script>' for src in sources)
    page.write_text(html.replace('</body>',scripts+'</body>'),encoding='utf-8')
    with socket.socket() as candidate:
        candidate.bind(('127.0.0.1',0));port=candidate.getsockname()[1]
    command=[r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe','--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--window-size=1400,1000','--remote-debugging-port='+str(port),'--remote-allow-origins=http://localhost','--user-data-dir='+str(profile),'about:blank']
    process=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    tabs=None
    for _ in range(100):
        try:
            tabs=json.load(urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/json',timeout=1))
            tabs=[tab for tab in tabs if tab.get('type')=='page' and not tab.get('url','').startswith('chrome-extension:')]
            if tabs:break
        except Exception:time.sleep(.1)
    if not tabs:raise RuntimeError('Headless Edge did not start')
    connection=websocket.create_connection(tabs[0]['webSocketDebuggerUrl'],timeout=10,origin='http://localhost')
    counter=0;errors=[]
    def call(method,params=None):
        global counter
        counter+=1;request_id=counter
        connection.send(json.dumps({'id':request_id,'method':method,'params':params or {}}))
        while True:
            message=json.loads(connection.recv())
            if message.get('method')=='Runtime.exceptionThrown':errors.append(message['params'])
            if message.get('id')==request_id:
                if 'error' in message:raise RuntimeError(str(message['error']))
                return message.get('result',{})
    call('Runtime.enable');call('Page.enable')
    navigation=call('Page.navigate',{'url':'http://127.0.0.1:8000/'+page.name})
    if navigation.get('errorText'):raise RuntimeError('Browser navigation failed: '+str(navigation))
    result=None
    for _ in range(300):
        result=call('Runtime.evaluate',{'expression':"document.querySelector('#test-results')?.textContent",'returnByValue':True}).get('result',{}).get('value')
        if result:break
        time.sleep(.1)
    if not result:
        state=call('Runtime.evaluate',{'expression':"JSON.stringify({url:location.href,state:document.readyState,text:document.body.innerText.slice(0,1500),html:document.documentElement.outerHTML.slice(0,1500),scripts:[...document.scripts].map(s=>s.src)})",'returnByValue':True})
        raise RuntimeError('Checks did not finish: '+str(state)+'; exceptions: '+str(errors))
    print(result,flush=True)
    if live:
        image=call('Page.captureScreenshot',{'format':'png'})
        screenshot=Path(tempfile.gettempdir())/'music-star-supabase-signin.png'
        screenshot.write_bytes(base64.b64decode(image['data']))
        print('Screenshot: '+str(screenshot),flush=True)
    if 'FAIL ' in result:raise SystemExit(1)
finally:
    if connection:
        try:connection.send(json.dumps({'id':999999,'method':'Browser.close'}))
        except Exception:pass
        connection.close()
    if process:
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill()
    page.unlink(missing_ok=True)
    # Only remove this test's verified, freshly allocated temporary profile directory.
    if profile.parent==Path(tempfile.gettempdir()).resolve() and profile.name.startswith('music-star-tests-'):
        shutil.rmtree(profile,ignore_errors=True)
