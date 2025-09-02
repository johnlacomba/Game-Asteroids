import React, { useState } from 'react';

const TitleScreen = ({ onModeSelect }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [touchedName, setTouchedName] = useState(false);
  const [touchedAddr, setTouchedAddr] = useState(false);
  const [mode, setMode] = useState(null); // 'host' or 'join'
  const finalName = name.trim().slice(0,20) || 'Player';

  const startHost = async () => {
    setMode('host');
    // Attempt to start backend through dev control endpoint (only available in dev).
    try {
      await fetch('http://'+window.location.hostname+':5002/start-backend', { method:'POST' });
    } catch (e) {
      // ignore errors (likely prod build)
    }
  onModeSelect('multiplayer', finalName, { serverAddress: window.location.hostname, isHost: true });
  };
  const startJoin = () => {
    setMode('join');
    const addr = (address.trim() || window.location.hostname).replace(/^(https?:\/\/)/,'');
    onModeSelect('multiplayer', finalName, { serverAddress: addr });
  };
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (document.activeElement && document.activeElement.id === 'join-address') {
        startJoin();
      } else {
        startHost();
      }
    }
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'black',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'Arial, sans-serif',
      zIndex: 1000
    }}>
      <h1 style={{
        fontSize: '72px',
        marginBottom: '50px',
        textAlign: 'center',
        letterSpacing: '8px',
        textShadow: '0 0 20px #00FFFF'
      }}>
        ASTEROIDS
      </h1>
      
      <div style={{
        fontSize: '24px',
        textAlign: 'center',
        lineHeight: '2',
        marginBottom: '60px'
      }}>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => setTouchedName(true)}
          maxLength={20}
          placeholder="Enter a name"
          style={{
            padding: '12px 16px',
            marginBottom: '25px',
            background: '#111',
            color: '#FFF',
            border: '2px solid #00FFFF',
            borderRadius: '4px',
            fontSize: '20px',
            textAlign: 'center',
            width: '320px',
            letterSpacing: '1px'
          }}
          onKeyDown={handleKeyPress}
        />
        {touchedName && name.trim().length === 0 && (
          <div style={{ color: '#FF6666', fontSize: '14px', marginBottom: '10px' }}>Name optional (defaults to Player)</div>
        )}
    <div style={{ position:'relative', width:'480px', maxWidth:'92vw', margin:'0 auto 10px', userSelect:'none' }}>
          {/* Host Button (Top Half) */}
      <div
            onClick={startHost}
            style={{
              position:'relative',
              height:'90px',
              cursor:'pointer',
              background:'rgba(0,255,0,0.12)',
              border:'2px solid #00FF00',
              boxShadow:'0 0 14px #00FF0033',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              transition:'background 0.25s'
            }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,255,0,0.22)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,255,0,0.12)';}}
          >
            <div style={{ textAlign:'center', padding:'0 26px' }}>
              <div style={{ fontSize:'34px', fontWeight:700, letterSpacing:'3px', textShadow:'0 0 10px #00FF00' }}>HOST GAME</div>
            </div>
          </div>
          {/* Join Button (Bottom Half) */}
      <div
            onClick={startJoin}
            style={{
              position:'relative',
              height:'90px',
              marginTop:'18px', // gap between rectangles
              cursor:'pointer',
              background:'rgba(0,162,255,0.12)',
              border:'2px solid #00A2FF',
              boxShadow:'0 0 14px #00A2FF33',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              transition:'background 0.25s'
            }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,162,255,0.22)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,162,255,0.12)';}}
          >
            <div style={{ textAlign:'center', padding:'0 26px' }}>
              <div style={{ fontSize:'34px', fontWeight:700, letterSpacing:'3px', textShadow:'0 0 10px #00A2FF' }}>JOIN GAME</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop:'32px', display:'flex', flexDirection:'column', alignItems:'center' }}>
          <input
            id="join-address"
            type="text"
            value={address}
            onChange={e=>setAddress(e.target.value)}
            onBlur={()=>setTouchedAddr(true)}
            placeholder="Remote Host (leave blank for localhost)"
            style={{
              padding:'10px 14px',
              background:'#111',
              color:'#FFF',
              border:'2px solid #0077FF',
              borderRadius:4,
              fontSize:16,
              width:'320px',
              textAlign:'center'
            }}
            onKeyDown={e=>{ if(e.key==='Enter') startJoin(); }}
          />
          {touchedAddr && address.trim().length===0 && (
            <div style={{ color:'#888', fontSize:12, marginTop:6 }}>Blank = this device</div>
          )}
        </div>
      </div>
      
      <div style={{
        fontSize: '16px',
        color: '#AAAAAA',
        textAlign: 'center',
        lineHeight: '1.5'
      }}>
  Press <strong>Enter</strong> to Host (focus on name). Focus IP field + Enter to Join.
      </div>
      
      {/* Animated stars background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: -1
      }}>
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '2px',
              height: '2px',
              backgroundColor: 'white',
              borderRadius: '50%',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `twinkle ${2 + Math.random() * 3}s infinite`,
              opacity: Math.random()
            }}
          />
        ))}
      </div>
      
      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TitleScreen;