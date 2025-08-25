import { SEED_X, SEED_Y, DEFAULT_MINE_PERCENT } from "./constants.js";
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const coordEl = document.getElementById('coords');

let CELL = 16;
function setZoom(newCell){
  CELL = Math.max(1, Math.min(64, newCell));
  render();
}
function zoom(factor){ setZoom(CELL * factor); }

let px = 0, py = 0; // позиция игрока в мире
let exploding = false; // взрыв в процессе
let defuseMode = false; // режим разминирования
const flagged = new Set(); // отмеченные мины

// посещённые области
const revealed = new Set();
function floodReveal(x, y){
  const stack = [[x, y]];
  while(stack.length){
    const [cx, cy] = stack.pop();
    const key = cx + "," + cy;
    if(revealed.has(key) || isWall(cx, cy) || isMine(cx, cy)) continue;
    revealed.add(key);
    if(countAdjacentMines(cx, cy) === 0){
      for(let dx=-1; dx<=1; dx++){
        for(let dy=-1; dy<=1; dy++){
          if(dx===0 && dy===0) continue;
          stack.push([cx+dx, cy+dy]);
        }
      }
    }
  }
}
floodReveal(px, py);

// псевдослучайные стены
function isWall(x,y){
  if ((x===0 && y===0) || (Math.abs(x)+Math.abs(y)===1)) return false;
  const v = (x*SEED_X ^ y*SEED_Y) >>> 0;
  return (v % 100) < 0; // ~15% стен
}

// псевдослучайные мины
function isMine(x,y){
  if ((x===0 && y===0) || (Math.abs(x)+Math.abs(y)===1)) return false;
  const v = (x*SEED_X ^ y*SEED_Y ^ 0xdeadbeef) >>> 0;
  return (v % 100) < DEFAULT_MINE_PERCENT; // процент мин
}

function countAdjacentMines(x, y){
  let count = 0;
  for(let dx=-1; dx<=1; dx++){
    for(let dy=-1; dy<=1; dy++){
      if(dx===0 && dy===0) continue;
      const nx=x+dx, ny=y+dy;
      if(!isWall(nx,ny) && isMine(nx,ny)) count++;
    }
  }
  return count;
}

function autoRevealAround(x, y){
  const total = countAdjacentMines(x, y);
  let flaggedCount = 0;
  for(let dx=-1; dx<=1; dx++){
    for(let dy=-1; dy<=1; dy++){
      if(dx===0 && dy===0) continue;
      const key = (x+dx)+","+(y+dy);
      if(flagged.has(key)) flaggedCount++;
    }
  }
  if(flaggedCount === total){
    for(let dx=-1; dx<=1; dx++){
      for(let dy=-1; dy<=1; dy++){
        if(dx===0 && dy===0) continue;
        const nx = x+dx, ny = y+dy;
        const key = nx+","+ny;
        if(flagged.has(key) || revealed.has(key)) continue;
        floodReveal(nx, ny);
      }
    }
  }
}

