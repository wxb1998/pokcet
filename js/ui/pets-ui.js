// 宠物列表 + 宠物详情 + 排序 + 批量出售
import { SPECIES, SKILLS, ELEM_CHART, PERSONALITIES, QUALITY_NAMES, TALENTS, GRADE_COLORS, GRADE_NAMES } from '../constants/index.js';
import { gameState } from '../state.js';
import { showModal, closeModal, showToast } from '../utils.js';
import { expForLevel, calcAllStats, getAptFromIV, equipSkill, unequipSkill, swapSkillSlots, syncBattleSkills } from '../systems/pet.js';
import { equipTreasure } from '../systems/treasure.js';
import { randInt } from '../utils.js';
import { renderHeader } from './header-ui.js';

let _petSortKey = 'level';
let _petSortAsc = false;
let _petBatchMode = false;
let _petBatchSelected = new Set();

// 暴露到 window 供 onclick 调用

// 装备技能：bookIdx→slotIdx，slotIdx=-1表示自动
window._equipSkillToSlot = function(petId, bookIdx, slotIdx) {
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet) return;
  if (equipSkill(pet, bookIdx, slotIdx)) {
    closeModal();
    showPetDetail(pet);
  } else {
    showToast('装备失败（槽位已满或已装备）', 'info');
  }
};

// 卸下技能
window._unequipSkillSlot = function(petId, slotIdx) {
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet) return;
  unequipSkill(pet, slotIdx);
  closeModal();
  showPetDetail(pet);
};

// 交换优先级（上移）
window._moveSkillUp = function(petId, slotIdx) {
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet || slotIdx <= 0) return;
  swapSkillSlots(pet, slotIdx, slotIdx - 1);
  closeModal();
  showPetDetail(pet);
};

// 交换优先级（下移）
window._moveSkillDown = function(petId, slotIdx) {
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet || slotIdx >= 3) return;
  swapSkillSlots(pet, slotIdx, slotIdx + 1);
  closeModal();
  showPetDetail(pet);
};

// 替换已满槽位：先卸下slotIdx，再装备bookIdx到该槽
window._replaceSkillSlot = function(petId, slotIdx, bookIdx) {
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet) return;
  unequipSkill(pet, slotIdx);
  equipSkill(pet, bookIdx, slotIdx);
  closeModal();
  showPetDetail(pet);
};

window._equipTreasure = function(trId, petId) {
  equipTreasure(trId, petId);
  closeModal();
  renderPets();
};

window._useTalentFruit = function(petId, stat) {
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet) return;
  if ((gameState.materials.talent_fruit || 0) <= 0) { showToast('没有天赋果', 'info'); return; }
  gameState.materials.talent_fruit--;
  const oldIV = pet.iv[stat];
  pet.iv[stat] = randInt(0, 31);
  pet.apts[stat] = getAptFromIV(pet.iv[stat]);
  calcAllStats(pet);
  showToast(stat.toUpperCase() + ' IV: ' + oldIV + ' → ' + pet.iv[stat] + ' (' + pet.apts[stat] + ')', 'info');
  closeModal();
  showPetDetail(pet);
};

window._batchSellPets = function() {
  let totalGold = 0;
  const ids = [..._petBatchSelected];
  ids.forEach(id => {
    const idx = gameState.pets.findIndex(p => p.id === id);
    if (idx < 0) return;
    const pet = gameState.pets[idx];
    totalGold += pet.level * 10;
    // 卸下宝物
    if (pet.treasure) {
      pet.treasure.equippedTo = null;
    }
    gameState.pets.splice(idx, 1);
  });
  gameState.gold += totalGold;
  _petBatchSelected.clear();
  _petBatchMode = false;
  showToast('批量放生完成! 获得 ' + totalGold + ' 金币', 'loot');
  renderPets();
  renderHeader();
};

function getAptScore(pet) {
  const aptVal = { D: 0, C: 1, B: 2, A: 3, S: 4, 'S+': 5 };
  return (aptVal[pet.apts.hp] || 0) + (aptVal[pet.apts.atk] || 0) + (aptVal[pet.apts.def] || 0) + (aptVal[pet.apts.spd] || 0);
}

