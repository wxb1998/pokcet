// 战斗系统：敌人生成、回合处理、胜负判定
import { SPECIES, SKILLS, ELEM_CHART, ZONES, PASSIVE_POOL, TALENTS, STATUS_EFFECTS, scalingRatio } from '../constants/index.js';
import { gameState, getFormationPets } from '../state.js';
import { randInt, pick, weightedPick, showToast, addLog } from '../utils.js';
import { gainExp } from './pet.js';
import { tryComprehend } from './comprehend.js';
import { generateTreasure } from './treasure.js';
import { QUALITY_NAMES } from '../constants/treasure-data.js';

// ===== 敌人生成 =====

export function spawnEnemies() {
  const zone = ZONES[gameState.currentZone];
  const allyCount = getFormationPets().length;
  let enemyCount;
  if (allyCount <= 1) enemyCount = 1;
  else if (allyCount === 2) enemyCount = randInt(2, 3);
  else enemyCount = randInt(2, 4);

  const enemies = [];
  for (let i = 0; i < enemyCount; i++) {
    const speciesId = pick(zone.species);
    const sp = SPECIES[speciesId];
    const lv = randInt(zone.lvRange[0], zone.lvRange[1]);

    // Star rating system
    const starRoll = Math.random();
    let stars = 0;
    if (starRoll < 0.06) stars = 3;
    else if (starRoll < 0.18) stars = 2;
    else if (starRoll < 0.40) stars = 1;

    const starMult = stars === 3 ? 1.8 : (stars === 2 ? 1.3 : (stars === 1 ? 1.1 : 1.0));
    const starPrefix = '★'.repeat(stars);

    // Generate enemy IVs for star display/capture reference
    const enemyIVs = {
      hp: randInt(0, 31), atk: randInt(0, 31), def: randInt(0, 31), spd: randInt(0, 31)
    };

    // Ensure star requirements are met
    if (stars >= 1) {
      const stats = ['hp', 'atk', 'def', 'spd'];
      const boostCount = stars === 3 ? 3 : (stars === 2 ? 2 : 1);
      const shuffled = stats.sort(() => Math.random() - 0.5);
      for (let j = 0; j < boostCount; j++) {
        const minIV = stars === 3 ? 27 : (stars === 2 ? 25 : 20);
        if (enemyIVs[shuffled[j]] < minIV) enemyIVs[shuffled[j]] = randInt(minIV, 31);
      }
    }

    const hp = Math.floor((sp.baseStats.hp + randInt(5,20)) * (1 + (lv-1)*0.06) * 5 * starMult);

    enemies.push({
      speciesId,
      name: starPrefix + sp.name + ' Lv.' + lv,
      displayName: starPrefix + sp.evoChain[Math.min(2, Math.floor(lv / 15))],
      elem: sp.elem,
      level: lv,
      atk: Math.floor((sp.baseStats.atk + randInt(5,15)) * (1 + (lv-1)*0.06) * starMult),
      def: Math.floor((sp.baseStats.def + randInt(5,15)) * (1 + (lv-1)*0.06) * starMult),
      spd: Math.floor((sp.baseStats.spd + randInt(5,15)) * (1 + (lv-1)*0.06) * starMult),
      maxHp: hp,
      currentHp: hp,
      stars,
      capturable: true,
      enemyIVs,
      captureSpecies: speciesId,
      row: i < Math.ceil(enemyCount / 2) ? 'front' : 'back',
      isEnemy: true,
      skills: [],
      buffDef: 0,
      regen: 0,
      statusEffects: []
    });

    if (!gameState.dex[speciesId]) gameState.dex[speciesId] = { seen: true, caught: false };
    else gameState.dex[speciesId].seen = true;

    // Assign enemy skills based on level (新4级系统)
    const skillPool = sp.skillPool;
    const enemySkills = [];

    // Common skill (always)
    if (skillPool.common && skillPool.common.length > 0) {
      const s = pick(skillPool.common);
      enemySkills.push({skillId: s, enhanceLevel: 0, cooldownLeft: 0, priority: 0});
    }

    // Fine skill (lv >= 10)
    if (lv >= 10 && skillPool.fine && skillPool.fine.length > 0) {
      const s = pick(skillPool.fine);
      enemySkills.push({skillId: s, enhanceLevel: 0, cooldownLeft: 0, priority: 1});
    }

    // Second fine skill (lv >= 20)
    if (lv >= 20 && skillPool.fine && skillPool.fine.length > 1) {
      const remaining = skillPool.fine.filter(s => !enemySkills.find(es => es.skillId === s));
      if (remaining.length > 0) {
        enemySkills.push({skillId: pick(remaining), enhanceLevel: 0, cooldownLeft: 0, priority: 1});
      }
    }

    // Rare skill (lv >= 30)
    if (lv >= 30 && skillPool.rare && skillPool.rare.length > 0) {
      const s = pick(skillPool.rare);
      enemySkills.push({skillId: s, enhanceLevel: 0, cooldownLeft: 0, priority: 2});
    }

    // 3星怪（Boss级）技能冷却归零
    if (stars >= 3) {
      enemySkills.forEach(s => s.cooldownLeft = 0);
    }

    enemies[enemies.length - 1].skills = enemySkills;

    // Auto-save to reserve if meets threshold
    if (enemies[i].stars >= gameState.reserveThreshold && gameState.reserve.length < 10) {
      gameState.reserve.push({
        speciesId,
        stars: enemies[i].stars,
        level: lv,
        ivs: enemyIVs,
        displayName: starPrefix + sp.evoChain[Math.min(2, Math.floor(lv / 15))],
        timestamp: Date.now()
      });
      showToast(starPrefix + ' ' + sp.name + ' 已保存到极品栏!', 'capture');
    }
  }
  return enemies;
}

