(function(){
  var $=function(i){return document.getElementById(i)};
  var API=window.location.origin==='null'?'http://localhost:3001':window.location.origin;
  var u=$('user'),p=$('pass'),m=$('msg');
  var loginRole='admin'; // which account type the user is signing in as; server still verifies it

  /* ---------- account type selector ---------- */
  function setRole(r){
    loginRole=r;
    var a=$('rAdmin'),b=$('rStudent');
    if(a)a.setAttribute('aria-pressed',r==='admin');
    if(b)b.setAttribute('aria-pressed',r==='student');
    var hint=$('roleHint');
    if(hint)hint.textContent=r==='admin'?'Admin sign-in is only available to the registered admin email.':'Student sign-in works with any registered student account.';
    u.placeholder='Username or email';
    m.textContent='';
  }
  if($('rAdmin'))$('rAdmin').onclick=function(){setRole('admin')};
  if($('rStudent'))$('rStudent').onclick=function(){setRole('student')};

  /* ---------- view switching ---------- */
  function hideAll(){['loginView','otpView','forgotView','resetView','doneView'].forEach(function(id){var el=$(id);if(el)el.style.display='none'});}
  function showLogin(){hideAll();$('loginView').style.display='block';m.textContent='';u.focus();
    if(sessionStorage.getItem('ce-session-expired')){
      sessionStorage.removeItem('ce-session-expired');
      m.textContent='Your session has expired. Please log in again.';
    }
  }
  function showForgot(){hideAll();$('forgotView').style.display='block';$('femail').focus();}
  function showReset(){hideAll();$('resetView').style.display='block';$('rotp').focus();}

  $('eye').onclick=function(){
    var show=p.type==='password';
    p.type=show?'text':'password';
    this.textContent=show?'Hide':'Show';
    this.setAttribute('aria-label',show?'Hide password':'Show password');
  };
  function fail(t,el){m.textContent=t;u.removeAttribute('aria-invalid');p.removeAttribute('aria-invalid');if(el){el.setAttribute('aria-invalid','true');el.focus()}}

  /* ---------- login ---------- */
  function submit(){
    var a=u.value.trim(),b=p.value;
    if(!a){return fail('Enter your username or email.',u)}
    if(!b){return fail('Enter your password.',p)}
    m.textContent='';
    fetch(API+'/api/auth/login',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:a,password:b,role:loginRole})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.error){return fail(data.error,p)}
      localStorage.setItem('ce-token',data.token);
      localStorage.setItem('ce-user',JSON.stringify(data.user));
      m.textContent='';
      document.body.classList.add('app-on');
      window.enterApp(data.user.role, data.user);
    }).catch(function(){
      fail('Could not reach the server. Is the backend running on localhost:3001?',p);
    });
  }

  /* ---------- login OTP (existing 2FA) ---------- */
  var code='',tries=0,exp=0,cd=0,tm=null;
  function startOtp(){
    hideAll();$('otpView').style.display='block';
    $('otpSub').textContent='Enter the 6-digit OTP sent to your email.';
    send();$('otp').focus();
  }
  function send(){
    code=String(Math.floor(100000+Math.random()*900000));tries=0;exp=Date.now()+120000;cd=Date.now()+30000;
    $('otpHint').innerHTML='Demo mode: your code is <code>'+code+'</code>. It expires in 2 minutes.';
    $('omsg').textContent='';$('otp').value='';
    var rs=$('rs');rs.disabled=true;clearInterval(tm);
    function tick(){var l=Math.ceil((cd-Date.now())/1000);if(l<=0){clearInterval(tm);rs.disabled=false;rs.textContent='Resend code'}else rs.textContent='Resend in '+l+'s'}
    tick();tm=setInterval(tick,500);
  }
  function back(){clearInterval(tm);hideAll();$('loginView').style.display='block';p.value='';p.focus()}
  function verify(){
    var v=$('otp').value.trim(),o=$('omsg');
    if(Date.now()>exp){o.textContent='This code has expired. Request a new one.';return}
    if(!/^[0-9]{6}$/.test(v)){o.textContent='Enter the 6-digit code.';return}
    if(v!==code){
      tries++;
      if(tries>=3){send();o.textContent='Too many wrong attempts. A new code has been generated.';return}
      o.textContent='Incorrect code. '+(3-tries)+(3-tries>1?' attempts':' attempt')+' left.';return;
    }
    clearInterval(tm);hideAll();u.value='';
    var user=JSON.parse(localStorage.getItem('ce-user')||'{}');
    document.body.classList.add('app-on');
    window.enterApp(user.role||'student', user);
  }

  /* ---------- sign up: new student account with Gmail + OTP ---------- */
  function showSignup(){hideAll();$('signupView').style.display='block';$('smsg').textContent='';$('sotp').style.display='none';$('suser').focus();}

  function sendSignupOtp(){
    var username=$('suser').value.trim(),email=$('semail').value.trim(),password=$('spass').value.trim(),smsg=$('smsg');
    if(!username){return smsg.textContent='Enter your full name / username.'}
    if(!email){return smsg.textContent='Enter your college Gmail.'}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){return smsg.textContent='Enter a valid email address.'}
    if(password.length<6){return smsg.textContent='Password must be at least 6 characters.'}
    smsg.textContent='';
    fetch(API+'/api/auth/signup-send-otp',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:username,email:email,password:password,role:'student'})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.error){return smsg.textContent=data.error;}
      smsg.textContent='';
      $('sothint').innerHTML='A 6-digit OTP has been sent to <b>'+email+'</b>.<br><small>Demo mode: check the server console for your code.</small>';
      $('sotpmsg').textContent='';$('sotpcode').value='';
      $('sotp').style.display='block';
      var btn=$('sresend');clearInterval(stm);
      var sCD=Date.now()+30000;
      function tick(){var l=Math.ceil((sCD-Date.now())/1000);if(l<=0){clearInterval(stm);if(btn){btn.disabled=false;btn.textContent='Resend OTP'}}else{if(btn){btn.disabled=true;btn.textContent='Resend in '+l+'s'}}}
      tick();stm=setInterval(tick,1000);
    }).catch(function(){
      smsg.textContent='Could not reach the server. Is the backend running?';
    });
  }
  function verifySignupOtp(){
    var email=$('semail').value.trim(),code=$('sotpcode').value.trim(),o=$('sotpmsg'),smsg=$('smsg');
    if(!email){return smsg.textContent='Enter your email.'}
    if(!/^[0-9]{6}$/.test(code)){return o.textContent='Enter the 6-digit OTP.'}
    o.textContent='';
    fetch(API+'/api/auth/signup-verify-otp',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:email,code:code})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.error){return o.textContent=data.error;}
      localStorage.setItem('ce-token',data.token);
      localStorage.setItem('ce-user',JSON.stringify(data.user));
      document.body.classList.add('app-on');
      window.enterApp(data.user.role, data.user);
    }).catch(function(){
      o.textContent='Could not reach the server. Is the backend running?';
    });
  }

  /* ---------- forgot password: step 1 (send OTP to email) ---------- */
  $('fsend').onclick=function(){
    var email=$('femail').value.trim(),fmsg=$('fmsg'),fhint=$('fhint');
    if(!email){fmsg.textContent='Enter your email or username.';return;}
    fmsg.textContent='';
    fetch(API+'/api/auth/forgot-password',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:email})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.error){return fmsg.textContent=data.error;}
      fmsg.textContent='';
      fhint.innerHTML='A 6-digit code has been sent to your email.<br><small>Demo mode: check the server console for the code.</small>';
      showReset();
    }).catch(function(){
      fmsg.textContent='Could not reach the server. Is the backend running?';
    });
  };

  /* ---------- forgot password: step 2 (reset with OTP + new password) ---------- */
  $('rreset').onclick=function(){
    var email=$('femail').value.trim(),otp=$('rotp').value.trim(),newPass=$('rpass').value.trim(),rmsg=$('rmsg'),rhint=$('rhint');
    if(!email){rmsg.textContent='Enter your email or username.';return;}
    if(!/^[0-9]{6}$/.test(otp)){rmsg.textContent='Enter the 6-digit code.';return;}
    if(newPass.length<6){rmsg.textContent='Password must be at least 6 characters.';return;}
    rmsg.textContent='';
    fetch(API+'/api/auth/reset-password',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:email,code:otp,newPassword:newPass})
    }).then(function(r){return r.json();}).then(function(data){
      if(data.error){return rmsg.textContent=data.error;}
      rmsg.textContent='';
      rhint.innerHTML='<span style="color:var(--ok)">Password reset successfully.</span>';
      setTimeout(function(){
        rhint.textContent='';
        $('rotp').value='';$('rpass').value='';
        showLogin();
      }, 1200);
    }).catch(function(){
      rmsg.textContent='Could not reach the server. Is the backend running?';
    });
  };

  /* ---------- logout ---------- */
  function logout(){
    localStorage.removeItem('ce-token');localStorage.removeItem('ce-user');
    document.body.classList.remove('app-on');
    hideAll();$('loginView').style.display='block';
    p.value='';u.value='';m.textContent='';u.focus();
    location.reload();
  }

  /* ---------- wiring ---------- */
  $('vf').onclick=verify;$('rs').onclick=send;$('bk').onclick=back;
  $('otp').addEventListener('input',function(){this.value=this.value.replace(/[^0-9]/g,'')});
  $('otp').addEventListener('keydown',function(e){if(e.key==='Enter')verify()});
  $('go').onclick=submit;
  [u,p].forEach(function(el){el.addEventListener('keydown',function(e){if(e.key==='Enter')submit()})});
  $('out').onclick=logout;
  $('fback').onclick=function(){showLogin();$('fmsg').textContent='';$('fhint').textContent='';};
  $('rback').onclick=function(){showForgot();$('rmsg').textContent='';$('rhint').textContent='';};
  $('forgotLink').onclick=function(e){e.preventDefault();showForgot();$('fmsg').textContent='';$('fhint').textContent='';};
  $('signupLink').onclick=function(e){e.preventDefault();showSignup();};
  $('sback').onclick=function(){showLogin();$('smsg').textContent='';$('sotp').style.display='none';};
  $('ssend').onclick=sendSignupOtp;
  $('sverify').onclick=verifySignupOtp;
  $('sresend').onclick=sendSignupOtp;
  $('sotpcode').addEventListener('input',function(){this.value=this.value.replace(/[^0-9]/g,'')});
  $('sotpcode').addEventListener('keydown',function(e){if(e.key==='Enter')verifySignupOtp()});

  /* ---------- auto-login if token exists (role always comes from the server) ---------- */
  if(localStorage.getItem('ce-token')){
    var t=localStorage.getItem('ce-token');
    fetch(API+'/api/me',{headers:{'Authorization':'Bearer '+t}})
      .then(function(r){return r.json().then(function(d){return {status:r.status,data:d};});})
      .then(function(res){
        if(res.status!==200||!res.data.user)throw new Error('Session expired');
        localStorage.setItem('ce-user',JSON.stringify(res.data.user));
        setRole(res.data.user.role);
        document.body.classList.add('app-on');
        // app.js is loaded after login.js, so defer until enterApp is defined
        setTimeout(function(){
          if(typeof window.enterApp==='function')window.enterApp(res.data.user.role,res.data.user);
        },0);
      })
      .catch(function(){
        localStorage.removeItem('ce-token');localStorage.removeItem('ce-user');
      });
  }
})();
