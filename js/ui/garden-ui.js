// 灵兽园界面 - 产出 + 分解（宠物/符文）
import { SPECIES, RUNE_SLOTS, RUNE_SETS, RUNE_QUALITY } from '../constants/index.js';
import { gameState } from '../state.js';
import { showToast } from '../utils.js';
import { addToGarden, removeFromGarden, calcPetDecomposeGold, calcRuneDecomposeGold,
         decomposePet, batchDecomposePets, decomposeRune, batchDecomposeRunes } from '../systems/garden.js';
import { renderHeader } from './header-ui.js';

// === 状态 ===
let _gardenTab = 'garden'; // garden | petDecomp | runeDecomp
let _decompPetSelected = new Set();
let _decompRuneSelected = new Set();
let _decompPetFilter = 'all'; // all | low (D/C级)
let _decompRuneFilter = 'all'; // all | white | green | blue

// 防抖
let _gardenRAF = 0;
function scheduleRender() {
  if (_gardenRAF) cancelAnimationFrame(_gardenRAF);
  _gardenRAF = requestAnimationFrame(() => { _gardenRAF = 0; renderGarden(); });
}

// === 灵兽园产出 ===
window._addToGarden = function(petId) {
  if (addToGarden(petId)) {
    showToast('已入驻灵兽园', 'info');
    scheduleRender();
  } else {
    showToast('无法添加（已满/已在出战/已入驻）', 'info');
  }
};

window._removeFromGarden = function(petId) {
  removeFromGarden(petId);
  showToast('已离开灵兽园', 'info');
  scheduleRender();
};

// === 分解操作 ===
window._toggleDecompPet = function(petId) {
  if (_decompPetSelected.has(petId)) _decompPetSelected.delete(petId);
  else _decompPetSelected.add(petId);
  scheduleRender();
};

window._toggleDecompRune = function(runeId) {
  if (_decompRuneSelected.has(runeId)) _decompRuneSelected.delete(runeId);
  else _decompRuneSelected.add(runeId);
  scheduleRender();
};

window._decomposeSelectedPets = function() {
  if (_decompPetSelected.size === 0) { showToast('没有选中的宠物', 'info'); return; }
  const ids = [..._decompPetSelected];
  const result = batchDecomposePets(ids);
  _decompPetSelected.clear();
  showToast('分解了 ' + result.count + ' 只宠物，获得 ' + result.totalGold + ' 金币!', 'loot');
  renderGarden();
  renderHeader();
};

window._decomposeSelectedRunes = function() {
  if (_decompRuneSelected.size === 0) { showToast('没有选中的符文', 'info'); return; }
  const ids = [..._decompRuneSelected];
  const result = batchDecomposeRunes(ids);
  _decompRuneSelected.clear();
  showToast('分解了 ' + result.count + ' 个符文，获得 ' + result.totalGold + ' 金币!', 'loot');
  renderGarden();
  renderHeader();
};

window._selectAllDecompPets = function() {
  const pets = getDecompPets();
  const allSelected = pets.length > 0 && pets.every(p => _decompPetSelected.has(p.id));
  if (allSelected) { _decompPetSelected.clear(); }
  else { pets.forEach(p => _decompPetSelected.add(p.id)); }
  scheduleRender();
};

window._selectLowAptPets = function(maxGrade) {
  const aptVal = { D: 0, C: 1, B: 2, A: 3, S: 4, 'S+': 5 };
  const threshold = (aptVal[maxGrade] || 1) * 4;
  gameState.pets.forEach(p => {
    if (gameState.formation.indexOf(p) >= 0) return;
    if (gameState.garden.indexOf(p.id) >= 0) return;
    const score = (aptVal[p.apts.hp] || 0) + (aptVal[p.apts.atk] || 0)
      + (aptVal[p.apts.def] || 0) + (aptVal[p.apts.spd] || 0);
    if (score <= threshold) _decompPetSelected.add(p.id);
  });
  scheduleRender();
};

window._selectAllDecompRunes = function() {
  const runes = getDecompRunes();
  const allSelected = runes.length > 0 && runes.every(r => _decompRuneSelected.has(r.id));
  if (allSelected) { _decompRuneSelected.clear(); }
  else { runes.forEach(r => _decompRuneSelected.add(r.id)); }
  scheduleRender();
};