// ===== 状态效果系统 =====

/** 尝试给目标施加状态效果 */
function tryApplyStatus(caster, target, effect) {
  if (!effect || !effect.type) return;
  if (!target.statusEffects) target.statusEffects = [];
  const sType = effect.type;

  // 跳过非debuff类（buff类直接在别处处理）
  const meta = STATUS_EFFECTS[sType];
  if (!meta) return;

  // 概率判定 + 属性缩放
  let chance = effect.baseChance || 0;
  if (effect.scaling === 'spd:spd') {
    chance *= scalingRatio(caster.spd, target.spd);
  } else if (effect.scaling === 'atk:def') {
    chance *= scalingRatio(caster.atk, target.def);
  } else if (effect.scaling === 'atk:atk') {
    chance *= scalingRatio(caster.atk, target.atk);
  }
  chance = Math.min(0.90, chance); // 上限90%

  if (Math.random() > chance) return;

  // 检查是否可叠加
  const existing = target.statusEffects.find(s => s.type === sType);
  if (existing) {
    if (meta.stackable && effect.stacks) {
      existing.stacks = Math.min((existing.stacks || 1) + (effect.stacks || 1), meta.maxStacks || 3);
      existing.turnsLeft = Math.max(existing.turnsLeft, effect.duration || 2);
    } else {
      // 不可叠加：刷新持续时间
      existing.turnsLeft = Math.max(existing.turnsLeft, effect.duration || 2);
      if (effect.value) existing.value = Math.max(existing.value || 0, effect.value);
    }
  } else {
    target.statusEffects.push({
      type: sType,
      turnsLeft: effect.duration || 2,
      stacks: effect.stacks || 1,
      value: effect.value || 0
    });
  }
  const statusName = meta.name || sType;
  addLog((target.displayName || target.name) + ' 陷入了' + statusName + '状态!', 'log-skill');
}

/** 给自己/队友施加buff */
function applyBuff(caster, target, effect) {
  if (!target.statusEffects) target.statusEffects = [];
  const sType = effect.type;
  if (sType === 'heal' || sType === 'purify' || sType === 'cleanse' || sType === 'teamHeal' || sType === 'cleanse_and_shield') return; // 这些单独处理

  let value = effect.value || 0;
  // 缩放
  if (effect.scaling === 'atk') {
    value *= (1 + caster.atk / 500);
  }
  const existing = target.statusEffects.find(s => s.type === sType);
  if (existing) {
    existing.turnsLeft = Math.max(existing.turnsLeft, effect.duration || 2);
    existing.value = Math.max(existing.value || 0, value);
  } else {
    target.statusEffects.push({ type: sType, turnsLeft: effect.duration || 2, value });
  }
}

/** 计算治疗量 */
function calcHealAmount(caster, effect) {
  const base = effect.baseHeal || 0;
  const atkBonus = (effect.atkRatio || 0) * (caster.atk || 50);
  const hpBonus = (effect.hpRatio || 0) * (caster.maxHp || 500);
  return Math.floor(base + atkBonus + hpBonus);
}

/** 计算护盾量 */
function calcShieldAmount(caster, effect) {
  const defBonus = (effect.defRatio || 0) * (caster.def || 50);
  const hpBonus = (effect.hpRatio || 0) * (caster.maxHp || 500);
  return Math.floor(defBonus + hpBonus);
}

