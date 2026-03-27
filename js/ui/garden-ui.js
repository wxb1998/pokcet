// 灵兽园界面
import { SPECIES } from '../constants/index.js';
import { gameState } from '../state.js';
import { showToast } from '../utils.js';
import { addToGarden, removeFromGarden } from '../systems/garden.js';

window._addToGarden = function(petId) {
  if (addToGarden(petId)) {
    showToast('已入驻灵兽园', 'info');
    renderGarden();
  } else {
    showToast('无法添加（已满/已在出战/已入驻）', 'info');
  }
};

window._removeFromGarden = function(petId) {
  removeFromGarden(petId);
  showToast('已离开灵兽园', 'info');
  renderGarden();
};

export function renderGarden() {
  const el = document.getElementById('garden-list');
  if (!el) return;
  if (!gameState.garden) gameState.garden = [];

  el.innerHTML = '<p style="color:#888;font-size:12px;margin-bottom:8px;">闲置宠物入驻灵兽园，每30秒产出金币和材料（上限5只）</p>';

  // Current garden pets
  if (gameState.garden.length > 0) {
    el.innerHTML += '<h4 style="color:#4caf50;">入驻中 (' + gameState.garden.length + '/5)</h4>';
    gameState.garden.forEach(petId => {
      const pet = gameState.pets.find(p => p.id === petId);
      if (!pet) return;
      const sp = SPECIES[pet.speciesId];
      const div = document.createElement('div');
      div.className = 'garden-slot occupied';
      div.innerHTML = '<span>' + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level + '</span>'
        + '<span style="color:#ffd700;font-size:11px;">产出: ' + Math.floor(pet.level * 0.5 + 1) + '金/30s</span>'
        + ' <button class="btn-sm" onclick="window._removeFromGarden(' + petId + ')">召回</button>';
      el.appendChild(div);
    });
  }

  // Available pets (not in formation, not in garden)
  const available = gameState.pets.filter(p =>
    gameState.formation.indexOf(p) < 0 &&
    (!gameState.garden || gameState.garden.indexOf(p.id) < 0)
  );

  if (available.length > 0 && gameState.garden.length < 5) {
    const addDiv = document.createElement('div');
    addDiv.innerHTML = '<h4 style="color:#aaa;margin-top:12px;">可入驻</h4>';
    available.forEach(pet => {
      const sp = SPECIES[pet.speciesId];
      const item = document.createElement('div');
      item.className = 'garden-slot';
      item.innerHTML = '<span>' + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level + '</span>'
        + ' <button class="btn-sm" onclick="window._addToGarden(' + pet.id + ')">入驻</button>';
      addDiv.appendChild(item);
    });
    el.appendChild(addDiv);
  }
}