export function renderPets() {
  const el = document.getElementById('pet-list');
  if (!el) return;
  el.innerHTML = '';

  if (gameState.pets.length === 0) {
    el.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">还没有宠物...</p>';
    return;
  }

  // 排序+批量工具栏
  const toolbar = document.createElement('div');
  toolbar.className = 'rune-sort-bar';
  toolbar.style.marginBottom = '10px';

  [['level','等级'],['apt','资质'],['elem','元素']].forEach(([key, label]) => {
    const btn = document.createElement('button');
    btn.className = 'sort-btn' + (_petSortKey === key ? ' active' : '');
    btn.textContent = label + (_petSortKey === key ? (_petSortAsc ? '↑' : '↓') : '');
    btn.onclick = () => {
      if (_petSortKey === key) _petSortAsc = !_petSortAsc;
      else { _petSortKey = key; _petSortAsc = false; }
      renderPets();
    };
    toolbar.appendChild(btn);
  });

  const batchBtn = document.createElement('button');
  batchBtn.className = 'sort-btn' + (_petBatchMode ? ' active' : '');
  batchBtn.textContent = _petBatchMode ? '取消批量' : '批量放生';
  batchBtn.onclick = () => { _petBatchMode = !_petBatchMode; _petBatchSelected.clear(); renderPets(); };
  toolbar.appendChild(batchBtn);

  el.appendChild(toolbar);

  // 排序
  const pets = [...gameState.pets];
  pets.sort((a, b) => {
    let va, vb;
    if (_petSortKey === 'level') { va = a.level; vb = b.level; }
    else if (_petSortKey === 'apt') { va = getAptScore(a); vb = getAptScore(b); }
    else { va = a.elem; vb = b.elem; if (va < vb) return _petSortAsc ? -1 : 1; if (va > vb) return _petSortAsc ? 1 : -1; return 0; }
    return _petSortAsc ? va - vb : vb - va;
  });

  pets.forEach(pet => {
    const sp = SPECIES[pet.speciesId];
    const pers = PERSONALITIES[pet.personality] || {name:'未知', up:null, down:null};
    const inForm = gameState.formation.indexOf(pet) >= 0;
    const card = document.createElement('div');
    card.className = 'pet-card' + (inForm ? ' in-formation' : '') + (_petBatchSelected.has(pet.id) ? ' selected' : '');

    const expPct = (pet.exp / expForLevel(pet.level) * 100).toFixed(1);

    // 资质
    let aptHTML = '资质: ';
    ['hp','atk','def','spd'].forEach(st => {
      const a = pet.apts[st];
      const cls = 'apt-' + (a === 'S+' ? 'Sp' : a);
      aptHTML += '<span class="' + cls + '">' + st.toUpperCase() + ':' + a + '</span> ';
    });

    // 个体值
    let ivHTML = '';
    if (gameState.appraisalUnlocked) {
      ivHTML = '<div style="font-size:10px;color:#666;margin-top:2px;">个体值: HP:' + pet.iv.hp + ' ATK:' + pet.iv.atk + ' DEF:' + pet.iv.def + ' SPD:' + pet.iv.spd + '</div>';
    }

    // 技能
    let skillsHTML = '';
    pet.skills.forEach(s => {
      const sd = SKILLS[s.skillId];
      const enh = s.enhanceLevel > 0 ? ' +' + s.enhanceLevel : '';
      const gradeColor = GRADE_COLORS[sd.grade] || '#ccc';
      const gradeName = GRADE_NAMES[sd.grade] || '';
      skillsHTML += '<span class="skill-tag" style="border-color:' + gradeColor + ';">' + sd.name + enh + ' <span style="color:' + gradeColor + ';">[' + gradeName + ']</span></span>';
    });
    if (pet.skills.length === 0) skillsHTML = '<span style="font-size:10px;color:#555;">未习得技能</span>';

    const bookCount = pet.skillBook ? pet.skillBook.length : 0;
    const compText = '技能书: ' + bookCount + '个';

    const icon = sp.icon || '';
    card.innerHTML = (_petBatchMode ? '<input type="checkbox" ' + (_petBatchSelected.has(pet.id) ? 'checked' : '') + ' style="float:left;margin:4px 8px 0 0;pointer-events:none;">' : '')
      + '<div class="pet-header">'
      + '<span class="pet-name">' + icon + ' ' + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level + '</span>'
      + '<span class="pet-elem elem-' + pet.elem + '">' + ELEM_CHART[pet.elem].name + '</span>'
      + '</div>'
      + '<div class="pet-apts">' + aptHTML + ' | 性格:' + pers.name + (pers.up ? '(↑' + pers.up + ' ↓' + pers.down + ')' : '') + '</div>'
      + ivHTML
      + '<div class="pet-stats"><span>HP:' + pet.maxHp + '</span><span>ATK:' + pet.atk + '</span><span>DEF:' + pet.def + '</span><span>SPD:' + pet.spd + '</span></div>'
      + '<div class="pet-skills-row">' + skillsHTML + '</div>'
      + '<div style="font-size:10px;color:#666;margin-top:4px;">' + compText + ' | ' + (pet.treasure ? '宝物:' + pet.treasure.name + '+' + pet.treasure.enhanceLevel : '未装备宝物') + '</div>'
      + '<div class="exp-bar"><div class="exp-fill" style="width:' + expPct + '%"></div></div>'
      + '<div style="font-size:9px;color:#555;margin-top:2px;">EXP: ' + pet.exp + '/' + expForLevel(pet.level) + ' (' + expPct + '%)' + (inForm ? ' [出战中]' : '') + '</div>';

    if (_petBatchMode) {
      card.onclick = () => {
        if (inForm) { showToast('出战中的宠物不能放生', 'info'); return; }
        if (_petBatchSelected.has(pet.id)) _petBatchSelected.delete(pet.id);
        else _petBatchSelected.add(pet.id);
        renderPets();
      };
    } else {
      card.onclick = () => showPetDetail(pet);
    }
    el.appendChild(card);
  });

  // 批量操作底栏
  if (_petBatchMode && _petBatchSelected.size > 0) {
    let totalPrice = 0;
    _petBatchSelected.forEach(id => {
      const p = gameState.pets.find(pp => pp.id === id);
      if (p) totalPrice += p.level * 10;
    });
    const batchBar = document.createElement('div');
    batchBar.className = 'batch-bar';
    batchBar.innerHTML = '<span>已选 ' + _petBatchSelected.size + ' 只</span>'
      + '<button class="btn-sm" style="background:#e53935;color:#fff;" onclick="window._batchSellPets()">批量放生 (获得' + totalPrice + '金币)</button>';
    el.appendChild(batchBar);
  }
}

