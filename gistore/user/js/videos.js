// ============================================================
//  user/js/videos.js
//  Generador de videos publicitarios — GI Store
//  45 plantillas, Canvas API, MediaRecorder, audio
//  v2 — 60 FPS · MP4 nativo · Audio via AudioBufferSourceNode
// ============================================================

'use strict';

// ── Constantes ────────────────────────────────────────────
const API_TOKEN      = '../../backend/tokens.php';
const API_VIDEOS     = '../backend/videos.php';
const API_MEMBRESIAS = '../backend/membresias.php';
const CANVAS_W       = 720;
const CANVAS_H       = 1280;
const FPS            = 30;

// ── Banco de audios predefinidos ──────────────────────────
// Sustituye las URLs por las rutas reales de tus audios en el servidor
const BANCO_AUDIOS = [
  { id: 'audio1', nombre: '🎵 Energía Comercial',  url: '../../audio/comercial-energia.mp3' },
  { id: 'audio2', nombre: '🎸 Rock Publicitario',  url: '../../audio/rock-publicitario.mp3' },
  { id: 'audio3', nombre: '🌴 Tropical Vibes',     url: '../../audio/tropical-vibes.mp3'    },
  { id: 'audio4', nombre: '🎹 Corporativo Suave',  url: '../../audio/corporativo-suave.mp3' },
  { id: 'audio5', nombre: '⚡ Electrónico Moderno', url: '../../audio/electronico-moderno.mp3'},
  { id: 'audio6', nombre: '🎺 Alegre y Festivo',   url: '../../audio/alegre-festivo.mp3'    },
];

// ── Estado global ─────────────────────────────────────────
let _token         = null;
let todosProductos = [];
let seleccionados  = [];   // [{id, nombre, url, img}]
let plantillaActual= 0;
let duracionSeg    = 15;
let audioFile      = null; // File subido por el usuario
let audioUrlBanco  = null; // URL del audio del banco seleccionado
let volumen        = 0.8;
let animFrame      = null;
let grabando       = false;
let mediaRec       = null;
let chunks         = [];
let imgsCargadas   = {};   // cache: url → HTMLImageElement
let tiempoInicio   = 0;
let membresiaActiva= false;

// ── Audio de preview (no graba, solo reproduce mientras previsualiza) ──
let _previewActx  = null;   // AudioContext
let _previewSrc   = null;   // BufferSourceNode
let _previewGain  = null;   // GainNode

// ── Canvas ────────────────────────────────────────────────
const canvas    = document.getElementById('vidCanvas');
const ctx       = canvas.getContext('2d');
canvas.width    = CANVAS_W;
canvas.height   = CANVAS_H;

// ── CSRF ──────────────────────────────────────────────────
async function getToken() {
  if (_token) return _token;
  try {
    const r = await fetch(API_TOKEN, { credentials: 'include' });
    const d = await r.json();
    _token = d.token || '';
  } catch { _token = ''; }
  return _token;
}

