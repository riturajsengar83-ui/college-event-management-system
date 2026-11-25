(function(){
  var $=function(i){return document.getElementById(i)};
  var API=window.location.origin==='null'?'http://localhost:3001':window.location.origin;
  var role='student',cur='home',delI=-1,selE=null,evFilter='all';
  var curMe=null, ev=[], regs=[], socket=null;
  var token=localStorage.getItem('ce-token')||'';

  /* ---------- real-time sync across devices ---------- */
  function initSocket(){
    if(socket) return;
    socket=io(API,{auth:{token:token},transports:['websocket','polling']});
    socket.on('connect_error',function(){});
    socket.on('data_changed',function(change){
      var msgEl=$('fm');
      loadData().then(function(){
        if(cur==='view'||cur==='home'||cur==='reg'||cur==='find'||cur==='stats') draw();
        if(msgEl){
          msgEl.textContent='Data updated from another device.';
          setTimeout(function(){msgEl.textContent='';},2000);
        }
      });
    });
  }

  /* ---------- api helper ---------- */
  function api(path,method,body){
    var t=localStorage.getItem('ce-token')||'';
    var opts={method:method||'GET',headers:{}};
    if(t)opts.headers['Authorization']='Bearer '+t;
    if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
    return fetch(API+path,opts).then(function(r){
      if(r.status===401){
        localStorage.removeItem('ce-token');localStorage.removeItem('ce-user');
        sessionStorage.setItem('ce-session-expired','1');
        location.reload();
      }
      return r.json();
    });
  }

  /* ---------- ui helpers ---------- */
  function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
  function tr(a){return '<tr>'+a.map(function(x){return '<td>'+x+'</td>'}).join('')+'</tr>'}
  function tbl(head,rows){return '<div class="scroll"><table><thead><tr>'+head.map(function(h){return '<th>'+h+'</th>'}).join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+head.length+'">Nothing to show yet.</td></tr>')+'</tbody></table></div>'}
  function note(t,ok){var n=$('fm');if(n){n.textContent=t;n.style.color=ok?'var(--ok)':'var(--err)'}}
  function go(k){
    if(M.some(function(m){return m[0]===k&&m[3]})&&role!=='admin')k='home';
    cur=k;delI=-1;selE=null;draw();
  }
  function cnt(eid){return regs.filter(function(r){return r.event_id===eid}).length}

  /* ---------- data loaders ---------- */
  function loadData(){
    return Promise.all([
      api('/api/events').then(function(e){ev=e||[];}).catch(function(){ev=[];}),
      api('/api/registrations').then(function(r){regs=r||[];}).catch(function(){regs=[];})
    ]).catch(function(){});
  }

  /* ---------- icons ---------- */
  var IC={home:'M3 11l9-8 9 8M5 10v10h14V10',add:'M12 5v14M5 12h14',view:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',reg:'M15 8a4 4 0 11-8 0 4 4 0 018 0zM3 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6',find:'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',stats:'M5 20V10M12 20V4M19 20v-7',files:'M7 3h7l5 5v13H7zM14 3v5h5',chat:'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7c-5.8 0-8.8-4.6-9-8.8 0-.2.1-.4.1-.5 1.2-2.6 3.3-4.3 5.8-5.1 2.8-.8 5.5-1.5 8.4-1.6 1.2-.1 2.4-.2 3.6-.2 5.2 0 8.6 3.6 8.9 6.3M3 5l9 16M21 5l-9 16',profile:'M16 7a4 4 0 11-8 0 4 4 0 018 0zM16 21l-5-5M8 21l5-5'};
  function I(k){return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+IC[k]+'"/></svg>'}

  /* ---------- nav ---------- */
  var M=[['home','Main menu','',0],['add','Add event','Create a new event',1],['view','View events','See events and who registered',0],['reg','Add student to event','Enroll a student in any event',1],['find','Search registrations','Find by name or enrollment number',1],['stats','Statistics','Totals and registrations',1],['files','Record files','View current records',1],['chat','Group chat','Talk with others in an event',0],['profile','Profile','View and edit your profile',0]];
  function draw(){
    var nav='';
    M.forEach(function(m){if(m[3]&&role!=='admin')return;nav+='<button data-k="'+m[0]+'"'+(m[0]===cur?' aria-current="page"':'')+'>'+I(m[0])+m[1]+'</button>'});
    $('nav').innerHTML=nav;
    $('nav').querySelectorAll('button').forEach(function(b){b.onclick=function(){go(b.dataset.k)}});
    V[cur]();
  }

  /* ---------- views ---------- */
  var V={};
  V.home=function(){
    var h='<h2>Welcome, '+(role==='admin'?'Admin':'Student')+'</h2><p class="sub">Choose what you want to do.</p><div class="kpis"><div class="kpi"><b>'+ev.length+'</b>Events</div><div class="kpi"><b>'+regs.length+'</b>Registrations</div><div class="kpi"><b>'+(ev.reduce(function(a,e){return a+e.seats},0)-regs.length)+'</b>Seats open</div></div>';
    
    /* ---------- Profile photo section (prominent on home) ---------- */
    var photoUrl=curMe.photo||'';
    h+='<div class="form" style="max-width:440px;margin-top:24px">';
    h+='<div style="background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:20px">';
    h+='<h3 style="margin-top:0">📷 Profile Picture</h3>';
    h+='<p style="color:var(--muted);font-size:14px">Add or change your profile photo (works for both Admin and Student).</p>';
    h+='<div id="homePhotoPreview" style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:var(--line);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;margin-bottom:12px">'+(photoUrl?'<img src="'+esc(photoUrl)+'" style="width:100%;height:100%;object-fit:cover">':'No photo')+'</div>';
    h+='<div class="field"><label for="homePphoto">Upload photo</label><input type="file" id="homePphoto" accept="image/*"><p class="msg" id="homePmsg" role="status"></p><button class="go" id="homePsave" type="button">Upload profile photo</button></div>';
    h+='</div></div>';
    
    h+='<div class="tiles2">';
    M.slice(1).forEach(function(m){if(m[3]&&role!=='admin')return;h+='<button class="mt" data-k="'+m[0]+'"><span class="ico">'+I(m[0])+'</span><b>'+m[1]+'</b><span>'+m[2]+'</span></button>'});
    h+='</div>';
    $('pane').innerHTML=h;
    $('pane').querySelectorAll('.mt').forEach(function(b){b.onclick=function(){go(b.dataset.k)}});
    
    /* Wire up home profile upload */
    var hpinput=$('homePphoto'), hpbtn=$('homePsave'), hpfm=$('homePmsg'), hppreview=$('homePhotoPreview');
    hpinput.onchange=function(){
      var f=this.files&&this.files[0];
      if(!f)return;
      if(f.size>2*1024*1024){return hpfm.textContent='Image too large (max 2 MB).'}
      fileToDataURL(f).then(function(data){
        hppreview.innerHTML='<img src="'+data+'" style="width:100%;height:100%;object-fit:cover">';
        hpinput._data=data;
        hpfm.textContent='';
      }).catch(function(){hpfm.textContent='Failed to read image.';});
    };
    hpbtn.onclick=function(){
      var data=hpinput._data;
      if(!data){return hpfm.textContent='Select an image first.';}
      hpfm.textContent='Uploading...';
      api('/api/auth/upload-photo','POST',{photo:data}).then(function(d){
        if(d.error){return hpfm.textContent=d.error;}
        hpfm.textContent='Photo uploaded successfully!';
        hpfm.style.color='var(--ok)';
        curMe.photo=d.photo;
        localStorage.setItem('ce-user',JSON.stringify(curMe));
        setTimeout(function(){V.home();},800);
      });
    };
  };
  V.add=function(){
    $('pane').innerHTML='<h2>Add event</h2><p class="sub">Create an event students can register for.</p><div class="form"><div><label for="eid">Event ID</label><input id="eid" placeholder="EVT-104 (leave blank to generate)" autocomplete="off"></div><div><label for="en">Event name</label><input id="en"></div><div><label for="ed">Date</label><input id="ed" type="date"></div><div><label for="evn">Venue</label><input id="evn"></div><div><label for="ec">Seats</label><input id="ec" type="number" min="1"></div><div><label for="ep">Event type</label><select id="ep"><option value="paid">Paid event</option><option value="free">Free event</option></select></div><p class="msg" id="fm" role="status"></p><button class="go" id="sv">Save event</button></div>';
    $('sv').onclick=function(){
      var n=$('en').value.trim(),d=$('ed').value,v=$('evn').value.trim(),c=parseInt($('ec').value,10),id=$('eid').value.trim(),pd=$('ep').value==='paid';
      if(!n||!d||!v||!(c>0))return note('Fill in the name, date, venue and a seat count above 0.');
      if(id&&!/^[A-Z0-9-]{3,12}$/.test(id.toUpperCase()))return note('Event ID can use letters, numbers and hyphens, 3 to 12 characters.');
      api('/api/events','POST',{event_id:id||null,name:n,date:d,venue:v,seats:c,paid:pd}).then(function(d){
        if(d.error)return note(d.error);
        note('Event added: '+n+' (ID '+d.event_id+')',1);
        ['eid','en','ed','evn','ec'].forEach(function(i){$(i).value=''});
        return loadData();
      }).then(function(){V.home();});
    };
  };
  V.view=function(){
    if(selE){
      var e=ev.find(function(x){return x.id===selE});
      if(!e){selE=null;V.view();return;}
      var r=regs.filter(function(r){return r.event_id===selE});
      var rows=r.map(function(x){
        return tr([esc(x.username),esc(x.enrollment_no||'-'),esc(x.branch||'-'),'<span class="pay '+(x.paid?'ok':'no')+'">'+(x.paid?'Paid':'Not paid')+'</span>']);
      });
      $('pane').innerHTML='<h2>'+esc(e.name)+'</h2>'+
       '<p class="sub">'+esc(e.event_id)+' &middot; '+esc(e.date)+' &middot; '+esc(e.venue)+' &middot; <span class="pay '+(e.paid?'ok':'free')+'">'+(e.paid?'Paid event':'Free event')+'</span></p>'+
       '<div class="kpis"><div class="kpi"><b>'+e.seats+'</b>Total seats</div><div class="kpi"><b>'+r.length+'</b>Registered</div><div class="kpi"><b>'+(e.seats-r.length)+'</b>Seats left</div></div>'+
       '<h3>Registered students ('+r.length+')</h3>'+
       tbl(['Name','Enrollment no.','Branch','Payment'],rows)+
       '<button class="dc" id="bkEv" type="button" style="margin-top:16px">&larr; Back to events</button>';
      $('bkEv').onclick=function(){selE=null;V.view();};
      return;
    }
    var adm=role==='admin',head=['ID','Event','Date','Venue','Type','Registered','Seats left','Action'];
    var shown=ev.filter(function(e){return evFilter==='all'||(evFilter==='paid'?e.paid:!e.paid)});
    var rows=shown.map(function(e){
      var c=cnt(e.id),a=[e.event_id,'<button class="dc" data-view="'+e.id+'" aria-label="Open event details">'+esc(e.name)+'</button>',e.date,esc(e.venue),'<span class="pay '+(e.paid?'ok':'free')+'">'+(e.paid?'Paid':'Free')+'</span>',c,e.seats-c];
      if(adm)a.push('<button class="dl" data-ask="'+e.id+'" aria-label="Delete '+esc(e.name)+'">Delete</button>');
      else{
        var me=curMe?curMe.id:null;
        if(regs.some(function(r){return r.user_id===me&&r.event_id===e.id}))a.push('Registered');
        else a.push('<button class="dc" data-reg="'+e.id+'" aria-label="Register for '+esc(e.name)+'">Register</button>');
      }
      return tr(a);
    });
    var filter='<div class="field" style="max-width:260px"><label for="ef">Show events</label><select id="ef">'+
      ['all|Paid and free','paid|Paid only','free|Free only'].map(function(o){var v=o.split('|');return '<option value="'+v[0]+'"'+(evFilter===v[0]?' selected':'')+'>'+v[1]+'</option>'}).join('')+'</select></div>';
    $('pane').innerHTML='<h2>View events</h2><p class="sub">All events and seats left. Click an event name to see who registered'+(adm?'':' — students can Register themselves')+'.</p>'+filter+'<p class="msg" id="fm" role="status"></p>'+tbl(head,rows);
    $('ef').onchange=function(){evFilter=this.value;V.view();};
    var P=$('pane');
    P.querySelectorAll('[data-view]').forEach(function(b){b.onclick=function(){selE=+b.dataset.view;V.view()}});
    P.querySelectorAll('[data-ask]').forEach(function(b){
      b.onclick=function(){
        var id=+b.dataset.ask;
        if(!confirm('Delete this event and all its registrations and messages?'))return;
        api('/api/events/'+id,'DELETE').then(function(d){
          if(d.error){return note(d.error);}
          note('Event deleted.',1);
          delI=-1;selE=null;
          return loadData();
        }).then(function(){
          V.view();
        });
      };
    });
    P.querySelectorAll('[data-reg]').forEach(function(b){
      b.onclick=function(){
        var eid=+b.dataset.reg;
        api('/api/registrations/self','POST',{event_id:eid}).then(function(d){
          if(d.error)return note(d.error);
          note('Registered! You are now signed up for '+d.username+'.',1);
          return loadData();
        }).then(function(){
          V.view();
        });
      };
    });
  };
  V.reg=function(){
    $('pane').innerHTML='<h2>Add student to event</h2><p class="sub">Admins only: enroll a student in any event.</p><p class="msg" id="fm" role="status">Loading students...</p>';
    api('/api/students').then(function(slist){
      if(!Array.isArray(slist)){return note('Could not load students.');}
      if(!slist.length){return note('No student accounts yet. Students must sign up before they can be added.');}
      var sopts=slist.map(function(s){return '<option value="'+s.id+'">'+esc(s.username||s.email)+(s.enrollment_no?' · '+esc(s.enrollment_no):'')+'</option>'}).join('');
      var eopts=ev.map(function(e){var l=e.seats-cnt(e.id);return '<option value="'+e.id+'"'+(l<1?' disabled':'')+'>'+e.event_id+' · '+esc(e.name)+' · '+(e.paid?'Paid':'Free')+' ('+l+' seats left)</option>'}).join('');
      $('pane').innerHTML='<h2>Add student to event</h2><p class="sub">Choose a student and an event to enroll them in.</p><div class="form"><div><label for="ss">Student</label><select id="ss">'+sopts+'</select></div><div><label for="se">Event</label><select id="se">'+(eopts||'<option value="">No events available</option>')+'</select></div><p class="msg" id="fm" role="status"></p><button class="go" id="sv">Add student to event</button></div>';
      $('sv').onclick=function(){
        var uid=parseInt($('ss').value,10),eid=parseInt($('se').value,10);
        if(isNaN(uid))return note('Choose a student.');
        if(isNaN(eid))return note('Choose an event.');
        if(regs.some(function(r){return r.user_id===uid&&r.event_id===eid}))return note('That student is already registered for this event.');
        api('/api/registrations','POST',{event_id:eid,user_id:uid}).then(function(d){
          if(d.error)return note(d.error);
          note('Student added to event.',1);
          return loadData();
        }).then(function(){V.reg();});
      };
    }).catch(function(){note('Could not load students. Is the backend running?');});
  };
  V.find=function(){
    $('pane').innerHTML='<h2>Search registrations</h2><p class="sub">Search by name or enrollment number.</p><input id="q" type="search" placeholder="Type a name or number" aria-label="Search registrations"><div id="res" style="margin-top:14px"></div>';
    function run(){
      var q=$('q').value.trim().toLowerCase();
      var r=regs.filter(function(s){return !q||(s.username||'').toLowerCase().indexOf(q)>-1||(s.enrollment_no||'').toLowerCase().indexOf(q)>-1});
      $('res').innerHTML='<p class="msg" id="fm" role="status"></p>'+tbl(['Name','Enrollment no.','Branch','Event','Payment','Action'],r.map(function(s){
        var del='';
        if(role==='admin'){
          del=' <button class="dc" data-do="'+s.id+'">Remove</button>';
        }
        return tr([esc(s.username),esc(s.enrollment_no||'-'),esc(s.branch||'-'),esc(s.event_code||''),'<span class="pay '+(s.paid?'ok':'no')+'">'+(s.paid?'Paid':'Not paid')+'</span>',del]);
      }));
      var P=$('res');
      P.querySelectorAll('[data-do]').forEach(function(b){
        b.onclick=function(){
          var id=+b.dataset.do;
          api('/api/registrations/'+id,'DELETE').then(function(d){
            if(d.error){note(d.error);return;}
            note('Removed.',1);
            return loadData();
          }).then(function(){
            run();
          });
        };
      });
    }
    $('q').oninput=run;run();
  };
  V.stats=function(){
    var cap=ev.reduce(function(a,e){return a+e.seats},0),br={};
    regs.forEach(function(s){br[s.branch||'-']=(br[s.branch||'-']||0)+1});
    var h='<h2>Statistics</h2><p class="sub">A summary of events and registrations.</p><div class="stats"><div class="stat"><b>'+ev.length+'</b>Events</div><div class="stat"><b>'+ev.filter(function(e){return !e.paid}).length+'</b>Free events</div><div class="stat"><b>'+regs.length+'</b>Registrations</div><div class="stat"><b>'+(cap?Math.round(regs.length/cap*100):0)+'%</b>Seats filled</div></div><h3>Registrations by event</h3>';
    ev.forEach(function(e){var c=cnt(e.id);h+='<div class="row"><span>'+esc(e.name)+'</span><div class="track"><div class="fill" style="width:'+Math.min(100,c/e.seats*100)+'%"></div></div><span>'+c+'/'+e.seats+'</span></div>'});
    h+='<h3>Registrations by branch</h3>';
    Object.keys(br).forEach(function(k){h+='<div class="row"><span>'+k+'</span><div class="track"><div class="fill" style="width:'+br[k]/regs.length*100+'%"></div></span><span>'+br[k]+'</span></div>'});
    $('pane').innerHTML=h;
  };
  V.files=function(){
    var E=ev.map(function(e){return [e.event_id,e.name,e.date,e.venue,e.seats,e.paid?1:0].join('|')}).join('\n');
    var S=regs.map(function(s){return [s.enrollment_no||'',s.username||'',s.branch||'',s.event_code||'',s.paid?1:0].join('|')}).join('\n');
    $('pane').innerHTML='<h2>Record files</h2><p class="sub">Current records from the server database.</p><div class="form" style="max-width:none"><p class="msg" id="fm" role="status"></p><button class="dc" id="rst" type="button">Refresh from server</button> <button class="dc" id="dlEv" type="button">Download Events CSV</button> <button class="dc" id="dlReg" type="button">Download Registrations CSV</button></div><h3>events</h3><textarea id="te" readonly rows="'+Math.max(3,ev.length)+'" aria-label="events"></textarea><h3>registrations</h3><textarea id="ts" readonly rows="'+Math.max(4,regs.length)+'" aria-label="registrations"></textarea>';
    $('te').value=E;$('ts').value=S;
    $('rst').onclick=function(){loadData().then(function(){V.files();note('Refreshed from server.',1)});};
    $('dlEv').onclick=function(){downloadCSV(E,'college-events.csv');};
    $('dlReg').onclick=function(){downloadCSV(S,'college-registrations.csv');};
  };

  function downloadCSV(text,filename){
    var blob=new Blob([text],{type:'text/csv'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    note('Downloaded '+filename);
  }
  /* ---------- WhatsApp-like group chat ---------- */
  V.chat=function(){
    if(typeof io==='undefined'){
      $('pane').innerHTML='<h2>Group chat</h2><p class="sub">Real-time chat library could not be loaded. Check your internet connection and reload.</p>';
      return;
    }
    if(!socket){
      socket=io(API,{auth:{token:token},transports:['websocket','polling']});
      socket.on('connect_error',function(){});
      socket.on('data_changed',function(change){
        loadData().then(function(){
          if(cur==='view'||cur==='home'||cur==='reg'||cur==='find'||cur==='stats') draw();
        });
      });
    }
    socket.off('new_message');
    socket.off('connect_error');
    socket.on('connect_error',function(){note('Chat: could not connect to real-time server.');});
    socket.on('new_message',function(m){appendMessage(m);});
    var opts='',sel=null;
    ev.forEach(function(e){
      if(role==='student'&&!regs.some(function(r){return r.user_id===curMe.id&&r.event_id===e.id}))return;
      var s=sel===null?' selected':'';if(sel===null)sel=e.id;
      opts+='<option value="'+e.id+'"'+s+'>'+esc(e.event_id)+' · '+esc(e.name)+' ('+cnt(e.id)+' members)</option>';
    });
    if(sel===null){$('pane').innerHTML='<h2>Group chat</h2><p class="sub">No events to chat in yet.</p><p class="msg" id="fm" role="status"></p>';return;}
    selE=sel;
    $('pane').innerHTML='<div class="chat-box">'+
      '<div class="chat-header"><div style="display:flex;align-items:center;gap:8px"><div><div class="ch-title">'+esc(ev.find(function(x){return x.id===selE}).name)+'</div><div class="ch-sub">'+esc(ev.find(function(x){return x.id===selE}).event_id)+' &middot; Group &middot; '+cnt(selE)+' members</div></div><select id="echat" style="font:inherit;padding:6px 8px;border-radius:6px;border:1.5px solid var(--line);background:var(--card);color:var(--ink)">'+opts+'</select></div><div class="ch-you">You: <b>'+esc(curMe.enrollment_no||curMe.username||'ADMIN')+'</b></div></div>'+
      '<div class="chat-messages" id="cm"></div>'+
      '<div class="chat-input"><input id="ci" placeholder="Type a message..." autocomplete="off"><button id="cs">Send</button></div>'+
      '</div>';
    var cm=$('cm');
    function loadMessages(){
      api('/api/messages/'+selE).then(function(msgs){
        cm.innerHTML='';
        (msgs||[]).forEach(appendMessage);
        cm.scrollTop=cm.scrollHeight;
      });
    }
    function appendMessage(m){
      var isMe=(m.sender_id===curMe.id);
      var sender=m.role==='admin'?'Admin':(m.username||m.enrollment_no||'?');
      var time=new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      var row=document.createElement('div');
      row.className='msg-row '+(isMe?'msg-row-sent':'msg-row-recv');
      row.innerHTML='<div class="msg-sender">'+esc(isMe?'You ('+curMe.username+')':sender)+'</div>'+
        '<div class="msg-bubble '+(isMe?'msg-sent':'msg-received')+'"><div class="msg-text">'+esc(m.message)+'</div>'+
        '<div class="msg-time">'+time+(isMe?' <span class="tick">&#10003;&#10003;</span>':'')+'</div></div></div>';
      cm.appendChild(row);
      cm.scrollTop=cm.scrollHeight;
    }
    socket.emit('join_event',selE);
    $('echat').onchange=function(){
      var ne=+this.value;
      if(ne===selE)return;
      socket.emit('leave_event',selE);
      selE=ne;
      socket.emit('join_event',selE);
      var evx=ev.find(function(x){return x.id===selE});
      $('cm').innerHTML='';
      $('pane').querySelector('.ch-title').textContent=evx.name;
      $('pane').querySelector('.ch-sub').textContent=evx.event_id+' &middot; Group &middot; '+cnt(selE)+' members';
      loadMessages();
    };
    $('cs').onclick=function(){
      var t=$('ci').value.trim();
      if(!t)return note('Type a message.');
      if(t.length>500)return note('Message too long (max 500 characters).');
      api('/api/messages','POST',{event_id:selE,message:t}).then(function(d){
        if(d.error)return note(d.error);
        $('ci').value='';
      });
    };
    $('ci').addEventListener('keydown',function(e){if(e.key==='Enter'){$('cs').click();}});
    loadMessages();
  };

  /* ---------- helpers ---------- */
  function fileToDataURL(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(reader.result);};
      reader.onerror=reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------- profile view ---------- */
  V.profile=function(){
    var photoHtml=curMe.photo?'<img src="'+esc(curMe.photo)+'" class="profile-img" alt="Profile">':'<div class="profile-img placeholder">No photo</div>';
    $('pane').innerHTML='<h2>My Profile</h2><p class="sub">Manage your account details and profile photo.</p><div class="form" style="max-width:440px"><div class="field"><div style="display:flex;align-items:center;gap:14px"><div id="photoPreview" style="width:96px;height:96px;border-radius:50%;overflow:hidden;background:var(--line);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px">'+photoHtml.replace(/<img/g,'<img style="width:100%;height:100%;object-fit:cover"').replace(/<div class="profile-img placeholder">No photo<\/div>/,'<span style="font-size:13px">No photo</span>')+'</div><div><div style="font-weight:600">'+esc(curMe.username||'-')+'</div><div style="color:var(--muted);font-size:13px">'+esc(curMe.email||'-')+'</div><div style="color:var(--muted);font-size:13px;margin-top:4px">Role: '+esc(curMe.role||'-')+'</div>'+(curMe.enrollment_no?'<div style="color:var(--muted);font-size:13px">Enrollment: '+esc(curMe.enrollment_no)+'</div>':'')+(curMe.branch?'<div style="color:var(--muted);font-size:13px">Branch: '+esc(curMe.branch)+'</div>':'')+'</div></div></div><div class="field"><label for="pphoto">Profile photo</label><input type="file" id="pphoto" accept="image/*"><p class="msg" id="pmsg" role="status"></p><button class="go" id="psave" type="button">Upload photo</button></div><p class="msg" id="pfm" role="status"></p></div>';
    var pinput=$('pphoto'),pbtn=$('psave'),pfm=$('pfm'),preview=$('photoPreview');
    pinput.onchange=function(){
      var f=this.files&&this.files[0];
      if(!f)return;
      if(f.size>2*1024*1024){return pfm.textContent='Image too large (max 2 MB).'}
      fileToDataURL(f).then(function(data){
        preview.innerHTML='<img src="'+data+'" style="width:100%;height:100%;object-fit:cover">';
        pinput._data=data;
        pfm.textContent='';
      }).catch(function(){pfm.textContent='Failed to read image.';});
    };
    pbtn.onclick=function(){
      var data=pinput._data;
      if(!data){return pfm.textContent='Select an image first.';}
      pfm.textContent='Uploading...';
      api('/api/auth/upload-photo','POST',{photo:data}).then(function(d){
        if(d.error){return pfm.textContent=d.error;}
        pfm.textContent='Photo uploaded.';
        pfm.style.color='var(--ok)';
        curMe.photo=d.photo;
        localStorage.setItem('ce-user',JSON.stringify(curMe));
        setTimeout(function(){V.profile();},800);
      });
    };
  };

  window.enterApp=function(r,user){
    role=r;curMe=user||null;cur='home';
    token=localStorage.getItem('ce-token')||'';
    var who=$('who');
    who.innerHTML='';
    var roleLabel=document.createElement('span');
    roleLabel.textContent=r==='admin'?'Admin':'Student';
    roleLabel.style.marginRight='8px';
    who.appendChild(roleLabel);
    if(curMe&&curMe.photo){
      var pImg=document.createElement('img');
      pImg.src=curMe.photo;
      pImg.style.width='32px';pImg.style.height='32px';pImg.style.borderRadius='50%';pImg.style.objectFit='cover';pImg.style.border='2px solid rgba(255,255,255,.45)';pImg.style.cursor='pointer';pImg.title='Profile photo';
      who.appendChild(pImg);
    } else {
      var pBtn=document.createElement('button');
      pBtn.textContent='+ Photo';
      pBtn.style.fontSize='12px';pBtn.style.padding='4px 8px';pBtn.style.borderRadius='6px';pBtn.style.border='1.5px solid var(--line)';pBtn.style.background='var(--card)';pBtn.style.color='var(--ink)';pBtn.style.cursor='pointer';pBtn.title='Add profile photo';
      pBtn.onclick=function(){go('profile');};
      who.appendChild(pBtn);
    }
    who.style.display='inline-flex';who.style.alignItems='center';who.style.gap='8px';
    initSocket();
    if(token){
      loadData().then(function(){draw();window.scrollTo(0,0);});
    }else{
      draw();window.scrollTo(0,0);
    }
  };
  $('so').onclick=function(){
    if(socket){socket.disconnect();socket=null;}
    localStorage.removeItem('ce-token');localStorage.removeItem('ce-user');
    document.body.classList.remove('app-on');
    $('user').value='';$('pass').value='';$('msg').textContent='';
    location.reload();
  };
})();
