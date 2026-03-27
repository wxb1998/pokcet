// 副本界面 - 符文塔选层 + 战斗结果
import { gameState } from '../state.js';
import { DUNGEON_FLOORS, STAMINA_MAX } from '../constants/index.js';
import { RUNE_SETS } from '../constants/index.js';
import { showModal } from '../utils.js';
import { challengeFloor, regenStamina } from '../systems/dungeon.js';
import { renderHeader } from './header-ui.js';
import { renderRunes } from './rune-ui.js';

export function renderDungeon() {
  const el = document.getElementById('dungeon-list');
  if (!el) return;

  regenStamina();

  el.innerHTML = '<div class="dungeon-stamina">⚡ 体力: <strong>' + gameState.stamina + '</strong> / ' + STAMINA_MAX + '</div>';

  DUNGEON_FLOORS.forEach((floor, idx) => {
    const cleared = gameState.dungeonProgress && gameState.dungeonProgress[idx];
    const canChallenge = gameState.stamina >= floor.staminaCost;
    const setsText = floor.runeDropSets.map(s => RUNE_SETS[s] ? RUNE_SETS[s].icon + RUNE_SETS[s].name : s).join(' ');

    const div = document.createElement('div');
    div.className = 'dungeon-floor' + (cleared ? ' cleared' : '') + (!canChallenge ? ' no-stamina' : '');

    div.innerHTML = '<div class="floor-header">'
      + '<span class="floor-name">' + floor.name + '</span>'
      + '<span class="floor-level">Lv.' + floor.bossLevel + '</span>'
      + (cleared ? ' <span class="floor-cleared">✅</span>' : '')
      + '</div>'
      + '<div class="floor-desc">' + floor.desc + '</div>'
      + '<div class="floor-info">'
      + '<span>体力: ' + floor.staminaCost + '</span>'
      + '<span>掉落: ' + setsText + '</span>'
      + '</div>'
      + '<div class="floor-actions">'
      + '<button class="btn-sm dungeon-btn" ' + (canChallenge ? 'onclick="window._challengeFloor(' + idx + ')"' : 'disabled') + '>'
      + (canChallenge ? '⚔️ 挑战' : '体力不足') + '</button>'
      + '</div>';

    el.appendChild(div);
  });
}

window._challengeFloor = function(floorId) {
  const floor = DUNGEON_FLOORS[floorId];
  if (!floor) return;

  // 确认挑战
  showModal('挑战 ' + floor.name,
    '<p>消耗 <strong>' + floor.staminaCost + '</strong> 体力挑战 ' + floor.name + '?</p>'
    + '<p>Boss等级: Lv.' + floor.bossLevel + ' (' + '★'.repeat(floor.bossStars) + ')</p>',
    [
      { text: '挑战!', primary: true, action: () => {
        const result = challengeFloor(floorId);
        showBattleResult(floor, result);
        renderDungeon();
        renderHeader();
      }},
      { text: '取消', action: null }
    ]
  );
};

function showBattleResult(floor, result) {
  let html = '<div class="dungeon-log" style="max-height:300px;overflow-y:auto;text-align:left;font-size:12px;line-height:1.6;">';

  result.log.forEach(line => {
    let cls = '';
    if (line.includes('💀') || line.includes('失败')) cls = 'style="color:#ef5350;"';
    else if (line.includes('🎉') || line.includes('胜利')) cls = 'style="color:#4caf50;"';
    else if (line.includes('🔮')) cls = 'style="color:#ce93d8;"';
    else if (line.includes('💰')) cls = 'style="color:#ff9800;"';
    html += '<p ' + cls + '>' + line + '</p>';
  });

  html += '</div>';

  if (result.success && result.rewards.runes.length > 0) {
    html += '<div style="margin-top:8px;padding:8px;background:#1a1a2e;border-radius:6px;">';
    html += '<p style="color:#ce93d8;font-size:13px;">获得符文:</p>';
    result.rewards.runes.forEach(rune => {
      const set = RUNE_SETS[rune.setId];
      html += '<p style="font-size:12px;color:' + (set ? set.color : '#fff') + ';">'
        + (set ? set.icon + ' ' + set.name : '') + ' · 槽位' + (rune.slotType + 1) + '</p>';
    });
    html += '</div>';
  }

  const title = result.success ? '🎉 挑战成功!' : '💀 挑战失败';
  showModal(title, html, [{ text: '确定', action: () => { if (result.success) renderRunes(); } }]);
}