// ══════════════════════════════════════════════════════════
//  45 PLANTILLAS
//  Cada una: { nombre, emoji, bg, render(ctx,img,t,W,H) }
//  t = 0..1 (progreso dentro del slide)
// ══════════════════════════════════════════════════════════
const PLANTILLAS = [

  // ── 1. FADE CLÁSICO ──────────────────────────────────
  { nombre:'Fade Clásico', emoji:'🌅', bg:'#000',
    render(c,img,t,W,H){ fadoImg(c,img,t,W,H,'cover'); } },

  // ── 2. ZOOM IN ────────────────────────────────────────
  { nombre:'Zoom In', emoji:'🔍', bg:'#111',
    render(c,img,t,W,H){
      const s = 1 + t * 0.35;
      c.globalAlpha = Math.min(1, t * 3);
      drawImgScaled(c,img,W,H,s);
      c.globalAlpha = 1;
    }},

  // ── 3. ZOOM OUT ───────────────────────────────────────
  { nombre:'Zoom Out', emoji:'🔭', bg:'#111',
    render(c,img,t,W,H){
      const s = 1.35 - t * 0.35;
      c.globalAlpha = Math.min(1, t * 3);
      drawImgScaled(c,img,W,H,s);
      c.globalAlpha = 1;
    }},

  // ── 4. SLIDE DERECHA ─────────────────────────────────
  { nombre:'Slide →', emoji:'➡️', bg:'#000',
    render(c,img,t,W,H){
      const x = easeOut(t) * W - W;
      c.save(); c.translate(x,0); drawImg(c,img,W,H); c.restore();
    }},

  // ── 5. SLIDE IZQUIERDA ───────────────────────────────
  { nombre:'Slide ←', emoji:'⬅️', bg:'#000',
    render(c,img,t,W,H){
      const x = W - easeOut(t)*W;
      c.save(); c.translate(x,0); drawImg(c,img,W,H); c.restore();
    }},

  // ── 6. SLIDE ARRIBA ──────────────────────────────────
  { nombre:'Slide ↑', emoji:'⬆️', bg:'#000',
    render(c,img,t,W,H){
      const y = H - easeOut(t)*H;
      c.save(); c.translate(0,y); drawImg(c,img,W,H); c.restore();
    }},

  // ── 7. SLIDE ABAJO ───────────────────────────────────
  { nombre:'Slide ↓', emoji:'⬇️', bg:'#000',
    render(c,img,t,W,H){
      const y = easeOut(t)*H - H;
      c.save(); c.translate(0,y); drawImg(c,img,W,H); c.restore();
    }},

  // ── 8. CORTINA VERTICAL ──────────────────────────────
  { nombre:'Cortina V', emoji:'🎭', bg:'#1a1a1a',
    render(c,img,t,W,H){
      drawImg(c,img,W,H);
      const rem = W * (1 - easeOut(t));
      c.fillStyle='#000'; c.fillRect(0,0,rem,H);
    }},

  // ── 9. CORTINA HORIZONTAL ────────────────────────────
  { nombre:'Cortina H', emoji:'🎪', bg:'#1a1a1a',
    render(c,img,t,W,H){
      drawImg(c,img,W,H);
      const rem = H * (1 - easeOut(t));
      c.fillStyle='#000'; c.fillRect(0,0,W,rem);
    }},

  // ── 10. FLIP HORIZONTAL ──────────────────────────────
  { nombre:'Flip H', emoji:'🔄', bg:'#111',
    render(c,img,t,W,H){
      const scale = Math.abs(Math.cos(t * Math.PI));
      c.save();
      c.translate(W/2,H/2);
      c.scale(scale,1);
      c.translate(-W/2,-H/2);
      drawImg(c,img,W,H);
      c.restore();
    }},

  // ── 11. IRIS / CÍRCULO ───────────────────────────────
  { nombre:'Iris', emoji:'👁️', bg:'#000',
    render(c,img,t,W,H){
      const r = easeOut(t) * Math.hypot(W,H);
      c.save();
      c.beginPath();
      c.arc(W/2,H/2,r,0,Math.PI*2);
      c.clip();
      drawImg(c,img,W,H);
      c.restore();
    }},

  // ── 12. DIAGONAL ─────────────────────────────────────
  { nombre:'Diagonal', emoji:'↗️', bg:'#000',
    render(c,img,t,W,H){
      drawImg(c,img,W,H);
      c.globalAlpha = 1;
      c.fillStyle='#000';
      const p = (1-easeOut(t))*(W+H);
      c.beginPath();
      c.moveTo(0,0); c.lineTo(p,0); c.lineTo(0,p);
      c.closePath(); c.fill();
    }},

  // ── 13. NEÓN VERDE ───────────────────────────────────
  { nombre:'Neón Verde', emoji:'💚', bg:'#001a0a',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      const g = c.createLinearGradient(0,H,W,0);
      g.addColorStop(0,'rgba(26,107,60,.55)');
      g.addColorStop(1,'rgba(52,211,153,.0)');
      c.fillStyle = g;
      c.fillRect(0,0,W,H);
      const alpha = 0.4 + 0.3*Math.sin(t*Math.PI*4);
      c.strokeStyle=`rgba(52,211,153,${alpha})`;
      c.lineWidth=12;
      c.strokeRect(24,24,W-48,H-48);
    }},

  // ── 14. LUJO DORADO ──────────────────────────────────
  { nombre:'Lujo Dorado', emoji:'✨', bg:'#1a1200',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      const g = c.createLinearGradient(0,H,W,0);
      g.addColorStop(0,'rgba(120,80,0,.65)');
      g.addColorStop(1,'rgba(255,200,50,.0)');
      c.fillStyle=g; c.fillRect(0,0,W,H);
      c.strokeStyle='rgba(255,215,0,.7)';
      c.lineWidth=6; c.strokeRect(20,20,W-40,H-40);
    }},

  // ── 15. MINIMALISTA BLANCO ───────────────────────────
  { nombre:'Minimalista', emoji:'⬜', bg:'#fff',
    render(c,img,t,W,H){
      c.fillStyle='#fff'; c.fillRect(0,0,W,H);
      const pad=80, a=Math.min(1,t*2.5);
      c.globalAlpha=a;
      drawImgRect(c,img,pad,pad,W-pad*2,H-pad*2);
      c.globalAlpha=1;
    }},

  // ── 16. OSCURO ELEGANTE ──────────────────────────────
  { nombre:'Oscuro Elegante', emoji:'🖤', bg:'#0d0d0d',
    render(c,img,t,W,H){
      c.fillStyle='#0d0d0d'; c.fillRect(0,0,W,H);
      fadoImg(c,img,t,W,H,'cover');
      const vg = c.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.8);
      vg.addColorStop(0,'rgba(0,0,0,0)');
      vg.addColorStop(1,'rgba(0,0,0,.75)');
      c.fillStyle=vg; c.fillRect(0,0,W,H);
    }},

  // ── 17. SPLIT HORIZONTAL ─────────────────────────────
  { nombre:'Split H', emoji:'✂️', bg:'#000',
    render(c,img,t,W,H){
      const e=easeOut(t);
      c.save(); c.rect(0,0,W,H/2); c.clip();
      c.translate(0,-H*(1-e)); drawImg(c,img,W,H); c.restore();
      c.save(); c.rect(0,H/2,W,H/2); c.clip();
      c.translate(0,H*(1-e)); drawImg(c,img,W,H); c.restore();
    }},

  // ── 18. SPLIT VERTICAL ───────────────────────────────
  { nombre:'Split V', emoji:'🔪', bg:'#000',
    render(c,img,t,W,H){
      const e=easeOut(t);
      c.save(); c.rect(0,0,W/2,H); c.clip();
      c.translate(-W*(1-e),0); drawImg(c,img,W,H); c.restore();
      c.save(); c.rect(W/2,0,W/2,H); c.clip();
      c.translate(W*(1-e),0); drawImg(c,img,W,H); c.restore();
    }},

  // ── 19. POLAROID ─────────────────────────────────────
  { nombre:'Polaroid', emoji:'📷', bg:'#e8e0d0',
    render(c,img,t,W,H){
      c.fillStyle='#e8e0d0'; c.fillRect(0,0,W,H);
      const e=easeOut(t), pad=60, bot=140;
      const x=pad, y=pad+(1-e)*H*0.3, w=W-pad*2, h=H-pad-bot;
      c.shadowBlur=40; c.shadowColor='rgba(0,0,0,.2)';
      c.fillStyle='#fff'; c.fillRect(x-10,y-10,w+20,h+bot+10);
      c.shadowBlur=0;
      c.globalAlpha=e;
      drawImgRect(c,img,x,y,w,h);
      c.globalAlpha=1;
    }},

  // ── 20. GLITCH ────────────────────────────────────────
  { nombre:'Glitch', emoji:'📺', bg:'#000',
    render(c,img,t,W,H){
      drawImg(c,img,W,H);
      if(Math.random()<0.4){
        const y=Math.random()*H, h=Math.random()*40+10;
        const dx=(Math.random()-0.5)*30;
        c.save();
        c.drawImage(canvas,0,y,W,h, dx,y,W,h);
        c.globalAlpha=0.5;
        c.fillStyle=`rgba(${Math.random()*255|0},0,${Math.random()*255|0},.3)`;
        c.fillRect(0,y,W,h);
        c.restore();
      }
    }},

  // ── 21. RETRO VHS ────────────────────────────────────
  { nombre:'Retro VHS', emoji:'📼', bg:'#1a1a1a',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      c.globalAlpha=0.12;
      for(let y=0;y<H;y+=4){
        c.fillStyle='#000'; c.fillRect(0,y,W,2);
      }
      c.globalAlpha=1;
      const nd=ctx.createImageData(W,20);
      for(let i=0;i<nd.data.length;i+=4){
        const v=Math.random()*255|0;
        nd.data[i]=nd.data[i+1]=nd.data[i+2]=v;
        nd.data[i+3]=30;
      }
      c.putImageData(nd,0,Math.random()*H|0);
    }},

  // ── 22. ACUARELA ─────────────────────────────────────
  { nombre:'Acuarela', emoji:'🎨', bg:'#f0e8d8',
    render(c,img,t,W,H){
      c.fillStyle='#f0e8d8'; c.fillRect(0,0,W,H);
      c.globalAlpha=Math.min(1,t*1.8);
      c.filter='saturate(140%) blur(0.5px)';
      drawImg(c,img,W,H);
      c.filter='none'; c.globalAlpha=1;
      for(let i=0;i<6;i++){
        c.globalAlpha=0.06;
        c.fillStyle=['#e07060','#60a090','#d0b060','#7080d0'][i%4];
        c.beginPath();
        c.arc(W*(0.2+i*0.15),H*(0.3+i*0.1),150,0,Math.PI*2);
        c.fill();
      }
      c.globalAlpha=1;
    }},

  // ── 23. FLARE SOLAR ──────────────────────────────────
  { nombre:'Flare Solar', emoji:'☀️', bg:'#fff8e0',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      const a=Math.sin(t*Math.PI)*0.7;
      const g=c.createRadialGradient(W*0.8,H*0.15,0,W*0.8,H*0.15,W*0.8);
      g.addColorStop(0,`rgba(255,255,200,${a})`);
      g.addColorStop(1,'rgba(255,200,0,0)');
      c.fillStyle=g; c.fillRect(0,0,W,H);
    }},

  // ── 24. PARTÍCULAS ───────────────────────────────────
  { nombre:'Partículas', emoji:'✨', bg:'#000814',
    render(c,img,t,W,H){
      c.fillStyle='rgba(0,8,20,.15)'; c.fillRect(0,0,W,H);
      c.globalAlpha=Math.min(1,t*2);
      drawImg(c,img,W,H);
      c.globalAlpha=1;
      for(let i=0;i<30;i++){
        const px=(Math.sin(i*137+t*3)*0.5+0.5)*W;
        const py=((i/30+t*0.5)%1)*H;
        const r=Math.random()*3+1;
        c.beginPath(); c.arc(px,py,r,0,Math.PI*2);
        c.fillStyle=`hsla(${140+i*10},80%,70%,.8)`; c.fill();
      }
    }},

  // ── 25. MOSAICO ──────────────────────────────────────
  { nombre:'Mosaico', emoji:'🧩', bg:'#000',
    render(c,img,t,W,H){
      const cols=8, rows=14;
      const cw=W/cols, ch=H/rows;
      for(let r=0;r<rows;r++){
        for(let col=0;col<cols;col++){
          const delay=(r+col)/(rows+cols);
          const lt=Math.min(1,Math.max(0,(t-delay*0.6)/0.4));
          if(lt<=0) continue;
          c.save();
          c.globalAlpha=lt;
          c.rect(col*cw,r*ch,cw,ch); c.clip();
          drawImg(c,img,W,H);
          c.restore();
        }
      }
    }},

  // ── 26. CINE SCOPE ───────────────────────────────────
  { nombre:'Cine Scope', emoji:'🎬', bg:'#000',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      const bar=H*0.12;
      c.fillStyle='#000';
      c.fillRect(0,0,W,bar);
      c.fillRect(0,H-bar,W,bar);
    }},

  // ── 27. ONDAS ────────────────────────────────────────
  { nombre:'Ondas', emoji:'🌊', bg:'#001428',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      c.strokeStyle='rgba(52,211,153,.4)';
      c.lineWidth=3;
      for(let i=0;i<5;i++){
        c.beginPath();
        for(let x=0;x<=W;x+=8){
          const y=H*0.5+Math.sin((x/W*4+t*3+i*0.5)*Math.PI)*40;
          i===0&&x===0?c.moveTo(x,y):c.lineTo(x,y);
        }
        c.stroke();
      }
    }},

  // ── 28. CRISTAL ──────────────────────────────────────
  { nombre:'Cristal', emoji:'💎', bg:'#0a1628',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      c.globalAlpha=0.3;
      const pts=[[0,0,W/2,H/3,0,H/2],[W,0,W/2,H/3,W,H/2],
                 [0,H,W/2,H*2/3,0,H/2],[W,H,W/2,H*2/3,W,H/2]];
      pts.forEach((p,i)=>{
        c.beginPath();
        c.moveTo(p[0],p[1]); c.lineTo(p[2],p[3]); c.lineTo(p[4],p[5]);
        c.closePath();
        c.fillStyle=`hsla(${200+i*20},60%,70%,.${2+i%3})`;
        c.fill();
      });
      c.globalAlpha=1;
    }},

  // ── 29. TILT SHIFT ───────────────────────────────────
  { nombre:'Tilt Shift', emoji:'📸', bg:'#000',
    render(c,img,t,W,H){
      drawImg(c,img,W,H);
      c.filter='blur(6px)';
      c.save(); c.rect(0,0,W,H*0.25); c.clip(); drawImg(c,img,W,H); c.restore();
      c.save(); c.rect(0,H*0.75,W,H*0.25); c.clip(); drawImg(c,img,W,H); c.restore();
      c.filter='none';
    }},

  // ── 30. PRISMA ───────────────────────────────────────
  { nombre:'Prisma RGB', emoji:'🔴🟢🔵', bg:'#000',
    render(c,img,t,W,H){
      const d=Math.sin(t*Math.PI)*8;
      c.globalCompositeOperation='screen';
      c.globalAlpha=0.9;
      c.filter='blur(1px)';
      c.save(); c.translate(-d,0); c.globalAlpha=0.85;
      drawImg(c,img,W,H); c.restore();
      c.save(); c.translate(d,d*0.5);
      drawImg(c,img,W,H); c.restore();
      c.save(); c.translate(d*0.5,-d);
      drawImg(c,img,W,H); c.restore();
      c.globalCompositeOperation='source-over';
      c.filter='none'; c.globalAlpha=1;
    }},

  // ── 31. BOKEH ────────────────────────────────────────
  { nombre:'Bokeh', emoji:'🌸', bg:'#0d001a',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      for(let i=0;i<20;i++){
        const px=(Math.sin(i*73)*0.5+0.5)*W;
        const py=(Math.cos(i*37)*0.5+0.5)*H;
        const r=(20+Math.sin(t*2+i)*15);
        const g2=c.createRadialGradient(px,py,0,px,py,r);
        g2.addColorStop(0,`hsla(${280+i*20},80%,80%,.35)`);
        g2.addColorStop(1,'transparent');
        c.fillStyle=g2; c.beginPath();
        c.arc(px,py,r,0,Math.PI*2); c.fill();
      }
    }},

  // ── 32. FUEGO ────────────────────────────────────────
  { nombre:'Fuego', emoji:'🔥', bg:'#1a0500',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      const g=c.createLinearGradient(0,H,0,H*0.4);
      g.addColorStop(0,'rgba(200,50,0,.7)');
      g.addColorStop(0.4,'rgba(255,120,0,.3)');
      g.addColorStop(1,'rgba(255,200,0,0)');
      c.fillStyle=g; c.fillRect(0,0,W,H);
    }},

  // ── 33. HIELO ────────────────────────────────────────
  { nombre:'Hielo', emoji:'❄️', bg:'#e8f4ff',
    render(c,img,t,W,H){
      c.fillStyle='#e8f4ff'; c.fillRect(0,0,W,H);
      c.globalAlpha=Math.min(1,t*2);
      c.filter='brightness(1.1) saturate(70%)';
      drawImg(c,img,W,H);
      c.filter='none'; c.globalAlpha=1;
      const ig=c.createLinearGradient(0,0,W,H);
      ig.addColorStop(0,'rgba(180,220,255,.35)');
      ig.addColorStop(1,'rgba(100,160,220,.1)');
      c.fillStyle=ig; c.fillRect(0,0,W,H);
    }},

  // ── 34. MATRIX ───────────────────────────────────────
  { nombre:'Matrix', emoji:'💻', bg:'#000',
    render(c,img,t,W,H){
      c.fillStyle='rgba(0,0,0,.08)'; c.fillRect(0,0,W,H);
      c.fillStyle='#00ff41';
      c.font='14px monospace';
      for(let i=0;i<30;i++){
        const x=(i/30)*W;
        const y=((t*3+i*0.3)%1)*H;
        c.fillText(Math.random()<0.5?'1':'0',x,y);
      }
      c.globalAlpha=Math.min(0.85,t*2);
      drawImg(c,img,W,H);
      c.globalAlpha=1;
    }},

  // ── 35. DUOTONO VERDE ────────────────────────────────
  { nombre:'Duotono', emoji:'🟩', bg:'#1a6b3c',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      c.globalCompositeOperation='multiply';
      c.fillStyle='rgba(26,107,60,.5)';
      c.fillRect(0,0,W,H);
      c.globalCompositeOperation='source-over';
    }},

  // ── 36. ESPEJO ───────────────────────────────────────
  { nombre:'Espejo', emoji:'🪞', bg:'#000',
    render(c,img,t,W,H){
      c.globalAlpha=Math.min(1,t*2.5);
      drawImg(c,img,W,H/2);
      c.save(); c.scale(1,-1); c.translate(0,-H);
      c.globalAlpha*=0.4;
      drawImg(c,img,W,H/2);
      c.restore();
      c.globalAlpha=1;
      const rg=c.createLinearGradient(0,H/2,0,H);
      rg.addColorStop(0,'rgba(0,0,0,0)');
      rg.addColorStop(1,'rgba(0,0,0,.95)');
      c.fillStyle=rg; c.fillRect(0,H/2,W,H/2);
    }},

  // ── 37. PAPEL RASGADO ────────────────────────────────
  { nombre:'Papel', emoji:'📄', bg:'#f5f0e8',
    render(c,img,t,W,H){
      c.fillStyle='#f5f0e8'; c.fillRect(0,0,W,H);
      const reveal=easeOut(t)*H;
      c.save(); c.rect(0,0,W,reveal); c.clip();
      drawImg(c,img,W,H);
      c.restore();
      c.beginPath(); c.moveTo(0,reveal);
      for(let x=0;x<=W;x+=20){
        c.lineTo(x, reveal + (Math.sin(x*0.1)*8));
      }
      c.lineTo(W,reveal); c.strokeStyle='rgba(0,0,0,.15)';
      c.lineWidth=2; c.stroke();
    }},

  // ── 38. STARBURST ────────────────────────────────────
  { nombre:'Starburst', emoji:'⭐', bg:'#fff8c0',
    render(c,img,t,W,H){
      fadoImg(c,img,t,W,H,'cover');
      c.save(); c.translate(W/2,H/2);
      const rays=16;
      for(let i=0;i<rays;i++){
        const angle=(i/rays)*Math.PI*2 + t*0.5;
        const len=Math.min(W,H)*0.9*(0.5+Math.sin(t*Math.PI)*0.5);
        const a=Math.sin(t*Math.PI)*0.15;
        c.globalAlpha=a;
        c.strokeStyle='rgba(255,220,50,.8)';
        c.lineWidth=4;
        c.beginPath(); c.moveTo(0,0);
        c.lineTo(Math.cos(angle)*len, Math.sin(angle)*len);
        c.stroke();
      }
      c.restore(); c.globalAlpha=1;
    }},

  // ── 39. CINEMATICO ───────────────────────────────────
  { nombre:'Cinemático', emoji:'🎥', bg:'#000',
    render(c,img,t,W,H){
      const pan=Math.sin(t*Math.PI)*30;
      c.save(); c.translate(pan,0);
      drawImgScaled(c,img,W,H,1.08);
      c.restore();
      c.globalAlpha=Math.min(1,(1-t)*6,t*6)*0.3;
      c.fillStyle='#000'; c.fillRect(0,0,W,H);
      c.globalAlpha=1;
      const bar=H*0.1;
      c.fillStyle='#000';
      c.fillRect(0,0,W,bar); c.fillRect(0,H-bar,W,bar);
    }},

  // ── 40. NOCHE ESTRELLADA ─────────────────────────────
  { nombre:'Noche', emoji:'🌙', bg:'#000814',
    render(c,img,t,W,H){
      c.fillStyle='#000814'; c.fillRect(0,0,W,H);
      for(let i=0;i<80;i++){
        const sx=(Math.sin(i*97)*0.5+0.5)*W;
        const sy=(Math.cos(i*53)*0.5+0.5)*H;
        const a=(Math.sin(t*3+i)*0.5+0.5)*0.8+0.1;
        c.fillStyle=`rgba(255,255,255,${a})`;
        c.fillRect(sx,sy,Math.random()<0.1?2:1,Math.random()<0.1?2:1);
      }
      c.globalAlpha=Math.min(0.9,t*2);
      drawImg(c,img,W,H);
      c.globalAlpha=1;
    }},

  // ── 41. EXPLOSIÓN ────────────────────────────────────
  { nombre:'Explosión', emoji:'💥', bg:'#000',
    render(c,img,t,W,H){
      const s=0.01+easeOut(t)*1.1;
      c.globalAlpha=Math.min(1,t*3);
      drawImgScaled(c,img,W,H,s);
      c.globalAlpha=1;
      if(t<0.3){
        const a=(0.3-t)/0.3;
        c.fillStyle=`rgba(255,200,50,${a*0.6})`;
        c.fillRect(0,0,W,H);
      }
    }},

  // ── 42. TELEVISIÓN ───────────────────────────────────
  { nombre:'Televisión', emoji:'📡', bg:'#1a1a1a',
    render(c,img,t,W,H){
      const e=easeOut(t);
      const rw=W*e, rh=H*e;
      const rx=(W-rw)/2, ry=(H-rh)/2;
      c.save();
      roundRect(c,rx,ry,rw,rh,12);
      c.clip(); drawImg(c,img,W,H); c.restore();
      c.strokeStyle='rgba(255,255,255,.1)';
      c.lineWidth=3;
      roundRect(c,rx,ry,rw,rh,12);
      c.stroke();
    }},

  // ── 43. KALEIDOSCOPIO ────────────────────────────────
  { nombre:'Kaleidos.', emoji:'🔮', bg:'#000',
    render(c,img,t,W,H){
      const segs=6;
      c.save(); c.translate(W/2,H/2);
      for(let i=0;i<segs;i++){
        c.save();
        c.rotate((i/segs)*Math.PI*2+t*0.3);
        c.beginPath();
        c.moveTo(0,0);
        c.arc(0,0,W*0.7,0,Math.PI*2/segs);
        c.closePath(); c.clip();
        c.translate(-W/2,-H/2);
        c.globalAlpha=Math.min(1,t*2);
        drawImg(c,img,W,H);
        c.restore();
      }
      c.restore(); c.globalAlpha=1;
    }},

  // ── 44. AMANECER ─────────────────────────────────────
  { nombre:'Amanecer', emoji:'🌄', bg:'#ff6b35',
    render(c,img,t,W,H){
      const g=c.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#ff6b35');
      g.addColorStop(0.5,'#ffa07a');
      g.addColorStop(1,'#1a1a2e');
      c.fillStyle=g; c.fillRect(0,0,W,H);
      c.globalAlpha=easeOut(t);
      drawImg(c,img,W,H);
      c.globalAlpha=1;
      const og=c.createLinearGradient(0,0,0,H);
      og.addColorStop(0,'rgba(255,107,53,.4)');
      og.addColorStop(1,'rgba(26,26,46,.6)');
      c.fillStyle=og; c.fillRect(0,0,W,H);
    }},

  // ── 45. CONFETI ──────────────────────────────────────
  { nombre:'Confeti', emoji:'🎉', bg:'#fff',
    render(c,img,t,W,H){
      c.fillStyle='#fff'; c.fillRect(0,0,W,H);
      c.globalAlpha=Math.min(1,t*2);
      drawImg(c,img,W,H);
      c.globalAlpha=1;
      const cols=['#ff4136','#2ecc40','#0074d9','#ffdc00','#b10dc9','#ff69b4'];
      for(let i=0;i<60;i++){
        const cx=(Math.sin(i*137)*0.5+0.5)*W;
        const cy=((t+i/60)%1)*H;
        const r=6+i%5;
        c.fillStyle=cols[i%cols.length];
        c.globalAlpha=0.85;
        c.save();
        c.translate(cx,cy);
        c.rotate(t*5+i);
        c.fillRect(-r/2,-r/4,r,r/2);
        c.restore();
      }
      c.globalAlpha=1;
    }},

];  // fin PLANTILLAS