window._selectRunesByQuality = function(quality) {
  gameState.runes.forEach(r => {
    if (!r.equippedTo && r.quality === quality) _decompRuneSelected.add(r.id);
  });
  scheduleRender();
};

window._setGardenTab = function(tab) {
  _gardenTab = tab;
  _decompPetSelected.clear();
  _decompRuneSelected.clear();
  scheduleRender();
};

window._setDecompPetFilter = function(f) {
  _decompPetFilter = f;
  scheduleRender();
};

window._setDecompRuneFilter = function(f) {
  _decompRuneFilter = f;
  scheduleRender();
};

// === 筛选逻辑 ===
function getDecompPets() {
  return gameState.pets.filter(p => {
    if (gameState.formation.indexOf(p) >= 0) return false;
    if (gameState.garden.indexOf(p.id) >= 0) return false;
    if (_decompPetFilter === 'low') {
      const aptVal = { D: 0, C: 1, B: 2, A: 3, S: 4, 'S+': 5 };
      const score = (aptVal[p.apts.hp] || 0) + (aptVal[p.apts.atk] || 0)
        + (aptVal[p.apts.def] || 0) + (aptVal[p.apts.spd] || 0);
      return score <= 8; // C级及以下
    }
    return true;
  });
}

function getDecompRunes() {
  return gameState.runes.filter(r => {
    if (r.equippedTo) return false;
    if (_decompRuneFilter !== 'all' && r.quality !== _decompRuneFilter) return false;
    return true;
  });
}

