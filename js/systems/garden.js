// 灵兽园系统 - 闲置宠物产出资源
import { gameState } from '../state.js';
import { addLog } from '../utils.js';

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
  // Can't add pets that are in formation
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
