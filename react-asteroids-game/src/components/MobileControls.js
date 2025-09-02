import React, { useEffect, useState, useCallback, useRef } from 'react';
import { setMobileKey, resetMobileKeys, setJoystickVector } from '../core/mobileInput';

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  const touchCapable = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  const mobileRegex = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i;
  return touchCapable && mobileRegex.test(ua);
}

export default function MobileControls() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isMobileDevice() || window.innerWidth < 900) {
      setShow(true);
    }
    const onResize = () => {
      if (isMobileDevice() || window.innerWidth < 900) setShow(true); else setShow(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fireBind = useCallback(() => ({
    onTouchStart: e => { e.preventDefault(); setMobileKey(' ', true); },
    onTouchEnd: e => { e.preventDefault(); setMobileKey(' ', false); },
    onTouchCancel: e => { e.preventDefault(); setMobileKey(' ', false); },
    onMouseDown: e => { if (!show) return; setMobileKey(' ', true); },
    onMouseUp: e => { if (!show) return; setMobileKey(' ', false); },
    onMouseLeave: e => { if (!show) return; setMobileKey(' ', false); },
  }), [show]);

  // Joystick logic
  const joyRef = useRef(null);
  const touchIdRef = useRef(null);
  const centerRef = useRef({ x:0, y:0 });

  const resetDir = () => {
    setMobileKey('w', false); setMobileKey('a', false); setMobileKey('s', false); setMobileKey('d', false);
    setJoystickVector(0,0);
    if (joyRef.current) {
      joyRef.current.style.transform = 'translate(-50%, -50%)';
    }
  };

  const updateDirFromVector = (dx, dy) => {
    const dead = 12; // px deadzone
    const mag = Math.hypot(dx, dy);
    if (mag < dead) { setJoystickVector(0,0); if(joyRef.current) joyRef.current.style.transform='translate(-50%, -50%)'; return; }
    const nx = dx / mag; const ny = dy / mag;
    setJoystickVector(nx, ny);
    const limit = 40;
    const lx = Math.max(-limit, Math.min(limit, dx));
    const ly = Math.max(-limit, Math.min(limit, dy));
    if (joyRef.current) joyRef.current.style.transform = `translate(calc(-50% + ${lx}px), calc(-50% + ${ly}px))`;
  };

  const handleJoyStart = (e) => {
    if (!show) return;
    if (touchIdRef.current != null) return; // already tracking a touch
    const t = e.changedTouches ? e.changedTouches[0] : e; // use the touch that actually started on the joystick
    touchIdRef.current = t.identifier ?? 'mouse';
    const rect = e.currentTarget.getBoundingClientRect();
    centerRef.current = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    updateDirFromVector(t.clientX - centerRef.current.x, t.clientY - centerRef.current.y);
  };
  const handleJoyMove = (e) => {
    if (touchIdRef.current == null) return;
    if (e.touches) {
      let targetTouch = null;
      for (let i=0;i<e.touches.length;i++) {
        const tt = e.touches[i];
        if ((tt.identifier ?? 'mouse') === touchIdRef.current) { targetTouch = tt; break; }
      }
      if (!targetTouch) return; // ignore moves from other touches
      updateDirFromVector(targetTouch.clientX - centerRef.current.x, targetTouch.clientY - centerRef.current.y);
    } else {
      updateDirFromVector(e.clientX - centerRef.current.x, e.clientY - centerRef.current.y);
    }
  };
  const handleJoyEnd = (e) => {
    if (touchIdRef.current == null) return;
    if (e.changedTouches) {
      for (let i=0;i<e.changedTouches.length;i++) {
        const ct = e.changedTouches[i];
        if ((ct.identifier ?? 'mouse') === touchIdRef.current) {
            touchIdRef.current = null; resetDir(); break;
        }
      }
    } else {
      // mouse end
      touchIdRef.current = null; resetDir();
    }
  };
  useEffect(() => {
    return () => resetDir();
  }, []);

  useEffect(() => () => resetMobileKeys(), []);

  if (!show) return null;

  const btnStyle = {
    width: 56,
    height: 56,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    border: '1px solid rgba(255,255,255,0.35)',
    color: '#fff',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    touchAction: 'none'
  };

  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex: 2000, userSelect:'none', WebkitUserSelect:'none' }}>
      {/* Analog Joystick */}
      <div
        style={{ position:'absolute', left:30, bottom:40, width:160, height:160, pointerEvents:'auto', touchAction:'none' }}
        onTouchStart={(e)=>{e.preventDefault();handleJoyStart(e);}}
        onTouchMove={(e)=>{e.preventDefault();handleJoyMove(e);}}
        onTouchEnd={(e)=>{e.preventDefault();handleJoyEnd(e);}}
        onTouchCancel={(e)=>{e.preventDefault();handleJoyEnd(e);}}
        onMouseDown={(e)=>{e.preventDefault();handleJoyStart(e);}}
        onMouseMove={(e)=>{ if(touchIdRef.current!=null){e.preventDefault();handleJoyMove(e);} }}
        onMouseUp={(e)=>{e.preventDefault();handleJoyEnd(e);}}
        onMouseLeave={(e)=>{e.preventDefault();handleJoyEnd(e);}}
      >
        <div style={{ position:'absolute', left:0, top:0, width:'100%', height:'100%', borderRadius:'50%', background:'rgba(255,255,255,0.06)', border:'2px solid rgba(255,255,255,0.25)' }} />
        <div ref={joyRef} style={{ position:'absolute', left:'50%', top:'50%', width:70, height:70, borderRadius:'50%', background:'rgba(255,255,255,0.25)', border:'2px solid rgba(255,255,255,0.45)', transform:'translate(-50%, -50%)', transition: touchIdRef.current? 'none':'transform 0.15s ease' }} />
      </div>
      {/* Fire Button */}
      <div style={{ position:'absolute', right:35, bottom:60, pointerEvents:'auto', WebkitTouchCallout:'none', userSelect:'none' }} {...fireBind()}>
        <div style={{ ...btnStyle, width:100, height:100, borderRadius:55, fontSize:20, fontWeight:'600', letterSpacing:1, WebkitUserSelect:'none' }}>FIRE</div>
      </div>
    </div>
  );
}