// ══════════════════════════════════════════════════════════
//  HELPERS DE DIBUJO
// ══════════════════════════════════════════════════════════
function easeOut(t){ return 1 - Math.pow(1-t,3); }

function drawImg(c,img,W,H){
  if(!img) return;
  const ir=img.naturalWidth/img.naturalHeight;
  const cr=W/H;
  let sx,sy,sw,sh;
  if(ir>cr){ sh=img.naturalHeight; sw=sh*cr; sx=(img.naturalWidth-sw)/2; sy=0; }
  else     { sw=img.naturalWidth;  sh=sw/cr; sx=0; sy=(img.naturalHeight-sh)/2; }
  c.drawImage(img,sx,sy,sw,sh,0,0,W,H);
}

function drawImgScaled(c,img,W,H,scale){
  if(!img) return;
  const sw=W*scale, sh=H*scale;
  const ox=(W-sw)/2, oy=(H-sh)/2;
  const ir=img.naturalWidth/img.naturalHeight;
  const cr=W/H;
  let sx,sy,siw,sih;
  if(ir>cr){ sih=img.naturalHeight; siw=sih*cr; sx=(img.naturalWidth-siw)/2; sy=0; }
  else     { siw=img.naturalWidth;  sih=siw/cr; sx=0; sy=(img.naturalHeight-sih)/2; }
  c.drawImage(img,sx,sy,siw,sih,ox,oy,sw,sh);
}

