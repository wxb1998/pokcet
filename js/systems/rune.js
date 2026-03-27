// 符文系统 - 生成、强化、装备、套装计算
import { gameState } from '../state.js';
import { RUNE_SLOTS, RUNE_SETS, RUNE_QUALITY, RUNE_MAIN_BASE, RUNE_SUB_POOL,
         RUNE_MAX_LEVEL, RUNE_ENHANCE_INTERVAL } from '../constants/index.js';
import { randInt, pick, showToast } from '../utils.js';

let _runeIdCounter = 1;
export function setRuneIdCounter(v) { _runeIdCounter = v; }
export function getRuneIdCounter() { return _runeIdCounter; }

/**
 * 生成一个符文
 * @param {number} slotType 槽位(0-5)
 * @param {string} setId 套装ID
 * @param {string} quality 品质key
 */
export function generateRune(slotType, setId, quality) {
  const slot = RUNE_SLOTS[slotType];
  const set = RUNE_SETS[setId];
  const qual = RUNE_QUALITY[quality];
  if (!slot || !set || !qual) return null;

  const mainBase = RUNE_MAIN_BASE[slot.mainStat];
  const mainValue = Math.floor(mainBase.base * qual.mainMult);

  // 随机副属性（不与主属性重复）
  const availableSubs = RUNE_SUB_POOL.filter(s => s.id !== slot.mainStat);
  const subs = [];
  const subCount = qual.subCount;
  const usedIds = new Set();

  for (let i = 0; i < subCount; i++) {
    const candidates = availableSubs.filter(s => !usedIds.has(s.id));
    if (candidates.length === 0) break;
    const sub = pick(candidates);
    usedIds.add(sub.id);
    subs.push({
      id: sub.id,
      name: sub.name,
      value: randInt(sub.min, sub.max)
    });
  }

  const rune = {
    id: _runeIdCounter++,
    slotType,
    setId,
    quality,
    level: 0,
    mainStat: slot.mainStat,
    mainValue,
    mainBase: mainBase.base,
    mainPerLevel: mainBase.perLevel,
    qualityMult: qual.mainMult,
    subs,
    equippedTo: null  // petId
  };

  return rune;
}

/**
 * 强化符文 (+1)，每+3触发副属性升级/解锁
 * @returns {object|null} { success, message, newSub? }
 */
export function enhanceRune(runeId) {
  const rune = gameState.runes.find(r => r.id === runeId);
  if (!rune) return { success: false, message: '符文不存在' };
  if (rune.level >= RUNE_MAX_LEVEL) return { success: false, message: '已达最高等级' };

  // 强化费用：等级越高越贵
  const cost = 500 + rune.level * 300;
  if (gameState.gold < cost) return { success: false, message: '金币不足 (需要' + cost + ')' };

  gameState.gold -= cost;
  rune.level++;

  // 更新主属性
  rune.mainValue = Math.floor((rune.mainBase + rune.mainPerLevel * rune.level) * rune.qualityMult);

  let result = { success: true, message: '符文强化至 +' + rune.level };

  // 每+3触发副属性
  if (rune.level % RUNE_ENHANCE_INTERVAL === 0) {
    const maxSubs = 4;
    if (rune.subs.length < maxSubs) {
      // 解锁新副属性
      const usedIds = new Set(rune.subs.map(s => s.id));
      const candidates = RUNE_SUB_POOL.filter(s => !usedIds.has(s.id) && s.id !== rune.mainStat);
      if (candidates.length > 0) {
        const newSub = pick(candidates);
        const sub = { id: newSub.id, name: newSub.name, value: randInt(newSub.min, newSub.max) };
        rune.subs.push(sub);
        result.message += '，解锁新副属性: ' + sub.name + '+' + sub.value;
        result.newSub = sub;
      }
    } else {
      // 随机强化已有副属性
      const idx = randInt(0, rune.subs.length - 1);
      const sub = rune.subs[idx];
      const pool = RUNE_SUB_POOL.find(s => s.id === sub.id);
      const boost = pool ? randInt(Math.floor(pool.min * 0.7), pool.max) : randInt(1, 5);
      sub.value += boost;
      result.message += '，强化副属性: ' + sub.name + '+' + boost;
    }
  }

  return result;
}

/**
 * 装备符文到宠物
 */