/** 处理单位回合开始的状态效果 */
function processStatusEffects(unit) {
  if (!unit.statusEffects) { unit.statusEffects = []; return { skip: false, silenced: false }; }
  let skip = false;
  let silenced = false;

  for (const se of unit.statusEffects) {
    switch (se.type) {
      case 'poison': {
        // 每回合伤害：3% × stacks × (atk/def缩放已在施加时决定)
        const dmg = Math.floor(unit.maxHp * 0.03 * (se.stacks || 1));
        unit.currentHp = Math.max(1, unit.currentHp - dmg);
        addLog((unit.displayName || unit.name) + ' 受到中毒伤害 ' + dmg, 'log-enemy-dmg');
        break;
      }
      case 'burn': {
        const dmg = Math.floor(unit.maxHp * 0.04);
        unit.currentHp = Math.max(1, unit.currentHp - dmg);
        addLog((unit.displayName || unit.name) + ' 受到灼烧伤害 ' + dmg, 'log-enemy-dmg');
        break;
      }
      case 'freeze':
        addLog((unit.displayName || unit.name) + ' 被冰冻，无法行动!', 'log-skill');
        skip = true;
        break;
      case 'paralyze':
        if (Math.random() < 0.25) {
          addLog((unit.displayName || unit.name) + ' 麻痹发作，无法行动!', 'log-skill');
          skip = true;
        }
        break;
      case 'confuse':
        // 混乱在攻击时处理（可能打队友），这里只标记
        break;
      case 'silence':
        silenced = true;
        break;
      case 'regen': {
        const h = Math.floor(unit.maxHp * 0.06);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + h);
        addLog((unit.displayName || unit.name) + ' 持续回复 ' + h + ' HP', 'log-heal');
        break;
      }
    }
  }

  // 减少持续时间，移除到期的
  unit.statusEffects = unit.statusEffects.filter(se => {
    se.turnsLeft--;
    return se.turnsLeft > 0;
  });

  return { skip, silenced };
}

/** 获取单位有效攻击力（含buff/debuff） */
function getEffectiveAtk(unit) {
  let atk = unit.atk || 50;
  if (!unit.statusEffects) return atk;
  unit.statusEffects.forEach(se => {
    if (se.type === 'atkUp') atk = Math.floor(atk * (1 + (se.value || 0.15)));
    if (se.type === 'atkDown') atk = Math.floor(atk * (1 - (se.value || 0.15)));
  });
  return atk;
}

/** 获取单位有效防御力 */
function getEffectiveDef(unit) {
  let def = unit.def || 30;
  if (!unit.statusEffects) return def;
  unit.statusEffects.forEach(se => {
    if (se.type === 'defUp') def = Math.floor(def * (1 + (se.value || 0.25)));
    if (se.type === 'defDown') def = Math.floor(def * (1 - (se.value || 0.25)));
  });
  return def;
}

/** 检查嘲讽目标 */
function getTauntTarget(isEnemyAttacker) {
  if (isEnemyAttacker) {
    // 敌方攻击时，检查己方是否有嘲讽单位
    for (let i = 0; i < 6; i++) {
      const p = gameState.formation[i];
      if (p && p.currentHp > 0 && p.statusEffects) {
        if (p.statusEffects.find(s => s.type === 'taunt')) return p;
      }
    }
  }
  return null;
}

// ===== 元素克制 =====

function getElemMultiplier(atkElem, defElem) {
  const chart = ELEM_CHART[atkElem];
  if (!chart) return 1.0;
  if (chart.strong.indexOf(defElem) >= 0) return 1.5;
  if (chart.weak.indexOf(defElem) >= 0) return 0.7;
  return 1.0;
}

// ===== 前排全灭检测 =====

function allFrontDead(isEnemy) {
  if (isEnemy) {
    return gameState.enemies.filter(e => e.row === 'front' && e.currentHp > 0).length === 0;
  }
  for (let i = 0; i < 3; i++) {
    if (gameState.formation[i] && gameState.formation[i].currentHp > 0) return false;
  }
  return true;
}

// ===== 伤害计算 =====

export function calcDamage(attacker, defender, skillData) {
  const power = skillData ? skillData.power : 50;
  const enhanceBonus = 1 + (skillData.enhanceLevel || 0) * 0.12;  // 每级+12%
  const atkVal = getEffectiveAtk(attacker);
  const defVal = getEffectiveDef(defender);
  const elemMult = getElemMultiplier(
    skillData ? skillData.elem : (attacker.elem || 'normal'),
    defender.elem || 'normal'
  );
  const rowMult = (defender.row === 'back' && !allFrontDead(defender.isEnemy)) ? 0.7 : 1.0;

  let critRate = 0.05;
  let critDmg = 1.5;
  // 旧宝物系统暴击加成（兼容）
  if (!attacker.isEnemy && attacker.treasure) {
    attacker.treasure.affixes.forEach(af => {
      if (af.id === 'crit_rate') critRate += af.value / 100;
      if (af.id === 'crit_dmg') critDmg += af.value / 100;
    });
  }
  // 符文暴击加成
  if (!attacker.isEnemy && attacker._runeEffects) {
    critRate += (attacker._runeEffects.pctStats.crit_rate || 0) / 100;
    critDmg += (attacker._runeEffects.pctStats.crit_dmg || 0) / 100;
  }
  const isCrit = Math.random() < critRate;
  const critMult = isCrit ? critDmg : 1.0;
  // 护盾吸收
  let shieldAbsorb = 0;
  if (defender.statusEffects) {
    const shield = defender.statusEffects.find(s => s.type === 'shield');
    if (shield) shieldAbsorb = shield.value || 0;
  }

  let baseDmg = Math.floor((power * atkVal / (defVal + 50)) * elemMult * rowMult * critMult * enhanceBonus);
  baseDmg = Math.max(1, baseDmg + randInt(-2, 2));

  // Talent: fierce (猛攻) +8% damage
  if (!attacker.isEnemy && attacker.talent === 'fierce') {
    baseDmg = Math.floor(baseDmg * 1.08);
  }

  // Talent: thickskin (厚皮) reduce crit damage taken
  if (!defender.isEnemy && defender.talent === 'thickskin' && isCrit) {
    baseDmg = Math.floor(baseDmg * 0.7); // 30% less crit damage
  }

  return { damage: baseDmg, isCrit, elemMult };
}

