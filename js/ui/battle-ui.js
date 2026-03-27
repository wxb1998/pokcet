// 战斗界面渲染 - 上下对阵 + 阵型(前排/后排) + HP/ATK条 + 攻击动画
import { SPECIES, SKILLS, ELEM_CHART, ZONES, CAPTURE_ITEMS, STATUS_EFFECTS } from '../constants/index.js';
import { gameState, getFormationPets } from '../state.js';
import { calcCaptureRate, attemptCapture, pauseBattle, resumeBattle } from '../systems/capture.js';
import { spawnEnemies } from '../systems/battle.js';
import { renderHeader } from './header-ui.js';
import { renderReserve } from './dex-ui.js';
import { showModal, closeModal } from '../utils.js';
import { createSpriteElement, showDamageNumber } from './sprites.js';
import { bindTooltip, skillTooltipHTML } from './tooltip.js';

// === 日志过滤状态 ===
let _logFilter = 'all'; // all | battle | skill | loot | comprehend

window._setLogFilter = function(filter) {
  _logFilter = filter;
  // 重新渲染日志区域
  const logEl = document.getElementById('battle-log');
  if (!logEl) return;
  renderBattleLog(logEl);
};

function renderBattleLog(logEl) {
  logEl.innerHTML = '';

  // 过滤按钮
  const filterBar = document.createElement('div');
  filterBar.className = 'log-filter-bar';
  const filterOpts = [
    ['all', '全部'], ['battle', '战斗'], ['skill', '状态'], ['comprehend', '领悟'], ['loot', '掉落']
  ];
  filterOpts.forEach(([key, label]) => {
    const btn = document.createElement('button');
    btn.className = 'log-filter-btn' + (_logFilter === key ? ' active' : '');
    btn.textContent = label;
    btn.onclick = (e) => { e.stopPropagation(); window._setLogFilter(key); };
    filterBar.appendChild(btn);
  });
  logEl.appendChild(filterBar);

  // 过滤日志
  const logs = gameState.battleLog.slice(-50).filter(l => {
    if (_logFilter === 'all') return true;
    if (_logFilter === 'battle') return l.cls === 'log-ally-dmg' || l.cls === 'log-enemy-dmg' || l.cls === 'log-dmg' || l.cls === 'log-heal';
    if (_logFilter === 'skill') return l.cls === 'log-skill';
    if (_logFilter === 'comprehend') return l.cls === 'log-comprehend';
    if (_logFilter === 'loot') return l.cls === 'log-loot' || l.cls === 'log-capture';
    return true;
  });

  logs.slice(-20).forEach(l => {
    const line = document.createElement('div');
    line.className = 'log-line ' + l.cls;
    line.textContent = l.msg;
    logEl.appendChild(line);
  });
  logEl.scrollTop = logEl.scrollHeight;
}

// === HP快照：用于检测HP变化并播放伤害动画 ===
let _lastHpSnapshot = {};

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
        const isBigHit = diff > (oldHp * 0.3);
        showDamageNumber(el, diff, isBigHit, false);
        el.classList.add('hit-flash');
        setTimeout(() => el.classList.remove('hit-flash'), 250);
      } else if (diff < 0) {
        showDamageNumber(el, Math.abs(diff), false, true);
      }
    }
  });
}

// === 攻击动作指示 ===
function playAttackAnimations() {
  const actions = gameState._battleActions;
  if (!actions || actions.length === 0) return;
  requestAnimationFrame(() => {
    actions.forEach((act, i) => {
      setTimeout(() => {
        // 攻击者向前位移动画
        const atkEl = document.querySelector('[data-unit-id="' + act.attackerId + '"]');
        if (atkEl) {
          const isEnemy = act.attackerId.startsWith('e');
          atkEl.classList.add(isEnemy ? 'atk-anim-down' : 'atk-anim-up');
          setTimeout(() => atkEl.classList.remove('atk-anim-down', 'atk-anim-up'), 300);
        }
      }, i * 100);
    });
  });
  gameState._battleActions = [];
}

