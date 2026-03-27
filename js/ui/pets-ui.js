// 宠物列表 + 宠物详情
import { SPECIES, SKILLS, ELEM_CHART, PERSONALITIES, QUALITY_NAMES, TALENTS } from '../constants/index.js';
import { gameState } from '../state.js';
import { showModal, closeModal, showToast } from '../utils.js';
import { expForLevel, calcAllStats, getAptFromIV } from '../systems/pet.js';
import { enhanceSkill } from '../systems/comprehend.js';
import { equipTreasure } from '../systems/treasure.js';
import { randInt } from '../utils.js';

// 暴露到 window 供 onclick 调用
window._enhanceSkill = function(petId, skillIdx) {
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet) return;
  if (enhanceSkill(pet, skillIdx)) {
    closeModal();
    showPetDetail(pet);
  }
};

window._equipTreasure = function(trId, petId) {
  equipTreasure(trId, petId);
  closeModal();
  renderPets();
};

window._useTalentFruit = function(petId, stat) {
  const pet = gameState.pets.find(p => p.id === petId);
  if (!pet) return;
  if ((gameState.materials.talent_fruit || 0) <= 0) { showToast('没有天赋果', 'info'); return; }
  gameState.materials.talent_fruit--;
  const oldIV = pet.iv[stat];
  pet.iv[stat] = randInt(0, 31);
  pet.apts[stat] = getAptFromIV(pet.iv[stat]);
  calcAllStats(pet);
  showToast(stat.toUpperCase() + ' IV: ' + oldIV + ' → ' + pet.iv[stat] + ' (' + pet.apts[stat] + ')', 'info');
  closeModal();
  showPetDetail(pet);
};

export function renderPets() {
  const el = document.getElementById('pet-list');
  if (!el) return;
  el.innerHTML = '';

  if (gameState.pets.length === 0) {
    el.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">还没有宠物...</p>';
    return;
  }

  gameState.pets.forEach(pet => {
    const sp = SPECIES[pet.speciesId];
    const pers = PERSONALITIES[pet.personality];
    const inForm = gameState.formation.indexOf(pet) >= 0;
    const card = document.createElement('div');
    card.className = 'pet-card' + (inForm ? ' in-formation' : '');

    const expPct = (pet.exp / expForLevel(pet.level) * 100).toFixed(1);

    // 资质
    let aptHTML = '资质: ';
    ['hp','atk','def','spd'].forEach(st => {
      const a = pet.apts[st];
      const cls = 'apt-' + (a === 'S+' ? 'Sp' : a);
      aptHTML += '<span class="' + cls + '">' + st.toUpperCase() + ':' + a + '</span> ';
    });

    // 个体值
    let ivHTML = '';
    if (gameState.appraisalUnlocked) {
      ivHTML = '<div style="font-size:10px;color:#666;margin-top:2px;">个体值: HP:' + pet.iv.hp + ' ATK:' + pet.iv.atk + ' DEF:' + pet.iv.def + ' SPD:' + pet.iv.spd + '</div>';
    }

    // 技能
    let skillsHTML = '';
    pet.skills.forEach(s => {
      const sd = SKILLS[s.skillId];
      const enh = s.enhanceLevel > 0 ? ' +' + s.enhanceLevel : '';
      skillsHTML += '<span class="skill-tag">' + sd.name + enh + ' [' + sd.tier + ']</span>';
    });
    if (pet.skills.length === 0) skillsHTML = '<span style="font-size:10px;color:#555;">未习得技能</span>';

    const compMax = Math.floor(pet.level / 3);
    const compText = '领悟: ' + pet.comprehensionCount + '/' + compMax;

    card.innerHTML = '<div class="pet-header">'
      + '<span class="pet-name">' + sp.evoChain[pet.evoStage] + ' Lv.' + pet.level + '</span>'
      + '<span class="pet-elem elem-' + pet.elem + '">' + ELEM_CHART[pet.elem].name + '</span>'
      + '</div>'
      + '<div class="pet-apts">' + aptHTML + ' | 性格:' + pers.name + (pers.up ? '(↑' + pers.up + ' ↓' + pers.down + ')' : '') + '</div>'
      + ivHTML
      + '<div class="pet-stats"><span>HP:' + pet.maxHp + '</span><span>ATK:' + pet.atk + '</span><span>DEF:' + pet.def + '</span><span>SPD:' + pet.spd + '</span></div>'
      + '<div class="pet-skills-row">' + skillsHTML + '</div>'
      + '<div style="font-size:10px;color:#666;margin-top:4px;">' + compText + ' | ' + (pet.treasure ? '宝物:' + pet.treasure.name + '+' + pet.treasure.enhanceLevel : '未装备宝物') + '</div>'
      + '<div class="exp-bar"><div class="exp-fill" style="width:' + expPct + '%"></div></div>'
      + '<div style="font-size:9px;color:#555;margin-top:2px;">EXP: ' + pet.exp + '/' + expForLevel(pet.level) + ' (' + expPct + '%)' + (inForm ? ' [出战中]' : '') + '</div>';

    card.onclick = () => showPetDetail(pet);
    el.appendChild(card);
  });
}

