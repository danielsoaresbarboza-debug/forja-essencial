(function(root){
  'use strict';
  const KEY='ui-collapsed-sections-v1';
  function loadCollapsed(){
    try{ return JSON.parse(root.localStorage.getItem(KEY)||'{}'); }catch{ return {}; }
  }
  function saveCollapsed(state){
    try{ root.localStorage.setItem(KEY, JSON.stringify(state)); }catch{}
  }
  function toggleSection(id){
    const el = root.document.querySelector(`[data-section-id="${id}"]`);
    if(!el) return;
    const collapsed = el.classList.toggle('collapsed');
    const state = loadCollapsed();
    state[id] = collapsed;
    saveCollapsed(state);
  }
  function applyCollapsedState(){
    const state = loadCollapsed();
    root.document.querySelectorAll('[data-section-id]').forEach(el=>{
      const id = el.dataset.sectionId;
      const shouldCollapse = Object.prototype.hasOwnProperty.call(state, id) ? state[id] : el.dataset.defaultCollapsed === 'true';
      el.classList.toggle('collapsed', !!shouldCollapse);
    });
  }
  root.toggleSection = toggleSection;
  root.ForjaUiSections = { toggleSection, applyCollapsedState };
})(globalThis);
