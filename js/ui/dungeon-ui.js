// 副本界面 - 符文塔选层 + 实时动画战斗
import { gameState, getFormationPets } from '../state.js';
import { DUNGEON_FLOORS, STAMINA_MAX } from '../constants/index.js';
import { RUNE_SETS, RUNE_SLOTS, RUNE_QUALITY, SPECIES, SKILLS, ELEM_CHART, STATUS_EFFECTS } from '../constants/index.js';
import { showModal, showToast } from '../utils.js';
import { regenStamina, createBoss, consumeStamina, grantDungeonRewards } from '../systems/dungeon.js';
import { tryApplyStatus, applyBuff, calcHealAmount, calcShieldAmount, processStatusEffects, getEffectiveAtk, getEffectiveDef, calcDamage } from '../systems/battle.js';
import { randInt } from '../utils.js';
import { renderHeader } from './header-ui.js';
import { renderRunes } from './rune-ui.js';
import { createSpriteElement, showDamageNumber } from './sprites.js';
import { bindTooltip, skillTooltipHTML } from './tooltip.js';


// 副本战斗状态（独立于主战斗）
let _dungeonBattle = null; // { floorId, floor, allies, enemies, log, tickTimer, finished }

export function renderDungeon() {
  const el = document.getElementById('dungeon-list');
  if (!el) return;

  // 如果正在副本战斗，渲染战斗界面
  if (_dungeonBattle && !_dungeonBattle.finished) {
    renderDungeonBattle(el);
    return;
  }

  // 正常楼层列表
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

// ===== 开始副本战斗 =====

window._challengeFloor = function(floorId) {
  const floor = DUNGEON_FLOORS[floorId];
  if (!floor) return;

  regenStamina();
  if (gameState.stamina < floor.staminaCost) {
    showToast('体力不足!', 'info');
    return;
  }

  const allies = getFormationPets();
  if (allies.length === 0) {
    showToast('没有上阵宠物!', 'info');
    return;
  }

  // 确认挑战
  showModal('挑战 ' + floor.name,
    '<p>消耗 <strong>' + floor.staminaCost + '</strong> 体力挑战 ' + floor.name + '?</p>'
    + '<p>Boss等级: Lv.' + floor.bossLevel + ' (' + '★'.repeat(floor.bossStars) + ')</p>',
    [
      { text: '⚔️ 出发!', primary: true, action: () => startDungeonBattle(floorId) },
      { text: '取消', action: null }
    ]
  );
};

function startDungeonBattle(floorId) {
  const floor = DUNGEON_FLOORS[floorId];

  // 消耗体力
  consumeStamina(floor.staminaCost);
  renderHeader();

  // 创建boss
  const boss = createBoss(floor);
  if (!boss) { showToast('Boss数据异常', 'info'); return; }

  // 复制宠物（不影响主世界状态）
  const allies = getFormationPets().map(fp => ({
    ...fp.pet,
    currentHp: fp.pet.maxHp, // 副本战斗满血开始
    maxHp: fp.pet.maxHp,
    atk: fp.pet.atk,
    def: fp.pet.def,
    spd: fp.pet.spd,
    isEnemy: false,
    buffDef: 0,
    regen: 0,
    statusEffects: [],
    _runeEffects: fp.pet._runeEffects,
    talent: fp.pet.talent,
    skills: fp.pet.skills.map(s => ({ ...s, cooldownLeft: 0 }))
  }));

  _dungeonBattle = {
    floorId,
    floor,
    allies,
    enemies: [boss],
    log: ['⚔️ 挑战 ' + floor.name + ' (Lv.' + floor.bossLevel + ')'],
    finished: false,
    result: null,
    round: 0,
    tickTimer: null
  };

  // 开始战斗循环
  _dungeonBattle.tickTimer = setInterval(dungeonBattleTick, 800);

  renderDungeon();
}

// ===== 副本战斗回合 =====

function dungeonBattleTick() {
  if (!_dungeonBattle || _dungeonBattle.finished) return;

  _dungeonBattle.round++;
  const { allies, enemies, log } = _dungeonBattle;
  const round = _dungeonBattle.round;

  // 收集存活单位按速度排序
  const units = [];
  allies.forEach(a => { if (a.currentHp > 0) units.push(a); });
  enemies.forEach(e => { if (e.currentHp > 0) units.push(e); });
  units.sort((a, b) => (b.spd || 0) - (a.spd || 0));

  for (const unit of units) {
    if (unit.currentHp <= 0) continue;

    // 处理状态效果（毒/灼烧/冰冻/麻痹等）
    const { skip, silenced } = processStatusEffects(unit);
    if (skip) {
      log.push('R' + round + ' ' + unit.name + ' 无法行动!');
      if (unit.skills) unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
      continue;
    }

    // 选技能（被沉默只能普攻）
    let skill = null;
    if (!silenced && unit.skills && unit.skills.length > 0) {
      const sorted = [...unit.skills].sort((a, b) => (a.priority || 0) - (b.priority || 0));
      skill = sorted.find(s => s.cooldownLeft <= 0) || null;
    }

    const isAlly = !unit.isEnemy;
    const allyPool = isAlly ? allies.filter(a => a.currentHp > 0) : enemies.filter(e => e.currentHp > 0);
    const enemyPool = isAlly ? enemies.filter(e => e.currentHp > 0) : allies.filter(a => a.currentHp > 0);
    if (enemyPool.length === 0) break;

    const skillData = skill ? SKILLS[skill.skillId] : null;
    const eff = skillData ? skillData.statusEffect : null;

    // === 自身增益/回复 ===
    if (skillData && skillData.type === 'self') {
      if (eff) {
        if (eff.type === 'heal') {
          const h = calcHealAmount(unit, eff);
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + h);
          log.push('R' + round + ' ' + unit.name + ' ' + skillData.name + ' +' + h + 'HP');
        } else if (eff.type === 'shield') {
          const shieldAmt = calcShieldAmount(unit, eff);
          if (!unit.statusEffects) unit.statusEffects = [];
          unit.statusEffects.push({ type: 'shield', turnsLeft: 3, value: shieldAmt });
          log.push('R' + round + ' ' + unit.name + ' ' + skillData.name + ' 护盾+' + shieldAmt);
        } else if (eff.type === 'regen') {
          if (!unit.statusEffects) unit.statusEffects = [];
          unit.statusEffects.push({ type: 'regen', turnsLeft: eff.duration || 3, value: 0 });
          log.push('R' + round + ' ' + unit.name + ' ' + skillData.name + ' 持续回复');
        } else {
          applyBuff(unit, unit, eff);
          log.push('R' + round + ' ' + unit.name + ' ' + skillData.name);
        }
      }
      skill.cooldownLeft = skillData.cooldown || 0;
      unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
      continue;
    }

    // === ally_single: 治疗血最低队友 ===
    if (skillData && skillData.type === 'ally_single') {
      if (eff) {
        let target = null, minRatio = 2;
        allyPool.forEach(a => {
          const ratio = a.currentHp / a.maxHp;
          if (ratio < minRatio) { minRatio = ratio; target = a; }
        });
        if (!target) target = unit;
        if (eff.type === 'heal' || eff.type === 'purify') {
          const h = calcHealAmount(unit, eff);
          target.currentHp = Math.min(target.maxHp, target.currentHp + h);
          log.push('R' + round + ' ' + unit.name + ' ' + skillData.name + ' → ' + target.name + ' +' + h + 'HP');
        }
      }
      skill.cooldownLeft = skillData.cooldown || 0;
      unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
      continue;
    }

    // === ally_all: 全体队友技能 ===
    if (skillData && skillData.type === 'ally_all') {
      if (eff) {
        if (eff.type === 'heal') {
          const h = calcHealAmount(unit, eff);
          allyPool.forEach(a => { a.currentHp = Math.min(a.maxHp, a.currentHp + h); });
          log.push('R' + round + ' ' + unit.name + ' ' + skillData.name + ' 全队+' + h + 'HP');
        } else if (eff.type === 'cleanse' && eff.cleanseAll) {
          allyPool.forEach(a => {
            if (a.statusEffects) a.statusEffects = a.statusEffects.filter(s => { const m = STATUS_EFFECTS[s.type]; return !(m && m.isDebuff); });
          });
          log.push('R' + round + ' ' + unit.name + ' ' + skillData.name + ' 驱散全队负面');
        } else {
          allyPool.forEach(a => applyBuff(unit, a, eff));
          log.push('R' + round + ' ' + unit.name + ' ' + skillData.name);
        }
      }
      skill.cooldownLeft = skillData.cooldown || 0;
      unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
      continue;
    }

    // === 联动技 ===
    if (skillData && skillData.type === 'link') {
      const linkElem = skillData.linkElem;
      const linkMin = skillData.linkMin || 2;
      const sameElemAllies = allyPool.filter(a => a.elem === linkElem);

      if (sameElemAllies.length < linkMin) {
        log.push('R' + round + ' ' + unit.name + ' ' + skillData.name + ' 同元素不足!');
        skill.cooldownLeft = 2;
        unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
        continue;
      }

      log.push('R' + round + ' 【联动技】' + skillData.name + ' 发动!');

      // 同元素宠物各攻击一次
      if (enemyPool.length > 0 && skillData.power > 0) {
        sameElemAllies.forEach(ally => {
          if (ally.currentHp <= 0) return;
          const target = enemyPool[Math.floor(Math.random() * enemyPool.length)];
          if (!target || target.currentHp <= 0) return;
          const result = calcDamage(ally, target, { ...skillData, enhanceLevel: skill.enhanceLevel || 0 });
          let dmg = result.damage;
          // 护盾吸收
          if (target.statusEffects) {
            const shield = target.statusEffects.find(s => s.type === 'shield');
            if (shield && shield.value > 0) {
              const absorbed = Math.min(shield.value, dmg);
              shield.value -= absorbed; dmg -= absorbed;
              if (shield.value <= 0) target.statusEffects = target.statusEffects.filter(s => s.type !== 'shield');
            }
          }
          target.currentHp = Math.max(0, target.currentHp - dmg);
          log.push('  ' + ally.name + ' 联动攻击 ' + target.name + ' ' + dmg + (result.isCrit ? '暴击!' : ''));
        });
      }

      // 对敌方施加状态
      if (eff) { enemyPool.forEach(t => { if (t.currentHp > 0) tryApplyStatus(unit, t, eff); }); }

      // 联动治疗
      if (skillData.linkHeal) {
        if (skillData.linkHeal.type === 'regen') {
          allyPool.forEach(a => { if (!a.statusEffects) a.statusEffects = []; a.statusEffects.push({ type: 'regen', turnsLeft: skillData.linkHeal.duration || 3, value: 0 }); });
          log.push('  全队持续回复!');
        } else {
          const h = calcHealAmount(unit, skillData.linkHeal);
          allyPool.forEach(a => { a.currentHp = Math.min(a.maxHp, a.currentHp + h); });
          log.push('  全队回复 ' + h + ' HP!');
        }
      }

      // 联动buff
      if (skillData.linkBuff) {
        const lb = skillData.linkBuff;
        allyPool.forEach(a => {
          if (!a.statusEffects) a.statusEffects = [];
          if (lb.speedUp) a.statusEffects.push({ type: 'speedUp', turnsLeft: lb.speedUpDuration || 2, value: 0.30 });
          if (lb.evasion) a.statusEffects.push({ type: 'evasion', turnsLeft: lb.evasionDuration || 2, value: lb.evasion });
        });
      }

      // cleanse_and_shield
      if (eff && eff.type === 'cleanse_and_shield') {
        allyPool.forEach(a => { if (a.statusEffects) a.statusEffects = a.statusEffects.filter(s => { const m = STATUS_EFFECTS[s.type]; return !(m && m.isDebuff); }); });
        const shieldAmt = calcShieldAmount(unit, { defRatio: eff.shieldDefRatio || 1.5, hpRatio: eff.shieldHpRatio || 0.04 });
        allyPool.forEach(a => { if (!a.statusEffects) a.statusEffects = []; a.statusEffects.push({ type: 'shield', turnsLeft: 3, value: shieldAmt }); });
        log.push('  驱散全负面 + 全队护盾 ' + shieldAmt);
      }

      // 全队buff（defUp/atkUp）
      if (eff && (eff.type === 'defUp' || eff.type === 'atkUp') && eff.baseChance >= 1.0) {
        allyPool.forEach(a => applyBuff(unit, a, eff));
      }

      skill.cooldownLeft = skillData.cooldown || 0;
      unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });

      if (enemies.every(e => e.currentHp <= 0) || allies.every(a => a.currentHp <= 0)) break;
      continue;
    }

    // === 伤害技能 (single / aoe) 或普攻 ===
    const targets = (skillData && skillData.type === 'aoe')
      ? enemyPool
      : [enemyPool[randInt(0, enemyPool.length - 1)]];

    targets.forEach(target => {
      if (!target || target.currentHp <= 0) return;
      const power = skillData ? skillData.power : 50;
      const atkVal = getEffectiveAtk(unit);
      const defVal = getEffectiveDef(target);
      let dmg = Math.max(1, Math.floor((power * atkVal / (defVal + 50))) + randInt(-3, 3));
      const isCrit = Math.random() < 0.1;
      if (isCrit) dmg = Math.floor(dmg * 1.5);
      if (!unit.isEnemy && unit.talent === 'fierce') dmg = Math.floor(dmg * 1.08);

      // 护盾吸收
      if (target.statusEffects) {
        const shield = target.statusEffects.find(s => s.type === 'shield');
        if (shield && shield.value > 0) {
          const absorbed = Math.min(shield.value, dmg);
          shield.value -= absorbed; dmg -= absorbed;
          if (shield.value <= 0) target.statusEffects = target.statusEffects.filter(s => s.type !== 'shield');
        }
      }

      // 符文吸血
      if (!unit.isEnemy && unit._runeEffects && unit._runeEffects.pctStats.lifesteal > 0) {
        const ls = Math.floor(dmg * unit._runeEffects.pctStats.lifesteal / 100);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + ls);
      }

      target.currentHp = Math.max(0, target.currentHp - dmg);
      const skillName = skillData ? skillData.name : '普攻';
      const critText = isCrit ? '暴击!' : '';
      log.push('R' + round + ' ' + unit.name + ' → ' + skillName + ' → ' + target.name + ' ' + dmg + critText + (target.currentHp <= 0 ? ' 💀' : ''));

      // 施加状态效果
      if (eff) tryApplyStatus(unit, target, eff);
    });

    if (skill) skill.cooldownLeft = skillData ? (skillData.cooldown || 0) : 0;
    if (unit.skills) unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });

    if (enemies.every(e => e.currentHp <= 0) || allies.every(a => a.currentHp <= 0)) break;
  }

  // 检查战斗结束
  if (enemies.every(e => e.currentHp <= 0)) {
    finishDungeonBattle(true);
  } else if (allies.every(a => a.currentHp <= 0)) {
    finishDungeonBattle(false);
  } else if (_dungeonBattle.round >= 100) {
    finishDungeonBattle(false);
  }

  renderDungeon();
}