function showPetDetail(pet) {
  const sp = SPECIES[pet.speciesId];
  const pers = PERSONALITIES[pet.personality];

  let html = '<div style="margin-bottom:12px;">';
  html += '<p><strong>' + sp.evoChain[pet.evoStage] + '</strong> (Lv.' + pet.level + ') - ' + sp.desc + '</p>';
  html += '<p>进化链: ' + sp.evoChain.map((e, i) => (i === pet.evoStage ? '<strong>' + e + '</strong>' : '<span style="color:#666">' + e + '</span>')).join(' → ') + '</p>';

  // Talent display
  if (pet.level >= 10 && pet.talent) {
    const talentData = TALENTS[pet.talent];
    html += '<p style="color:#e94560;"><strong>天赋: ' + talentData.name + '</strong> - ' + talentData.desc + '</p>';
  } else if (pet.level < 10) {
    html += '<p style="color:#888;">天赋: ???（Lv.10解锁）</p>';
  }

  // EV/Learning Power display
  if (gameState.appraisalUnlocked && (pet.ev.hp || pet.ev.atk || pet.ev.def || pet.ev.spd)) {
    const totalEV = pet.ev.hp + pet.ev.atk + pet.ev.def + pet.ev.spd;
    html += '<p style="color:#4caf50;font-size:12px;">学习点数: HP:' + pet.ev.hp + ' ATK:' + pet.ev.atk + ' DEF:' + pet.ev.def + ' SPD:' + pet.ev.spd + ' (合计:' + totalEV + '/510)</p>';
    html += '<p style="color:#4caf50;font-size:12px;">战斗次数: ' + (pet.battleCount || 0) + '</p>';
  }

  html += '</div>';

  // 技能区
  html += '<h4 style="color:#e94560;">技能 (' + pet.skills.length + '/4)</h4>';
  pet.skills.forEach((s, idx) => {
    const sd = SKILLS[s.skillId];
    html += '<div style="padding:6px;margin:4px 0;background:rgba(255,255,255,0.05);border-radius:4px;">';
    html += '<strong>' + sd.name + '</strong> [' + sd.tier + '] Lv.' + (s.enhanceLevel + 1);
    html += ' | 威力:' + (sd.power || '-') + ' | CD:' + sd.cooldown + ' | ' + sd.desc;
    if (s.enhanceLevel < 3) {
      const compMax = Math.floor(pet.level / 3);
      if (pet.comprehensionCount < compMax) {
        html += ' <button class="btn-sm btn-enhance" onclick="window._enhanceSkill(' + pet.id + ',' + idx + ')">强化</button>';
      }
    }
    html += '</div>';
  });

  // 天赋果重随
  if (gameState.appraisalUnlocked && gameState.materials.talent_fruit > 0) {
    html += '<p style="margin-top:12px;"><strong>天赋果重随 (库存:' + gameState.materials.talent_fruit + '):</strong> ';
    ['hp','atk','def','spd'].forEach(stat => {
      html += '<button class="btn-sm" onclick="window._useTalentFruit(' + pet.id + ',\'' + stat + '\')">' + stat.toUpperCase() + '</button> ';
    });
    html += '</p>';
  }

  // 宝物区
  html += '<h4 style="color:#ffd700;margin-top:12px;">宝物</h4>';
  if (pet.treasure) {
    html += '<p>' + pet.treasure.name + ' +' + pet.treasure.enhanceLevel + ' [' + QUALITY_NAMES[pet.treasure.quality] + ']</p>';
  } else {
    const available = gameState.treasures.filter(t => !t.equippedTo);
    if (available.length > 0) {
      html += '<p>未装备 - 可用宝物:</p>';
      available.forEach(t => {
        html += '<div class="modal-select-item" onclick="window._equipTreasure(' + t.id + ',' + pet.id + ')">'
          + t.name + ' [' + QUALITY_NAMES[t.quality] + '] +' + t.enhanceLevel + '</div>';
      });
    } else {
      html += '<p>未装备，暂无可用宝物</p>';
    }
  }

  showModal(sp.name + ' 详情', html, [{ text: '关闭', action: null }]);
}