// === 渲染 ===
export function renderGarden() {
  const el = document.getElementById('garden-list');
  if (!el) return;
  if (!gameState.garden) gameState.garden = [];
  el.innerHTML = '';

  // Tab栏
  const tabBar = document.createElement('div');
  tabBar.className = 'garden-tab-bar';
  [['garden', '🏡 灵兽园'], ['petDecomp', '🔥 分解宠物'], ['runeDecomp', '💎 分解符文']].forEach(([key, label]) => {
    const btn = document.createElement('button');
    btn.className = 'garden-tab-btn' + (_gardenTab === key ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => window._setGardenTab(key);
    tabBar.appendChild(btn);
  });
  el.appendChild(tabBar);

  if (_gardenTab === 'garden') renderGardenPanel(el);
  else if (_gardenTab === 'petDecomp') renderPetDecompPanel(el);
  else if (_gardenTab === 'runeDecomp') renderRuneDecompPanel(el);
}

function renderGardenPanel(el) {
  const desc = document.createElement('p');
  desc.style.cssText = 'color:#888;font-size:12px;margin:8px 0;';
  desc.textContent = '闲置宠物入驻灵兽园，每30秒产出金币和材料（上限5只）';
  el.appendChild(desc);

  // 入驻中
  if (gameState.garden.length > 0) {
    const h = document.createElement('h4');
    h.style.color = '#4caf50';
    h.textContent = '入驻中 (' + gameState.garden.length + '/5)';
    el.appendChild(h);

    gameState.garden.forEach(petId => {
      const pet = gameState.pets.find(p => p.id === petId);
      if (!pet) return;
      const sp = SPECIES[pet.speciesId];
      const div = document.createElement('div');
      div.className = 'garden-slot occupied';
      div.innerHTML = '<span>' + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level + '</span>'
        + '<span style="color:#ffd700;font-size:11px;">产出: ' + Math.floor(pet.level * 0.5 + 1) + '金/30s</span>'
        + ' <button class="btn-sm" onclick="window._removeFromGarden(' + petId + ')">召回</button>';
      el.appendChild(div);
    });
  }

  // 可入驻
  const available = gameState.pets.filter(p =>
    gameState.formation.indexOf(p) < 0 &&
    (!gameState.garden || gameState.garden.indexOf(p.id) < 0)
  );

  if (available.length > 0 && gameState.garden.length < 5) {
    const addDiv = document.createElement('div');
    const h = document.createElement('h4');
    h.style.cssText = 'color:#aaa;margin-top:12px;';
    h.textContent = '可入驻';
    addDiv.appendChild(h);

    available.forEach(pet => {
      const sp = SPECIES[pet.speciesId];
      const item = document.createElement('div');
      item.className = 'garden-slot';
      item.innerHTML = '<span>' + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level + '</span>'
        + ' <button class="btn-sm" onclick="window._addToGarden(' + pet.id + ')">入驻</button>';
      addDiv.appendChild(item);
    });
    el.appendChild(addDiv);
  }
}

function renderPetDecompPanel(el) {
  const desc = document.createElement('p');
  desc.style.cssText = 'color:#888;font-size:12px;margin:8px 0;';
  desc.textContent = '分解多余宠物获得金币。出战和灵兽园中的宠物不可分解。';
  el.appendChild(desc);

  // 筛选栏
  const filterBar = document.createElement('div');
  filterBar.className = 'skill-filter-bar';
  [['all', '全部'], ['low', 'C级及以下']].forEach(([key, label]) => {
    const btn = document.createElement('button');
    btn.className = 'skill-filter-btn' + (_decompPetFilter === key ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => window._setDecompPetFilter(key);
    filterBar.appendChild(btn);
  });
  el.appendChild(filterBar);

  // 快选栏
  const quickBar = document.createElement('div');
  quickBar.className = 'skill-filter-bar';
  quickBar.style.marginTop = '4px';

  const selAllBtn = document.createElement('button');
  selAllBtn.className = 'btn-sm';
  selAllBtn.style.cssText = 'background:#1976d2;color:#fff;';
  selAllBtn.textContent = '全选当前';
  selAllBtn.onclick = () => window._selectAllDecompPets();
  quickBar.appendChild(selAllBtn);

  [['D', '快选D级以下'], ['C', '快选C级以下']].forEach(([grade, label]) => {
    const btn = document.createElement('button');
    btn.className = 'btn-sm';
    btn.style.cssText = 'background:#ff9800;color:#fff;';
    btn.textContent = label;
    btn.onclick = () => window._selectLowAptPets(grade);
    quickBar.appendChild(btn);
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn-sm';
  clearBtn.textContent = '清空';
  clearBtn.onclick = () => { _decompPetSelected.clear(); scheduleRender(); };
  quickBar.appendChild(clearBtn);
  el.appendChild(quickBar);

  // 宠物列表
  const pets = getDecompPets();
  if (pets.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = 'color:#555;text-align:center;padding:16px;';
    emptyMsg.textContent = '没有可分解的宠物';
    el.appendChild(emptyMsg);
  } else {
    const list = document.createElement('div');
    list.className = 'decomp-list';

    pets.forEach(pet => {
      const sp = SPECIES[pet.speciesId];
      const gold = calcPetDecomposeGold(pet);
      const selected = _decompPetSelected.has(pet.id);
      const div = document.createElement('div');
      div.className = 'decomp-item' + (selected ? ' selected' : '');
      div.onclick = () => window._toggleDecompPet(pet.id);
      div.innerHTML = '<div class="decomp-item-left">'
        + '<span class="decomp-check">' + (selected ? '☑' : '☐') + '</span>'
        + '<span class="decomp-name">' + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level + '</span>'
        + '<span class="decomp-apt">' + pet.apts.hp + '/' + pet.apts.atk + '/' + pet.apts.def + '/' + pet.apts.spd + '</span>'
        + '</div>'
        + '<span class="decomp-gold">+' + gold + '💰</span>';
      list.appendChild(div);
    });
    el.appendChild(list);
  }

  // 底部操作栏
  if (_decompPetSelected.size > 0) {
    let totalGold = 0;
    _decompPetSelected.forEach(id => {
      const pet = gameState.pets.find(p => p.id === id);
      if (pet) totalGold += calcPetDecomposeGold(pet);
    });

    const bottomBar = document.createElement('div');
    bottomBar.className = 'decomp-bottom-bar';
    bottomBar.innerHTML = '<span>已选 ' + _decompPetSelected.size + ' 只，预计获得 <b style="color:#ffd700;">' + totalGold + '</b> 金币</span>';
    const execBtn = document.createElement('button');
    execBtn.className = 'btn-sm';
    execBtn.style.cssText = 'background:#e94560;color:#fff;padding:8px 16px;font-size:14px;';
    execBtn.textContent = '确认分解';
    execBtn.onclick = () => window._decomposeSelectedPets();
    bottomBar.appendChild(execBtn);
    el.appendChild(bottomBar);
  }
}

function renderRuneDecompPanel(el) {
  const desc = document.createElement('p');
  desc.style.cssText = 'color:#888;font-size:12px;margin:8px 0;';
  desc.textContent = '分解多余符文获得金币。已装备的符文会自动卸下后分解。';
  el.appendChild(desc);

  // 筛选栏
  const filterBar = document.createElement('div');
  filterBar.className = 'skill-filter-bar';
  [['all', '全部'], ['white', '白'], ['green', '绿'], ['blue', '蓝']].forEach(([key, label]) => {
    const btn = document.createElement('button');
    btn.className = 'skill-filter-btn' + (_decompRuneFilter === key ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => window._setDecompRuneFilter(key);
    filterBar.appendChild(btn);
  });
  el.appendChild(filterBar);

  // 快选栏
  const quickBar = document.createElement('div');
  quickBar.className = 'skill-filter-bar';
  quickBar.style.marginTop = '4px';

  const selAllBtn = document.createElement('button');
  selAllBtn.className = 'btn-sm';
  selAllBtn.style.cssText = 'background:#1976d2;color:#fff;';
  selAllBtn.textContent = '全选当前';
  selAllBtn.onclick = () => window._selectAllDecompRunes();
  quickBar.appendChild(selAllBtn);

  [['white', '全选白'], ['green', '全选绿']].forEach(([q, label]) => {
    const btn = document.createElement('button');
    btn.className = 'btn-sm';
    btn.style.cssText = 'background:#ff9800;color:#fff;';
    btn.textContent = label;
    btn.onclick = () => window._selectRunesByQuality(q);
    quickBar.appendChild(btn);
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn-sm';
  clearBtn.textContent = '清空';
  clearBtn.onclick = () => { _decompRuneSelected.clear(); scheduleRender(); };
  quickBar.appendChild(clearBtn);
  el.appendChild(quickBar);

  // 符文列表（只显示未装备的）
  const runes = getDecompRunes();
  if (runes.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = 'color:#555;text-align:center;padding:16px;';
    emptyMsg.textContent = '没有可分解的未装备符文';
    el.appendChild(emptyMsg);
  } else {
    // 按品质排序
    const qualOrder = { gold: 0, purple: 1, blue: 2, green: 3, white: 4 };
    runes.sort((a, b) => (qualOrder[a.quality] || 5) - (qualOrder[b.quality] || 5));

    const list = document.createElement('div');
    list.className = 'decomp-list';

    runes.forEach(rune => {
      const set = RUNE_SETS[rune.setId];
      const qual = RUNE_QUALITY[rune.quality];
      const slot = RUNE_SLOTS[rune.slotType];
      const gold = calcRuneDecomposeGold(rune);
      const selected = _decompRuneSelected.has(rune.id);

      const div = document.createElement('div');
      div.className = 'decomp-item' + (selected ? ' selected' : '');
      div.style.borderLeft = '3px solid ' + qual.color;
      div.onclick = () => window._toggleDecompRune(rune.id);
      div.innerHTML = '<div class="decomp-item-left">'
        + '<span class="decomp-check">' + (selected ? '☑' : '☐') + '</span>'
        + '<span class="decomp-name" style="color:' + qual.color + ';">' + (set ? set.name : '') + ' ' + slot.name + ' +' + rune.level + '</span>'
        + '<span class="decomp-apt">' + qual.label + '</span>'
        + '</div>'
        + '<span class="decomp-gold">+' + gold + '💰</span>';
      list.appendChild(div);
    });
    el.appendChild(list);
  }

  // 底部操作栏
  if (_decompRuneSelected.size > 0) {
    let totalGold = 0;
    _decompRuneSelected.forEach(id => {
      const rune = gameState.runes.find(r => r.id === id);
      if (rune) totalGold += calcRuneDecomposeGold(rune);
    });

    const bottomBar = document.createElement('div');
    bottomBar.className = 'decomp-bottom-bar';
    bottomBar.innerHTML = '<span>已选 ' + _decompRuneSelected.size + ' 个，预计获得 <b style="color:#ffd700;">' + totalGold + '</b> 金币</span>';
    const execBtn = document.createElement('button');
    execBtn.className = 'btn-sm';
    execBtn.style.cssText = 'background:#e94560;color:#fff;padding:8px 16px;font-size:14px;';
    execBtn.textContent = '确认分解';
    execBtn.onclick = () => window._decomposeSelectedRunes();
    bottomBar.appendChild(execBtn);
    el.appendChild(bottomBar);
  }
}