export function equipRune(runeId, petId) {
  const rune = gameState.runes.find(r => r.id === runeId);
  const pet = gameState.pets.find(p => p.id === petId);
  if (!rune || !pet) return false;

  // 初始化宠物符文槽
  if (!pet.runes) pet.runes = [null, null, null, null, null, null];

  // 如果该槽位已有符文，先卸下
  const oldRune = pet.runes[rune.slotType];
  if (oldRune) {
    const old = gameState.runes.find(r => r.id === oldRune);
    if (old) old.equippedTo = null;
  }

  // 如果符文装在别的宠物身上，先卸下
  if (rune.equippedTo && rune.equippedTo !== petId) {
    const otherPet = gameState.pets.find(p => p.id === rune.equippedTo);
    if (otherPet && otherPet.runes) {
      const idx = otherPet.runes.indexOf(rune.id);
      if (idx >= 0) otherPet.runes[idx] = null;
    }
  }

  pet.runes[rune.slotType] = rune.id;
  rune.equippedTo = petId;
  return true;
}

/**
 * 卸下符文
 */
export function unequipRune(runeId) {
  const rune = gameState.runes.find(r => r.id === runeId);
  if (!rune || !rune.equippedTo) return false;

  const pet = gameState.pets.find(p => p.id === rune.equippedTo);
  if (pet && pet.runes) {
    const idx = pet.runes.indexOf(rune.id);
    if (idx >= 0) pet.runes[idx] = null;
  }
  rune.equippedTo = null;
  return true;
}

/**
 * 出售符文
 */
export function sellRune(runeId) {
  const idx = gameState.runes.findIndex(r => r.id === runeId);
  if (idx < 0) return 0;
  const rune = gameState.runes[idx];

  // 先卸下
  if (rune.equippedTo) unequipRune(runeId);

  // 计算售价
  const qualMult = { white: 1, green: 2, blue: 4, purple: 8, gold: 15 };
  const price = (100 + rune.level * 50) * (qualMult[rune.quality] || 1);

  gameState.runes.splice(idx, 1);
  gameState.gold += price;
  return price;
}

/**
 * 计算宠物的符文套装效果
 * @returns {object} { setBonuses: [{setId, count, effects:[]}], flatStats: {}, pctStats: {} }
 */
export function calcRuneEffects(pet) {
  const result = {
    setBonuses: [],
    flatStats: { hp: 0, atk: 0, def: 0, spd: 0 },
    pctStats: { hp_pct: 0, atk_pct: 0, def_pct: 0, spd_pct: 0, crit_rate: 0, crit_dmg: 0, lifesteal: 0, first_strike: 0, hit_rate: 0 }
  };

  if (!pet.runes) return result;

  // 统计套装数量
  const setCounts = {};
  const equippedRunes = [];

  for (let i = 0; i < 6; i++) {
    if (!pet.runes[i]) continue;
    const rune = gameState.runes.find(r => r.id === pet.runes[i]);
    if (!rune) continue;
    equippedRunes.push(rune);
    setCounts[rune.setId] = (setCounts[rune.setId] || 0) + 1;

    // 累加主属性
    if (['hp', 'atk', 'def', 'spd'].includes(rune.mainStat)) {
      result.flatStats[rune.mainStat] += rune.mainValue;
    } else {
      result.pctStats[rune.mainStat] = (result.pctStats[rune.mainStat] || 0) + rune.mainValue;
    }

    // 累加副属性
    rune.subs.forEach(sub => {
      if (sub.id.endsWith('_flat')) {
        const stat = sub.id.replace('_flat', '');
        if (result.flatStats[stat] !== undefined) result.flatStats[stat] += sub.value;
      } else if (sub.id.endsWith('_pct')) {
        result.pctStats[sub.id] = (result.pctStats[sub.id] || 0) + sub.value;
      } else {
        result.pctStats[sub.id] = (result.pctStats[sub.id] || 0) + sub.value;
      }
    });
  }

  // 计算套装效果
  Object.keys(setCounts).forEach(setId => {
    const count = setCounts[setId];
    const set = RUNE_SETS[setId];
    if (!set) return;

    const effects = [];
    // 按2件一组计算（比如6件同套可触发3次2件效果 + 1次4件效果）
    if (set[2] && count >= 2) {
      const times = Math.floor(count / 2);
      for (let t = 0; t < (set[4] ? 1 : times); t++) {
        effects.push(set[2]);
        result.pctStats[set[2].stat] = (result.pctStats[set[2].stat] || 0) + set[2].value * 100;
      }
    }
    if (set[4] && count >= 4) {
      effects.push(set[4]);
      result.pctStats[set[4].stat] = (result.pctStats[set[4].stat] || 0) + set[4].value * 100;
    }

    if (effects.length > 0) {
      result.setBonuses.push({ setId, setName: set.name, count, effects });
    }
  });

  return result;
}