// ===== 选择目标 =====

function pickTarget(attacker, skillType) {
  if (attacker.isEnemy) {
    const allies = [];
    for (let i = 0; i < 6; i++) {
      if (gameState.formation[i] && gameState.formation[i].currentHp > 0) {
        allies.push(gameState.formation[i]);
      }
    }
    if (allies.length === 0) return null;
    if (skillType === 'aoe') return allies;
    const frontAlive = allies.filter(p => gameState.formation.indexOf(p) < 3);
    if (frontAlive.length > 0) return [pick(frontAlive)];
    return [pick(allies)];
  } else {
    const enemiesAlive = gameState.enemies.filter(e => e.currentHp > 0);
    if (enemiesAlive.length === 0) return null;
    if (skillType === 'aoe') return enemiesAlive;
    if (gameState.captureMode && gameState.captureTargetIdx >= 0) {
      const ct = gameState.enemies[gameState.captureTargetIdx];
      if (ct && ct.currentHp > 0) return [ct];
    }
    const frontEnemies = enemiesAlive.filter(e => e.row === 'front');
    if (frontEnemies.length > 0) return [pick(frontEnemies)];
    return [pick(enemiesAlive)];
  }
}

// ===== 技能执行 =====

function executeSkill(unit, skillSlot) {
  const skillData = SKILLS[skillSlot.skillId];
  if (!skillData) return;

  const sidePrefix = unit.isEnemy ? '【敌】' : '【我】';
  const eff = skillData.statusEffect;

  // === 自身增益/回复 ===
  if (skillData.type === 'self') {
    if (eff) {
      if (eff.type === 'heal') {
        const h = calcHealAmount(unit, eff);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + h);
        addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，回复 ' + h + ' HP!', 'log-heal');
      } else if (eff.type === 'shield') {
        const shieldAmt = calcShieldAmount(unit, eff);
        if (!unit.statusEffects) unit.statusEffects = [];
        const existing = unit.statusEffects.find(s => s.type === 'shield');
        if (existing) { existing.value = shieldAmt; existing.turnsLeft = 3; }
        else unit.statusEffects.push({ type:'shield', turnsLeft:3, value:shieldAmt });
        addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，生成 ' + shieldAmt + ' 点护盾!', 'log-skill');
      } else if (eff.type === 'regen') {
        if (!unit.statusEffects) unit.statusEffects = [];
        unit.statusEffects.push({ type:'regen', turnsLeft: eff.duration || 3, value:0 });
        addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，持续回复中!', 'log-heal');
      } else {
        // 通用buff（defUp, atkUp, speedUp, taunt等）
        applyBuff(unit, unit, eff);
        addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '!', 'log-skill');
      }
    }
    skillSlot.cooldownLeft = skillData.cooldown;
    return;
  }

  // === ally_single: 单体队友技能 ===
  if (skillData.type === 'ally_single') {
    if (eff) {
      // 找血量最低的队友
      let target = null, minRatio = 2;
      const allies = unit.isEnemy ? gameState.enemies : gameState.formation.filter(Boolean);
      allies.forEach(a => {
        if (a && a.currentHp > 0) {
          const ratio = a.currentHp / a.maxHp;
          if (ratio < minRatio) { minRatio = ratio; target = a; }
        }
      });
      if (!target) target = unit;

      if (eff.type === 'heal' || eff.type === 'purify') {
        const h = calcHealAmount(unit, eff);
        target.currentHp = Math.min(target.maxHp, target.currentHp + h);
        addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，回复 ' + (target.displayName||target.name) + ' ' + h + ' HP!', 'log-heal');
        // 净化：驱散负面
        if (eff.type === 'purify' && eff.cleanse && target.statusEffects) {
          const debuffs = target.statusEffects.filter(s => { const m = STATUS_EFFECTS[s.type]; return m && m.isDebuff; });
          for (let i = 0; i < (eff.cleanse || 1) && debuffs.length > 0; i++) {
            const idx = target.statusEffects.indexOf(debuffs.shift());
            if (idx >= 0) target.statusEffects.splice(idx, 1);
          }
          addLog(sidePrefix + '驱散了 ' + (target.displayName||target.name) + ' 的负面状态!', 'log-skill');
        }
      }
    }
    skillSlot.cooldownLeft = skillData.cooldown;
    return;
  }

  // === ally_all: 全体队友技能 ===
  if (skillData.type === 'ally_all') {
    if (eff) {
      const allies = unit.isEnemy
        ? gameState.enemies.filter(e => e.currentHp > 0)
        : getFormationPets().map(fp => fp.pet);

      if (eff.type === 'heal') {
        const h = calcHealAmount(unit, eff);
        allies.forEach(a => { a.currentHp = Math.min(a.maxHp, a.currentHp + h); });
        addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，全队回复 ' + h + ' HP!', 'log-heal');
      } else if (eff.type === 'cleanse' && eff.cleanseAll) {
        allies.forEach(a => {
          if (a.statusEffects) a.statusEffects = a.statusEffects.filter(s => { const m = STATUS_EFFECTS[s.type]; return !(m && m.isDebuff); });
        });
        addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，驱散全队负面状态!', 'log-skill');
      } else {
        // 通用buff（encourage等）
        allies.forEach(a => applyBuff(unit, a, eff));
        addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '!', 'log-skill');
      }
    }
    skillSlot.cooldownLeft = skillData.cooldown;
    return;
  }

  // === 联动技 ===
  if (skillData.type === 'link') {
    // 检查是否满足联动条件（同元素宠物数量 >= linkMin）
    const linkElem = skillData.linkElem;
    const linkMin = skillData.linkMin || 2;
    const sameElemAllies = unit.isEnemy
      ? gameState.enemies.filter(e => e.currentHp > 0 && e.elem === linkElem)
      : getFormationPets().filter(fp => fp.pet.elem === linkElem).map(fp => fp.pet);

    if (sameElemAllies.length < linkMin) {
      // 不满足条件，跳过（改用普攻）
      addLog(sidePrefix + unit.name + ' 尝试发动 ' + skillData.name + '，但同元素宠物不足!', 'log-skill');
      skillSlot.cooldownLeft = 2; // 短CD惩罚
      return;
    }

    addLog(sidePrefix + '【联动技】' + skillData.name + ' 发动!', 'log-skill');

    // 1. 同元素所有宠物各攻击一次
    const enemyTargets = unit.isEnemy
      ? gameState.formation.filter(p => p && p.currentHp > 0)
      : gameState.enemies.filter(e => e.currentHp > 0);

    if (enemyTargets.length > 0 && skillData.power > 0) {
      sameElemAllies.forEach(ally => {
        if (ally.currentHp <= 0) return;
        const target = enemyTargets[Math.floor(Math.random() * enemyTargets.length)];
        if (!target || target.currentHp <= 0) return;
        const linkFlags = skillData.linkFlags || {};

        const result = calcDamage(ally, target, { ...skillData, enhanceLevel: skillSlot.enhanceLevel || 0 });
        let dmg = result.damage;

        // 护盾吸收
        if (target.statusEffects) {
          const shield = target.statusEffects.find(s => s.type === 'shield');
          if (shield && shield.value > 0) {
            const absorbed = Math.min(shield.value, dmg);
            shield.value -= absorbed;
            dmg -= absorbed;
            if (shield.value <= 0) target.statusEffects = target.statusEffects.filter(s => s.type !== 'shield');
          }
        }
        target.currentHp = Math.max(0, target.currentHp - dmg);
        addLog(sidePrefix + (ally.displayName || ally.name) + ' 联动攻击 ' + (target.displayName || target.name) + ' ' + dmg + ' 伤害', unit.isEnemy ? 'log-enemy-dmg' : 'log-ally-dmg');

        // 攻击动画
        if (gameState._battleActions) {
          const atkId = ally.isEnemy ? 'e' + gameState.enemies.indexOf(ally) : 'a' + gameState.formation.indexOf(ally);
          const tgtId = target.isEnemy ? 'e' + gameState.enemies.indexOf(target) : 'a' + gameState.formation.indexOf(target);
          gameState._battleActions.push({ attackerId: atkId, targetId: tgtId });
        }
      });
    }

    // 2. 对全体敌方施加状态效果
    if (eff) {
      enemyTargets.forEach(target => {
        if (target.currentHp > 0) tryApplyStatus(unit, target, eff);
      });
    }

    // 3. 联动治疗（link_water, link_holy, link_grass等）
    if (skillData.linkHeal) {
      const allies = unit.isEnemy
        ? gameState.enemies.filter(e => e.currentHp > 0)
        : getFormationPets().map(fp => fp.pet);
      if (skillData.linkHeal.type === 'regen') {
        // 全队持续回复
        allies.forEach(a => {
          if (!a.statusEffects) a.statusEffects = [];
          a.statusEffects.push({ type: 'regen', turnsLeft: skillData.linkHeal.duration || 3, value: 0 });
        });
        addLog(sidePrefix + '全队获得持续回复!', 'log-heal');
      } else {
        const h = calcHealAmount(unit, skillData.linkHeal);
        allies.forEach(a => { a.currentHp = Math.min(a.maxHp, a.currentHp + h); });
        addLog(sidePrefix + '全队回复 ' + h + ' HP!', 'log-heal');
      }
    }

    // 4. 联动buff（link_flying: 增攻+增速+闪避）
    if (skillData.linkBuff) {
      const allies = unit.isEnemy
        ? gameState.enemies.filter(e => e.currentHp > 0)
        : getFormationPets().map(fp => fp.pet);
      const lb = skillData.linkBuff;
      allies.forEach(a => {
        if (!a.statusEffects) a.statusEffects = [];
        if (lb.speedUp) a.statusEffects.push({ type: 'speedUp', turnsLeft: lb.speedUpDuration || 2, value: 0.30 });
        if (lb.evasion) a.statusEffects.push({ type: 'evasion', turnsLeft: lb.evasionDuration || 2, value: lb.evasion });
      });
    }

    // 5. 特殊：cleanse_and_shield（link_holy）
    if (eff && eff.type === 'cleanse_and_shield') {
      const allies = unit.isEnemy
        ? gameState.enemies.filter(e => e.currentHp > 0)
        : getFormationPets().map(fp => fp.pet);
      // 驱散全负面
      allies.forEach(a => {
        if (a.statusEffects) a.statusEffects = a.statusEffects.filter(s => { const m = STATUS_EFFECTS[s.type]; return !(m && m.isDebuff); });
      });
      // 全队护盾
      const shieldAmt = calcShieldAmount(unit, { defRatio: eff.shieldDefRatio || 1.5, hpRatio: eff.shieldHpRatio || 0.04 });
      allies.forEach(a => {
        if (!a.statusEffects) a.statusEffects = [];
        a.statusEffects.push({ type: 'shield', turnsLeft: 3, value: shieldAmt });
      });
      addLog(sidePrefix + '驱散全负面 + 全队护盾 ' + shieldAmt + '!', 'log-skill');
    }

    // 6. 联动技buff给全队（link_normal: 全队增防）
    if (eff && (eff.type === 'defUp' || eff.type === 'atkUp') && eff.baseChance >= 1.0) {
      const allies = unit.isEnemy
        ? gameState.enemies.filter(e => e.currentHp > 0)
        : getFormationPets().map(fp => fp.pet);
      allies.forEach(a => applyBuff(unit, a, eff));
    }

    skillSlot.cooldownLeft = skillData.cooldown;
    return;
  }

  // 伤害技能（single / aoe）
  const targets = pickTarget(unit, skillData.type);
  if (!targets || targets.length === 0) return;

  targets.forEach(target => {
    const result = calcDamage(unit, target, { ...skillData, enhanceLevel: skillSlot.enhanceLevel || 0 });
    const critText = result.isCrit ? ' 暴击!' : '';
    const elemText = result.elemMult > 1 ? ' 效果拔群!' : (result.elemMult < 1 ? ' 效果不佳...' : '');
    const logCls = unit.isEnemy ? 'log-enemy-dmg' : 'log-ally-dmg';
    const prefix = unit.isEnemy ? '【敌】' : '【我】';
    // 护盾吸收
    let actualDmg = result.damage;
    if (target.statusEffects) {
      const shield = target.statusEffects.find(s => s.type === 'shield');
      if (shield && shield.value > 0) {
        const absorbed = Math.min(shield.value, actualDmg);
        shield.value -= absorbed;
        actualDmg -= absorbed;
        if (shield.value <= 0) {
          target.statusEffects = target.statusEffects.filter(s => s.type !== 'shield');
        }
      }
    }
    target.currentHp = Math.max(0, target.currentHp - actualDmg);

    addLog(prefix + unit.name + ' 使用 ' + skillData.name + ' 对 ' + (target.displayName || target.name) + ' 造成 ' + result.damage + ' 伤害' + critText + elemText, logCls);
    // 记录攻击动作（供UI动画）
    const atkId = unit.isEnemy ? 'e' + gameState.enemies.indexOf(unit) : 'a' + gameState.formation.indexOf(unit);
    const tgtId = target.isEnemy ? 'e' + gameState.enemies.indexOf(target) : 'a' + gameState.formation.indexOf(target);
    if (gameState._battleActions) gameState._battleActions.push({ attackerId: atkId, targetId: tgtId });

    // 施加状态效果（如果技能有）
    if (eff) tryApplyStatus(unit, target, eff);

    // 附带治疗（万木春等攻击+治疗混合技能）
    if (skillData.statusEffect && skillData.statusEffect.type === 'teamHeal') {
      const allies = unit.isEnemy ? gameState.enemies.filter(e => e.currentHp > 0) : getFormationPets().map(fp => fp.pet);
      const h = calcHealAmount(unit, skillData.statusEffect);
      allies.forEach(a => { a.currentHp = Math.min(a.maxHp, a.currentHp + h); });
    }

    // 宝物被动: 吸血
    if (!unit.isEnemy && unit.treasure && unit.treasure.passive === 'lifesteal') {
      const ls = Math.floor(result.damage * 0.05);
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + ls);
    }
    // 符文套装: 吸血
    if (!unit.isEnemy && unit._runeEffects && unit._runeEffects.pctStats.lifesteal > 0) {
      const ls = Math.floor(result.damage * unit._runeEffects.pctStats.lifesteal / 100);
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + ls);
    }
    // 宝物被动: 反伤
    if (!target.isEnemy && target.treasure && target.treasure.passive === 'thorns') {
      const th = Math.floor(result.damage * 0.1);
      unit.currentHp = Math.max(0, unit.currentHp - th);
    }
    // 宝物被动: 连击
    if (!unit.isEnemy && unit.treasure && unit.treasure.passive === 'doubleStrike' && Math.random() < 0.08) {
      const r2 = calcDamage(unit, target, skillData);
      target.currentHp = Math.max(0, target.currentHp - r2.damage);
      addLog('【我】' + unit.name + ' 触发连击! 额外造成 ' + r2.damage + ' 伤害', 'log-ally-dmg');
    }
  });
  skillSlot.cooldownLeft = skillData.cooldown;
}

