// 存档 / 读档系统
import { gameState, counters } from './state.js';
import { calcAllStats } from './systems/pet.js';

const SAVE_KEY = 'shanhaijing_save_v2';

export function saveGame() {
  try {
    const formationIds = gameState.formation.map(p => p ? p.id : null);
    const petsData = gameState.pets.map(p => {
      const pd = { ...p };
      pd.treasureId = p.treasure ? p.treasure.id : null;
      delete pd.treasure;
      // 保存当前HP比例用于恢复
      pd.hpRatio = p.maxHp > 0 ? p.currentHp / p.maxHp : 1;
      return pd;
    });

    const data = {
      version: 2,
      advLv: gameState.advLv,
      advExp: gameState.advExp,
      gold: gameState.gold,
      materials: gameState.materials,
      pets: petsData,
      formationIds,
      treasures: gameState.treasures.map(t => ({ ...t })),
      reserve: gameState.reserve,
      currentZone: gameState.currentZone,
      dex: gameState.dex,
      totalBattles: gameState.totalBattles,
      appraisalUnlocked: gameState.appraisalUnlocked,
      garden: gameState.garden || [],
      petIdCounter: counters.petId,
      treasureIdCounter: counters.treasureId
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* silent */ }
}

export function loadGame() {
  try {
    // 兼容旧存档key
    let raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem('shanhaijing_save');
    if (!raw) return false;

    const data = JSON.parse(raw);
    gameState.advLv = data.advLv || 1;
    gameState.advExp = data.advExp || 0;
    gameState.gold = data.gold || 0;
    gameState.materials = data.materials || { soul_stone: 3, enhance_stone: 0, rare_enhance: 0, rope: 5, seal: 0, fairy_lock: 0, talent_fruit: 0 };
    // Migrate old saves that don't have new material fields
    if (!gameState.materials.rope) gameState.materials.rope = 5;
    if (!gameState.materials.seal) gameState.materials.seal = 0;
    if (!gameState.materials.fairy_lock) gameState.materials.fairy_lock = 0;
    if (!gameState.materials.talent_fruit) gameState.materials.talent_fruit = 0;
    gameState.dex = data.dex || {};
    gameState.totalBattles = data.totalBattles || 0;
    gameState.appraisalUnlocked = data.appraisalUnlocked || false;
    gameState.currentZone = data.currentZone || 0;
    gameState.reserve = data.reserve || [];
    gameState.garden = data.garden || [];
    counters.petId = data.petIdCounter || 1;
    counters.treasureId = data.treasureIdCounter || 1;

    // 恢复宝物
    gameState.treasures = (data.treasures || []).map(t => ({ ...t, equippedTo: t.equippedTo || null }));

    // 恢复宠物
    gameState.pets = (data.pets || []).map(pd => {
      const pet = { ...pd, treasure: null, currentHp: 0 };
      // Migrate old pets without new fields
      if (!pet.ev) pet.ev = { hp: 0, atk: 0, def: 0, spd: 0 };
      if (!pet.battleCount) pet.battleCount = 0;
      if (!pet.talent) pet.talent = 'fierce'; // Default talent for old saves
      if (pd.treasureId) {
        const tr = gameState.treasures.find(t => t.id === pd.treasureId);
        if (tr) { pet.treasure = tr; tr.equippedTo = pet.id; }
      }
      calcAllStats(pet);
      // 恢复HP比例（如果有的话）
      pet.currentHp = pd.hpRatio ? Math.max(1, Math.floor(pet.maxHp * pd.hpRatio)) : pet.maxHp;
      return pet;
    });

    // 恢复阵型（直接引用对象）
    gameState.formation = [null, null, null, null, null, null];
    if (data.formationIds) {
      data.formationIds.forEach((pid, idx) => {
        if (pid) {
          const pet = gameState.pets.find(p => p.id === pid);
          if (pet) gameState.formation[idx] = pet;
        }
      });
    }

    return true;
  } catch (e) { return false; }
}