// === Capture item picker ===
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
      _lastHpSnapshot = {};
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

  const currentSnap = takeHpSnapshot();
  const prevSnap = _lastHpSnapshot;
  _lastHpSnapshot = currentSnap;

  battleArea.innerHTML = '';

  // === 上下对阵布局：敌方在上，己方在下 ===

  // --- 敌方区域（上方）---
  const enemyPanel = document.createElement('div');
  enemyPanel.className = 'battle-team enemy-team';

  const enemyLabel = document.createElement('div');
  enemyLabel.className = 'team-label enemy-label';
  enemyLabel.textContent = '👹 敌方';
  enemyPanel.appendChild(enemyLabel);

  // 敌方后排（最上面，远离中间）
  const enemyBack = document.createElement('div');
  enemyBack.className = 'formation-row back-row';
  const enemyFront = document.createElement('div');
  enemyFront.className = 'formation-row front-row';

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

  if (hasEnemyBack) {
    const eBackTag = document.createElement('div');
    eBackTag.className = 'row-tag';
    eBackTag.textContent = '— 后排 —';
    enemyPanel.appendChild(eBackTag);
    enemyPanel.appendChild(enemyBack);
  }
  const eFrontTag = document.createElement('div');
  eFrontTag.className = 'row-tag';
  eFrontTag.textContent = '— 前排 —';
  enemyPanel.appendChild(eFrontTag);
  enemyPanel.appendChild(enemyFront);

  // --- VS 分隔线 ---
  const vsDiv = document.createElement('div');
  vsDiv.className = 'battle-vs';
  vsDiv.innerHTML = '⚔️ <span class="vs-text">VS</span> ⚔️';

  // --- 己方区域（下方）---
  const allyPanel = document.createElement('div');
  allyPanel.className = 'battle-team ally-team';

  // 己方前排（靠近中间）
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
      if (i < 3) allyFront.appendChild(empty); else allyBack.appendChild(empty);
      continue;
    }
    allyCount++;
    const unit = createUnitCard(pet, i, false);
    if (i < 3) allyFront.appendChild(unit); else allyBack.appendChild(unit);
  }

  if (allyCount === 0) {
    allyPanel.innerHTML = '<p style="color:#666;padding:20px;text-align:center;">无上阵宠物</p>';
  } else {
    const aFrontTag = document.createElement('div');
    aFrontTag.className = 'row-tag';
    aFrontTag.textContent = '— 前排 —';
    allyPanel.appendChild(aFrontTag);
    allyPanel.appendChild(allyFront);

    const hasBackRow = [3,4,5].some(i => gameState.formation[i]);
    if (hasBackRow) {
      const aBackTag = document.createElement('div');
      aBackTag.className = 'row-tag';
      aBackTag.textContent = '— 后排 —';
      allyPanel.appendChild(aBackTag);
      allyPanel.appendChild(allyBack);
    }

    const allyLabel = document.createElement('div');
    allyLabel.className = 'team-label';
    allyLabel.textContent = '🛡️ 我方';
    allyPanel.appendChild(allyLabel);
  }

  // === 组装：敌上 → VS → 己下 ===
  battleArea.appendChild(enemyPanel);
  battleArea.appendChild(vsDiv);
  battleArea.appendChild(allyPanel);

  // === 播放动画 ===
  if (Object.keys(prevSnap).length > 0) {
    playDamageAnimations(prevSnap);
  }
  playAttackAnimations();

  // === 战斗日志 ===
  const logEl = document.getElementById('battle-log');
  if (!logEl) return;
  renderBattleLog(logEl);
}

