// 副本系统 - 符文塔，消耗体力挑战固定Boss
import { gameState } from '../state.js';
import { DUNGEON_FLOORS, STAMINA_MAX, STAMINA_REGEN_INTERVAL } from '../constants/index.js';
import { SPECIES, SKILLS } from '../constants/index.js';
import { randInt, pick, weightedPick, showToast, addLog } from '../utils.js';
import { generateRune } from './rune.js';
import { gainExp } from './pet.js';
import { calcDamage } from './battle.js';
import { getFormationPets } from '../state.js';

// ===== 体力系统 =====

export function initStamina() {
  if (gameState.stamina === undefined) {
    gameState.stamina = STAMINA_MAX;
    gameState.lastStaminaTime = Date.now();
  }
}

export function regenStamina() {
  const now = Date.now();
  const elapsed = now - (gameState.lastStaminaTime || now);
  const regenCount = Math.floor(elapsed / STAMINA_REGEN_INTERVAL);
  if (regenCount > 0) {
    gameState.stamina = Math.min(STAMINA_MAX, gameState.stamina + regenCount);
    gameState.lastStaminaTime = now - (elapsed % STAMINA_REGEN_INTERVAL);
  }
}

// ===== 创建Boss敌人 =====

function createBoss(floor) {
  const sp = SPECIES[floor.bossSpecies];
  if (!sp) return null;

  const lv = floor.bossLevel;
  const starMult = floor.bossStars === 3 ? 2.0 : (floor.bossStars === 2 ? 1.5 : 1.2);

  const hp = Math.floor((sp.baseStats.hp + 20) * (1 + (lv - 1) * 0.06) * 8 * starMult);

  const boss = {
    speciesId: floor.bossSpecies,
    name: floor.name,
    displayName: floor.name,
    elem: sp.elem,
    level: lv,
    atk: Math.floor((sp.baseStats.atk + 20) * (1 + (lv - 1) * 0.06) * starMult * 1.3),
    def: Math.floor((sp.baseStats.def + 20) * (1 + (lv - 1) * 0.06) * starMult * 1.2),
    spd: Math.floor((sp.baseStats.spd + 15) * (1 + (lv - 1) * 0.06) * starMult),
    maxHp: hp,
    currentHp: hp,
    stars: floor.bossStars,
    isEnemy: true,
    isBoss: true,
    row: 'front',
    skills: [],
    buffDef: 0,
    regen: 0
  };

  // 分配技能
  const skillPool = sp.skillPool;
  if (skillPool.basic.length > 0) {
    boss.skills.push({ skillId: pick(skillPool.basic), enhanceLevel: 0, cooldownLeft: 0, priority: 0 });
  }
  if (lv >= 10 && skillPool.mid.length > 0) {
    boss.skills.push({ skillId: pick(skillPool.mid), enhanceLevel: 0, cooldownLeft: 0, priority: 1 });
  }
  if (lv >= 20 && skillPool.mid.length > 1) {
    const remaining = skillPool.mid.filter(s => !boss.skills.find(bs => bs.skillId === s));
    if (remaining.length > 0) boss.skills.push({ skillId: pick(remaining), enhanceLevel: 0, cooldownLeft: 0, priority: 1 });
  }
  if (lv >= 30 && skillPool.high.length > 0) {
    boss.skills.push({ skillId: pick(skillPool.high), enhanceLevel: 0, cooldownLeft: 0, priority: 2 });
  }
  // Boss技能冷却归零
  boss.skills.forEach(s => s.cooldownLeft = 0);

  return boss;
}

// ===== 副本战斗（同步模拟，非实时） =====

/**
 * 挑战副本某层
 * @returns {object} { success, log, rewards }
 */
