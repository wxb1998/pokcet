// 战斗界面渲染 - 左右对阵 + 阵型(前排/后排) + 像素精灵 + 伤害动画
import { SPECIES, SKILLS, ELEM_CHART, ZONES, CAPTURE_ITEMS } from '../constants/index.js';
import { gameState, getFormationPets } from '../state.js';
import { calcCaptureRate, attemptCapture, pauseBattle, resumeBattle } from '../systems/capture.js';
import { spawnEnemies } from '../systems/battle.js';
import { renderHeader } from './header-ui.js';
import { renderReserve } from './dex-ui.js';
import { showModal, closeModal } from '../utils.js';
import { createSpriteElement, showDamageNumber } from './sprites.js';
import { bindTooltip, skillTooltipHTML } from './tooltip.js';

// === HP快照：用于检测HP变化并播放伤害动画 ===
let _lastHpSnapshot = {}; // { 'a0': 1200, 'a1': 800, 'e0': 500, ... }

function takeHpSnapshot() {
  const snap = {};
  for (let i = 0; i < 6; i++) {
    const pet = gameState.formation[i];
    if (pet) snap['a' + i] = pet.currentHp;
  }
  gameState.enemies.forEach((e, idx) => {
    snap['e' + idx] = e.currentHp;
  });
  return snap;
}

function playDamageAnimations(oldSnap) {
  // 延迟一帧等DOM渲染完毕
  requestAnimationFrame(() => {
    for (const key in oldSnap) {
      const oldHp = oldSnap[key];
      let newHp;
      if (key.startsWith('a')) {
        const idx = parseInt(key.slice(1));
        const pet = gameState.formation[idx];
        newHp = pet ? pet.currentHp : 0;
      } else {
        const idx = parseInt(key.slice(1));
        const enemy = gameState.enemies[idx];
        newHp = enemy ? enemy.currentHp : 0;
      }

      const diff = oldHp - newHp;
      if (diff === 0) continue;

      const el = document.querySelector('[data-unit-id="' + key + '"]');
      if (!el) continue;

      if (diff > 0) {
        // 受伤 - 红色伤害数字 + 闪光
        const isBigHit = diff > (oldHp * 0.3); // 大于30%HP算暴击级
        showDamageNumber(el, diff, isBigHit, false);
        el.classList.add('hit-flash');
        setTimeout(() => el.classList.remove('hit-flash'), 250);
      } else if (diff < 0) {
        // 回复 - 绿色
        showDamageNumber(el, Math.abs(diff), false, true);
      }
    }
  });
}

// Capture item picker
window._showCapturePicker = function(idx) {
  pauseBattle();
  const enemy = gameState.enemies[idx];
  if (!enemy || enemy.currentHp <= 0) { resumeBattle(); return; }

  let html = '<p>目标: <strong>' + enemy.displayName + '</strong> HP:' + enemy.currentHp + '/' + enemy.maxHp + '</p>';
  const items = ['rope', 'seal', 'soul_stone', 'fairy_lock'];
  items.forEach(itemId => {
    const item = CAPTURE_ITEMS[itemId];
    const stock = gameState.materials[itemId] || 0;
    const rate = calcCaptureRate(enemy, itemId);
    const disabled = stock <= 0;
    html += '<div class="capture-item-row' + (disabled ? ' disabled' : '') + '" '
      + (disabled ? '' : 'onclick="window._confirmCapture(' + idx + ',\'' + itemId + '\')"') + '>'
      + '<span style="color:' + item.color + ';font-weight:bold;">' + item.name + '</span> - ' + item.desc
      + '<span style="float:right;">成功率:' + Math.floor(rate) + '% | 库存:' + stock + '</span></div>';
  });
  showModal('选择捕捉道具', html, [{text:'取消', action: () => resumeBattle()}]);
};

window._confirmCapture = function(enemyIdx, itemId) {
  closeModal();
  attemptCapture(enemyIdx, itemId, () => { renderBattle(); renderHeader(); });
};