function drawImgRect(c,img,x,y,w,h){
  if(!img) return;
  const ir=img.naturalWidth/img.naturalHeight;
  const cr=w/h;
  let sx,sy,sw,sh;
  if(ir>cr){ sh=img.naturalHeight; sw=sh*cr; sx=(img.naturalWidth-sw)/2; sy=0; }
  else     { sw=img.naturalWidth;  sh=sw/cr; sx=0; sy=(img.naturalHeight-sh)/2; }
  c.drawImage(img,sx,sy,sw,sh,x,y,w,h);
}

function fadoImg(c,img,t,W,H){
  c.globalAlpha = Math.min(1, t*2.5);
  drawImg(c,img,W,H);
  c.globalAlpha = 1;
}

function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y);
  c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h);   c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r);     c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
}

// ══════════════════════════════════════════════════════════
//  CARGA DE IMÁGENES
// ══════════════════════════════════════════════════════════
function cargarImagen(url){
  return new Promise(resolve=>{
    if(imgsCargadas[url]){ resolve(imgsCargadas[url]); return; }
    const img=new Image();
    img.crossOrigin='anonymous'; // CORS anónimo → evita canvas tainted → captureStream sin SecurityError
    img.onload=()=>{ imgsCargadas[url]=img; resolve(img); };
    img.onerror=()=>resolve(null);
    img.src=url;
  });
}

