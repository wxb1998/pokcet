// 游戏入口 - 初始化、事件绑定、游戏循环
import { gameState } from './state.js';
import { addLog } from './utils.js';
import { createPet } from './systems/pet.js';
import { spawnEnemies, battleTick, setBattleRenderer } from './systems/battle.js';
import { gardenTick } from './systems/garden.js';
import { initStamina, regenStamina } from './systems/dungeon.js';
import { saveGame, loadGame } from './save.js';
import { renderHeader } from './ui/header-ui.js';
import { renderBattle, renderZoneSelector } from './ui/battle-ui.js';
import { renderPets } from './ui/pets-ui.js';
import { renderFormation } from './ui/formation-ui.js';
import { renderTreasure } from './ui/treasure-ui.js';
import { renderDex, renderReserve } from './ui/dex-ui.js';
import { renderShop } from './ui/shop-ui.js';
import { renderGarden } from './ui/garden-ui.js';
import { renderRunes } from './ui/rune-ui.js';
import { renderDungeon } from './ui/dungeon-ui.js';

function initGame() {
  const loaded = loadGame();

  if (!loaded) {
    // 新游戏：创建全S资质混沌
    const starter = createPet('hundun', 1, true);
    gameState.pets.push(starter);
    gameState.formation[0] = starter;
    gameState.dex['hundun'] = { seen: true, caught: true };
    addLog('欢迎来到山海经的世界! 你获得了一只混沌!', 'log-loot');
  } else {
    addLog('存档已加载，继续冒险!', 'log-loot');
  }

  // 初始化体力
  initStamina();

  // 生成初始敌人
  gameState.enemies = spawnEnemies();

  // 注册渲染回调（打破循环依赖）
  setBattleRenderer(renderBattle);

  // Store battleTick reference for pause/resume
  gameState._battleTickFn = battleTick;

  // 初次渲染
  renderHeader();
  renderZoneSelector();
  renderBattle();
  renderReserve();

  // 启动战斗循环，根据battleSpeed调整间隔
  const initialSpeed = gameState.battleSpeed || 1;
  const initialInterval = Math.max(75, Math.floor(1500 / initialSpeed));
  gameState.battleInterval = setInterval(battleTick, initialInterval);

  // 灵兽园产出 (30秒)
  setInterval(gardenTick, 30000);

  // 体力回复检查 (60秒)
  setInterval(regenStamina, 60000);

  // 自动存档 (30秒)
  setInterval(saveGame, 30000);

  // 战斗速度滑块
  const speedSlider = document.getElementById('speed-slider');
  const speedDisplay = document.getElementById('speed-display');
  if (speedSlider) {
    speedSlider.value = initialSpeed;
    speedSlider.addEventListener('input', () => {
      const speed = parseFloat(speedSlider.value);
      gameState.battleSpeed = speed;
      speedDisplay.textContent = '×' + speed;
      if (gameState.battleInterval) clearInterval(gameState.battleInterval);
      const interval = Math.max(75, Math.floor(1500 / speed));
      gameState.battleInterval = setInterval(battleTick, interval);
    });
  }

  // 保留栏阈值选择
  const thresholdSelect = document.getElementById('reserve-threshold');
  if (thresholdSelect) {
    thresholdSelect.value = gameState.reserveThreshold || 2;
    thresholdSelect.addEventListener('change', () => {
      gameState.reserveThreshold = parseInt(thresholdSelect.value);
    });
  }

  // Tab 切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      document.getElementById('panel-' + tab).classList.add('active');

      switch (tab) {
        case 'battle': renderBattle(); renderZoneSelector(); break;
        case 'pets': renderPets(); break;
        case 'formation': renderFormation(); break;
        case 'rune': renderRunes(); break;
        case 'dungeon': renderDungeon(); break;
        case 'treasure': renderTreasure(); break;
        case 'dex': renderDex(); renderReserve(); break;
        case 'shop': renderShop(); break;
        case 'garden': renderGarden(); break;
      }
    });
  });

  console.log('[山海经·挂机物语] 游戏初始化完成, v3.0 符文系统');
}

// 启动
document.addEventListener('DOMContentLoaded', initGame);