export function renderZoneSelector() {
  const el = document.getElementById('zone-selector');
  if (!el) return;
  el.innerHTML = '';
  ZONES.forEach((z, idx) => {
    const btn = document.createElement('button');
    btn.className = 'zone-btn' + (idx === gameState.currentZone ? ' active' : '');
    btn.textContent = z.name + ' (Lv.' + z.lvRange[0] + '-' + z.lvRange[1] + ')';
    btn.disabled = gameState.advLv < z.unlockLv;
    btn.onclick = () => {
      if (gameState.advLv < z.unlockLv) return;
      gameState.currentZone = idx;
      gameState.enemies = spawnEnemies();
      gameState.captureMode = false;
      gameState.captureTargetIdx = -1;
      _lastHpSnapshot = {}; // 切区域重置快照
      renderBattle();
      renderZoneSelector();
    };
    el.appendChild(btn);
  });
}

export function renderBattle() {
  renderHeader();
  renderReserve();

  const battleArea = document.getElementById('battle-area');
  if (!battleArea) return;

  // 先拍当前HP快照（用于和上帧对比）
  const currentSnap = takeHpSnapshot();
  const prevSnap = _lastHpSnapshot;
  _lastHpSnapshot = currentSnap;

  battleArea.innerHTML = '';

  // === 左右对阵布局 ===
  const allyPanel = document.createElement('div');
  allyPanel.className = 'battle-team ally-team';
  allyPanel.id = 'ally-side';

  const vsDiv = document.createElement('div');
  vsDiv.className = 'battle-vs';
  vsDiv.textContent = '⚔️';

  const enemyPanel = document.createElement('div');
  enemyPanel.className = 'battle-team enemy-team';
  enemyPanel.id = 'enemy-side';

  // === 己方 - 前排(0-2) + 后排(3-5) ===
  const allyFront = document.createElement('div');
  allyFront.className = 'formation-row front-row';
  const allyBack = document.createElement('div');
  allyBack.className = 'formation-row back-row';

  let allyCount = 0;
  for (let i = 0; i < 6; i++) {
    const pet = gameState.formation[i];
    if (!pet) {
      const empty = document.createElement('div');
      empty.className = 'battle-unit-card empty-slot';
      if (i < 3) allyFront.appendChild(empty);
      else allyBack.appendChild(empty);
      continue;
    }
    allyCount++;
    const unit = createUnitCard(pet, i, false);
    if (i < 3) allyFront.appendChild(unit);
    else allyBack.appendChild(unit);
  }

  const allyLabel = document.createElement('div');
  allyLabel.className = 'team-label';
  allyLabel.textContent = '🛡️ 我方';
  allyPanel.appendChild(allyLabel);

  const allyFrontLabel = document.createElement('div');
  allyFrontLabel.className = 'row-tag';
  allyFrontLabel.textContent = '前排';
  allyPanel.appendChild(allyFrontLabel);
  allyPanel.appendChild(allyFront);

  const hasBackRow = [3,4,5].some(i => gameState.formation[i]);
  if (hasBackRow) {
    const allyBackLabel = document.createElement('div');
    allyBackLabel.className = 'row-tag';
    allyBackLabel.textContent = '后排';
    allyPanel.appendChild(allyBackLabel);
    allyPanel.appendChild(allyBack);
  }

  if (allyCount === 0) {
    allyPanel.innerHTML = '<p style="color:#666;padding:20px;text-align:center;">无上阵宠物</p>';
  }

  // === 敌方 - 前排 + 后排 ===
  const enemyLabel = document.createElement('div');
  enemyLabel.className = 'team-label enemy-label';
  enemyLabel.textContent = '👹 敌方';
  enemyPanel.appendChild(enemyLabel);

  const enemyFront = document.createElement('div');
  enemyFront.className = 'formation-row front-row';
  const enemyBack = document.createElement('div');
  enemyBack.className = 'formation-row back-row';

  let hasEnemyBack = false;
  gameState.enemies.forEach((e, idx) => {
    const unit = createUnitCard(e, idx, true);
    if (e.row === 'back') {
      enemyBack.appendChild(unit);
      hasEnemyBack = true;
    } else {
      enemyFront.appendChild(unit);
    }
  });

  const eFrontLabel = document.createElement('div');
  eFrontLabel.className = 'row-tag';
  eFrontLabel.textContent = '前排';
  enemyPanel.appendChild(eFrontLabel);
  enemyPanel.appendChild(enemyFront);
  if (hasEnemyBack) {
    const eBackLabel = document.createElement('div');
    eBackLabel.className = 'row-tag';
    eBackLabel.textContent = '后排';
    enemyPanel.appendChild(eBackLabel);
    enemyPanel.appendChild(enemyBack);
  }

  battleArea.appendChild(allyPanel);
  battleArea.appendChild(vsDiv);
  battleArea.appendChild(enemyPanel);

  // === 播放伤害/回复动画 ===
  if (Object.keys(prevSnap).length > 0) {
    playDamageAnimations(prevSnap);
  }

  // === 战斗日志 ===
  const logEl = document.getElementById('battle-log');
  if (!logEl) return;
  logEl.innerHTML = '';
  gameState.battleLog.slice(-20).forEach(l => {
    const line = document.createElement('div');
    line.className = 'log-line ' + l.cls;
    line.textContent = l.msg;
    logEl.appendChild(line);
  });
  logEl.scrollTop = logEl.scrollHeight;
}

