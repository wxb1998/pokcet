// 游戏入口 - 初始化、事件绑定、游戏循环
import { gameState } from './state.js';
import { addLog } from './utils.js';
import { createPet } from './systems/pet.js';
import { spawnEnemies, battleTick, setBattleRenderer } from './systems/battle.js';
import { gardenTick } from './systems/garden.js';
import { saveGame, loadGame } from './save.js';
import { renderHeader } from './ui/header-ui.js';
import { renderBattle, renderZoneSelector } from './ui/battle-ui.js';
import { renderPets } from './ui/pets-ui.js';
import { renderFormation } from './ui/formation-ui.js';
import { renderTreasure } from './ui/treasure-ui.js';
import { renderDex, renderReserve } from './ui/dex-ui.js';
import { renderShop } from './ui/shop-ui.js';
import { renderGarden } from './ui/garden-ui.js';

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

  // 启动战斗循环 (1.5秒/回合)
  gameState.battleInterval = setInterval(battleTick, 1500);

  // 灵兽园产出 (30秒)
  setInterval(gardenTick, 30000);

  // 自动存档 (30秒)
  setInterval(saveGame, 30000);

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
        case 'treasure': renderTreasure(); break;
        case 'dex': renderDex(); break;
        case 'shop': renderShop(); break;
        case 'garden': renderGarden(); break;
      }
    });
  });

  console.log('[山海经·挂机物语] 游戏初始化完成, 模块化版本 v2.0');
}

// 启动
document.addEventListener('DOMContentLoaded', initGame);