// ===== 单位回合 =====

function unitTakeTurn(unit) {
  // 1. 处理状态效果（毒/灼烧伤害、冰冻/麻痹跳过判定）
  const { skip, silenced } = processStatusEffects(unit);
  if (skip) {
    // 被控制跳过行动，但技能CD仍然减少
    if (unit.skills) unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
    return;
  }

  // 兼容旧regen/buffDef
  if (unit.regen > 0) { unit.regen--; }
  if (unit.buffDef > 0) unit.buffDef--;

  const sidePrefix = unit.isEnemy ? '【敌】' : '【我】';

  // 2. 选技能释放（被沉默只能普攻）
  if (!silenced && unit.skills && unit.skills.length > 0) {
    // 按priority排序（0最高=最先释放），选第一个CD就绪的
    const sorted = [...unit.skills].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const readySkill = sorted.find(s => s.cooldownLeft <= 0);
    if (readySkill) {
      // 混乱检查：30%概率攻击队友（仅伤害技能）
      const isConfused = unit.statusEffects && unit.statusEffects.find(s => s.type === 'confuse');
      if (isConfused && Math.random() < 0.30) {
        const sd = SKILLS[readySkill.skillId];
        if (sd && (sd.type === 'single' || sd.type === 'aoe')) {
          addLog(sidePrefix + (unit.displayName || unit.name) + ' 陷入混乱，攻击了队友!', 'log-skill');
          // 攻击随机队友
          const allies = unit.isEnemy
            ? gameState.enemies.filter(e => e.currentHp > 0 && e !== unit)
            : gameState.formation.filter(p => p && p.currentHp > 0 && p !== unit);
          if (allies.length > 0) {
            const friendlyTarget = pick(allies);
            const result = calcDamage(unit, friendlyTarget, { power: 45, elem: 'normal', enhanceLevel: 0 });
            friendlyTarget.currentHp = Math.max(0, friendlyTarget.currentHp - result.damage);
          }
          unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
          return;
        }
      }

      executeSkill(unit, readySkill);
      unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
      return;
    }
  }

  // 3. 普攻（无就绪技能或被沉默）
  let targets = pickTarget(unit, 'single');
  if (!targets || targets.length === 0) return;

  // 嘲讽检查
  const tauntTarget = getTauntTarget(unit.isEnemy);
  let target = tauntTarget || targets[0];

  // Talent: agile (灵敏) 闪避
  const evasionBuff = target.statusEffects ? target.statusEffects.find(s => s.type === 'evasion') : null;
  const evasionChance = (target.talent === 'agile' ? 0.10 : 0) + (evasionBuff ? (evasionBuff.value || 0) : 0);
  if (evasionChance > 0 && Math.random() < evasionChance) {
    addLog(sidePrefix.replace('敌', '我').replace('我', '敌') + (target.displayName || target.name) + ' 闪避了攻击!', 'log-skill');
    if (unit.skills) unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
    return;
  }

  const power = unit.isEnemy ? 50 : 45;
  const result = calcDamage(unit, target, { power, elem: unit.elem, enhanceLevel: 0 });
  target.currentHp = Math.max(0, target.currentHp - result.damage);
  addLog(sidePrefix + (unit.displayName || unit.name) + ' 普通攻击 ' + (target.displayName || target.name) + ' 造成 ' + result.damage + ' 伤害', unit.isEnemy ? 'log-enemy-dmg' : 'log-ally-dmg');

  // 记录攻击动作
  if (gameState._battleActions) {
    const atkId = unit.isEnemy ? 'e' + gameState.enemies.indexOf(unit) : 'a' + gameState.formation.indexOf(unit);
    const tgtId = target.isEnemy ? 'e' + gameState.enemies.indexOf(target) : 'a' + gameState.formation.indexOf(target);
    gameState._battleActions.push({ attackerId: atkId, targetId: tgtId });
  }

  // 宝物被动
  if (target.treasure && target.treasure.passive === 'thorns') {
    const th = Math.floor(result.damage * 0.1);
    unit.currentHp = Math.max(0, unit.currentHp - th);
  }

  if (unit.skills) unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
}