function createUnitCard(unit, idx, isEnemy) {
  const div = document.createElement('div');
  const alive = unit.currentHp > 0;
  const hpPct = Math.max(0, unit.currentHp / unit.maxHp * 100);
  const speciesId = unit.speciesId || 'hundun';
  const sp = SPECIES[speciesId];

  div.className = 'battle-unit-card' + (alive ? '' : ' dead') + (isEnemy ? ' enemy' : ' ally');
  div.dataset.unitId = isEnemy ? 'e' + idx : 'a' + idx;

  // 像素精灵
  const spriteWrap = document.createElement('div');
  spriteWrap.className = 'unit-sprite-wrap';
  const sprite = createSpriteElement(speciesId, 40, isEnemy);
  spriteWrap.appendChild(sprite);
  if (!alive) spriteWrap.style.opacity = '0.3';

  // 信息区
  const info = document.createElement('div');
  info.className = 'unit-info-panel';

  // 名称行
  const nameRow = document.createElement('div');
  nameRow.className = 'unit-name-row';
  const stars = unit.stars || 0;
  const starHTML = stars > 0 ? '<span class="star-rating star-' + stars + '">' + '★'.repeat(stars) + '</span> ' : '';
  const elemName = ELEM_CHART[unit.elem] ? ELEM_CHART[unit.elem].name : '';
  const displayName = isEnemy ? (unit.displayName || unit.name) : (sp.evoChain[unit.evoStage || 0] + ' Lv.' + unit.level);
  nameRow.innerHTML = starHTML + '<span class="pet-elem elem-' + unit.elem + '">' + elemName + '</span> ' + displayName;

  // HP条
  const hpBar = document.createElement('div');
  hpBar.className = 'unit-hp-bar';
  hpBar.innerHTML = '<div class="unit-hp-fill' + (hpPct < 30 ? ' low' : '') + '" style="width:' + hpPct + '%"></div>';

  const hpText = document.createElement('div');
  hpText.className = 'unit-hp-text';
  hpText.textContent = Math.max(0, unit.currentHp) + '/' + unit.maxHp;

  info.appendChild(nameRow);
  info.appendChild(hpBar);
  info.appendChild(hpText);

  // 技能（带tooltip）
  if (!isEnemy && unit.skills && unit.skills.length > 0) {
    const skillRow = document.createElement('div');
    skillRow.className = 'unit-skill-row';
    unit.skills.forEach(s => {
      const sd = SKILLS[s.skillId];
      if (!sd) return;
      const tag = document.createElement('span');
      tag.className = 'skill-tag' + (s.cooldownLeft > 0 ? ' on-cd' : '');
      tag.textContent = (s.cooldownLeft > 0 ? '⏳' : '✦') + sd.name;
      bindTooltip(tag, () => skillTooltipHTML(s.skillId));
      skillRow.appendChild(tag);
    });
    info.appendChild(skillRow);
  }

  // 复活计时器
  if (!isEnemy && !alive && unit.id) {
    const timer = gameState.reviveTimers ? gameState.reviveTimers[unit.id] : null;
    if (timer) {
      const remaining = Math.max(0, Math.ceil((timer - Date.now()) / 1000));
      const revDiv = document.createElement('div');
      revDiv.className = 'revive-timer';
      revDiv.textContent = '复活中... ' + remaining + 's';
      info.appendChild(revDiv);
    }
  }

  // 捕捉按钮（敌方）
  if (isEnemy && alive) {
    const capBtn = document.createElement('button');
    capBtn.className = 'capture-btn';
    capBtn.textContent = '✨捕捉';
    capBtn.onclick = (e) => { e.stopPropagation(); window._showCapturePicker(idx); };
    info.appendChild(capBtn);
  }

  div.appendChild(spriteWrap);
  div.appendChild(info);
  return div;
}
