// 战斗界面渲染
import { SPECIES, SKILLS, ELEM_CHART, ZONES, CAPTURE_ITEMS } from '../constants/index.js';
import { gameState, getFormationPets } from '../state.js';
import { calcCaptureRate, attemptCapture, pauseBattle, resumeBattle } from '../systems/capture.js';
import { spawnEnemies } from '../systems/battle.js';
import { renderHeader } from './header-ui.js';
import { showModal, closeModal } from '../utils.js';

// Capture item picker
window._showCapturePicker = function(idx) {
  pauseBattle();
  const enemy = gameState.enemies[idx];
  if (!enemy || enemy.currentHp <= 0) { resumeBattle(); return; }

  let html = '<p>目标: <strong>' + enemy.displayName + '</strong> HP:' + enemy.currentHp + '/' + enemy.maxHp + '</p>';

  const items = ['rope', 'seal', 'soul_stone', 'fairy_lock'];
  items.forEach(itemId => {
    const item = CAPTURE_ITEMS[itemId];
    const matKey = itemId;
    const stock = gameState.materials[matKey] || 0;
    const rate = calcCaptureRate(enemy, itemId);
    const disabled = stock <= 0;

    html += '<div class="capture-item-row' + (disabled ? ' disabled' : '') + '" '
      + (disabled ? '' : 'onclick="window._confirmCapture(' + idx + ',\'' + itemId + '\')"') + '>'
      + '<span style="color:' + item.color + ';font-weight:bold;">' + item.name + '</span>'
      + ' - ' + item.desc
      + '<span style="float:right;">成功率:' + Math.floor(rate) + '% | 库存:' + stock + '</span>'
      + '</div>';
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
    btn.title = z.desc + (gameState.advLv < z.unlockLv ? ' [需要冒险Lv.' + z.unlockLv + ']' : '');
    btn.onclick = () => {
      if (gameState.advLv < z.unlockLv) return;
      gameState.currentZone = idx;
      gameState.enemies = spawnEnemies();
      gameState.captureMode = false;
      gameState.captureTargetIdx = -1;
      renderBattle();
      renderZoneSelector();
    };
    el.appendChild(btn);
  });
}

export function renderBattle() {
  renderHeader();

  // === 敌方 ===
  const enemyEl = document.getElementById('enemy-side');
  if (!enemyEl) return;
  enemyEl.innerHTML = '';
  const enemyCount = Math.max(3, gameState.enemies.length);
  for (let i = 0; i < enemyCount; i++) {
    const div = document.createElement('div');
    if (i < gameState.enemies.length) {
      const e = gameState.enemies[i];
      const hpPct = Math.max(0, e.currentHp / e.maxHp * 100);
      div.className = 'battle-unit ' + e.row;
      let captureHTML = '';
      if (e.capturable && e.currentHp > 0) {
        captureHTML = '<button class="capture-btn" onclick="window._showCapturePicker(' + i + ')">✨捕捉</button>';
      }
      div.innerHTML = '<div class="unit-name"><span class="pet-elem elem-' + e.elem + '">' + ELEM_CHART[e.elem].name + '</span> ' + e.displayName + '</div>'
        + '<div class="unit-hp-bar"><div class="unit-hp-fill' + (hpPct < 30 ? ' low' : '') + '" style="width:' + hpPct + '%"></div></div>'
        + '<div class="unit-info">HP:' + Math.max(0, e.currentHp) + '/' + e.maxHp + ' ATK:' + e.atk + ' SPD:' + e.spd + '</div>'
        + captureHTML;
    } else {
      div.className = 'battle-unit empty';
      div.innerHTML = '<div class="unit-info">---</div>';
    }
    enemyEl.appendChild(div);
  }

  // === 己方 ===
  const allyEl = document.getElementById('ally-side');
  if (!allyEl) return;
  allyEl.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const div = document.createElement('div');
    const pet = gameState.formation[i];
    if (pet) {
      const hpPct = Math.max(0, pet.currentHp / pet.maxHp * 100);
      const row = i < 3 ? 'front' : 'back';
      div.className = 'battle-unit ' + row;
      const skillText = pet.skills.map(s => {
        const sd = SKILLS[s.skillId];
        return (s.cooldownLeft > 0 ? '⏳' : '✦') + sd.name + (s.enhanceLevel > 0 ? '+' + s.enhanceLevel : '');
      }).join(' | ');
      div.innerHTML = '<div class="unit-name">' + SPECIES[pet.speciesId].evoChain[pet.evoStage] + ' Lv.' + pet.level + '</div>'
        + '<div class="unit-hp-bar"><div class="unit-hp-fill' + (hpPct < 30 ? ' low' : '') + '" style="width:' + hpPct + '%"></div></div>'
        + '<div class="unit-info">HP:' + pet.currentHp + '/' + pet.maxHp + ' ATK:' + pet.atk + ' DEF:' + pet.def + ' SPD:' + pet.spd + '</div>'
        + '<div class="unit-info" style="margin-top:2px;color:#e94560;">' + (skillText || '无技能') + '</div>';
    } else {
      div.className = 'battle-unit empty';
      div.innerHTML = '<div class="slot-label">' + (i < 3 ? '前排' : '后排') + '</div><div class="unit-info">空位</div>';
    }
    allyEl.appendChild(div);
  }

  // === 战斗日志 ===
  const logEl = document.getElementById('battle-log');
  if (!logEl) return;
  logEl.innerHTML = '';
  gameState.battleLog.slice(-30).forEach(l => {
    const line = document.createElement('div');
    line.className = 'log-line ' + l.cls;
    line.textContent = l.msg;
    logEl.appendChild(line);
  });
  logEl.scrollTop = logEl.scrollHeight;
}
