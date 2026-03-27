// 宠物核心系统：创建、属性计算、经验、进化
import { SPECIES, APT_MULT, APT_WEIGHTS, PERSONALITIES, TALENT_KEYS } from '../constants/index.js';
import { gameState, counters } from '../state.js';
import { randInt, weightedPick, showToast, addLog } from '../utils.js';
import { calcRuneEffects } from './rune.js';

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
    skills: [],
    treasure: null,
    comprehensionCount: 0,
    talent: TALENT_KEYS[Math.floor(Math.random() * TALENT_KEYS.length)],
    ev: { hp: 0, atk: 0, def: 0, spd: 0 },
    battleCount: 0,
    // 战斗临时属性
    currentHp: 0,
    maxHp: 0,
    buffDef: 0,
    regen: 0
  };

  // 给一个初始技能
  if (sp.skillPool.basic.length > 0) {
    pet.skills.push({ skillId: sp.skillPool.basic[0], enhanceLevel: 0, cooldownLeft: 0, priority: 0 });
  }

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
