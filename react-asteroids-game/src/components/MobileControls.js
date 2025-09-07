import React, { useEffect, useState, useRef } from 'react';
import { setMobileKey, resetMobileKeys, setJoystickVector, setRightJoystickVector } from '../core/mobileInput';

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

  // Fire button removed; firing is controlled by holding the right joystick

  // Joystick logic
  const joyRef = useRef(null); // left stick knob
  const touchIdRef = useRef(null);
  const centerRef = useRef({ x:0, y:0 });

  // Right stick (aim)
  const rightJoyRef = useRef(null);
  const rightTouchIdRef = useRef(null);
  const rightCenterRef = useRef({ x:0, y:0 });

  const resetDir = () => {
    setMobileKey('w', false); setMobileKey('a', false); setMobileKey('s', false); setMobileKey('d', false);
    setJoystickVector(0,0);
    setRightJoystickVector(0,0);
    if (joyRef.current) {
      joyRef.current.style.transform = 'translate(-50%, -50%)';
    }
    if (rightJoyRef.current) {
      rightJoyRef.current.style.transform = 'translate(-50%, -50%)';
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
  // Right stick helpers
  const updateAimFromVector = (dx, dy) => {
    const dead = 12;
    const mag = Math.hypot(dx, dy);
    if (mag < dead) { setRightJoystickVector(0,0); if(rightJoyRef.current) rightJoyRef.current.style.transform='translate(-50%, -50%)'; return; }
    const nx = dx / mag; const ny = dy / mag;
    setRightJoystickVector(nx, ny);
    const limit = 40;
    const lx = Math.max(-limit, Math.min(limit, dx));
    const ly = Math.max(-limit, Math.min(limit, dy));
    if (rightJoyRef.current) rightJoyRef.current.style.transform = `translate(calc(-50% + ${lx}px), calc(-50% + ${ly}px))`;
  };
  const handleRightJoyStart = (e) => {
    if (!show) return;
    if (rightTouchIdRef.current != null) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    rightTouchIdRef.current = t.identifier ?? 'mouse';
    const rect = e.currentTarget.getBoundingClientRect();
    rightCenterRef.current = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    updateAimFromVector(t.clientX - rightCenterRef.current.x, t.clientY - rightCenterRef.current.y);
    // Optional: press right stick to fire
    setMobileKey(' ', true);
  };
  const handleRightJoyMove = (e) => {
    if (rightTouchIdRef.current == null) return;
    if (e.touches) {
      let targetTouch = null;
      for (let i=0;i<e.touches.length;i++) {
        const tt = e.touches[i];
        if ((tt.identifier ?? 'mouse') === rightTouchIdRef.current) { targetTouch = tt; break; }
      }
      if (!targetTouch) return;
      updateAimFromVector(targetTouch.clientX - rightCenterRef.current.x, targetTouch.clientY - rightCenterRef.current.y);
    } else {
      updateAimFromVector(e.clientX - rightCenterRef.current.x, e.clientY - rightCenterRef.current.y);
    }
  };
  const handleRightJoyEnd = (e) => {
    if (rightTouchIdRef.current == null) return;
    if (e.changedTouches) {
      for (let i=0;i<e.changedTouches.length;i++) {
        const ct = e.changedTouches[i];
        if ((ct.identifier ?? 'mouse') === rightTouchIdRef.current) {
          rightTouchIdRef.current = null; setRightJoystickVector(0,0); if(rightJoyRef.current) rightJoyRef.current.style.transform='translate(-50%, -50%)'; setMobileKey(' ', false); break;
        }
      }
    } else {
      rightTouchIdRef.current = null; setRightJoystickVector(0,0); if(rightJoyRef.current) rightJoyRef.current.style.transform='translate(-50%, -50%)'; setMobileKey(' ', false);
    }
  };


  useEffect(() => () => resetMobileKeys(), []);

  if (!show) return null;

  // No standalone fire button styling needed

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
      {/* Right Analog Joystick (Aim) */}
      <div
        style={{ position:'absolute', right:30, bottom:40, width:160, height:160, pointerEvents:'auto', touchAction:'none' }}
        onTouchStart={(e)=>{e.preventDefault();handleRightJoyStart(e);}}
        onTouchMove={(e)=>{e.preventDefault();handleRightJoyMove(e);}}
        onTouchEnd={(e)=>{e.preventDefault();handleRightJoyEnd(e);}}
        onTouchCancel={(e)=>{e.preventDefault();handleRightJoyEnd(e);}}
        onMouseDown={(e)=>{e.preventDefault();handleRightJoyStart(e);}}
        onMouseMove={(e)=>{ if(rightTouchIdRef.current!=null){e.preventDefault();handleRightJoyMove(e);} }}
        onMouseUp={(e)=>{e.preventDefault();handleRightJoyEnd(e);}}
        onMouseLeave={(e)=>{e.preventDefault();handleRightJoyEnd(e);}}
      >
        <div style={{ position:'absolute', left:0, top:0, width:'100%', height:'100%', borderRadius:'50%', background:'rgba(255,255,255,0.06)', border:'2px solid rgba(255,255,255,0.25)' }} />
        <div ref={rightJoyRef} style={{ position:'absolute', left:'50%', top:'50%', width:70, height:70, borderRadius:'50%', background:'rgba(255,255,255,0.25)', border:'2px solid rgba(255,255,255,0.45)', transform:'translate(-50%, -50%)', transition: rightTouchIdRef.current? 'none':'transform 0.15s ease' }} />
      </div>
    </div>
  );
}
