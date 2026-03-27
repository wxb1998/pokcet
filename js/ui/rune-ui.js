// 符文界面 - 背包 + 装备管理
import { gameState } from '../state.js';
import { RUNE_SLOTS, RUNE_SETS, RUNE_QUALITY, RUNE_MAX_LEVEL } from '../constants/index.js';
import { showModal, closeModal, showToast } from '../utils.js';
import { enhanceRune, equipRune, unequipRune, sellRune, calcRuneEffects } from '../systems/rune.js';
import { calcAllStats } from '../systems/pet.js';
import { renderHeader } from './header-ui.js';

export function renderRunes() {
  const el = document.getElementById('rune-list');
  if (!el) return;
  el.innerHTML = '';

  if (!gameState.runes || gameState.runes.length === 0) {
    el.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">暂无符文，去副本挑战获取吧!</p>';
    return;
  }

  // 按品质排序：金>紫>蓝>绿>白
  const qualOrder = { gold: 0, purple: 1, blue: 2, green: 3, white: 4 };
  const sorted = [...gameState.runes].sort((a, b) => (qualOrder[a.quality] || 5) - (qualOrder[b.quality] || 5));

  sorted.forEach(rune => {
    const set = RUNE_SETS[rune.setId];
    const qual = RUNE_QUALITY[rune.quality];
    const slot = RUNE_SLOTS[rune.slotType];
    const equipped = rune.equippedTo ? gameState.pets.find(p => p.id === rune.equippedTo) : null;

    const div = document.createElement('div');
    div.className = 'rune-card';
    div.style.borderLeft = '3px solid ' + qual.color;

    let subsHTML = rune.subs.map(s => '<span class="rune-sub">' + s.name + '+' + s.value + '</span>').join(' ');

    div.innerHTML = '<div class="rune-header">'
      + '<span style="color:' + (set ? set.color : '#fff') + ';">' + (set ? set.icon + ' ' + set.name : '') + '</span>'
      + ' <span style="color:' + qual.color + ';">' + slot.name + '</span>'
      + ' <span class="rune-level">+' + rune.level + '</span>'
      + (equipped ? ' <span style="font-size:10px;color:#888;">(' + equipped.name + ')</span>' : '')
      + '</div>'
      + '<div class="rune-main">' + slot.mainLabel + '+' + rune.mainValue + '</div>'
      + '<div class="rune-subs">' + subsHTML + '</div>'
      + '<div class="rune-actions">'
      + '<button class="btn-sm" onclick="window._showRuneDetail(' + rune.id + ')">详情</button>'
      + (rune.level < RUNE_MAX_LEVEL ? ' <button class="btn-sm" onclick="window._enhanceRuneUI(' + rune.id + ')">强化</button>' : '')
      + (rune.equippedTo ? ' <button class="btn-sm" onclick="window._unequipRuneUI(' + rune.id + ')">卸下</button>' : ' <button class="btn-sm" onclick="window._equipRuneUI(' + rune.id + ')">装备</button>')
      + ' <button class="btn-sm" style="color:#e53935;" onclick="window._sellRuneUI(' + rune.id + ')">出售</button>'
      + '</div>';

    el.appendChild(div);
  });
}

// ===== 全局事件 =====

window._showRuneDetail = function(runeId) {
  const rune = gameState.runes.find(r => r.id === runeId);
  if (!rune) return;
  const set = RUNE_SETS[rune.setId];
  const qual = RUNE_QUALITY[rune.quality];
  const slot = RUNE_SLOTS[rune.slotType];

  let html = '<div style="text-align:left;">';
  html += '<p style="color:' + qual.color + ';font-size:16px;">' + (set ? set.icon + ' ' + set.name : '') + ' · ' + slot.name + ' +' + rune.level + '</p>';
  html += '<p>品质: <span style="color:' + qual.color + ';">' + qual.name + '</span></p>';
  html += '<p>主属性: ' + slot.mainLabel + ' +' + rune.mainValue + '</p>';
  html += '<p>副属性:</p><ul style="margin:4px 0;">';
  rune.subs.forEach(s => { html += '<li>' + s.name + ' +' + s.value + '</li>'; });
  html += '</ul>';

  // 套装效果说明
  if (set) {
    html += '<hr style="border-color:#333;"><p style="color:' + set.color + ';">套装效果:</p>';
    if (set[2]) html += '<p style="font-size:12px;">2件: ' + set[2].desc + '</p>';
    if (set[4]) html += '<p style="font-size:12px;">4件: ' + set[4].desc + '</p>';
  }
  html += '</div>';

  showModal('符文详情', html, [{ text: '关闭', action: null }]);
};

window._enhanceRuneUI = function(runeId) {
  const result = enhanceRune(runeId);
  if (result.success) {
    showToast(result.message, 'loot');
  } else {
    showToast(result.message, 'info');
  }
  renderRunes();
  renderHeader();
};

window._equipRuneUI = function(runeId) {
  const rune = gameState.runes.find(r => r.id === runeId);
  if (!rune) return;
  const slot = RUNE_SLOTS[rune.slotType];

  // 显示宠物选择器
  let html = '<p>选择要装备 <strong>' + slot.name + '</strong> 符文的宠物:</p>';
  gameState.pets.forEach(pet => {
    const sp = pet.speciesId;
    html += '<div class="capture-item-row" onclick="window._confirmEquipRune(' + rune.id + ',' + pet.id + ')">'
      + '<span>' + (pet.icon || '') + ' ' + pet.name + ' Lv.' + pet.level + '</span>'
      + '</div>';
  });

  showModal('装备符文', html, [{ text: '取消', action: null }]);
};

window._confirmEquipRune = function(runeId, petId) {
  closeModal();
  if (equipRune(runeId, petId)) {
    const pet = gameState.pets.find(p => p.id === petId);
    if (pet) calcAllStats(pet);
    showToast('符文装备成功!', 'loot');
  } else {
    showToast('装备失败', 'info');
  }
  renderRunes();
};

window._unequipRuneUI = function(runeId) {
  if (unequipRune(runeId)) {
    showToast('符文已卸下', 'info');
  }
  renderRunes();
};

window._sellRuneUI = function(runeId) {
  const rune = gameState.runes.find(r => r.id === runeId);
  if (!rune) return;
  const qual = RUNE_QUALITY[rune.quality];

  showModal('出售符文', '<p>确定出售这个<span style="color:' + qual.color + ';">' + qual.name + '</span>符文吗?</p>', [
    { text: '出售', primary: true, action: () => {
      const price = sellRune(runeId);
      showToast('出售获得 ' + price + ' 金币', 'loot');
      renderRunes();
      renderHeader();
    }},
    { text: '取消', action: null }
  ]);
};
