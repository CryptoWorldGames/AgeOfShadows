import React, { useState, useEffect } from 'react';
import GameScene from './GameScene.jsx';

function AdminPanel({ email }) {
  const isAdmin = email === 'shadowdefense2023@gmail.com';
  if (!isAdmin) return null;

  const [stats, setStats] = useState(null);
  const [adminToken, setAdminToken] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    if (token) setAdminToken(token);
  }, []);

  const fetchStats = async () => {
    if (!adminToken) return;
    const res = await fetch('/api/admin/stats', {
      headers: { 'x-admin-token': adminToken }
    });
    const data = await res.json();
    setStats(data);
  };

  return (
    <div style={{ position: 'fixed', bottom: 20, left: 20, background: 'rgba(255,0,0,0.2)', border: '2px solid #ff0000', borderRadius: 8, padding: 16, color: '#fff', fontFamily: "'Segoe UI', sans-serif", fontSize: 12, zIndex: 999 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>🔐 ADMIN PANEL</div>
      <button onClick={fetchStats} style={{ padding: '6px 12px', background: '#ff0000', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', marginBottom: 8, width: '100%' }}>Fetch Stats</button>
      {stats && (
        <div style={{ fontSize: 11 }}>
          <div>Players: {stats.playerCount}</div>
          <div>Trees: {stats.worldState.trees}</div>
          <div>Buildings: {stats.worldState.buildings}</div>
          <div style={{ marginTop: 8, maxHeight: 150, overflow: 'auto' }}>
            {stats.onlinePlayers.map(p => <div key={p.name} style={{ opacity: 0.8 }}>{p.name} ({p.units} units)</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileOrientationCheck() {
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const portrait = window.innerHeight > window.innerWidth;
      setIsMobile(mobile);
      setIsPortrait(portrait);
    };

    checkMobile();
    window.addEventListener('orientationchange', checkMobile);
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('orientationchange', checkMobile);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  if (isMobile && isPortrait) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', fontFamily: "'Segoe UI', sans-serif", textAlign: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📱</div>
        <h1 style={{ fontSize: '28px', margin: '0 0 16px' }}>Turn Phone Sideways</h1>
        <p style={{ fontSize: '14px', opacity: 0.7 }}>The game works best in landscape mode</p>
        <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '20px' }}>Rotate your device to continue</p>
      </div>
    );
  }

  return null;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [emailConfigured, setEmailConfigured] = useState(false);

  async function handleSubmit() {
    setError('');

    if (mode === 'login') {
      if (!email.trim() || !password.trim()) {
        setError('Email and password required');
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password })
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || 'Login failed');
          setLoading(false);
          return;
        }
        if (data.adminToken) {
          sessionStorage.setItem('adminToken', data.adminToken);
        }
        onAuthenticated({ userId: data.userId, email: data.email, displayName: data.displayName });
      } catch (err) {
        setError('Network error: ' + err.message);
        setLoading(false);
      }
    }
    else if (mode === 'register') {
      if (!email.trim() || !password.trim()) {
        setError('Email and password required');
        return;
      }
      if (!email.includes('@')) {
        setError('Invalid email address');
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), displayName: displayName.trim(), password })
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || 'Registration failed');
          setLoading(false);
          return;
        }
        setEmailConfigured(data.emailConfigured || false);
        setVerifyingEmail(true);
        setLoading(false);
      } catch (err) {
        setError('Network error: ' + err.message);
        setLoading(false);
      }
    }
    else if (mode === 'reset') {
      if (!resetToken) {
        if (!email.trim()) {
          setError('Email required');
          return;
        }
        setLoading(true);
        try {
          await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim() })
          });
          setResetSent(true);
          setError('');
          setLoading(false);
        } catch (err) {
          setError('Network error: ' + err.message);
          setLoading(false);
        }
      } else {
        if (!newPassword.trim()) {
          setError('New password required');
          return;
        }
        if (newPassword.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        setLoading(true);
        try {
          const response = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), resetToken, newPassword })
          });
          const data = await response.json();
          if (!response.ok) {
            setError(data.error || 'Password reset failed');
            setLoading(false);
            return;
          }
          setError('');
          setMode('login');
          setResetToken('');
          setResetSent(false);
          setNewPassword('');
          setPassword('');
          setEmail('');
          setLoading(false);
        } catch (err) {
          setError('Network error: ' + err.message);
          setLoading(false);
        }
      }
    }
  }

  if (verifyingEmail) {
    return (
      <div style={{width:'100vw', height:'100vh', background:'linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', fontFamily:"'Segoe UI', sans-serif", color:'#fff', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          {[...Array(80)].map((_,i)=><div key={i} style={{position:'absolute',left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,width:Math.random()>0.8?'2px':'1px',height:Math.random()>0.8?'2px':'1px',background:'#fff',borderRadius:'50%',opacity:0.3+Math.random()*0.7}}/>)}
        </div>
        <div style={{textAlign:'center', marginBottom:'40px', zIndex:1}}>
          <div style={{fontSize:'64px', marginBottom:'8px'}}>✉️</div>
          <h1 style={{fontSize:'48px',fontWeight:'900',margin:0,letterSpacing:'2px'}}>Verify Email</h1>
        </div>
        <div style={{background:'rgba(0,0,0,0.7)',border:'1px solid rgba(200,168,75,0.4)',borderRadius:'16px',padding:'40px 48px',width:'360px',zIndex:1,backdropFilter:'blur(10px)',boxShadow:'0 0 60px rgba(200,168,75,0.1)'}}>
          <p style={{textAlign:'center',color:'rgba(255,255,255,0.7)',marginBottom:'20px'}}>
            {emailConfigured
              ? 'Check your email for the verification link. Copy the token from the email and paste it below:'
              : 'Check the server console for your verification token and paste it below:'}
          </p>
          <div style={{marginBottom:'20px'}}>
            <label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>VERIFICATION TOKEN</label>
            <input type="text" value={verificationToken} onChange={e=>setVerificationToken(e.target.value)} placeholder="Paste token here" autoFocus style={{width:'100%',padding:'12px 16px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif"}}/>
          </div>
          {error&&<div style={{color:'#ff6b6b',fontSize:'12px',marginBottom:'16px',textAlign:'center'}}>{error}</div>}
          <button onClick={async()=>{
            if(!verificationToken.trim()){setError('Token required');return;}
            setLoading(true);
            const res=await fetch('/api/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verificationToken:verificationToken.trim()})});
            const data=await res.json();
            if(!res.ok){setError(data.error||'Verification failed');setLoading(false);return;}
            setError('');
            setVerifyingEmail(false);
            setMode('login');
            setPassword('');
            alert('Email verified! You can now login.');
            setLoading(false);
          }} disabled={loading} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg, #c8a84b, #ffd700)',border:'none',borderRadius:'8px',color:'#000',fontSize:'16px',fontWeight:'700',cursor:loading?'not-allowed':'pointer',letterSpacing:'2px',transition:'all 0.2s',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.7:1}}>{loading?'VERIFYING...':'VERIFY EMAIL'}</button>
          <div style={{marginTop:'20px',textAlign:'center',fontSize:'12px'}}><button onClick={()=>{setVerifyingEmail(false);setError('')}} style={{background:'none',border:'none',color:'#c8a84b',cursor:'pointer',textDecoration:'underline'}}>Back to login</button></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width:'100vw', height:'100vh', background:'linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%)',
      display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column',
      fontFamily:"'Segoe UI', sans-serif", color:'#fff', position:'relative', overflow:'hidden'
    }}>
      <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
        {[...Array(80)].map((_,i)=>(
          <div key={i} style={{position:'absolute',left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,width:Math.random()>0.8?'2px':'1px',height:Math.random()>0.8?'2px':'1px',background:'#fff',borderRadius:'50%',opacity:0.3+Math.random()*0.7}}/>
        ))}
      </div>
      <div style={{textAlign:'center', marginBottom:'40px', zIndex:1}}>
        <div style={{fontSize:'64px', marginBottom:'8px'}}>⚔️</div>
        <h1 style={{fontSize:'52px',fontWeight:'900',margin:0,letterSpacing:'4px',background:'linear-gradient(135deg, #c8a84b, #ffd700, #c8a84b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>AGE OF SHADOWS</h1>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'14px',letterSpacing:'6px',marginTop:'8px'}}>MULTIPLAYER STRATEGY</p>
      </div>
      <div style={{background:'rgba(0,0,0,0.7)',border:'1px solid rgba(200,168,75,0.4)',borderRadius:'16px',padding:'40px 48px',width:'360px',zIndex:1,backdropFilter:'blur(10px)',boxShadow:'0 0 60px rgba(200,168,75,0.1)'}}>
        <h2 style={{margin:'0 0 24px',fontSize:'20px',color:'#c8a84b',textAlign:'center'}}>{mode==='login'?'Enter the Realm':mode==='register'?'Create Account':'Reset Password'}</h2>
        {mode!=='reset'&&(<div style={{display:'flex',gap:'8px',marginBottom:'24px',borderBottom:'1px solid rgba(200,168,75,0.2)'}}><button onClick={()=>{setMode('login');setError('')}} style={{flex:1,padding:'8px',background:mode==='login'?'rgba(200,168,75,0.2)':'transparent',border:'none',borderBottom:mode==='login'?'2px solid #c8a84b':'none',color:'#c8a84b',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:"'Segoe UI', sans-serif",letterSpacing:'1px'}}>LOGIN</button><button onClick={()=>{setMode('register');setError('')}} style={{flex:1,padding:'8px',background:mode==='register'?'rgba(200,168,75,0.2)':'transparent',border:'none',borderBottom:mode==='register'?'2px solid #c8a84b':'none',color:'#c8a84b',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:"'Segoe UI', sans-serif",letterSpacing:'1px'}}>REGISTER</button></div>)}
        <div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>EMAIL</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="you@example.com" disabled={loading||(mode==='reset'&&resetSent)} autoFocus style={{width:'100%',padding:'12px 16px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1,cursor:loading?'not-allowed':'text'}}/></div>
        {mode==='register'&&(<div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>DISPLAY NAME (optional)</label><input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your warrior name" disabled={loading} style={{width:'100%',padding:'12px 16px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1}}/></div>)}
        {mode!=='reset'&&(<div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>PASSWORD</label><div style={{position:'relative',display:'flex',alignItems:'center'}}><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••" disabled={loading} style={{width:'100%',padding:'12px 16px',paddingRight:'40px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1}}/><button type="button" onClick={()=>setShowPassword(!showPassword)} disabled={loading} style={{position:'absolute',right:'12px',background:'none',border:'none',color:'#c8a84b',cursor:loading?'not-allowed':'pointer',fontSize:'16px',padding:'0',width:'24px',height:'24px',display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity 0.2s'}}>{showPassword?'👁️':'👁️'}</button></div></div>)}
        {mode==='reset'&&resetSent&&(<><div style={{marginBottom:'20px',padding:'12px',background:'rgba(200,168,75,0.1)',borderRadius:'8px',fontSize:'13px',color:'rgba(255,255,255,0.7)'}}>Check server logs for reset token</div><div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>RESET TOKEN</label><input type="text" value={resetToken} onChange={e=>setResetToken(e.target.value)} placeholder="Paste token" disabled={loading} style={{width:'100%',padding:'12px 16px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif"}}/></div><div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>NEW PASSWORD</label><div style={{position:'relative',display:'flex',alignItems:'center'}}><input type={showNewPassword?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••" disabled={loading} style={{width:'100%',padding:'12px 16px',paddingRight:'40px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1}}/><button type="button" onClick={()=>setShowNewPassword(!showNewPassword)} disabled={loading} style={{position:'absolute',right:'12px',background:'none',border:'none',color:'#c8a84b',cursor:loading?'not-allowed':'pointer',fontSize:'16px',padding:'0',width:'24px',height:'24px',display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity 0.2s'}}>{showNewPassword?'👁️':'👁️'}</button></div></div></>) }
        {error&&<div style={{color:'#ff6b6b',fontSize:'12px',marginBottom:'16px',textAlign:'center'}}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg, #c8a84b, #ffd700)',border:'none',borderRadius:'8px',color:'#000',fontSize:'16px',fontWeight:'700',cursor:loading?'not-allowed':'pointer',letterSpacing:'2px',transition:'all 0.2s',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.7:1}} onMouseEnter={e=>!loading&&(e.target.style.transform='scale(1.02)')} onMouseLeave={e=>!loading&&(e.target.style.transform='scale(1)')}>{loading?'LOADING...':mode==='login'?'LOGIN':mode==='register'?'CREATE ACCOUNT':resetSent?'RESET PASSWORD':'SEND RESET EMAIL'}</button>
        {mode==='login'&&(<div style={{marginTop:'20px',textAlign:'center',fontSize:'12px'}}><button onClick={()=>{setMode('reset');setError('')}} style={{background:'none',border:'none',color:'#c8a84b',cursor:'pointer',textDecoration:'underline'}}>Forgot password?</button></div>)}
        {mode==='reset'&&(<div style={{marginTop:'20px',textAlign:'center'}}><button onClick={()=>{setMode('login');setError('');setResetToken('');setResetSent(false)}} style={{background:'none',border:'none',color:'#c8a84b',cursor:'pointer',fontSize:'12px',textDecoration:'underline'}}>Back to login</button></div>)}
        <div style={{marginTop:'20px',textAlign:'center',fontSize:'11px',color:'rgba(255,255,255,0.3)',lineHeight:'1.6'}}>Free to play · No download required<br/>A relaxing, idle browser game</div>
      </div>
      <div style={{position:'absolute',bottom:'20px',fontSize:'11px',color:'rgba(255,255,255,0.2)',zIndex:1}}>© 2026 CryptoWorldGames · ageofshadows.onrender.com</div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);

  return (
    <>
      <MobileOrientationCheck />
      {auth && <AdminPanel email={auth.email} />}
      {!auth ? <AuthScreen onAuthenticated={setAuth} /> : <GameScene auth={auth} />}
    </>
  );
}
