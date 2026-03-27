// 战斗系统：敌人生成、回合处理、胜负判定
import { SPECIES, SKILLS, ELEM_CHART, ZONES, PASSIVE_POOL, TALENTS } from '../constants/index.js';
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
    const isBoss = Math.random() < 0.05;
    const bossMult = isBoss ? 1.8 : 1.0;
    const capturable = !isBoss && Math.random() < 0.35;
    const hp = Math.floor((sp.baseStats.hp + randInt(5,20)) * (1 + (lv-1)*0.06) * 5 * bossMult);

    enemies.push({
      speciesId,
      name: (isBoss ? '★' : '') + sp.name + ' Lv.' + lv,
      displayName: (isBoss ? '★' : '') + sp.evoChain[Math.min(2, Math.floor(lv / 15))],
      elem: sp.elem,
      level: lv,
      atk: Math.floor((sp.baseStats.atk + randInt(5,15)) * (1 + (lv-1)*0.06) * bossMult),
      def: Math.floor((sp.baseStats.def + randInt(5,15)) * (1 + (lv-1)*0.06) * bossMult),
      spd: Math.floor((sp.baseStats.spd + randInt(5,15)) * (1 + (lv-1)*0.06) * bossMult),
      maxHp: hp,
      currentHp: hp,
      isBoss,
      capturable,
      captureSpecies: speciesId,
      row: i < Math.ceil(enemyCount / 2) ? 'front' : 'back',
      isEnemy: true,
      skills: [],
      buffDef: 0,
      regen: 0
    });

    if (!gameState.dex[speciesId]) gameState.dex[speciesId] = { seen: true, caught: false };
    else gameState.dex[speciesId].seen = true;

    // Assign enemy skills based on level
    const skillPool = sp.skillPool;
    const enemySkills = [];

    // Basic skill (always)
    if (skillPool.basic.length > 0) {
      const basicSkill = pick(skillPool.basic);
      enemySkills.push({skillId: basicSkill, enhanceLevel: 0, cooldownLeft: 0, priority: 0});
    }

    // Mid skill (lv >= 10)
    if (lv >= 10 && skillPool.mid.length > 0) {
      const midSkill = pick(skillPool.mid);
      enemySkills.push({skillId: midSkill, enhanceLevel: 0, cooldownLeft: 0, priority: 1});
    }

    // Second mid skill (lv >= 20)
    if (lv >= 20 && skillPool.mid.length > 1) {
      const remaining = skillPool.mid.filter(s => !enemySkills.find(es => es.skillId === s));
      if (remaining.length > 0) {
        enemySkills.push({skillId: pick(remaining), enhanceLevel: 0, cooldownLeft: 0, priority: 1});
      }
    }

    // High skill (lv >= 30)
    if (lv >= 30 && skillPool.high.length > 0) {
      const highSkill = pick(skillPool.high);
      enemySkills.push({skillId: highSkill, enhanceLevel: 0, cooldownLeft: 0, priority: 2});
    }

    // Boss gets extra skill and reduced cooldown
    if (isBoss) {
      enemySkills.forEach(s => s.cooldownLeft = 0);
    }

    enemies[enemies.length - 1].skills = enemySkills;
  }
  return enemies;
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
  const enhanceBonus = 1 + (skillData.enhanceLevel || 0) * 0.08;
  const atkVal = attacker.atk || 50;
  const defVal = defender.def || 30;
  const elemMult = getElemMultiplier(
    skillData ? skillData.elem : (attacker.elem || 'normal'),
    defender.elem || 'normal'
  );
  const rowMult = (defender.row === 'back' && !allFrontDead(defender.isEnemy)) ? 0.7 : 1.0;

  let critRate = 0.05;
  let critDmg = 1.5;
  if (!attacker.isEnemy && attacker.treasure) {
    attacker.treasure.affixes.forEach(af => {
      if (af.id === 'crit_rate') critRate += af.value / 100;
      if (af.id === 'crit_dmg') critDmg += af.value / 100;
    });
  }
  const isCrit = Math.random() < critRate;
  const critMult = isCrit ? critDmg : 1.0;
  const defBuff = (defender.buffDef > 0) ? 0.7 : 1.0;

  let baseDmg = Math.floor((power * atkVal / (defVal + 50)) * elemMult * rowMult * critMult * defBuff * enhanceBonus);
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

  // 自身增益/回复
  const sidePrefix = unit.isEnemy ? '【敌】' : '【我】';
  if (skillData.type === 'self') {
    if (skillData.effect === 'defUp') { unit.buffDef = 3; addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，防御提升!', 'log-skill'); }
    else if (skillData.effect === 'defUp2') { unit.buffDef = 4; addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，防御大幅提升!', 'log-skill'); }
    else if (skillData.effect === 'heal25') { const h = Math.floor(unit.maxHp * 0.25); unit.currentHp = Math.min(unit.maxHp, unit.currentHp + h); addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，回复 ' + h + ' HP!', 'log-heal'); }
    else if (skillData.effect === 'heal40') { const h = Math.floor(unit.maxHp * 0.4); unit.currentHp = Math.min(unit.maxHp, unit.currentHp + h); addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，回复 ' + h + ' HP!', 'log-heal'); }
    else if (skillData.effect === 'regen') { unit.regen = 4; addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，持续回复中!', 'log-heal'); }
    skillSlot.cooldownLeft = skillData.cooldown;
    return;
  }

  // 全体队友回复
  if (skillData.type === 'ally_all') {
    if (skillData.effect === 'healAll30') {
      getFormationPets().forEach(a => {
        const h = Math.floor(a.pet.maxHp * 0.3);
        a.pet.currentHp = Math.min(a.pet.maxHp, a.pet.currentHp + h);
      });
      addLog(sidePrefix + unit.name + ' 使用 ' + skillData.name + '，全队回复HP!', 'log-heal');
    }
    skillSlot.cooldownLeft = skillData.cooldown;
    return;
  }

  // 伤害技能
  const targets = pickTarget(unit, skillData.type);
  if (!targets || targets.length === 0) return;

  targets.forEach(target => {
    const result = calcDamage(unit, target, { ...skillData, enhanceLevel: skillSlot.enhanceLevel || 0 });
    target.currentHp = Math.max(0, target.currentHp - result.damage);
    const critText = result.isCrit ? ' 暴击!' : '';
    const elemText = result.elemMult > 1 ? ' 效果拔群!' : (result.elemMult < 1 ? ' 效果不佳...' : '');
    const logCls = unit.isEnemy ? 'log-enemy-dmg' : 'log-ally-dmg';
    const prefix = unit.isEnemy ? '【敌】' : '【我】';
    addLog(prefix + unit.name + ' 使用 ' + skillData.name + ' 对 ' + (target.displayName || target.name) + ' 造成 ' + result.damage + ' 伤害' + critText + elemText, logCls);

    // 宝物被动: 吸血
    if (!unit.isEnemy && unit.treasure && unit.treasure.passive === 'lifesteal') {
      const ls = Math.floor(result.damage * 0.05);
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
  if (unit.regen > 0) {
    const h = Math.floor(unit.maxHp * 0.08);
    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + h);
    unit.regen--;
  }
  if (unit.buffDef > 0) unit.buffDef--;

  if (unit.isEnemy) {
    // Enemy skill usage (same logic as player pets)
    if (unit.skills && unit.skills.length > 0) {
      const readySkills = unit.skills.filter(s => s.cooldownLeft <= 0);
      if (readySkills.length > 0) {
        readySkills.sort((a, b) => a.priority - b.priority);
        executeSkill(unit, readySkills[0]);
        unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
        return;
      }
    }
    // Fallback to basic attack
    const targets = pickTarget(unit, 'single');
    if (!targets || targets.length === 0) return;
    const target = targets[0];

    // Talent: agile (灵敏) 10% dodge
    if (!target.isEnemy && target.talent === 'agile' && Math.random() < 0.10) {
      addLog('【我】' + target.name + ' 灵敏闪避了攻击!', 'log-skill');
      return;
    }

    const result = calcDamage(unit, target, { power: 50, elem: unit.elem, enhanceLevel: 0 });
    target.currentHp = Math.max(0, target.currentHp - result.damage);
    addLog('【敌】' + (unit.displayName || unit.name) + ' 攻击 ' + target.name + ' 造成 ' + result.damage + ' 伤害', 'log-enemy-dmg');
    if (target.treasure && target.treasure.passive === 'thorns') {
      const th = Math.floor(result.damage * 0.1);
      unit.currentHp = Math.max(0, unit.currentHp - th);
    }
    if (unit.skills) unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
    return;
  }

  // 宠物回合 - 按优先级选技能
  const readySkills = unit.skills.filter(s => s.cooldownLeft <= 0);
  if (readySkills.length > 0) {
    readySkills.sort((a, b) => a.priority - b.priority);
    executeSkill(unit, readySkills[0]);
  } else {
    const targets = pickTarget(unit, 'single');
    if (!targets || targets.length === 0) return;
    const target = targets[0];
    const result = calcDamage(unit, target, { power: 45, elem: unit.elem, enhanceLevel: 0 });
    target.currentHp = Math.max(0, target.currentHp - result.damage);
    addLog('【我】' + unit.name + ' 普通攻击 ' + (target.displayName || target.name) + ' 造成 ' + result.damage + ' 伤害', 'log-ally-dmg');
  }
  unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
}

// ===== 战斗回合 =====

/** 外部传入渲染回调，避免循环依赖 */
let _renderBattle = null;
export function setBattleRenderer(fn) { _renderBattle = fn; }

export function battleTick() {
  if (gameState.enemies.length === 0) return;

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

  if (_renderBattle) _renderBattle();
}

// ===== 胜利处理 =====

function handleVictory() {
  gameState.captureMode = false;
  gameState.captureTargetIdx = -1;

  const avgEnemyLv = gameState.enemies.reduce((s, e) => s + e.level, 0) / gameState.enemies.length;
  const baseExp = Math.floor(avgEnemyLv * 8 + 10);
  const goldReward = Math.floor(avgEnemyLv * 3 + randInt(5, 15));
  gameState.gold += goldReward;
  addLog('战斗胜利! 获得 ' + goldReward + ' 金币', 'log-loot');

  getFormationPets().forEach(fp => {
    gainExp(fp.pet, baseExp);
    tryComprehend(fp.pet);
  });

  // 材料掉落
  if (Math.random() < 0.05) { gameState.materials.soul_stone++; addLog('掉落了灵魂石!', 'log-loot'); showToast('获得灵魂石 x1!', 'loot'); }
  if (Math.random() < 0.25) { gameState.materials.enhance_stone++; addLog('掉落了强化石!', 'log-loot'); }
  if (Math.random() < 0.06) { gameState.materials.rare_enhance++; addLog('掉落了精良强化石!', 'log-loot'); }

  // 宝物掉落
  if (Math.random() < 0.10) {
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
      p.skills.forEach(s => s.cooldownLeft = 0);
    });
    gameState.enemies = spawnEnemies();
    addLog('宠物已恢复，继续战斗!', 'log-heal');
    if (_renderBattle) _renderBattle();
  }, 3000);
}