// === 单位卡片 ===
function createUnitCard(unit, idx, isEnemy) {
  const div = document.createElement('div');
  const alive = unit.currentHp > 0;
  const hpPct = Math.max(0, unit.currentHp / unit.maxHp * 100);
  const speciesId = unit.speciesId || 'hundun';
  const sp = SPECIES[speciesId];

  div.className = 'battle-unit-card' + (alive ? '' : ' dead') + (isEnemy ? ' enemy' : ' ally');
  div.dataset.unitId = isEnemy ? 'e' + idx : 'a' + idx;

  // --- 像素精灵（更大：70px）---
  const spriteWrap = document.createElement('div');
  spriteWrap.className = 'unit-sprite-wrap';
  const sprite = createSpriteElement(speciesId, 70, isEnemy);
  spriteWrap.appendChild(sprite);
  if (!alive) spriteWrap.style.opacity = '0.3';

  // --- 信息区 ---
  const info = document.createElement('div');
  info.className = 'unit-info-panel';

  // 名称行
  const nameRow = document.createElement('div');
  nameRow.className = 'unit-name-row';
  const stars = unit.stars || 0;
  const starHTML = stars > 0 ? '<span class="star-rating star-' + stars + '">' + '★'.repeat(stars) + '</span> ' : '';
  const elemName = ELEM_CHART[unit.elem] ? ELEM_CHART[unit.elem].name : '';
  const displayName = isEnemy
    ? (unit.displayName || unit.name)
    : (sp.evoChain[unit.evoStage || 0] + ' Lv.' + unit.level);
  nameRow.innerHTML = starHTML + '<span class="pet-elem elem-' + unit.elem + '">' + elemName + '</span> ' + displayName;

  // HP条
  const hpBarWrap = document.createElement('div');
  hpBarWrap.className = 'unit-bar-wrap';
  const hpLabel = document.createElement('span');
  hpLabel.className = 'bar-label hp-label';
  hpLabel.textContent = 'HP';
  const hpBar = document.createElement('div');
  hpBar.className = 'unit-hp-bar';
  hpBar.innerHTML = '<div class="unit-hp-fill' + (hpPct < 30 ? ' low' : '') + '" style="width:' + hpPct + '%"></div>';
  const hpText = document.createElement('span');
  hpText.className = 'bar-text';
  hpText.textContent = Math.max(0, Math.floor(unit.currentHp)) + '/' + unit.maxHp;
  hpBarWrap.appendChild(hpLabel);
  hpBarWrap.appendChild(hpBar);
  hpBarWrap.appendChild(hpText);

  // ATK蓄力条
  const atkBarWrap = document.createElement('div');
  atkBarWrap.className = 'unit-bar-wrap';
  const atkLabel = document.createElement('span');
  atkLabel.className = 'bar-label atk-label';
  atkLabel.textContent = 'ATK';
  const atkBar = document.createElement('div');
  atkBar.className = 'unit-atk-bar';

  let atkPct = 0;
  let atkReady = false;
  if (unit.skills && unit.skills.length > 0) {
    const readySkills = unit.skills.filter(s => s.cooldownLeft <= 0);
    if (readySkills.length > 0) {
      atkPct = 100;
      atkReady = true;
    } else {
      let minCD = 999, maxCD = 1;
      unit.skills.forEach(s => {
        const sd = SKILLS[s.skillId];
        if (sd) {
          if (s.cooldownLeft < minCD) { minCD = s.cooldownLeft; maxCD = sd.cooldown || 1; }
        }
      });
      atkPct = Math.max(5, Math.floor((1 - minCD / Math.max(1, maxCD)) * 100));
    }
  } else {
    atkPct = 100;
    atkReady = true;
  }
  atkBar.innerHTML = '<div class="unit-atk-fill' + (atkReady ? ' ready' : '') + '" style="width:' + atkPct + '%"></div>';
  atkBarWrap.appendChild(atkLabel);
  atkBarWrap.appendChild(atkBar);

  info.appendChild(nameRow);
  info.appendChild(hpBarWrap);
  info.appendChild(atkBarWrap);

  // 技能图标行（小圆点，带tooltip）
  if (unit.skills && unit.skills.length > 0) {
    const skillRow = document.createElement('div');
    skillRow.className = 'unit-skill-row';
    unit.skills.forEach(s => {
      const sd = SKILLS[s.skillId];
      if (!sd) return;
      const tag = document.createElement('span');
      tag.className = 'skill-dot' + (s.cooldownLeft > 0 ? ' on-cd' : '');
      tag.textContent = s.cooldownLeft > 0 ? s.cooldownLeft : '✦';
      bindTooltip(tag, () => skillTooltipHTML(s.skillId, s.enhanceLevel || 0));
      skillRow.appendChild(tag);
    });
    info.appendChild(skillRow);
  }

  // 状态效果图标行
  if (unit.statusEffects && unit.statusEffects.length > 0) {
    const statusRow = document.createElement('div');
    statusRow.className = 'unit-status-row';
    unit.statusEffects.forEach(se => {
      const meta = STATUS_EFFECTS[se.type];
      if (!meta) return;
      const icon = document.createElement('span');
      icon.className = 'status-icon' + (meta.isDebuff ? ' debuff' : ' buff');
      icon.textContent = meta.icon + (se.stacks > 1 ? se.stacks : '');
      icon.title = meta.name + ' (' + se.turnsLeft + '回合)';
      statusRow.appendChild(icon);
    });
    info.appendChild(statusRow);
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