function showPetDetail(pet) {
  const sp = SPECIES[pet.speciesId];
  const pers = PERSONALITIES[pet.personality];

  let html = '<div style="margin-bottom:12px;">';
  html += '<p><strong>' + sp.evoChain[pet.evoStage] + '</strong> (Lv.' + pet.level + ') - ' + sp.desc + '</p>';
  html += '<p>进化链: ' + sp.evoChain.map((e, i) => (i === pet.evoStage ? '<strong>' + e + '</strong>' : '<span style="color:#666">' + e + '</span>')).join(' → ') + '</p>';

  // Talent display
  if (pet.level >= 10 && pet.talent) {
    const talentData = TALENTS[pet.talent];
    html += '<p style="color:#e94560;"><strong>天赋: ' + talentData.name + '</strong> - ' + talentData.desc + '</p>';
  } else if (pet.level < 10) {
    html += '<p style="color:#888;">天赋: ???（Lv.10解锁）</p>';
  }

  // EV/Learning Power display
  if (gameState.appraisalUnlocked && (pet.ev.hp || pet.ev.atk || pet.ev.def || pet.ev.spd)) {
    const totalEV = pet.ev.hp + pet.ev.atk + pet.ev.def + pet.ev.spd;
    html += '<p style="color:#4caf50;font-size:12px;">学习点数: HP:' + pet.ev.hp + ' ATK:' + pet.ev.atk + ' DEF:' + pet.ev.def + ' SPD:' + pet.ev.spd + ' (合计:' + totalEV + '/510)</p>';
    html += '<p style="color:#4caf50;font-size:12px;">战斗次数: ' + (pet.battleCount || 0) + '</p>';
  }

  html += '</div>';

  // ===== 技能管理区 =====
  const typeMap = { single:'单体', aoe:'群攻', self:'自身', ally_single:'单体队友', ally_all:'全体队友', link:'联动' };
  const equippedCount = pet.equippedSkills.filter(v => v != null).length;

  // --- 装备槽（4格，显示优先级序号 + 上下箭头 + 卸下按钮）---
  html += '<h4 style="color:#e94560;">装备槽 (' + equippedCount + '/4) <span style="font-size:11px;color:#888;font-weight:normal;">① 优先释放</span></h4>';
  for (let slot = 0; slot < 4; slot++) {
    const bookIdx = pet.equippedSkills[slot];
    const slotLabel = '❶❷❸❹'[slot];
    if (bookIdx != null && pet.skillBook[bookIdx]) {
      const entry = pet.skillBook[bookIdx];
      const sd = SKILLS[entry.skillId];
      if (!sd) continue;
      const gc = GRADE_COLORS[sd.grade] || '#ccc';
      const gn = GRADE_NAMES[sd.grade] || '';
      html += '<div style="padding:6px;margin:3px 0;background:rgba(255,255,255,0.07);border-radius:4px;border-left:4px solid ' + gc + ';display:flex;align-items:center;gap:6px;">';
      // 优先级序号
      html += '<span style="font-size:16px;min-width:20px;">' + slotLabel + '</span>';
      // 技能信息
      html += '<div style="flex:1;">';
      html += '<strong style="color:' + gc + ';">' + sd.name + '</strong> <span style="color:' + gc + ';font-size:11px;">[' + gn + ']</span> Lv.' + entry.level;
      html += ' <span style="color:#888;font-size:11px;">威力:' + (sd.power || '-') + ' CD:' + sd.cooldown + ' ' + (typeMap[sd.type] || '') + '</span>';
      html += '</div>';
      // 操作按钮
      html += '<div style="display:flex;gap:3px;flex-shrink:0;">';
      if (slot > 0) html += '<button class="btn-sm" onclick="window._moveSkillUp(' + pet.id + ',' + slot + ')" title="上移优先级">↑</button>';
      if (slot < 3 && pet.equippedSkills[slot + 1] != null) html += '<button class="btn-sm" onclick="window._moveSkillDown(' + pet.id + ',' + slot + ')" title="下移优先级">↓</button>';
      html += '<button class="btn-sm" style="background:#e53935;color:#fff;" onclick="window._unequipSkillSlot(' + pet.id + ',' + slot + ')">卸下</button>';
      html += '</div></div>';
    } else {
      html += '<div style="padding:6px;margin:3px 0;background:rgba(255,255,255,0.02);border-radius:4px;border:1px dashed #444;color:#555;display:flex;align-items:center;gap:6px;">';
      html += '<span style="font-size:16px;min-width:20px;">' + slotLabel + '</span>';
      html += '<span>空槽位</span>';
      html += '</div>';
    }
  }

  // --- 技能书（所有已领悟技能列表，可装备/替换）---
  if (pet.skillBook && pet.skillBook.length > 0) {
    html += '<h4 style="color:#42a5f5;margin-top:10px;">技能书 (' + pet.skillBook.length + '个已领悟)</h4>';
    pet.skillBook.forEach((entry, idx) => {
      const sd = SKILLS[entry.skillId];
      if (!sd) return;
      const gc = GRADE_COLORS[sd.grade] || '#ccc';
      const gn = GRADE_NAMES[sd.grade] || '';
      const equippedSlot = pet.equippedSkills.indexOf(idx);
      const isEquipped = equippedSlot >= 0;
      const hasEmpty = pet.equippedSkills.indexOf(null) >= 0;

      html += '<div style="padding:5px 6px;margin:2px 0;background:rgba(255,255,255,' + (isEquipped ? '0.07' : '0.02') + ');border-radius:4px;border-left:3px solid ' + gc + ';display:flex;align-items:center;gap:6px;">';
      // 技能信息
      html += '<div style="flex:1;">';
      html += '<span style="color:' + gc + ';font-weight:bold;">' + sd.name + '</span> <span style="color:' + gc + ';font-size:10px;">[' + gn + ']</span> Lv.' + entry.level;
      html += ' <span style="color:#888;font-size:10px;">威力:' + (sd.power || '-') + ' CD:' + sd.cooldown + ' ' + (typeMap[sd.type] || '') + '</span>';
      if (sd.desc) html += '<div style="color:#777;font-size:10px;margin-top:1px;">' + sd.desc + '</div>';
      html += '</div>';
      // 操作
      html += '<div style="flex-shrink:0;">';
      if (isEquipped) {
        html += '<span style="color:#4caf50;font-size:11px;">✓ 槽位' + (equippedSlot + 1) + '</span>';
      } else if (hasEmpty) {
        html += '<button class="btn-sm" style="background:#1976d2;color:#fff;" onclick="window._equipSkillToSlot(' + pet.id + ',' + idx + ',-1)">装备</button>';
      } else {
        // 所有槽位已满，显示替换下拉
        html += '<select style="font-size:11px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:2px;" onchange="if(this.value>=0)window._replaceSkillSlot(' + pet.id + ',parseInt(this.value),' + idx + ')">';
        html += '<option value="-1">替换...</option>';
        for (let s = 0; s < 4; s++) {
          const bi = pet.equippedSkills[s];
          if (bi != null && pet.skillBook[bi]) {
            const ssd = SKILLS[pet.skillBook[bi].skillId];
            html += '<option value="' + s + '">替换 ' + (s+1) + '号: ' + (ssd ? ssd.name : '???') + '</option>';
          }
        }
        html += '</select>';
      }
      html += '</div></div>';
    });
  } else {
    html += '<p style="color:#666;font-size:12px;margin-top:8px;">尚未领悟任何技能（升级时有50%概率领悟）</p>';
  }

  // 天赋果重随
  if (gameState.appraisalUnlocked && gameState.materials.talent_fruit > 0) {
    html += '<p style="margin-top:12px;"><strong>天赋果重随 (库存:' + gameState.materials.talent_fruit + '):</strong> ';
    ['hp','atk','def','spd'].forEach(stat => {
      html += '<button class="btn-sm" onclick="window._useTalentFruit(' + pet.id + ',\'' + stat + '\')">' + stat.toUpperCase() + '</button> ';
    });
    html += '</p>';
  }

  // 宝物区
  html += '<h4 style="color:#ffd700;margin-top:12px;">宝物</h4>';
  if (pet.treasure) {
    html += '<p>' + pet.treasure.name + ' +' + pet.treasure.enhanceLevel + ' [' + QUALITY_NAMES[pet.treasure.quality] + ']</p>';
  } else {
    const available = gameState.treasures.filter(t => !t.equippedTo);
    if (available.length > 0) {
      html += '<p>未装备 - 可用宝物:</p>';
      available.forEach(t => {
        html += '<div class="modal-select-item" onclick="window._equipTreasure(' + t.id + ',' + pet.id + ')">'
          + t.name + ' [' + QUALITY_NAMES[t.quality] + '] +' + t.enhanceLevel + '</div>';
      });
    } else {
      html += '<p>未装备，暂无可用宝物</p>';
    }
  }

  showModal(sp.name + ' 详情', html, [{ text: '关闭', action: null }]);
}