function finishDungeonBattle(victory) {
  if (!_dungeonBattle) return;
  clearInterval(_dungeonBattle.tickTimer);
  _dungeonBattle.finished = true;
  _dungeonBattle.result = { success: victory, rewards: { gold: 0, exp: 0, runes: [] } };

  const { floor, floorId, log } = _dungeonBattle;

  if (victory) {
    log.push('🎉 胜利! 击败了 ' + floor.name);
    const rewards = grantDungeonRewards(floorId, floor);
    _dungeonBattle.result.rewards = rewards;
    rewards.runes.forEach(r => {
      const set = RUNE_SETS[r.setId];
      const slot = RUNE_SLOTS[r.slotType];
      log.push('🔮 获得符文: ' + (set ? set.icon + set.name : '') + '·' + slot.name);
    });
    log.push('💰 金币+' + rewards.gold + '  经验+' + rewards.exp);
  } else {
    log.push('💀 挑战失败... ' + floor.name + ' 太强了');
  }

  renderDungeon();
}

// ===== 副本战斗界面渲染 =====

function renderDungeonBattle(container) {
  container.innerHTML = '';

  const { allies, enemies, log, finished, result, floor } = _dungeonBattle;

  // 标题
  const title = document.createElement('div');
  title.className = 'dungeon-stamina';
  title.innerHTML = '⚔️ <strong>' + floor.name + '</strong> Lv.' + floor.bossLevel + ' | 回合 ' + _dungeonBattle.round;
  container.appendChild(title);

  // 战斗区域 - 左右对阵
  const battleArea = document.createElement('div');
  battleArea.style.cssText = 'display:flex;align-items:stretch;gap:0;margin:8px 0;';

  const allyPanel = document.createElement('div');
  allyPanel.className = 'battle-team ally-team';

  const vsDiv = document.createElement('div');
  vsDiv.className = 'battle-vs';
  vsDiv.textContent = 'VS';

  const enemyPanel = document.createElement('div');
  enemyPanel.className = 'battle-team enemy-team';

  // 己方
  allies.forEach((a, idx) => {
    const card = createDungeonUnitCard(a, idx, false);
    allyPanel.appendChild(card);
  });

  // 敌方
  enemies.forEach((e, idx) => {
    const card = createDungeonUnitCard(e, idx, true);
    enemyPanel.appendChild(card);
  });

  battleArea.appendChild(allyPanel);
  battleArea.appendChild(vsDiv);
  battleArea.appendChild(enemyPanel);
  container.appendChild(battleArea);

  // 战斗日志
  const logDiv = document.createElement('div');
  logDiv.id = 'dungeon-battle-log';
  logDiv.style.cssText = 'max-height:200px;overflow-y:auto;background:rgba(0,0,0,0.3);border-radius:8px;padding:8px;font-size:11px;line-height:1.6;';
  log.slice(-15).forEach(line => {
    const p = document.createElement('div');
    p.style.color = line.includes('💀') || line.includes('失败') ? '#ef5350' :
                     line.includes('🎉') || line.includes('胜利') ? '#4caf50' :
                     line.includes('🔮') ? '#ce93d8' :
                     line.includes('💰') ? '#ff9800' : '#999';
    p.textContent = line;
    logDiv.appendChild(p);
  });
  container.appendChild(logDiv);
  logDiv.scrollTop = logDiv.scrollHeight;

  // 结束按钮
  if (finished) {
    const btnArea = document.createElement('div');
    btnArea.style.cssText = 'text-align:center;margin-top:10px;';
    const btn = document.createElement('button');
    btn.className = 'dungeon-btn';
    btn.style.cssText = 'padding:8px 20px;font-size:14px;';
    btn.textContent = result.success ? '🎉 查看奖励并返回' : '💀 返回楼层列表';
    btn.onclick = () => {
      if (result.success && result.rewards.runes.length > 0) {
        showRewardsModal(result.rewards);
      }
      _dungeonBattle = null;
      renderDungeon();
      renderHeader();
    };
    btnArea.appendChild(btn);
    container.appendChild(btnArea);
  }
}