// ══════════════════════════════════════════════════════════
//  MOTOR DE ANIMACIÓN
//  t siempre calculado con performance.now() real → animación
//  determinista aunque el RAF varíe entre 58–62 fps.
// ══════════════════════════════════════════════════════════
function calcularSlide(elapsed){
  const n = seleccionados.length;
  if(!n) return { idx:0, t:0 };
  const porSlide = duracionSeg / n;
  const idx      = Math.min(Math.floor(elapsed / porSlide), n - 1);
  const tLocal   = elapsed - idx * porSlide;
  const t        = Math.min(tLocal / porSlide, 1);
  return { idx, t };
}

let _imgActual   = null;
let _idxActual   = -1;
let _imgPendiente= null;

function precargarSiguiente(idxActual){
  const next = idxActual + 1;
  if(next < seleccionados.length)
    _imgPendiente = cargarImagen(seleccionados[next].url);
}

const FADE_SEG = 0.25;

function _renderFrame(){
  const elapsed = (performance.now() / 1000) - tiempoInicio;

  if(!grabando && elapsed >= duracionSeg){ detenerPreview(); return; }

  const ec = Math.min(elapsed, duracionSeg - 0.001);
  const n  = seleccionados.length;
  if(!n) return;

  const { idx, t } = calcularSlide(ec);

  if(idx !== _idxActual){
    _idxActual = idx;
    const url  = seleccionados[idx]?.url;
    _imgActual = url ? (imgsCargadas[url] || null) : null;
    if(url && !_imgActual) cargarImagen(url);
    precargarSiguiente(idx);
  }

  const pl = PLANTILLAS[plantillaActual];
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle = pl.bg; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  ctx.save(); pl.render(ctx, _imgActual, t, CANVAS_W, CANVAS_H); ctx.restore();

  // Crossfade
  const restante = (duracionSeg/n) - t*(duracionSeg/n);
  if(restante < FADE_SEG && idx + 1 < n){
    const ni = imgsCargadas[seleccionados[idx+1]?.url] || null;
    if(ni){
      const fa = Math.min(1, Math.max(0, 1 - restante/FADE_SEG));
      ctx.save(); ctx.globalAlpha=fa; pl.render(ctx,ni,0,CANVAS_W,CANVAS_H); ctx.restore();
    }
  }
}

function loop(){
  animFrame = requestAnimationFrame(loop);
  _renderFrame();
}

async function iniciarPreview(){
  if(!seleccionados.length){ toast('Selecciona al menos 1 imagen','warn'); return; }
  detenerPreview();
  const sinCache = seleccionados.filter(p => !imgsCargadas[p.url]);
  if (sinCache.length) _mostrarLoader('Cargando imágenes…');
  await Promise.all(seleccionados.map(p=>cargarImagen(p.url)));
  _ocultarLoader();
  tiempoInicio = performance.now()/1000;
  _idxActual=-1; _imgActual=null; _imgPendiente=null;
  document.getElementById('vidPlaceholder').style.display='none';
  _arrancarAudioPreview();
  loop();
}

function detenerPreview(){
  if(animFrame){ cancelAnimationFrame(animFrame); animFrame=null; }
  _pararAudioPreview();
}

// ── Audio preview — sin crossOrigin, sin AudioContext ────
function _arrancarAudioPreview(){
  _pararAudioPreview();
  const url = audioUrlBanco || window._audiosBancoActivo?.url || null;
  if(!url && !audioFile) return;
  try{
    const el  = new Audio();
    el.loop   = true;
    el.volume = volumen;
    el.src    = audioFile ? URL.createObjectURL(audioFile) : url;
    if(audioFile) el._objUrl = el.src;
    _previewSrc = el;
    el.play().catch(e=>console.warn('Audio preview:', e));
  } catch(e){ console.warn('Preview audio error:', e); }
}

function _pararAudioPreview(){
  try{
    if(_previewSrc instanceof HTMLAudioElement){
      _previewSrc.pause();
      if(_previewSrc._objUrl) URL.revokeObjectURL(_previewSrc._objUrl);
      _previewSrc.src=''; _previewSrc=null;
    }
  } catch(_){}
  try{ if(_previewActx){ _previewActx.close(); _previewActx=null; } } catch(_){}
  _previewGain=null;
}

