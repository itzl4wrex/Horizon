// Horizon: "Move widgets" mode.
// Lets you drag the clock, greeting, date, search bar, quick links, edit links, to-do and
// music bar anywhere on the page. Positions are stored as pixel offsets from each
// widget's default spot and applied through the CSS `translate` property, so they
// never fight with the existing layout or animations.
(function(){
  const KEY = 'horizon_layout';
  const WIDGETS = {
    time:  '.time',
    greeting: '.greeting',
    date: '.date-row',
    search: '.search-wrap',
    links: '.quick-links',
    editlinks: '.edit-links-btn#editLinksBtn',
    todo: '.mini-todo',
    music: '.music-bar'
  };
  const MARGIN = 6;
  const hasSync = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync);

  let layout = {};
  try{ layout = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ layout = {}; }

  const els = {};
  Object.keys(WIDGETS).forEach(id=>{
    const el = document.querySelector(WIDGETS[id]);
    if(el){ el.setAttribute('data-widget', id); els[id] = el; }
  });

  function persist(){
    try{ localStorage.setItem(KEY, JSON.stringify(layout)); }catch(e){}
    if(hasSync){ try{ chrome.storage.sync.set({ [KEY]: layout }); }catch(e){} }
  }

  function apply(id){
    const el = els[id]; if(!el) return;
    const p = layout[id];
    if(p && (p.x || p.y)){
      el.style.setProperty('--dx', p.x + 'px');
      el.style.setProperty('--dy', p.y + 'px');
    }else{
      el.style.removeProperty('--dx');
      el.style.removeProperty('--dy');
    }
  }

  // Keep a widget fully on screen given its default (un-offset) position.
  function clamp(id, x, y){
    const el = els[id];
    const r = el.getBoundingClientRect();
    const cur = layout[id] || { x:0, y:0 };
    const baseL = r.left - cur.x, baseT = r.top - cur.y;
    const minX = MARGIN - baseL, maxX = window.innerWidth - MARGIN - (baseL + r.width);
    const minY = MARGIN - baseT, maxY = window.innerHeight - MARGIN - (baseT + r.height);
    return {
      x: Math.round(Math.min(Math.max(x, Math.min(minX, maxX)), Math.max(minX, maxX))),
      y: Math.round(Math.min(Math.max(y, Math.min(minY, maxY)), Math.max(minY, maxY)))
    };
  }

  function applyAll(){
    Object.keys(els).forEach(id=>{
      if(layout[id] && els[id].getClientRects().length){
        layout[id] = clamp(id, layout[id].x, layout[id].y);
      }
      apply(id);
    });
  }

  // ---- Styles ----
  const style = document.createElement('style');
  style.textContent = `
    [data-widget]{ translate: var(--dx, 0px) var(--dy, 0px); }
    body.search-active .search-wrap{ translate: none; }
    body.layout-editing [data-widget]{
      outline: 2px dashed rgba(183,219,161,0.75);
      outline-offset: 6px;
      cursor: grab;
      touch-action: none;
      user-select: none; -webkit-user-select: none;
    }
    body.layout-editing [data-widget] *{ pointer-events: none !important; }
    body.layout-editing [data-widget].dragging{
      cursor: grabbing;
      outline-style: solid;
      z-index: 40;
      transition: none !important;
    }
    body.layout-editing .music-bar, body.layout-editing .mini-todo{ z-index: 8; }
    .layout-bar{
      position: fixed; top: calc(14px + env(safe-area-inset-top, 0px)); left: 50%;
      transform: translateX(-50%) translateY(-20px);
      z-index: 60; display: none; align-items: center; gap: 10px;
      padding: 8px 10px 8px 16px; border-radius: 999px;
      background: rgba(18,16,28,0.85); color: #f3e9d2;
      border: 1px solid rgba(243,233,210,0.25);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      font: 13px 'Space Grotesk', system-ui, sans-serif;
      opacity: 0; transition: opacity .2s ease, transform .2s ease;
      max-width: 94vw;
    }
    body.layout-editing .layout-bar{ display: flex; opacity: 1; transform: translateX(-50%); }
    .layout-bar button{
      font: inherit; cursor: pointer; border-radius: 999px; padding: 6px 14px;
      border: 1px solid rgba(243,233,210,0.25); background: rgba(255,255,255,0.08); color: inherit;
    }
    .layout-bar button:hover{ background: rgba(255,255,255,0.16); }
    .layout-bar .done{ background: #b7dba1; color: #16221a; border-color: transparent; font-weight: 600; }
    .layout-bar .done:hover{ background: #c6e6b2; }
    body.layout-editing.search-active .time,
    body.layout-editing.search-active .greeting,
    body.layout-editing.search-active .date-row,
    body.layout-editing.search-active .quick-links,
    body.layout-editing.search-active .edit-links-btn,
    body.layout-editing.search-active .mini-todo,
    body.layout-editing.search-active .music-bar{ opacity: 1; filter: none; }
    body.theme-light .layout-bar{ background: rgba(255,255,255,0.9); color: #222; border-color: rgba(0,0,0,0.15); }
    body.theme-light .layout-bar button{ border-color: rgba(0,0,0,0.15); background: rgba(0,0,0,0.05); }
    body.theme-light .layout-bar .done{ background: #4f8a3a; color: #fff; }
  `;
  document.head.appendChild(style);

  // ---- Toolbar shown while editing ----
  const bar = document.createElement('div');
  bar.className = 'layout-bar';
  bar.innerHTML = '<span>Drag widgets to move them</span>' +
    '<button type="button" class="reset">Reset</button>' +
    '<button type="button" class="done">Done</button>';
  document.body.appendChild(bar);

  function setEditing(on){
    document.body.classList.toggle('layout-editing', on);
    if(on){
      document.body.classList.remove('search-active');
      const ov = document.getElementById('overlay'); if(ov) ov.click(); // close any open panel
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
  }
  const isEditing = ()=> document.body.classList.contains('layout-editing');

  bar.querySelector('.done').addEventListener('click', ()=> setEditing(false));
  bar.querySelector('.reset').addEventListener('click', ()=>{
    // Resets the built-in widgets; custom shapes keep their spots.
    Object.keys(layout).forEach(id=>{ if(id.indexOf('shape_') !== 0) delete layout[id]; });
    try{ localStorage.removeItem(PRESET_KEY); }catch(e){}
    Object.keys(els).forEach(apply);
    persist();
  });

  // Entry points: floating button + settings row
  const floatBtn = document.createElement('button');
  floatBtn.className = 'bg-toggle';
  floatBtn.id = 'layoutToggle';
  floatBtn.type = 'button';
  floatBtn.title = 'Move widgets';
  floatBtn.setAttribute('aria-label', 'Move widgets');
  floatBtn.style.right = '110px';
  floatBtn.textContent = '✥';
  floatBtn.addEventListener('click', ()=> setEditing(!isEditing()));
  document.body.appendChild(floatBtn);

  const settingsBtn = document.getElementById('moveWidgetsBtn');
  if(settingsBtn) settingsBtn.addEventListener('click', ()=> setEditing(true));

  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && isEditing()) setEditing(false);
  });

  // ---- Dragging ----
  let drag = null;
  document.addEventListener('pointerdown', e=>{
    if(!isEditing() || e.button > 0) return;
    const el = e.target.closest && e.target.closest('[data-widget]');
    if(!el) return;
    e.preventDefault();
    const id = el.getAttribute('data-widget');
    const cur = layout[id] || { x:0, y:0 };
    drag = { id, el, startX: e.clientX, startY: e.clientY, ox: cur.x, oy: cur.y, pid: e.pointerId };
    el.classList.add('dragging');
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
  });
  document.addEventListener('pointermove', e=>{
    if(!drag || e.pointerId !== drag.pid) return;
    const c = clamp(drag.id, drag.ox + e.clientX - drag.startX, drag.oy + e.clientY - drag.startY);
    layout[drag.id] = c;
    apply(drag.id);
  });
  function endDrag(e){
    if(!drag || (e && e.pointerId !== drag.pid)) return;
    drag.el.classList.remove('dragging');
    const p = layout[drag.id];
    if(p && !p.x && !p.y) delete layout[drag.id];
    persist();
    drag = null;
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  // Block link clicks / form submits on widgets while arranging.
  document.addEventListener('click', e=>{
    if(isEditing() && e.target.closest && e.target.closest('[data-widget]')){
      e.preventDefault(); e.stopPropagation();
    }
  }, true);
  document.addEventListener('dragstart', e=>{ if(isEditing()) e.preventDefault(); });


  // ---- Ready-made layout presets ----
  // Presets are calculated from the widgets' current/default rectangles, so they
  // remain responsive across window sizes and can still be fine-tuned with Move widgets.
  const PRESET_KEY = 'horizon_layout_preset';

  const PRESETS = {
    centered: {
      name: 'Centered',
      desc: 'Balanced, distraction-free home screen',
      icon: 'fa-solid fa-bullseye',
      targets: {
        time:{x:.50,y:.29,anchor:'center'}, greeting:{x:.50,y:.40,anchor:'center'},
        date:{x:.50,y:.45,anchor:'center'}, search:{x:.50,y:.55,anchor:'center'},
        links:{x:.50,y:.69,anchor:'center'}, editlinks:{anchor:'below-links',gap:12}, todo:{x:.04,y:.06,anchor:'left-top'},
        music:{x:.50,y:.94,anchor:'center-bottom'}
      }
    },
    dashboard: {
      name: 'Dashboard', desc: 'Utility-first layout with a compact center',
      icon: 'fa-solid fa-table-cells-large',
      targets: {
        time:{x:.06,y:.10,anchor:'left-top'}, greeting:{x:.06,y:.24,anchor:'left-top'},
        date:{x:.06,y:.29,anchor:'left-top'}, search:{x:.72,y:.13,anchor:'center'},
        links:{x:.72,y:.33,anchor:'center'}, editlinks:{anchor:'below-links',gap:12}, todo:{x:.04,y:.52,anchor:'left-top'},
        music:{x:.50,y:.94,anchor:'center-bottom'}
      }
    },
    split: {
      name: 'Split',
      desc: 'Elegant two-column layout with a balanced center',
      icon: 'fa-solid fa-table-columns',
      targets: {
        time:{x:.28,y:.27,anchor:'center'}, greeting:{x:.28,y:.39,anchor:'center'},
        date:{x:.28,y:.44,anchor:'center'}, search:{x:.28,y:.54,anchor:'center'},
        links:{x:.72,y:.46,anchor:'center'}, editlinks:{anchor:'below-links',gap:12}, todo:{x:.04,y:.06,anchor:'left-top'},
        music:{x:.50,y:.94,anchor:'center-bottom'}
      }
    },
  };

  function presetTargetPoint(el, target){
    const r = el.getBoundingClientRect();
    if(target.anchor === 'below-links'){
      const linksEl = els.links;
      if(linksEl){
        const lr = linksEl.getBoundingClientRect();
        return {
          x: lr.left + (lr.width - r.width) / 2,
          y: lr.bottom + (target.gap || 12)
        };
      }
    }
    let tx = window.innerWidth * target.x, ty = window.innerHeight * target.y;
    if(target.anchor === 'center'){
      tx -= r.width / 2; ty -= r.height / 2;
    }else if(target.anchor === 'center-bottom'){
      tx -= r.width / 2; ty -= r.height;
    }
    return {x:tx,y:ty};
  }

  function applyPreset(name){
    const preset = PRESETS[name];
    if(!preset) return;
    Object.keys(els).forEach(id=>{
      els[id].style.removeProperty('--dx');
      els[id].style.removeProperty('--dy');
    });
    layout = {};
    requestAnimationFrame(()=>{
      Object.keys(preset.targets).filter(id=>id !== 'editlinks').forEach(id=>{
        const el = els[id];
        if(!el) return;
        const r = el.getBoundingClientRect();
        const target = presetTargetPoint(el, preset.targets[id]);
        layout[id] = clamp(id, target.x - r.left, target.y - r.top);
        apply(id);
      });
      // Place Edit Links after Quick Links has its real rendered height.
      if(els.editlinks && preset.targets.editlinks){
        const el = els.editlinks;
        const r = el.getBoundingClientRect();
        const target = presetTargetPoint(el, preset.targets.editlinks);
        layout.editlinks = clamp('editlinks', target.x - r.left, target.y - r.top);
        apply('editlinks');
      }
      try{ localStorage.setItem(PRESET_KEY, name); }catch(e){}
      persist();
      document.querySelectorAll('.layout-preset').forEach(btn=>{
        btn.classList.toggle('active', btn.dataset.preset === name);
      });
    });
  }

  window.HorizonPresets = {
    list(){ return PRESETS; },
    apply: applyPreset,
    current(){
      try{ return localStorage.getItem(PRESET_KEY) || 'centered'; }catch(e){ return 'centered'; }
    }
  };

  // Render the preset picker inside Settings.
  const presetGrid = document.getElementById('layoutPresetGrid');
  if(presetGrid){
    Object.keys(PRESETS).forEach(name=>{
      const p = PRESETS[name];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'layout-preset';
      btn.dataset.preset = name;
      btn.innerHTML =
        '<span class="layout-preset-icon"><i class="' + p.icon + '"></i></span>' +
        '<span class="layout-preset-copy"><strong>' + p.name + '</strong><small>' + p.desc + '</small></span>';
      btn.addEventListener('click', ()=>applyPreset(name));
      presetGrid.appendChild(btn);
    });
    const current = window.HorizonPresets.current();
    const active = presetGrid.querySelector('[data-preset="' + current + '"]');
    if(active) active.classList.add('active');
  }

  // ---- Public API (used by shapes.js for custom shape widgets) ----
  window.HorizonLayout = {
    register(id, el){ el.setAttribute('data-widget', id); els[id] = el; apply(id); },
    unregister(id){ delete els[id]; if(layout[id]){ delete layout[id]; persist(); } },
    setPos(id, x, y){ layout[id] = { x: Math.round(x), y: Math.round(y) }; apply(id); persist(); },
    getPos(id){ return layout[id] || { x:0, y:0 }; },
    setEditing,
    isEditing
  };

  // ---- Init ----
  applyAll();
  window.addEventListener('resize', ()=>{ applyAll(); });
  window.addEventListener('load', ()=>{ applyAll(); });

  // Pull layout synced from another device, if any.
  if(hasSync){
    try{
      chrome.storage.sync.get({ [KEY]: null }, res=>{
        if(res && res[KEY] && !Object.keys(layout).length){
          layout = res[KEY];
          try{ localStorage.setItem(KEY, JSON.stringify(layout)); }catch(e){}
          applyAll();
        }
      });
    }catch(e){}
  }
})();
