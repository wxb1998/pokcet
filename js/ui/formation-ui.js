// 阵型配置界面 - 包含替换/移除功能（修复了原版只能移除不能替换的bug）
import { SPECIES, ELEM_CHART } from '../constants/index.js';
import { gameState, getFormationCount } from '../state.js';
import { showModal, closeModal, showToast } from '../utils.js';
import { renderBattle } from './battle-ui.js';

export function renderFormation() {
  const el = document.getElementById('formation-grid');
  if (!el) return;
  el.innerHTML = '<div class="row-label">前排（承受更多伤害）</div>';
  for (let i = 0; i < 3; i++) renderFormSlot(el, i);
  el.innerHTML += '<div class="row-label">后排（受伤减少30%）</div>';
  for (let i = 3; i < 6; i++) renderFormSlot(el, i);
}

function renderFormSlot(container, idx) {
  const div = document.createElement('div');
  const pet = gameState.formation[idx];

  if (pet) {
    const sp = SPECIES[pet.speciesId];
    div.className = 'form-slot occupied';
    div.innerHTML = '<div class="slot-label">' + (idx < 3 ? '前排' : '后排') + (idx % 3 + 1) + '</div>'
      + '<div class="slot-pet-name">' + sp.evoChain[pet.evoStage] + '</div>'
      + '<div class="slot-pet-info">Lv.' + pet.level + ' ' + ELEM_CHART[pet.elem].name + '</div>'
      + '<div class="slot-pet-info">ATK:' + pet.atk + ' DEF:' + pet.def + ' SPD:' + pet.spd + '</div>';
    div.onclick = () => showSlotActions(idx, pet);
  } else {
    div.className = 'form-slot';
    div.innerHTML = '<div class="slot-label">' + (idx < 3 ? '前排' : '后排') + (idx % 3 + 1) + '</div>'
      + '<div class="slot-pet-info">点击配置</div>';
    div.onclick = () => showFormationPicker(idx);
  }
  container.appendChild(div);
}

/**
 * 已占用格子的操作菜单 —— 修复：增加"替换"选项
 */
function showSlotActions(idx, pet) {
  const sp = SPECIES[pet.speciesId];
  const available = gameState.pets.filter(p => gameState.formation.indexOf(p) < 0);
  const isLastPet = getFormationCount() <= 1;

  const buttons = [];

  // 替换按钮（如果有其他可用宠物）
  if (available.length > 0) {
    buttons.push({
      text: '替换',
      primary: true,
      action: () => showReplacePicker(idx)
    });
  }

  // 移除按钮（不能移除最后一只）
  if (!isLastPet) {
    buttons.push({
      text: '移除',
      action: () => {
        gameState.formation[idx] = null;
        renderFormation();
        renderBattle();
        showToast(sp.name + ' 已下阵', 'info');
      }
    });
  }

  buttons.push({ text: '取消', action: null });

  showModal('阵型操作', '<p>当前: <strong>' + sp.evoChain[pet.evoStage] + '</strong> Lv.' + pet.level + '</p>'
    + (isLastPet ? '<p style="color:#f44336;font-size:12px;">至少需要1只宠物出战，无法移除</p>' : ''),
    buttons);
}

/**
 * 替换宠物选择器
 */
function showReplacePicker(slotIdx) {
  const available = gameState.pets.filter(p => gameState.formation.indexOf(p) < 0);
  let html = '<p>选择新宠物替换当前位置:</p>';
  available.forEach(pet => {
    const sp = SPECIES[pet.speciesId];
    html += '<div class="modal-select-item" data-pet-id="' + pet.id + '">'
      + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level
      + ' [' + ELEM_CHART[pet.elem].name + '] '
      + 'ATK:' + pet.atk + ' DEF:' + pet.def + ' SPD:' + pet.spd
      + '</div>';
  });

  showModal('替换宠物', html, [{ text: '取消', action: null }]);

  setTimeout(() => {
    document.querySelectorAll('[data-pet-id]').forEach(el => {
      el.onclick = () => {
        const petId = parseInt(el.getAttribute('data-pet-id'));
        const pet = gameState.pets.find(p => p.id === petId);
        if (pet) {
          gameState.formation[slotIdx] = pet;
          closeModal();
          renderFormation();
          renderBattle();
          showToast(pet.name + ' 已上阵!', 'info');
        }
      };
    });
  }, 100);
}

/**
 * 空格子选择宠物
 */
function showFormationPicker(slotIdx) {
  const available = gameState.pets.filter(p => gameState.formation.indexOf(p) < 0);
  const inFormCount = getFormationCount();

  if (available.length === 0) { showToast('没有可上阵的宠物', 'info'); return; }
  if (inFormCount >= 6) { showToast('阵型已满', 'info'); return; }

  let html = '<p>选择宠物上阵到' + (slotIdx < 3 ? '前排' : '后排') + ':</p>';
  available.forEach(pet => {
    const sp = SPECIES[pet.speciesId];
    html += '<div class="modal-select-item" data-pet-id="' + pet.id + '">'
      + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level
      + ' [' + ELEM_CHART[pet.elem].name + '] '
      + 'ATK:' + pet.atk + ' DEF:' + pet.def + ' SPD:' + pet.spd
      + '</div>';
  });

  showModal('选择宠物', html, [{ text: '取消', action: null }]);

  setTimeout(() => {
    document.querySelectorAll('[data-pet-id]').forEach(el => {
      el.onclick = () => {
        const petId = parseInt(el.getAttribute('data-pet-id'));
        const pet = gameState.pets.find(p => p.id === petId);
        if (pet) {
          gameState.formation[slotIdx] = pet;
          closeModal();
          renderFormation();
          renderBattle();
          showToast(pet.name + ' 已上阵!', 'info');
        }
      };
    });
  }, 100);
}
