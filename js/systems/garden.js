// 灵兽园系统 - 闲置宠物产出 + 分解宠物/符文获得金币
import { gameState } from '../state.js';
import { addLog, showToast } from '../utils.js';
import { unequipRune } from './rune.js';

// ===== 灵兽园产出（保留原功能）=====

export function gardenTick() {
  if (!gameState.garden || gameState.garden.length === 0) return;

  gameState.garden.forEach(petId => {
    const pet = gameState.pets.find(p => p.id === petId);
    if (!pet) return;
    // Each pet produces gold based on level
    const gold = Math.floor(pet.level * 0.5 + 1);
    gameState.gold += gold;
    // Small chance for materials
    if (Math.random() < 0.02) {
      gameState.materials.enhance_stone++;
    }
    if (Math.random() < 0.005) {
      gameState.materials.rope++;
    }
  });
}

export function addToGarden(petId) {
  if (!gameState.garden) gameState.garden = [];
  if (gameState.garden.length >= 5) return false;
  if (gameState.garden.indexOf(petId) >= 0) return false;
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet) return false;
  if (gameState.formation.indexOf(pet) >= 0) return false;
  gameState.garden.push(petId);
  return true;
}

export function removeFromGarden(petId) {
  if (!gameState.garden) return;
  gameState.garden = gameState.garden.filter(id => id !== petId);
}

// ===== 分解系统 =====

/**
 * 计算宠物分解获得的金币
 * 基础 = 等级×15 + 星级加成
 * 资质越高金币越多
 */
export function calcPetDecomposeGold(pet) {
  if (!pet) return 0;
  const aptVal = { D: 0, C: 1, B: 2, A: 3, S: 5, 'S+': 8 };
  const aptScore = (aptVal[pet.apts.hp] || 0) + (aptVal[pet.apts.atk] || 0)
    + (aptVal[pet.apts.def] || 0) + (aptVal[pet.apts.spd] || 0);
  return Math.floor(pet.level * 15 + aptScore * 5 + 10);
}

/**
 * 计算符文分解获得的金币
 * 品质×基础 + 强化等级加成
 */
export function calcRuneDecomposeGold(rune) {
  if (!rune) return 0;
  const qualMult = { white: 1, green: 3, blue: 6, purple: 12, gold: 25 };
  return Math.floor((80 + rune.level * 40) * (qualMult[rune.quality] || 1));
}

/**
 * 分解单只宠物
 * @returns {number} 获得的金币, 0=失败
 */
export function decomposePet(petId) {
  const idx = gameState.pets.findIndex(p => p.id === petId);
  if (idx < 0) return 0;
  const pet = gameState.pets[idx];

  // 不能分解出战中的宠物
  if (gameState.formation.indexOf(pet) >= 0) return 0;

  // 从灵兽园移除
  removeFromGarden(petId);

  // 卸下身上所有符文
  if (pet.runes) {
    pet.runes.forEach((runeId, slotIdx) => {
      if (runeId) {
        const rune = gameState.runes.find(r => r.id === runeId);
        if (rune) rune.equippedTo = null;
      }
    });
  }

  const gold = calcPetDecomposeGold(pet);
  gameState.gold += gold;
  gameState.pets.splice(idx, 1);

  return gold;
}

/**
 * 批量分解宠物
 * @param {number[]} petIds
 * @returns {{count:number, totalGold:number}}
 */
export function batchDecomposePets(petIds) {
  let totalGold = 0;
  let count = 0;
  petIds.forEach(id => {
    const gold = decomposePet(id);
    if (gold > 0) { totalGold += gold; count++; }
  });
  return { count, totalGold };
}

/**
 * 分解单个符文
 * @returns {number} 获得的金币
 */
export function decomposeRune(runeId) {
  const idx = gameState.runes.findIndex(r => r.id === runeId);
  if (idx < 0) return 0;
  const rune = gameState.runes[idx];

  // 先卸下
  if (rune.equippedTo) unequipRune(runeId);

  const gold = calcRuneDecomposeGold(rune);
  gameState.gold += gold;
  gameState.runes.splice(idx, 1);

  return gold;
}

/**
 * 批量分解符文
 * @param {number[]} runeIds
 * @returns {{count:number, totalGold:number}}
 */
export function batchDecomposeRunes(runeIds) {
  let totalGold = 0;
  let count = 0;
  runeIds.forEach(id => {
    const gold = decomposeRune(id);
    if (gold > 0) { totalGold += gold; count++; }
  });
  return { count, totalGold };
}
