// 宠物核心系统：创建、属性计算、经验、进化
import { SPECIES, APT_MULT, APT_WEIGHTS, PERSONALITIES, TALENT_KEYS } from '../constants/index.js';
import { gameState, counters } from '../state.js';
import { randInt, weightedPick, showToast, addLog } from '../utils.js';
import { calcRuneEffects } from './rune.js';
import { tryComprehendOnLevelUp } from './comprehend.js';

/**
 * 从IV值推导资质
 * IV 27-31 = 'S'
 * IV 20-26 = 'A'
 * IV 13-19 = 'B'
 * IV 6-12 = 'C'
 * IV 0-5 = 'D'
 */
export function getAptFromIV(iv) {
  if (iv >= 27) return 'S';
  if (iv >= 20) return 'A';
  if (iv >= 13) return 'B';
  if (iv >= 6) return 'C';
  return 'D';
}

export function randomApt() { return weightedPick(APT_WEIGHTS); }

export function randomPersonality() {
  const keys = Object.keys(PERSONALITIES);
  return keys[Math.floor(Math.random() * keys.length)];
}

export function randomIV() {
  return { hp: randInt(0,31), atk: randInt(0,31), def: randInt(0,31), spd: randInt(0,31) };
}

/**
 * 创建宠物
 * @param {string} speciesId - 种族ID
 * @param {number} level - 初始等级
 * @param {boolean} forceAllS - 是否强制全S资质（仅开局混沌）
 * @param {object} customIVs - 自定义IV值（用于保留栏捕捉）
 */
export function createPet(speciesId, level, forceAllS, customIVs) {
  const sp = SPECIES[speciesId];
  if (!sp) return null;
  level = level || 1;

  // Generate IV first
  let iv;
  if (customIVs) {
    iv = customIVs;
  } else if (forceAllS) {
    iv = { hp: randInt(27,31), atk: randInt(27,31), def: randInt(27,31), spd: randInt(27,31) };
  } else {
    iv = randomIV();
  }

  // Derive apts from IV
  const apts = {
    hp: getAptFromIV(iv.hp),
    atk: getAptFromIV(iv.atk),
    def: getAptFromIV(iv.def),
    spd: getAptFromIV(iv.spd)
  };

  const pet = {
    id: counters.petId++,
    speciesId,
    name: sp.name,
    elem: sp.elem,
    level,
    exp: 0,
    apts,
    personality: randomPersonality(),
    iv,
    evoStage: 0,
    // === 新技能系统 ===
    skillBook: [],          // 技能书：所有已领悟技能 [{skillId, level}]，无上限
    equippedSkills: [null, null, null, null], // 装备槽：4个，存skillBook索引，顺序=优先级
    skills: [],             // 战斗用：由 syncBattleSkills() 从上面两个字段计算
    // === 旧字段保留兼容 ===
    treasure: null,
    comprehensionCount: 0,
    talent: TALENT_KEYS[Math.floor(Math.random() * TALENT_KEYS.length)],
    ev: { hp: 0, atk: 0, def: 0, spd: 0 },
    battleCount: 0,
    // 战斗临时属性
    currentHp: 0,
    maxHp: 0,
    buffDef: 0,
    regen: 0,
    statusEffects: []       // 状态效果列表 [{type, turnsLeft, stacks, value}]
  };

  // 给一个初始技能
  if (sp.skillPool.common && sp.skillPool.common.length > 0) {
    pet.skillBook.push({ skillId: sp.skillPool.common[0], level: 1 });
    pet.equippedSkills[0] = 0; // 装备到第一槽位
  }
  syncBattleSkills(pet);

  calcAllStats(pet);
  pet.currentHp = pet.maxHp;

  // 图鉴
  if (!gameState.dex[speciesId]) gameState.dex[speciesId] = { seen: true, caught: false };

  return pet;
}

/**
 * 计算单项属性
 * 公式: floor((基础 + 个体值 + EV/4) × 等级成长 × 进化加成 × 性格修正 × 宝物加成)
 * 符文加成在 calcAllStats 中统一处理
 */