function moveBy(dx, dy){
  if (exploding) return;
  const nx = px + dx, ny = py + dy;
  if (isWall(nx, ny)) return;

  const ox = px, oy = py;
  px = nx; py = ny;
  if (defuseMode){
    if (isMine(px, py)){
      flagged.add(nx+","+ny);
      revealed.add(nx+","+ny);
      px = ox; py = oy;
      floodReveal(px, py);
      autoRevealAround(px, py);
    }else{
      px = 0; py = 0;
      floodReveal(px, py);
      autoRevealAround(px, py);
    }
    defuseMode = false;
    render();
    return;
  }

  floodReveal(px, py);
  const steppedMine = isMine(px, py);
  if (!steppedMine) autoRevealAround(px, py);
  if (steppedMine){
    exploding = true;
    render();
    drawExplosion();
    setTimeout(()=>{ px=0; py=0; floodReveal(px,py); exploding=false; render(); }, 500);
  }else{
    render();
  }
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // вычисляем окно мира
  const VIEW_COLS = Math.floor(canvas.width / CELL);
  const VIEW_ROWS = Math.floor(canvas.height / CELL);
  const halfC = Math.floor(VIEW_COLS/2);
  const halfR = Math.floor(VIEW_ROWS/2);
  const tlx = px - halfC, tly = py - halfR;
  const brx = tlx + VIEW_COLS - 1, bry = tly + VIEW_ROWS - 1;

  ctx.font = `${CELL*0.8}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // видимые клетки
  for(let gy=tly; gy<=bry; gy++){
    for(let gx=tlx; gx<=brx; gx++){
      const key=gx+","+gy;
      if(!revealed.has(key)) continue;
      const sx=(gx-tlx)*CELL, sy=(gy-tly)*CELL;

      ctx.fillStyle='#eee';
      ctx.fillRect(sx,sy,CELL,CELL);
      ctx.strokeStyle='#444';
      ctx.strokeRect(sx,sy,CELL,CELL);

      if (isWall(gx,gy)){
        ctx.fillStyle='#777';
        ctx.fillRect(sx+1,sy+1,CELL-2,CELL-2);
      }else if(isMine(gx,gy)){
        ctx.fillStyle='#f00';
        ctx.fillRect(sx+1,sy+1,CELL-2,CELL-2);
        if(flagged.has(key)){
          ctx.fillStyle='#fff';
          ctx.fillText('⚑', sx+CELL/2, sy+CELL/2);
        }
      }else{
        const mines=countAdjacentMines(gx,gy);
        if(mines>0){
          ctx.fillStyle='#000';
          ctx.fillText(mines, sx+CELL/2, sy+CELL/2);
        }
      }
    }
  }

  // игрок (в центре экрана)
  if(!exploding){
    const psx=(px-tlx)*CELL+1, psy=(py-tly)*CELL+1;
    ctx.fillStyle = defuseMode ? '#ff0' : '#3572ff';
    ctx.fillRect(psx,psy,CELL-2,CELL-2);
    const playerMines=countAdjacentMines(px,py);
    ctx.fillStyle=defuseMode ? '#000' : '#fff';
    ctx.fillText(playerMines, psx+CELL/2, psy+CELL/2);
  }

  const currentMines = countAdjacentMines(px,py);
  coordEl.textContent = `x: ${px}, y: ${py}, mines: ${currentMines}, mode: ${defuseMode?'defuse':'walk'}`;
}
render();

function drawExplosion(){
  const VIEW_COLS = Math.floor(canvas.width / CELL);
  const VIEW_ROWS = Math.floor(canvas.height / CELL);
  const halfC = Math.floor(VIEW_COLS/2);
  const halfR = Math.floor(VIEW_ROWS/2);
  const cx = halfC*CELL + CELL/2;
  const cy = halfR*CELL + CELL/2;
  const r = CELL/2 - 2;
  ctx.fillStyle = '#f00';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#ffa500';
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const angle = i * Math.PI/4;
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(angle)*r, cy+Math.sin(angle)*r);
  }
  ctx.stroke();
}


// клавиатура
window.addEventListener('keydown', e=>{
  let handled = true;
  if (e.key==='ArrowUp' || e.key==='w') moveBy(0,-1);
  else if (e.key==='ArrowDown' || e.key==='s') moveBy(0,1);
  else if (e.key==='ArrowLeft' || e.key==='a') moveBy(-1,0);
  else if (e.key==='ArrowRight' || e.key==='d') moveBy(1,0);
  else if (e.key==='+' || e.key==='=') zoom(1.1);
  else if (e.key==='-') zoom(0.9);
  else if (e.key===' ') { defuseMode = !defuseMode; render(); }
  else handled = false;
  if (handled) e.preventDefault();
});

// D-pad
let holdTimer=null;
function startHold(dx,dy){
  moveBy(dx,dy);
  stopHold();
  holdTimer=setInterval(()=>moveBy(dx,dy),140);
}
function stopHold(){ if(holdTimer){clearInterval(holdTimer);holdTimer=null;} }
document.querySelectorAll('.btn').forEach(btn=>{
  const dx=parseInt(btn.dataset.dx,10), dy=parseInt(btn.dataset.dy,10);
  btn.addEventListener('touchstart', ev=>{ev.preventDefault();startHold(dx,dy);},{passive:false});
  btn.addEventListener('touchend', ev=>{ev.preventDefault();stopHold();},{passive:false});
  btn.addEventListener('mousedown', ()=>startHold(dx,dy));
  window.addEventListener('mouseup', stopHold);
});

// свайпы
let swipeStart=null;
let pinchStartDist=null, pinchStartCell=CELL;
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===1){
    swipeStart={x:e.touches[0].clientX,y:e.touches[0].clientY,t:performance.now()};
  }else if(e.touches.length===2){
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    pinchStartDist=Math.hypot(dx,dy);
    pinchStartCell=CELL;
    swipeStart=null;
    e.preventDefault();
  }
},{passive:false});
canvas.addEventListener('touchmove', e=>{
  if(e.touches.length===2 && pinchStartDist){
    const dx=e.touches[0].clientX-e.touches[1].clientX;
    const dy=e.touches[0].clientY-e.touches[1].clientY;
    const dist=Math.hypot(dx,dy);
    setZoom(pinchStartCell*dist/pinchStartDist);
    e.preventDefault();
  }
},{passive:false});
canvas.addEventListener('touchend', e=>{
  if(e.touches.length<2) pinchStartDist=null;
  if(!swipeStart) return;
  const t=performance.now()-swipeStart.t;
  const touch=(e.changedTouches&&e.changedTouches[0])||null;
  if(touch){
    const dx=touch.clientX-swipeStart.x, dy=touch.clientY-swipeStart.y;
    const absX=Math.abs(dx), absY=Math.abs(dy);
    if(Math.max(absX,absY)>=24 && t<600){
      if(absX>absY) moveBy(dx>0?1:-1,0);
      else moveBy(0,dy>0?1:-1);
    }
  }
  swipeStart=null;
},{passive:true});

canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  zoom(e.deltaY<0?1.1:0.9);
},{passive:false});