export function challengeFloor(floorId) {
  const floor = DUNGEON_FLOORS[floorId];
  if (!floor) return { success: false, log: ['副本不存在'] };

  regenStamina();
  if (gameState.stamina < floor.staminaCost) {
    return { success: false, log: ['体力不足! 需要' + floor.staminaCost + '点，当前' + gameState.stamina + '点'] };
  }

  const allies = getFormationPets();
  if (allies.length === 0) {
    return { success: false, log: ['没有上阵宠物!'] };
  }

  // 消耗体力
  gameState.stamina -= floor.staminaCost;

  // 创建boss
  const boss = createBoss(floor);
  if (!boss) return { success: false, log: ['Boss数据异常'] };

  // 复制宠物状态（不影响主世界HP）
  const allyClones = allies.map(fp => ({
    ...fp.pet,
    currentHp: fp.pet.currentHp,
    maxHp: fp.pet.maxHp,
    isEnemy: false,
    buffDef: 0,
    regen: 0,
    skills: fp.pet.skills.map(s => ({ ...s, cooldownLeft: 0 }))
  }));

  const enemies = [boss];
  const log = [];
  log.push('⚔️ 挑战 ' + floor.name + ' (Lv.' + floor.bossLevel + ')');

  // 模拟战斗（最多100回合防死循环）
  let round = 0;
  while (round < 100) {
    round++;

    // 收集所有存活单位
    const units = [];
    allyClones.forEach(a => { if (a.currentHp > 0) units.push(a); });
    enemies.forEach(e => { if (e.currentHp > 0) units.push(e); });
    units.sort((a, b) => (b.spd || 0) - (a.spd || 0));

    for (const unit of units) {
      if (unit.currentHp <= 0) continue;

      // 回复/buff衰减
      if (unit.regen > 0) {
        const h = Math.floor(unit.maxHp * 0.08);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + h);
        unit.regen--;
      }
      if (unit.buffDef > 0) unit.buffDef--;

      // 选技能
      let skill = null;
      if (unit.skills && unit.skills.length > 0) {
        const ready = unit.skills.filter(s => s.cooldownLeft <= 0);
        if (ready.length > 0) {
          ready.sort((a, b) => b.priority - a.priority);
          skill = ready[0];
        }
      }

      // 选目标
      const isAlly = !unit.isEnemy;
      const targetPool = isAlly
        ? enemies.filter(e => e.currentHp > 0)
        : allyClones.filter(a => a.currentHp > 0);
      if (targetPool.length === 0) break;

      const target = targetPool[randInt(0, targetPool.length - 1)];
      const skillData = skill ? SKILLS[skill.skillId] : null;

      // 处理自身增益技能
      if (skillData && skillData.type === 'self') {
        if (skillData.effect === 'defUp' || skillData.effect === 'defUp2') {
          unit.buffDef = skillData.effect === 'defUp2' ? 4 : 3;
          log.push('R' + round + ' ' + unit.name + ' 使用 ' + skillData.name + ' 防御提升');
        } else if (skillData.effect === 'heal25' || skillData.effect === 'heal40') {
          const pct = skillData.effect === 'heal40' ? 0.4 : 0.25;
          const h = Math.floor(unit.maxHp * pct);
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + h);
          log.push('R' + round + ' ' + unit.name + ' 使用 ' + skillData.name + ' 回复 ' + h + 'HP');
        } else if (skillData.effect === 'regen') {
          unit.regen = 4;
          log.push('R' + round + ' ' + unit.name + ' 使用 ' + skillData.name + ' 持续回复');
        }
        if (skill) skill.cooldownLeft = skillData.cooldown || 0;
        if (unit.skills) unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });
        continue;
      }

      // 伤害计算
      const power = skillData ? skillData.power : 50;
      const atkVal = unit.atk || 50;
      const defVal = target.def || 30;
      const defBuff = target.buffDef > 0 ? 0.7 : 1.0;
      let dmg = Math.max(1, Math.floor((power * atkVal / (defVal + 50)) * defBuff) + randInt(-3, 3));

      // 暴击
      if (Math.random() < 0.1) dmg = Math.floor(dmg * 1.5);

      // 天赋: 猛攻
      if (!unit.isEnemy && unit.talent === 'fierce') dmg = Math.floor(dmg * 1.08);

      target.currentHp = Math.max(0, target.currentHp - dmg);
      const skillName = skillData ? skillData.name : '普攻';
      log.push('R' + round + ' ' + unit.name + ' → ' + skillName + ' → ' + target.name + ' ' + dmg + '伤害' + (target.currentHp <= 0 ? ' 💀' : ''));

      if (skill) skill.cooldownLeft = skillData ? (skillData.cooldown || 0) : 0;
      if (unit.skills) unit.skills.forEach(s => { if (s.cooldownLeft > 0) s.cooldownLeft--; });

      // 检查结束
      if (enemies.every(e => e.currentHp <= 0)) break;
      if (allyClones.every(a => a.currentHp <= 0)) break;
    }

    if (enemies.every(e => e.currentHp <= 0) || allyClones.every(a => a.currentHp <= 0)) break;
  }

  const victory = enemies.every(e => e.currentHp <= 0);
  const rewards = { gold: 0, exp: 0, runes: [] };

  if (victory) {
    log.push('🎉 胜利! 击败了 ' + floor.name);

    // 标记通关
    if (!gameState.dungeonProgress) gameState.dungeonProgress = {};
    gameState.dungeonProgress[floorId] = true;

    // 金币和经验奖励
    rewards.gold = floor.goldReward;
    rewards.exp = floor.expReward;
    gameState.gold += rewards.gold;
    allies.forEach(fp => gainExp(fp.pet, rewards.exp));

    // 掉落符文（1-2个）
    const dropCount = Math.random() < 0.3 ? 2 : 1;
    for (let d = 0; d < dropCount; d++) {
      const quality = weightedPick(floor.runeDropQuality);
      const setId = pick(floor.runeDropSets);
      const slotType = randInt(0, 5);
      const rune = generateRune(slotType, setId, quality);
      if (rune) {
        gameState.runes.push(rune);
        rewards.runes.push(rune);
        log.push('🔮 获得符文: ' + RUNE_SETS[setId].name + '·' + RUNE_SLOTS_NAMES[slotType] + ' [' + RUNE_QUALITY_LABELS[quality] + ']');
      }
    }

    log.push('💰 金币+' + rewards.gold + '  经验+' + rewards.exp);
  } else {
    log.push('💀 挑战失败... ' + floor.name + ' 太强了');
  }

  return { success: victory, log, rewards };
}

// 辅助常量
import { RUNE_QUALITY as RQ } from '../constants/index.js';
const RUNE_SLOTS_NAMES = ['天位', '地位', '玄位', '黄位', '日位', '月位'];
const RUNE_QUALITY_LABELS = { white: '普通', green: '精良', blue: '稀有', purple: '史诗', gold: '传说' };