export function calcStat(pet, stat) {
  const sp = SPECIES[pet.speciesId];
  const base = sp.baseStats[stat];
  const iv = pet.iv[stat];
  const ev = pet.ev && pet.ev[stat] ? Math.floor(pet.ev[stat] / 4) : 0;
  const lvGrowth = 1 + (pet.level - 1) * 0.06;
  const evoBonus = 1 + pet.evoStage * 0.3;

  const persData = PERSONALITIES[pet.personality];
  let persMod = 1.0;
  if (persData) {
    if (persData.up === stat) persMod = 1.1;
    if (persData.down === stat) persMod = 0.9;
  }

  // 旧宝物系统加成（兼容）
  let treasureBonus = 1.0;
  if (pet.treasure) {
    pet.treasure.affixes.forEach(af => {
      if (af.id === stat + '_pct') treasureBonus += af.value / 100;
      if (af.id === 'hp_pct' && stat === 'hp') treasureBonus += af.value / 100;
    });
  }

  return Math.floor((base + iv + ev) * lvGrowth * evoBonus * persMod * treasureBonus);
}

export function calcAllStats(pet) {
  const prevMaxHp = pet.maxHp || 1;
  const hpRatio = pet.currentHp / prevMaxHp;

  // 基础属性计算
  let hp = calcStat(pet, 'hp') * 5;
  let atk = calcStat(pet, 'atk');
  let def = calcStat(pet, 'def');
  let spd = calcStat(pet, 'spd');

  // 符文加成
  const runeEffects = calcRuneEffects(pet);
  // 固定值加成
  hp  += runeEffects.flatStats.hp;
  atk += runeEffects.flatStats.atk;
  def += runeEffects.flatStats.def;
  spd += runeEffects.flatStats.spd;
  // 百分比加成
  hp  = Math.floor(hp  * (1 + (runeEffects.pctStats.hp_pct || 0) / 100));
  atk = Math.floor(atk * (1 + (runeEffects.pctStats.atk_pct || 0) / 100));
  def = Math.floor(def * (1 + (runeEffects.pctStats.def_pct || 0) / 100));
  spd = Math.floor(spd * (1 + (runeEffects.pctStats.spd_pct || 0) / 100));

  pet.maxHp = hp;
  pet.atk = atk;
  pet.def = def;
  pet.spd = spd;

  // 缓存符文效果供战斗使用
  pet._runeEffects = runeEffects;

  pet.currentHp = Math.max(1, Math.floor(pet.maxHp * hpRatio));
}

export function expForLevel(lv) {
  return Math.floor(50 * Math.pow(lv, 1.5));
}

/**
 * 宠物获得经验
 * @returns {boolean} 是否升级了
 */
export function gainExp(pet, amount) {
  pet.exp += amount;
  let leveledUp = false;

  while (pet.exp >= expForLevel(pet.level) && pet.level < 100) {
    pet.exp -= expForLevel(pet.level);
    pet.level++;
    leveledUp = true;

    // 升级时尝试领悟技能（50%概率）
    tryComprehendOnLevelUp(pet);

    // 进化检查
    if (pet.evoStage === 0 && pet.level >= 15) {
      pet.evoStage = 1;
      const evoName = SPECIES[pet.speciesId].evoChain[1];
      addLog(pet.name + ' 进化为 ' + evoName + '!', 'log-skill');
      showToast(pet.name + ' 进化了!', 'info');
    } else if (pet.evoStage === 1 && pet.level >= 35) {
      pet.evoStage = 2;
      const evoName = SPECIES[pet.speciesId].evoChain[2];
      addLog(pet.name + ' 进化为 ' + evoName + '!', 'log-skill');
      showToast(pet.name + ' 最终进化!', 'info');
    }
  }

  if (leveledUp) {
    calcAllStats(pet);
    // 冒险者经验
    gameState.advExp += 1;
    const advNeeded = gameState.advLv * 3;
    if (gameState.advExp >= advNeeded) {
      gameState.advExp -= advNeeded;
      gameState.advLv++;
      showToast('冒险等级提升至 ' + gameState.advLv + '!', 'info');
      if (gameState.advLv >= 15 && !gameState.appraisalUnlocked) {
        gameState.appraisalUnlocked = true;
        showToast('解锁了鉴定功能！可以查看个体值了！', 'info');
      }
    }
  }

  // EV学习点数获取
  const evStats = ['hp', 'atk', 'def', 'spd'];
  const totalEV = pet.ev.hp + pet.ev.atk + pet.ev.def + pet.ev.spd;
  if (totalEV < 510) {
    const stat = evStats[Math.floor(Math.random() * 4)];
    if (pet.ev[stat] < 252) {
      pet.ev[stat] += randInt(1, 3);
      if (pet.ev[stat] > 252) pet.ev[stat] = 252;
    }
  }
  pet.battleCount = (pet.battleCount || 0) + 1;

  return leveledUp;
}

