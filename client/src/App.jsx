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
    <div id="admin-panel" style={{ position: 'fixed', top: 210, left: 14, maxHeight: '50vh', maxWidth: 180, overflowY: 'auto', background: 'rgba(255,0,0,0.2)', border: '2px solid #ff0000', borderRadius: 8, padding: 12, color: '#fff', fontFamily: "'Segoe UI', sans-serif", fontSize: 11, zIndex: 100 }}>
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

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null);

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
      if (!email.trim() || !password.trim() || !displayName.trim()) {
        setError('Email, display name, and password required');
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
        setSuccess('Account created! Logging in...');
        const loginResponse = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password })
        });
        const loginData = await loginResponse.json();
        if (!loginResponse.ok) {
          setError('Account created but login failed. Please log in manually.');
          setSuccess('');
          setMode('login');
          setLoading(false);
          return;
        }
        if (loginData.adminToken) {
          sessionStorage.setItem('adminToken', loginData.adminToken);
        }
        setWelcomeData({ userId: loginData.userId, email: loginData.email, displayName: loginData.displayName });
        setLoading(false);
      } catch (err) {
        setError('Network error: ' + err.message);
        setSuccess('');
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

  if (welcomeData) {
    return (
      <div style={{width:'100vw',height:'100vh',background:'linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Segoe UI',sans-serif",padding:'20px',boxSizing:'border-box'}}>
        <div style={{background:'rgba(0,0,0,0.9)',border:'2px solid rgba(200,168,75,0.6)',borderRadius:'16px',padding:'clamp(24px,5vh,40px) clamp(20px,5vw,32px)',width:'min(90vw,380px)',textAlign:'center',color:'#fff',boxShadow:'0 0 60px rgba(200,168,75,0.2)'}}>
          <div style={{fontSize:'clamp(40px,8vw,56px)',marginBottom:'12px'}}>⚔️</div>
          <h1 style={{fontSize:'clamp(20px,5vw,26px)',fontWeight:'900',color:'#c8a84b',margin:'0 0 10px',letterSpacing:'2px'}}>WELCOME!</h1>
          <p style={{fontSize:'clamp(16px,4vw,20px)',fontWeight:'700',margin:'0 0 6px',color:'#fff'}}>{welcomeData.displayName}</p>
          <p style={{fontSize:'clamp(13px,3vw,15px)',opacity:0.7,margin:'0 0 28px',lineHeight:'1.6'}}>You are now registered and ready to enter the realm of Age of Shadows.</p>
          <button onClick={()=>onAuthenticated(welcomeData)} style={{width:'100%',padding:'clamp(12px,3vh,16px)',background:'linear-gradient(135deg, #c8a84b, #ffd700)',border:'none',borderRadius:'8px',color:'#000',fontSize:'clamp(14px,3.5vw,16px)',fontWeight:'700',cursor:'pointer',letterSpacing:'2px'}}>OK - ENTER THE GAME</button>
        </div>
      </div>
    );
  }

return (
    <div style={{
      width:'100vw', minHeight:'100vh', background:'linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%)',
      display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column',
      fontFamily:"'Segoe UI', sans-serif", color:'#fff', position:'relative', overflow:'hidden',
      paddingTop:'max(12px, env(safe-area-inset-top))',
      paddingBottom:'max(12px, env(safe-area-inset-bottom))',
      paddingLeft:'max(12px, env(safe-area-inset-left))',
      paddingRight:'max(12px, env(safe-area-inset-right))',
      boxSizing:'border-box'
    }}>
      <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
        {[...Array(80)].map((_,i)=>(
          <div key={i} style={{position:'absolute',left:`${Math.random()*100}%`,top:`${Math.random()*100}%`,width:Math.random()>0.8?'2px':'1px',height:Math.random()>0.8?'2px':'1px',background:'#fff',borderRadius:'50%',opacity:0.3+Math.random()*0.7}}/>
        ))}
      </div>
      <div style={{textAlign:'center', marginBottom:'clamp(12px, 2vh, 20px)', zIndex:1, maxWidth:'100%', padding:'0 12px', flex:'0 1 auto'}}>
        <div style={{fontSize:'clamp(36px, 8vh, 64px)', marginBottom:'2px', lineHeight:'1'}}>⚔️</div>
        <h1 style={{fontSize:'clamp(20px, 6vh, 48px)',fontWeight:'900',margin:0,letterSpacing:'clamp(0.5px, 0.5vw, 3px)',background:'linear-gradient(135deg, #c8a84b, #ffd700, #c8a84b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',lineHeight:'1.1'}}>AGE OF SHADOWS</h1>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'clamp(9px, 2vh, 12px)',letterSpacing:'clamp(0.5px, 0.5vw, 3px)',margin:'4px 0 0 0'}}>MULTIPLAYER STRATEGY</p>
        <p style={{color:'#fff',fontSize:'clamp(10px, 2vh, 13px)',fontWeight:'600',margin:'4px 0 0 0',letterSpacing:'1px'}}>v2.12</p>
      </div>
      <div style={{background:'rgba(0,0,0,0.7)',border:'1px solid rgba(200,168,75,0.4)',borderRadius:'12px',padding:'clamp(16px, 3vh, 28px)',width:'min(90vw, 360px)',zIndex:1,backdropFilter:'blur(10px)',boxShadow:'0 0 60px rgba(200,168,75,0.1)',marginLeft:'auto',marginRight:'auto',flex:'0 1 auto',maxHeight:'90vh',overflowY:'auto',overflowX:'hidden',boxSizing:'border-box'}}>
        <h2 style={{margin:'0 0 clamp(12px, 2vh, 16px)',fontSize:'clamp(14px, 3vh, 18px)',color:'#c8a84b',textAlign:'center'}}>{mode==='login'?'Enter the Realm':mode==='register'?'Create Account':'Reset Password'}</h2>
        {mode!=='reset'&&(<div style={{display:'flex',gap:'8px',marginBottom:'24px',borderBottom:'1px solid rgba(200,168,75,0.2)'}}><button onClick={()=>{setMode('login');setError('')}} style={{flex:1,padding:'8px',background:mode==='login'?'rgba(200,168,75,0.2)':'transparent',border:'none',borderBottom:mode==='login'?'2px solid #c8a84b':'none',color:'#c8a84b',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:"'Segoe UI', sans-serif",letterSpacing:'1px'}}>LOGIN</button><button onClick={()=>{setMode('register');setError('')}} style={{flex:1,padding:'8px',background:mode==='register'?'rgba(200,168,75,0.2)':'transparent',border:'none',borderBottom:mode==='register'?'2px solid #c8a84b':'none',color:'#c8a84b',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:"'Segoe UI', sans-serif",letterSpacing:'1px'}}>REGISTER</button></div>)}
        <div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'clamp(11px, 2.5vw, 12px)',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>EMAIL</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="you@example.com" disabled={loading||(mode==='reset'&&resetSent)} autoFocus style={{width:'100%',padding:'clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px)',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'16px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1,cursor:loading?'not-allowed':'text'}}/></div>
        {mode==='register'&&(<div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>DISPLAY NAME (optional)</label><input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your warrior name" disabled={loading} style={{width:'100%',padding:'12px 16px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1}}/></div>)}
        {mode!=='reset'&&(<div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>PASSWORD</label><div style={{position:'relative',display:'flex',alignItems:'center'}}><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••" disabled={loading} style={{width:'100%',padding:'12px 16px',paddingRight:'40px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1}}/><button type="button" onClick={()=>setShowPassword(!showPassword)} disabled={loading} style={{position:'absolute',right:'12px',background:'none',border:'none',color:'#c8a84b',cursor:loading?'not-allowed':'pointer',fontSize:'16px',padding:'0',width:'24px',height:'24px',display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity 0.2s'}}>{showPassword?'👁️':'👁️'}</button></div></div>)}
        {mode==='reset'&&resetSent&&(<><div style={{marginBottom:'20px',padding:'12px',background:'rgba(200,168,75,0.1)',borderRadius:'8px',fontSize:'13px',color:'rgba(255,255,255,0.7)'}}>Check server logs for reset token</div><div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>RESET TOKEN</label><input type="text" value={resetToken} onChange={e=>setResetToken(e.target.value)} placeholder="Paste token" disabled={loading} style={{width:'100%',padding:'12px 16px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif"}}/></div><div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>NEW PASSWORD</label><div style={{position:'relative',display:'flex',alignItems:'center'}}><input type={showNewPassword?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••" disabled={loading} style={{width:'100%',padding:'12px 16px',paddingRight:'40px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1}}/><button type="button" onClick={()=>setShowNewPassword(!showNewPassword)} disabled={loading} style={{position:'absolute',right:'12px',background:'none',border:'none',color:'#c8a84b',cursor:loading?'not-allowed':'pointer',fontSize:'16px',padding:'0',width:'24px',height:'24px',display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity 0.2s'}}>{showNewPassword?'👁️':'👁️'}</button></div></div></>) }
        {error&&<div style={{color:'#ff6b6b',fontSize:'12px',marginBottom:'16px',textAlign:'center'}}>{error}</div>}
        {success&&<div style={{color:'#6bff6b',fontSize:'12px',marginBottom:'16px',textAlign:'center'}}>{success}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg, #c8a84b, #ffd700)',border:'none',borderRadius:'8px',color:'#000',fontSize:'16px',fontWeight:'700',cursor:loading?'not-allowed':'pointer',letterSpacing:'2px',transition:'all 0.2s',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.7:1}} onMouseEnter={e=>!loading&&(e.target.style.transform='scale(1.02)')} onMouseLeave={e=>!loading&&(e.target.style.transform='scale(1)')}>{loading?'LOADING...':mode==='login'?'LOGIN':mode==='register'?'CREATE ACCOUNT':resetSent?'RESET PASSWORD':'SEND RESET EMAIL'}</button>
        {mode==='login'&&(<div style={{marginTop:'20px',textAlign:'center',fontSize:'12px'}}><button onClick={()=>{setMode('reset');setError('')}} style={{background:'none',border:'none',color:'#c8a84b',cursor:'pointer',textDecoration:'underline'}}>Forgot password?</button></div>)}
        {mode==='reset'&&(<div style={{marginTop:'20px',textAlign:'center'}}><button onClick={()=>{setMode('login');setError('');setResetToken('');setResetSent(false)}} style={{background:'none',border:'none',color:'#c8a84b',cursor:'pointer',fontSize:'12px',textDecoration:'underline'}}>Back to login</button></div>)}
        <div style={{marginTop:'20px',textAlign:'center',fontSize:'11px',color:'rgba(255,255,255,0.3)',lineHeight:'1.6'}}>Free to play · No download required<br/>A relaxing, idle browser game</div>
      </div>
      <div style={{position:'absolute',bottom:'14px',left:'20px',right:'20px',fontSize:'10px',color:'rgba(255,255,255,0.15)',textAlign:'center',zIndex:1}}>© 2026 CryptoWorldGames</div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('auth');
    if (saved) {
      try {
        setAuth(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to restore auth:', e);
      }
    }
  }, []);

  const handleAuthenticated = (authData) => {
    setAuth(authData);
    localStorage.setItem('auth', JSON.stringify(authData));
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem('auth');
    sessionStorage.removeItem('adminToken');
  };

  return (
    <>
      {auth && <AdminPanel email={auth.email} />}
      {!auth ? <AuthScreen onAuthenticated={handleAuthenticated} /> : <GameScene auth={auth} onLogout={handleLogout} />}
    </>
  );
}