// ===== 战斗回合 =====

/** 外部传入渲染回调，避免循环依赖 */
let _renderBattle = null;
export function setBattleRenderer(fn) { _renderBattle = fn; }

// 渲染节流：高倍速时UI最多每200ms刷新一次，避免DOM重建太快导致按钮点不到
let _lastRenderTime = 0;
const RENDER_MIN_INTERVAL = 200; // ms

export function battleTick() {
  if (gameState.enemies.length === 0) return;
  // 每回合重置攻击动作记录（供UI播放攻击动画）
  gameState._battleActions = [];

  // Check revival timers
  const now = Date.now();
  for (let i = 0; i < 6; i++) {
    const pet = gameState.formation[i];
    if (pet && pet.currentHp <= 0) {
      if (!gameState.reviveTimers[pet.id]) {
        // Start 15-second timer
        gameState.reviveTimers[pet.id] = now + 15000;
      } else if (now >= gameState.reviveTimers[pet.id]) {
        // Revive at 50% HP
        pet.currentHp = Math.floor(pet.maxHp * 0.5);
        delete gameState.reviveTimers[pet.id];
        addLog(pet.name + ' 复活了! (50% HP)', 'log-heal');
      }
    }
  }

  const units = [];
  getFormationPets().forEach(fp => units.push({ unit: fp.pet, isEnemy: false, spd: fp.pet.spd }));
  gameState.enemies.forEach(e => { if (e.currentHp > 0) units.push({ unit: e, isEnemy: true, spd: e.spd }); });
  units.sort((a, b) => b.spd - a.spd);

  for (let i = 0; i < units.length; i++) {
    const u = units[i].unit;
    if (u.currentHp <= 0) continue;
    if (gameState.enemies.every(e => e.currentHp <= 0)) break;
    if (getFormationPets().length === 0) break;
    unitTakeTurn(u);
  }

  if (gameState.enemies.every(e => e.currentHp <= 0)) {
    handleVictory();
  } else if (getFormationPets().length === 0) {
    handleDefeat();
  }

  // 节流渲染：高倍速时不要每tick都重建DOM
  if (_renderBattle) {
    const renderNow = Date.now();
    if (renderNow - _lastRenderTime >= RENDER_MIN_INTERVAL) {
      _lastRenderTime = renderNow;
      _renderBattle();
    }
  }
}