/**
 * 从 skillBook + equippedSkills 生成战斗用 skills 数组
 * 战斗系统直接读 pet.skills，格式与旧版兼容
 */
export function syncBattleSkills(pet) {
  if (!pet.skillBook) { pet.skillBook = []; pet.equippedSkills = [null,null,null,null]; }
  pet.skills = [];
  for (let i = 0; i < 4; i++) {
    const bookIdx = pet.equippedSkills[i];
    if (bookIdx == null || !pet.skillBook[bookIdx]) continue;
    const entry = pet.skillBook[bookIdx];
    pet.skills.push({
      skillId: entry.skillId,
      enhanceLevel: entry.level - 1,  // skillBook.level从1开始，enhanceLevel从0开始
      cooldownLeft: 0,
      priority: i                      // 优先级=槽位顺序，0最高
    });
  }
}

/**
 * 迁移旧存档宠物数据到新技能系统
 * 旧格式: pet.skills = [{skillId, enhanceLevel, cooldownLeft, priority}]
 * 新格式: pet.skillBook + pet.equippedSkills
 */
export function migratePetSkills(pet) {
  // 已经有skillBook的不用迁移
  if (pet.skillBook && pet.skillBook.length > 0) return;

  pet.skillBook = [];
  pet.equippedSkills = [null, null, null, null];
  pet.statusEffects = pet.statusEffects || [];

  if (pet.skills && pet.skills.length > 0) {
    // 按旧priority排序
    const sorted = [...pet.skills].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    sorted.forEach((s, i) => {
      pet.skillBook.push({
        skillId: s.skillId,
        level: (s.enhanceLevel || 0) + 1  // enhanceLevel 0 → level 1
      });
      if (i < 4) pet.equippedSkills[i] = i;
    });
  }

  syncBattleSkills(pet);
}

// ===== 技能装备操作 =====

/**
 * 装备技能到指定槽位
 * @param {object} pet
 * @param {number} bookIdx - skillBook中的索引
 * @param {number} slotIdx - 装备槽位(0-3)，-1表示自动找空槽
 * @returns {boolean} 是否成功
 */
export function equipSkill(pet, bookIdx, slotIdx) {
  if (!pet.skillBook || bookIdx < 0 || bookIdx >= pet.skillBook.length) return false;

  // 检查是否已经装备在某个槽位
  const alreadyAt = pet.equippedSkills.indexOf(bookIdx);
  if (alreadyAt >= 0) return false; // 已装备

  if (slotIdx === -1) {
    // 自动找第一个空槽
    slotIdx = pet.equippedSkills.indexOf(null);
    if (slotIdx === -1) return false; // 没有空槽
  }

  if (slotIdx < 0 || slotIdx > 3) return false;
  pet.equippedSkills[slotIdx] = bookIdx;
  syncBattleSkills(pet);
  return true;
}

/**
 * 卸下指定槽位的技能
 * @param {object} pet
 * @param {number} slotIdx - 装备槽位(0-3)
 */
export function unequipSkill(pet, slotIdx) {
  if (slotIdx < 0 || slotIdx > 3) return;
  pet.equippedSkills[slotIdx] = null;
  syncBattleSkills(pet);
}

/**
 * 交换两个槽位的技能（调整优先级）
 * @param {object} pet
 * @param {number} slotA
 * @param {number} slotB
 */
export function swapSkillSlots(pet, slotA, slotB) {
  if (slotA < 0 || slotA > 3 || slotB < 0 || slotB > 3) return;
  const tmp = pet.equippedSkills[slotA];
  pet.equippedSkills[slotA] = pet.equippedSkills[slotB];
  pet.equippedSkills[slotB] = tmp;
  syncBattleSkills(pet);
}
