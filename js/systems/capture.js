// 捕捉系统 - 道具选择 + 暂停战斗
import { gameState, getFormationPets } from '../state.js';
import { SPECIES, CAPTURE_ITEMS } from '../constants/index.js';
import { clamp, showToast, addLog } from '../utils.js';
import { createPet } from './pet.js';

export function calcCaptureRate(enemy, itemId) {
  const item = CAPTURE_ITEMS[itemId];
  if (!item) return 0;
  if (itemId === 'fairy_lock') return 100; // 困仙锁必定成功

  const hpRatio = enemy.currentHp / enemy.maxHp;
  const baseRate = (1 - hpRatio) * 50;
  let maxPetLv = 1;
  getFormationPets().forEach(fp => { if (fp.pet.level > maxPetLv) maxPetLv = fp.pet.level; });
  const lvBonus = maxPetLv >= enemy.level ? 10 : -10;
  return clamp(baseRate + item.bonus + lvBonus, 5, 95);
}

export function attemptCapture(enemyIdx, itemId, onRender) {
  const enemy = gameState.enemies[enemyIdx];
  if (!enemy || enemy.currentHp <= 0) { showToast('目标已被击败', 'info'); return; }

  // Check item stock
  const matKey = itemId;
  if ((gameState.materials[matKey] || 0) <= 0) { showToast('道具不足', 'info'); return; }

  // Consume item
  gameState.materials[matKey]--;

  const rate = calcCaptureRate(enemy, itemId);
  const itemName = CAPTURE_ITEMS[itemId].name;
  addLog('使用 ' + itemName + ' 尝试捕捉 ' + enemy.displayName + '... (成功率:' + Math.floor(rate) + '%)', 'log-capture');

  if (Math.random() * 100 < rate) {
    // Captured pet is Lv.1, keep IVs/talent random
    const newPet = createPet(enemy.captureSpecies, 1);
    gameState.pets.push(newPet);
    if (gameState.dex[enemy.captureSpecies]) gameState.dex[enemy.captureSpecies].caught = true;
    enemy.currentHp = 0;
    gameState.captureMode = false;
    gameState.captureTargetIdx = -1;
    addLog('捕捉成功! 获得 ' + newPet.name + ' Lv.1!', 'log-capture');
    showToast('捕捉成功! 获得 ' + newPet.name + ' Lv.1', 'capture');
  } else {
    addLog('捕捉失败...', 'log-capture');
    showToast('捕捉失败!', 'info');
  }

  // Resume battle
  resumeBattle();
  if (onRender) onRender();
}

// Battle pause/resume
export function pauseBattle() {
  if (gameState.battleInterval) {
    clearInterval(gameState.battleInterval);
    gameState.battleInterval = null;
  }
}

export function resumeBattle() {
  if (!gameState.battleInterval) {
    // Use the stored reference to battleTick
    if (gameState._battleTickFn) {
      gameState.battleInterval = setInterval(gameState._battleTickFn, 1500);
    }
  }
}
