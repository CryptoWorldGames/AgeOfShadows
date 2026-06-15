import React, { useState } from 'react';
import GameScene from './GameScene.jsx';

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
        onAuthenticated({ userId: data.userId, email: data.email, displayName: displayName || email.split('@')[0] });
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
        {mode!=='reset'&&(<div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>PASSWORD</label><div style={{position:'relative',display:'flex',alignItems:'center'}}><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••" disabled={loading} style={{width:'100%',padding:'12px 16px',paddingRight:'40px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1}}/><button type="button" onClick={()=>setShowPassword(!showPassword)} disabled={loading} style={{position:'absolute',right:'12px',background:'none',border:'none',color:'rgba(255,255,255,0.6)',cursor:loading?'not-allowed':'pointer',fontSize:'18px',padding:'0',width:'24px',height:'24px',display:'flex',alignItems:'center',justifyContent:'center'}}>{showPassword?'👁️':'👁️‍🗨️'}</button></div></div>)}
        {mode==='reset'&&resetSent&&(<><div style={{marginBottom:'20px',padding:'12px',background:'rgba(200,168,75,0.1)',borderRadius:'8px',fontSize:'13px',color:'rgba(255,255,255,0.7)'}}>Check server logs for reset token</div><div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>RESET TOKEN</label><input type="text" value={resetToken} onChange={e=>setResetToken(e.target.value)} placeholder="Paste token" disabled={loading} style={{width:'100%',padding:'12px 16px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif"}}/></div><div style={{marginBottom:'20px'}}><label style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.6)',marginBottom:'8px',letterSpacing:'2px'}}>NEW PASSWORD</label><div style={{position:'relative',display:'flex',alignItems:'center'}}><input type={showNewPassword?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••" disabled={loading} style={{width:'100%',padding:'12px 16px',paddingRight:'40px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(200,168,75,0.3)',borderRadius:'8px',color:'#fff',fontSize:'15px',outline:'none',boxSizing:'border-box',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.5:1}}/><button type="button" onClick={()=>setShowNewPassword(!showNewPassword)} disabled={loading} style={{position:'absolute',right:'12px',background:'none',border:'none',color:'rgba(255,255,255,0.6)',cursor:loading?'not-allowed':'pointer',fontSize:'18px',padding:'0',width:'24px',height:'24px',display:'flex',alignItems:'center',justifyContent:'center'}}>{showNewPassword?'👁️':'👁️‍🗨️'}</button></div></div></>) }
        {error&&<div style={{color:'#ff6b6b',fontSize:'12px',marginBottom:'16px',textAlign:'center'}}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg, #c8a84b, #ffd700)',border:'none',borderRadius:'8px',color:'#000',fontSize:'16px',fontWeight:'700',cursor:loading?'not-allowed':'pointer',letterSpacing:'2px',transition:'all 0.2s',fontFamily:"'Segoe UI', sans-serif",opacity:loading?0.7:1}} onMouseEnter={e=>!loading&&(e.target.style.transform='scale(1.02)')} onMouseLeave={e=>!loading&&(e.target.style.transform='scale(1)')}>{loading?'LOADING...':mode==='login'?'LOGIN':mode==='register'?'CREATE ACCOUNT':resetSent?'RESET PASSWORD':'SEND RESET EMAIL'}</button>
        {mode==='login'&&(<div style={{marginTop:'20px',textAlign:'center',fontSize:'12px'}}><button onClick={()=>{setMode('reset');setError('')}} style={{background:'none',border:'none',color:'#c8a84b',cursor:'pointer',textDecoration:'underline'}}>Forgot password?</button></div>)}
        {mode==='reset'&&(<div style={{marginTop:'20px',textAlign:'center'}}><button onClick={()=>{setMode('login');setError('');setResetToken('');setResetSent(false)}} style={{background:'none',border:'none',color:'#c8a84b',cursor:'pointer',fontSize:'12px',textDecoration:'underline'}}>Back to login</button></div>)}
        <div style={{marginTop:'20px',textAlign:'center',fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>Free to play · No download required · An idle browser game</div>
      </div>
      <div style={{position:'absolute',bottom:'20px',fontSize:'11px',color:'rgba(255,255,255,0.2)',zIndex:1}}>© 2026 CryptoWorldGames · ageofshadows.onrender.com</div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  if (!auth) return <AuthScreen onAuthenticated={setAuth} />;
  return <GameScene auth={auth} />;
}