// ══════════════════════════════════════════════════════════
//  GRABACIÓN / EXPORTACIÓN
//
//  AUDIO SIN CORS — SOLUCIÓN DEFINITIVA:
//  soundhelix.com y Jamendo no envían CORS headers.
//  El proxy PHP (audios.php?accion=proxy&url=...) descarga
//  el MP3 en el servidor y lo sirve desde tu dominio con
//  Access-Control-Allow-Origin: *  →  fetch() funciona.
//  Para archivos locales se usa FileReader (sin red, sin CORS).
//
//  FPS — POR QUÉ 60 PUEDE VERSE MAL:
//  captureStream(60) pide 60fps pero el compositor del navegador
//  puede bajar a 30 si la GPU está ocupada. El MediaRecorder
//  graba los timestamps reales, no los declarados, así que el
//  video puede quedar a 28-58fps irregulares. Para producción
//  estable se recomienda 30fps; aquí mantenemos 60 porque en
//  máquinas modernas funciona bien.
// ══════════════════════════════════════════════════════════
async function grabar(){
  if(!seleccionados.length){ toast('Selecciona imágenes primero','warn'); return; }
  if(grabando) return;

  _mostrarLoader('Preparando video…');
  await Promise.all(seleccionados.map(p=>cargarImagen(p.url)));

  grabando=true; chunks=[]; actualizarBotonesGrabar(true);

  let stream;
  try {
    stream = canvas.captureStream(FPS);
  } catch(secErr) {
    _ocultarLoader();
    toast('Error de seguridad en canvas. Recarga la página (F5).', 'warn');
    grabando=false; actualizarBotonesGrabar(false);
    return;
  }
  const urlBancoFinal = audioUrlBanco || window._audiosBancoActivo?.url || null;
  const hayAudio      = !!(audioFile || urlBancoFinal);

  let _grabActx=null, _grabSrcNode=null;

  if(hayAudio){
    try{
      _grabActx = new AudioContext({ sampleRate:44100 });
      let arrayBuf = null;

      if(audioFile){
        // Archivo local: FileReader, cero red, cero CORS
        arrayBuf = await new Promise((res,rej)=>{
          const fr=new FileReader();
          fr.onload=e=>res(e.target.result); fr.onerror=rej;
          fr.readAsArrayBuffer(audioFile);
        });
      } else {
        // URL externa: proxy PHP del mismo servidor → mismo origen → sin CORS
        try{
          const token    = await getToken();
          const proxyUrl = `${API_AUDIOS}?accion=proxy&token=${encodeURIComponent(token)}&url=${encodeURIComponent(urlBancoFinal)}`;
          _mostrarLoader('Cargando audio…');
          const resp = await fetch(proxyUrl, { credentials:'include' });
          if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
          arrayBuf = await resp.arrayBuffer();
        } catch(fe){
          console.warn('Proxy audio falló:', fe);
        }
      }

      if(arrayBuf && arrayBuf.byteLength > 1000){
        const audioBuf  = await _grabActx.decodeAudioData(arrayBuf);
        const dest      = _grabActx.createMediaStreamDestination();
        const gain      = _grabActx.createGain();
        gain.gain.value = volumen;
        _grabSrcNode    = _grabActx.createBufferSource();
        _grabSrcNode.buffer = audioBuf;
        _grabSrcNode.loop   = true;
        _grabSrcNode.connect(gain);
        gain.connect(dest);
        gain.connect(_grabActx.destination);
        _grabSrcNode.start(0);
        const track = dest.stream.getAudioTracks()[0];
        if(track) stream.addTrack(track);
        toast('Grabando con audio 🎵');
      } else {
        toast('Grabando (sin audio — proxy no disponible)','warn');
      }
    } catch(e){
      console.warn('Audio de grabación no disponible:', e);
      toast('Grabando (sin audio)','warn');
    }
  }

  _ocultarLoader();

  // ── Formato ───────────────────────────────────────────
  // IMPORTANTE: avc1 SIEMPRE antes que avc3.
  // avc1 = compatible con WhatsApp, Facebook, iOS, Android.
  // avc3 = solo navegadores modernos, rechazado por WhatsApp.
  const tieneAudio = stream.getAudioTracks().length > 0;
  window._giTieneAudio = tieneAudio;
  const mime =
    (tieneAudio && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) ? 'video/mp4;codecs=avc1,mp4a.40.2' :
    (tieneAudio && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.5')) ? 'video/mp4;codecs=avc1,mp4a.40.5' :
    (tieneAudio && MediaRecorder.isTypeSupported('video/mp4;codecs=avc3,mp4a.40.2')) ? 'video/mp4;codecs=avc3,mp4a.40.2' :
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')                           ? 'video/mp4;codecs=avc1'            :
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc3')                           ? 'video/mp4;codecs=avc3'            :
    MediaRecorder.isTypeSupported('video/mp4')                                       ? 'video/mp4'                        :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')                      ? 'video/webm;codecs=vp9,opus'       :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9')                           ? 'video/webm;codecs=vp9'            :
                                                                                       'video/webm';

  _ocultarLoader();
  mediaRec = new MediaRecorder(stream, { mimeType:mime, videoBitsPerSecond:8_000_000 });
  mediaRec.ondataavailable = e=>{ if(e.data.size>0) chunks.push(e.data); };
  mediaRec.onstop = ()=>{
    try{ if(_grabSrcNode){ _grabSrcNode.stop(); _grabSrcNode=null; } } catch(_){}
    try{ if(_grabActx)   { _grabActx.close();  _grabActx=null;    } } catch(_){}
    _ocultarLoader(); grabando=false; actualizarBotonesGrabar(false); exportar(mime);
  };
  mediaRec.start(33); // chunk cada ~33ms ≈ 1 frame a 30fps mínimo

  // Arrancar render loop
  detenerPreview();
  tiempoInicio=performance.now()/1000; _idxActual=-1; _imgActual=null;
  document.getElementById('vidPlaceholder').style.display='none';
  loop();

  // Barra de progreso
  const progBar=document.getElementById('vidProgFill');
  const progTxt=document.getElementById('vidProgTxt');
  const progWrap=document.getElementById('vidProgWrap');
  progWrap.classList.add('visible');
  const ini=performance.now();
  const tick=()=>{
    if(!grabando) return;
    const pct=Math.min(100,((performance.now()-ini)/(duracionSeg*1000))*100);
    progBar.style.width=pct+'%';
    progTxt.textContent=`Grabando… ${Math.round(pct)}%`;
    if(pct<100) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  setTimeout(()=>{
    if(mediaRec && mediaRec.state!=='inactive') mediaRec.stop();
    detenerPreview();
    progWrap.classList.remove('visible');
  }, duracionSeg*1000);
}

async function exportar(mime){
  const blob     = new Blob(chunks, {type: mime});
  const ts       = Date.now();
  const conAudio = mime.includes('mp4a') || mime.includes('opus') || (window._giTieneAudio === true);
  const ext      = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const esAvc1   = mime.includes('avc1');

  // ══ NIVEL 1: Servidor con FFmpeg (solo en local/desarrollo) ════
  const _esLocal = ['localhost','127.0.0.1'].includes(location.hostname) || location.hostname.endsWith('.local');
  if (_esLocal && mime.startsWith('video/mp4')) {
    try {
      _mostrarLoader('Optimizando video…');
      const token = await getToken();
      const form  = new FormData();
      form.append('video', blob, `video-${ts}.mp4`);
      form.append('token', token);
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 90_000);
      const resp = await fetch('../backend/convertir_video.php', {
        method: 'POST', credentials: 'include', body: form, signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (resp.ok) {
        const outBlob = await resp.blob();
        _ocultarLoader();
        if (outBlob.size > 1000) {
          _descargar(outBlob, `GIStore-video-${ts}.mp4`);
          toast('¡Video listo! ✅ Compatible con WhatsApp y Facebook' + (conAudio ? ' 🎵' : ''), 'ok');
          return;
        }
      } else {
        const ct  = resp.headers.get('Content-Type') || '';
        const err = ct.includes('json') ? await resp.json().catch(()=>({})) : {};
        if (err.error === 'upload_vacio' || err.error === 'archivo_muy_grande') {
          _ocultarLoader();
          _mostrarModalError(err, blob, ts, ext, mime);
          return;
        }
        console.warn('Servidor FFmpeg falló:', err);
      }
    } catch(e) {
      console.warn('Fetch convertir_video falló:', e.message);
    }
    _ocultarLoader();
  }

  // ══ NIVEL 1.5: FFmpeg.wasm single-thread (solo en producción) ════
  // Usa @ffmpeg/core-mt con modo sin Worker — no requiere SharedArrayBuffer
  // ni COEP/COOP, funciona en cualquier hosting compartido.
  if (!_esLocal && mime.startsWith('video/mp4')) {
    try {
      _mostrarLoader('Cargando motor de conversión…');

      // Archivos alojados en el mismo origen → sin bloqueo cross-origin
      const _ffBase = location.origin + '/user/libs/ffmpeg-wasm';
      if (!window._ffmpegLoaded) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = `${_ffBase}/ffmpeg.js`;
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        window._ffmpegLoaded = true;
      }

      const { FFmpeg } = window.FFmpegWASM;
      const ffwasm = new FFmpeg();
      ffwasm.on('progress', ({ progress }) => {
        _mostrarLoader(`Convirtiendo video… ${Math.round(progress * 100)}%`);
      });

      // Worker y core desde el mismo origen → sin bloqueo COEP
      await ffwasm.load({
        coreURL  : `${_ffBase}/ffmpeg-core.js`,
        wasmURL  : `${_ffBase}/ffmpeg-core.wasm`,
        workerURL: `${_ffBase}/814.ffmpeg.js`,
      });

      const inName  = `in_${ts}.mp4`;
      const outName = `out_${ts}.mp4`;
      await ffwasm.writeFile(inName, new Uint8Array(await blob.arrayBuffer()));
      _mostrarLoader('Convirtiendo video… 0%');

      // Si ya es avc1 → solo remux + faststart (segundos)
      // Si es avc3/webm → re-codificar a baseline (compatible WhatsApp)
      const _yaEsAvc1 = mime.includes('avc1');
      const _videoArgs = _yaEsAvc1
        ? ['-c:v', 'copy']
        : ['-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
           '-pix_fmt', 'yuv420p', '-r', '30',
           '-vf', 'scale=720:1280:flags=lanczos'];
      const _audioArgs = conAudio
        ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2']
        : ['-an'];
      await ffwasm.exec([
        '-i', inName,
        ..._videoArgs,
        '-movflags', '+faststart',
        ..._audioArgs,
        outName,
      ]);

      const outData = await ffwasm.readFile(outName);
      await ffwasm.deleteFile(inName);
      await ffwasm.deleteFile(outName);

      const outBlob = new Blob([outData.buffer], { type: 'video/mp4' });
      _ocultarLoader();
      if (outBlob.size > 1000) {
        _descargar(outBlob, `GIStore-video-${ts}.mp4`);
        toast('¡Video listo! ✅ Compatible con WhatsApp y Facebook' + (conAudio ? ' 🎵' : ''), 'ok');
        return;
      }
    } catch(e) {
      console.warn('FFmpeg.wasm falló, usando fallback:', e.message);
      _ocultarLoader();
    }
  }

  // ══ NIVEL 2: Faststart en el navegador (sin servidor) ══
  // Mueve el moov atom al inicio del MP4 en JS puro.
  // Funciona en cualquier hosting sin FFmpeg.
  if (mime.startsWith('video/mp4')) {
    try {
      _mostrarLoader('Preparando para WhatsApp…');
      const fixed = await _mp4Faststart(blob);
      _ocultarLoader();
      if (fixed) {
        _descargar(fixed, `GIStore-video-${ts}.mp4`);
        toast('¡Video listo!' + (esAvc1 ? ' ✅ Compatible con WhatsApp' : '') + (conAudio ? ' 🎵' : ''), 'ok');
        return;
      }
    } catch(e) {
      console.warn('Faststart browser falló:', e);
      _ocultarLoader();
    }
  }

  // ══ NIVEL 3: Descarga directa (fallback final) ══════════
  _descargar(blob, `GIStore-video-${ts}.${ext}`);
  toast(`Video descargado. ${esAvc1 ? '✅' : '⚠️ Puede no ser compatible con WhatsApp.'}`, esAvc1 ? 'ok' : 'warn');
}

// ── Faststart en navegador: mueve moov antes de mdat ───────
async function _mp4Faststart(blob) {
  const buf   = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const boxes = _parseMp4Boxes(bytes);
  const moov  = boxes.find(b => b.type === 'moov');
  const mdat  = boxes.find(b => b.type === 'mdat');
  if (!moov || !mdat) return null;
  if (moov.offset < mdat.offset) return blob; // ya está en orden
  const ftyp     = boxes.find(b => b.type === 'ftyp');
  const shift    = moov.size;
  const moovBytes = new Uint8Array(buf, moov.offset, moov.size).slice();
  _patchStco(moovBytes, shift);
  const partes = [];
  if (ftyp) partes.push(new Uint8Array(buf, ftyp.offset, ftyp.size));
  partes.push(moovBytes);
  for (const box of boxes) {
    if (box.type === 'ftyp' || box.type === 'moov') continue;
    partes.push(new Uint8Array(buf, box.offset, box.size));
  }
  return new Blob(partes, { type: 'video/mp4' });
}

function _parseMp4Boxes(bytes) {
  const boxes = [];
  let i = 0;
  while (i + 8 <= bytes.length) {
    const size = (bytes[i]<<24)|(bytes[i+1]<<16)|(bytes[i+2]<<8)|bytes[i+3];
    const type = String.fromCharCode(bytes[i+4],bytes[i+5],bytes[i+6],bytes[i+7]);
    if (size < 8 || i + size > bytes.length) break;
    boxes.push({ type, offset: i, size });
    i += size;
  }
  return boxes;
}

function _patchStco(moovBytes, shift) {
  let i = 0;
  const containers = new Set(['moov','trak','mdia','minf','stbl','udta','edts']);
  while (i + 8 <= moovBytes.length) {
    const size = (moovBytes[i]<<24)|(moovBytes[i+1]<<16)|(moovBytes[i+2]<<8)|moovBytes[i+3];
    const type = String.fromCharCode(moovBytes[i+4],moovBytes[i+5],moovBytes[i+6],moovBytes[i+7]);
    if (size < 8 || i + size > moovBytes.length) break;
    if (type === 'stco') {
      const count = (moovBytes[i+12]<<24)|(moovBytes[i+13]<<16)|(moovBytes[i+14]<<8)|moovBytes[i+15];
      for (let e = 0; e < count; e++) {
        const p = i + 16 + e * 4;
        const nw = ((moovBytes[p]<<24)|(moovBytes[p+1]<<16)|(moovBytes[p+2]<<8)|moovBytes[p+3]) + shift;
        moovBytes[p]=(nw>>>24)&0xff; moovBytes[p+1]=(nw>>>16)&0xff;
        moovBytes[p+2]=(nw>>>8)&0xff; moovBytes[p+3]=nw&0xff;
      }
    } else if (type === 'co64') {
      const count = (moovBytes[i+12]<<24)|(moovBytes[i+13]<<16)|(moovBytes[i+14]<<8)|moovBytes[i+15];
      for (let e = 0; e < count; e++) {
        const p = i + 16 + e * 8;
        const nw = ((moovBytes[p+4]<<24)|(moovBytes[p+5]<<16)|(moovBytes[p+6]<<8)|moovBytes[p+7]) + shift;
        moovBytes[p+4]=(nw>>>24)&0xff; moovBytes[p+5]=(nw>>>16)&0xff;
        moovBytes[p+6]=(nw>>>8)&0xff; moovBytes[p+7]=nw&0xff;
      }
    }
    i += containers.has(type) ? 8 : size;
  }
}

// ── Modal de error con instrucciones ───────────────────────
function _mostrarModalError(err, blob, ts, ext, mime){
  _descargar(blob, `GIStore-video-${ts}.${ext}`);
  const codigo = err.error || '';
  const ERRORES = {
    'upload_vacio':      { titulo: '📦 Video demasiado grande (límite PHP: 2MB)', codigo: 'sudo nano /etc/php/8.4/apache2/php.ini\n# upload_max_filesize = 200M\n# post_max_size = 200M\nsudo service apache2 restart' },
    'archivo_muy_grande':{ titulo: '📦 Video demasiado grande', codigo: 'upload_max_filesize = 200M\npost_max_size = 200M' },
  };
  const info = ERRORES[codigo] || { titulo: '⚠️ Error en el servidor', codigo: `ffmpeg -i GIStore-video-${ts}.${ext} -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -r 30 -movflags +faststart -c:a aac output-wa.mp4` };
  const modal = document.createElement('div');
  modal.id = '_vidModalError';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem;';
  modal.innerHTML = `<div style="background:var(--superficie,#1e2a35);color:var(--texto,#fff);border-radius:16px;padding:2rem;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5);max-height:90vh;overflow-y:auto;"><h3 style="margin:0 0 .75rem">${info.titulo}</h3><pre style="background:rgba(0,0,0,.5);border-radius:8px;padding:.875rem;font-size:.75rem;color:#34d399;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin:0 0 1rem">${info.codigo}</pre><p style="margin:0 0 1.25rem;font-size:.8rem;color:var(--texto-suave,#aaa)">También convierte en <a href="https://convertio.co/es/mp4-mp4/" target="_blank" style="color:#34d399">convertio.co</a></p><button onclick="document.getElementById('_vidModalError').remove()" style="width:100%;padding:.75rem;border:none;border-radius:10px;background:var(--primario,#34d399);color:#000;font-weight:700;cursor:pointer;">Entendido</button></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

// ── Helper: descarga un Blob ────────────────────────────────
function _descargar(blob, filename){
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 8000);
}

function actualizarBotonesGrabar(estoyGrabando){
  document.getElementById('btnGrabar').disabled   =  estoyGrabando;
  document.getElementById('btnPreview').disabled  =  estoyGrabando;
  document.getElementById('btnCancelar').style.display= estoyGrabando?'inline-flex':'none';
}

// ══════════════════════════════════════════════════════════
//  UI — PRODUCTOS
// ══════════════════════════════════════════════════════════
function renderProductos(prods){
  const wrap=document.getElementById('vidProductosGrid');
  wrap.innerHTML='';

  if(!prods.length){
    wrap.innerHTML='<p style="font-size:.82rem;color:var(--texto-suave);padding:.5rem 0;grid-column:1/-1">Sin productos con imagen.</p>';
    return;
  }

  prods.forEach(p=>{
    const div=document.createElement('div');
    div.className='vid-prod-item';
    div.dataset.id=p.id;
    div.innerHTML=`
      <img src="${p.url}" alt="${p.nombre}" loading="lazy"
           onerror="this.parentElement.style.display='none'">
      <div class="vid-prod-check">✓</div>
      <div class="vid-prod-num">${p.nombre}</div>`;
    div.addEventListener('click',()=>toggleProducto(div,p));
    wrap.appendChild(div);
  });
}

function toggleProducto(el,p){
  const idx=seleccionados.findIndex(s=>s.id===p.id);
  if(idx>=0){
    seleccionados.splice(idx,1);
    el.classList.remove('sel');
  } else {
    if(seleccionados.length>=12){ toast('Máximo 12 imágenes','warn'); return; }
    seleccionados.push(p);
    el.classList.add('sel');
  }
  actualizarContador();
  if(animFrame) iniciarPreview();
}

function actualizarContador(){
  document.getElementById('vidSelCount').textContent=seleccionados.length;
}

// ══════════════════════════════════════════════════════════
//  UI — PLANTILLAS
// ══════════════════════════════════════════════════════════
function renderPlantillas(){
  const wrap=document.getElementById('vidPlantillasGrid');
  wrap.innerHTML='';
  PLANTILLAS.forEach((p,i)=>{
    const div=document.createElement('div');
    div.className='vid-plantilla-card'+(i===0?' activa':'');
    div.innerHTML=`
      <div class="vid-plantilla-preview" style="background:${p.bg||'#111'}">${p.emoji}</div>
      <div class="vid-plantilla-nombre">${p.nombre}</div>`;
    div.addEventListener('click',()=>{
      document.querySelectorAll('.vid-plantilla-card').forEach(c=>c.classList.remove('activa'));
      div.classList.add('activa');
      plantillaActual=i;
      if(animFrame) iniciarPreview();
    });
    wrap.appendChild(div);
  });
}

// ══════════════════════════════════════════════════════════
//  UI — DURACIÓN
// ══════════════════════════════════════════════════════════
function initDuracion(){
  document.querySelectorAll('.vid-dur-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.vid-dur-btn').forEach(b=>b.classList.remove('activo'));
      btn.classList.add('activo');
      duracionSeg=parseInt(btn.dataset.dur);
      if(animFrame) iniciarPreview();
    });
  });
}

// ══════════════════════════════════════════════════════════
//  UI — AUDIO (banco Jamendo + archivo propio)
// ══════════════════════════════════════════════════════════
function initAudio(){
  const zona = document.getElementById('vidAudioZona');
  const inp  = document.getElementById('vidAudioInput');
  const vol  = document.getElementById('vidVolumen');

  // ── Inicializar banco de audios (audios-banco.js) ─────
  if(typeof window.initBancoAudios === 'function'){
    window.initBancoAudios(getToken);

    // Cuando el usuario selecciona/quita una pista del banco,
    // sincronizar con la variable audioUrlBanco de este módulo
    window._onAudioBancoChange = (pista) => {
      if(pista){
        audioUrlBanco = pista.url;
        audioFile     = null; // banco tiene prioridad sobre archivo propio
        zona.textContent = '🎵 Audio del banco seleccionado';
        zona.classList.add('tiene-audio');
      } else {
        audioUrlBanco = null;
        zona.textContent = '🎵 Toca para añadir música propia';
        zona.classList.remove('tiene-audio');
      }
    };
  }

  // ── Archivo propio (anula el banco) ───────────────────
  zona.addEventListener('click',()=>inp.click());
  inp.addEventListener('change',e=>{
    audioFile = e.target.files[0] || null;
    if(audioFile){
      // Archivo propio anula banco
      audioUrlBanco = null;
      window._audiosBancoActivo = null;
      // Deseleccionar pista del banco visualmente
      document.querySelectorAll('.vab-pista.seleccionada').forEach(el => el.classList.remove('seleccionada'));
      document.getElementById('vabActiva') && (document.getElementById('vabActiva').style.display='none');
      zona.textContent = `🎵 ${audioFile.name}`;
      zona.classList.add('tiene-audio');
    } else {
      zona.textContent = '🎵 Toca para añadir música propia';
      zona.classList.remove('tiene-audio');
    }
  });

  vol.addEventListener('input',()=>{
    volumen = parseFloat(vol.value);
    // Actualizar volumen del preview directamente en el elemento de audio
    if(_previewSrc instanceof HTMLAudioElement) _previewSrc.volume = volumen;
  });
}

// ══════════════════════════════════════════════════════════
//  BLOQUEO POR MEMBRESÍA
// ══════════════════════════════════════════════════════════
function mostrarBloqueoMembresia(){
  // Ocultar toda la UI de videos y mostrar mensaje
  const grid = document.querySelector('.vid-grid');
  if(grid){
    grid.innerHTML = `
      <div style="
        grid-column:1/-1;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:1.25rem;padding:3rem 1rem;text-align:center;
      ">
        <span class="material-symbols-outlined" style="font-size:3.5rem;color:var(--primario)">workspace_premium</span>
        <h2 style="margin:0;font-size:1.4rem">Membresía requerida</h2>
        <p style="margin:0;color:var(--texto-suave);max-width:380px;line-height:1.6">
          Para crear videos publicitarios necesitas una membresía activa.
          Activa o renueva tu membresía y regresa a esta sección.
        </p>
        <a href="membresia.html" class="vid-btn vid-btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:.5rem">
          <span class="material-symbols-outlined">rocket_launch</span>
          Activar membresía
        </a>
      </div>
    `;
  }
}

// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  LOADER OVERLAY
// ══════════════════════════════════════════════════════════
function _mostrarLoader(msg) {
  let el = document.getElementById('_vidLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = '_vidLoader';
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.1rem;color:#fff;font-family:inherit';
    el.innerHTML = `
      <style>@keyframes _vs{to{transform:rotate(360deg)}}</style>
      <div style="width:52px;height:52px;border-radius:50%;border:4px solid rgba(255,255,255,.15);border-top-color:var(--primario,#34d399);animation:_vs .75s linear infinite"></div>
      <span id="_vidLoaderTxt" style="font-size:.88rem;font-weight:600;letter-spacing:.03em;opacity:.9"></span>
    `;
    document.body.appendChild(el);
  }
  el.querySelector('#_vidLoaderTxt').textContent = msg || '';
  el.style.display = 'flex';
}
function _ocultarLoader() {
  const el = document.getElementById('_vidLoader');
  if (el) el.style.display = 'none';
}

let _toastTimer=null;
function toast(msg,tipo=''){
  let el=document.getElementById('vidToast');
  if(!el){ el=document.createElement('div'); el.id='vidToast'; el.className='vid-toast'; document.body.appendChild(el); }
  el.textContent=msg;
  el.className='vid-toast '+(tipo||'');
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>el.classList.add('show')); });
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  NOTA: MP4 nativo vía MediaRecorder (Chrome 130+ / Edge)
//  No se necesita FFmpeg.wasm ni SharedArrayBuffer.
//  En Firefox se descarga WebM, que Instagram y WhatsApp aceptan.
// ══════════════════════════════════════════════════════════

async function init(){
  // Fecha
  const fEl=document.getElementById('fechaHoy');
  if(fEl) fEl.textContent=new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  const token = await getToken();

  // ── 1. Verificar membresía PRIMERO ───────────────────
  try{
    const rMem = await fetch(`${API_MEMBRESIAS}?accion=estado&token=${encodeURIComponent(token)}`, { credentials:'include' });
    const dMem = await rMem.json();

    // PHP retorna: { ok: true, datos: { membresia: { estado: 'activa'|'vencida'|null }, ... } }
    const estado = dMem?.datos?.membresia?.estado ?? null;
    membresiaActiva = dMem.ok && estado === 'activa';
  } catch(e){
    console.warn('No se pudo verificar membresía:', e);
    membresiaActiva = false;
  }

  if(!membresiaActiva){
    mostrarBloqueoMembresia();
    return; // ← Detener init: no montar el resto de la UI
  }

  // ── 2. Montar UI solo si membresía activa ────────────
  document.getElementById('btnPreview').addEventListener('click', iniciarPreview);
  document.getElementById('btnDetener').addEventListener('click',()=>{
    detenerPreview();
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    document.getElementById('vidPlaceholder').style.display='flex';
  });
  document.getElementById('btnGrabar').addEventListener('click', grabar);
  document.getElementById('btnCancelar').addEventListener('click',()=>{
    if(mediaRec&&mediaRec.state!=='inactive') mediaRec.stop();
    detenerPreview();
    grabando=false;
    actualizarBotonesGrabar(false);
    document.getElementById('vidProgWrap').classList.remove('visible');
    toast('Grabación cancelada','warn');
  });

  renderPlantillas();
  initDuracion();
  initAudio();

  // ── 3. Cargar productos ───────────────────────────────
  const grid=document.getElementById('vidProductosGrid');
  grid.innerHTML='<div class="vid-skeleton"></div>'.repeat(6);

  try{
    const r=await fetch(`${API_VIDEOS}?accion=imagenes&token=${encodeURIComponent(token)}`,{credentials:'include'});
    const d=await r.json();
    if(!d.ok) throw new Error(d.error);
    todosProductos=d.datos;
    renderProductos(todosProductos);
    const nomEl=document.getElementById('vendedorNombre');
    if(nomEl&&d.vendedor) nomEl.textContent=d.vendedor;
  } catch(e){
    document.getElementById('vidProductosGrid').innerHTML=
      `<p style="grid-column:1/-1;font-size:.82rem;color:var(--error)">Error al cargar productos: ${e.message}</p>`;
  }
}

init();