// ===== 胜利处理 =====

function handleVictory() {
  gameState.captureMode = false;
  gameState.captureTargetIdx = -1;

  // Victory HP regen for surviving pets
  getFormationPets().forEach(fp => {
    const healAmt = Math.floor(fp.pet.maxHp * 0.10);
    fp.pet.currentHp = Math.min(fp.pet.maxHp, fp.pet.currentHp + healAmt);
  });

  const avgEnemyLv = gameState.enemies.reduce((s, e) => s + e.level, 0) / gameState.enemies.length;
  const baseExp = Math.floor(avgEnemyLv * 8 + 10);
  const goldReward = Math.floor(avgEnemyLv * 3 + randInt(5, 15));
  gameState.gold += goldReward;
  addLog('战斗胜利! 获得 ' + goldReward + ' 金币', 'log-loot');

  getFormationPets().forEach(fp => {
    gainExp(fp.pet, baseExp);
    tryComprehend(fp.pet);
  });

  // Calculate drop multiplier based on max enemy stars
  const maxStars = Math.max(...gameState.enemies.map(e => e.stars || 0));
  const dropMult = maxStars >= 3 ? 3 : (maxStars >= 2 ? 2 : 1);

  // 材料掉落
  if (Math.random() < 0.05 * dropMult) { gameState.materials.soul_stone++; addLog('掉落了灵魂石!', 'log-loot'); showToast('获得灵魂石 x1!', 'loot'); }
  if (Math.random() < 0.25 * dropMult) { gameState.materials.enhance_stone++; addLog('掉落了强化石!', 'log-loot'); }
  if (Math.random() < 0.06 * dropMult) { gameState.materials.rare_enhance++; addLog('掉落了精良强化石!', 'log-loot'); }

  // 宝物掉落
  if (Math.random() < 0.10 * dropMult) {
    const qual = weightedPick({ white:40, green:30, blue:18, purple:9, gold:3 });
    const tr = generateTreasure(qual);
    gameState.treasures.push(tr);
    addLog('获得宝物: ' + tr.name + ' [' + QUALITY_NAMES[qual] + ']', 'log-loot');
    showToast('获得宝物: ' + tr.name, 'loot');
  }

  gameState.totalBattles++;
  setTimeout(() => {
    gameState.enemies = spawnEnemies();
    if (_renderBattle) _renderBattle();
  }, 800);
}

// ===== 失败处理 =====

function handleDefeat() {
  gameState.captureMode = false;
  gameState.captureTargetIdx = -1;
  addLog('战斗失败...宠物正在恢复中...', 'log-dmg');

  setTimeout(() => {
    gameState.pets.forEach(p => {
      p.currentHp = p.maxHp;
      p.buffDef = 0;
      p.regen = 0;
      p.statusEffects = [];
      if (p.skills) p.skills.forEach(s => s.cooldownLeft = 0);
    });
    gameState.enemies = spawnEnemies();
    addLog('宠物已恢复，继续战斗!', 'log-heal');
    if (_renderBattle) _renderBattle();
  }, 3000);
}