function createDungeonUnitCard(unit, idx, isEnemy) {
  const div = document.createElement('div');
  const alive = unit.currentHp > 0;
  const hpPct = Math.max(0, unit.currentHp / unit.maxHp * 100);
  const speciesId = unit.speciesId || 'hundun';
  const sp = SPECIES[speciesId];

  div.className = 'battle-unit-card' + (alive ? '' : ' dead') + (isEnemy ? ' enemy' : ' ally');

  // 精灵
  const spriteWrap = document.createElement('div');
  spriteWrap.className = 'unit-sprite-wrap';
  const sprite = createSpriteElement(speciesId, 48, isEnemy);
  spriteWrap.appendChild(sprite);
  if (!alive) spriteWrap.style.opacity = '0.3';

  // 信息
  const info = document.createElement('div');
  info.className = 'unit-info-panel';

  const nameRow = document.createElement('div');
  nameRow.className = 'unit-name-row';
  const stars = unit.stars || 0;
  const starHTML = stars > 0 ? '<span class="star-rating star-' + stars + '">' + '★'.repeat(stars) + '</span> ' : '';
  const elemName = ELEM_CHART[unit.elem] ? ELEM_CHART[unit.elem].name : '';
  const displayName = isEnemy ? (unit.displayName || unit.name) : (unit.name + ' Lv.' + unit.level);
  nameRow.innerHTML = starHTML + '<span class="pet-elem elem-' + unit.elem + '">' + elemName + '</span> ' + displayName;

  const hpBar = document.createElement('div');
  hpBar.className = 'unit-hp-bar';
  hpBar.innerHTML = '<div class="unit-hp-fill' + (hpPct < 30 ? ' low' : '') + '" style="width:' + hpPct + '%"></div>';

  const hpText = document.createElement('div');
  hpText.className = 'unit-hp-text';
  hpText.textContent = Math.max(0, Math.floor(unit.currentHp)) + '/' + unit.maxHp;

  info.appendChild(nameRow);
  info.appendChild(hpBar);
  info.appendChild(hpText);

  // 技能
  if (unit.skills && unit.skills.length > 0) {
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

  // 状态效果图标
  if (unit.statusEffects && unit.statusEffects.length > 0) {
    const statusRow = document.createElement('div');
    statusRow.className = 'unit-status-row';
    unit.statusEffects.forEach(se => {
      const meta = STATUS_EFFECTS[se.type];
      if (!meta) return;
      const icon = document.createElement('span');
      icon.className = 'status-icon' + (meta.isDebuff ? ' debuff' : ' buff');
      icon.textContent = meta.icon;
      icon.title = meta.name + ' (' + se.turnsLeft + '回合)';
      statusRow.appendChild(icon);
    });
    info.appendChild(statusRow);
  }

  div.appendChild(spriteWrap);
  div.appendChild(info);
  return div;
}

function showRewardsModal(rewards) {
  let html = '<div style="padding:8px;">';
  html += '<p style="color:#ff9800;">💰 金币 +' + rewards.gold + '</p>';
  html += '<p style="color:#4caf50;">经验 +' + rewards.exp + '</p>';
  if (rewards.runes.length > 0) {
    html += '<p style="color:#ce93d8;margin-top:8px;">获得符文:</p>';
    rewards.runes.forEach(rune => {
      const set = RUNE_SETS[rune.setId];
      const qual = RUNE_QUALITY[rune.quality];
      const slot = RUNE_SLOTS[rune.slotType];
      html += '<div style="padding:4px;margin:2px 0;color:' + (qual ? qual.color : '#fff') + ';">'
        + (set ? set.icon + ' ' + set.name : '') + ' · ' + slot.name + ' [' + (qual ? qual.name : '') + ']'
        + '</div>';
    });
  }
  html += '</div>';
  showModal('🎉 战斗奖励', html, [{ text: '确定', action: () => renderRunes() }]);
}
