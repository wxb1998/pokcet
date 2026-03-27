// 技能领悟系统 - 升级时50%概率领悟，方案A（重复=强化，满级浪费）
import { SPECIES, SKILLS, COMPREHEND_WEIGHTS } from '../constants/index.js';
import { showToast, addLog, weightedPick } from '../utils.js';
import { syncBattleSkills } from './pet.js';

/**
 * 升级时尝试领悟技能
 * 触发时机：宠物升级时调用
 * 概率：50%
 * 机制（方案A）：
 *   1. 按权重随机抽一个grade
 *   2. 从该grade的skillPool里随机抽一个技能
 *   3. 已学过 → 强化（level+1，上限5，满级则浪费）
 *   4. 未学过 → 加入skillBook
 *   5. 不弹窗，直接学会
 */
export function tryComprehendOnLevelUp(pet) {
  if (Math.random() > 0.50) return;

  const sp = SPECIES[pet.speciesId];
  if (!sp || !sp.skillPool) return;

  // 构建可领悟池（按grade权重）
  const gradePool = {};
  const grades = ['common', 'fine', 'rare', 'legend'];
  grades.forEach(g => {
    const pool = sp.skillPool[g] || [];
    if (pool.length > 0) {
      gradePool[g] = pool;
    }
  });

  if (Object.keys(gradePool).length === 0) return;

  // 按权重选grade
  const weights = {};
  for (const g in gradePool) {
    weights[g] = COMPREHEND_WEIGHTS[g] || 1;
  }
  const chosenGrade = weightedPick(weights);
  const pool = gradePool[chosenGrade];
  if (!pool || pool.length === 0) return;

  // 从该grade池里随机抽一个
  const skillId = pool[Math.floor(Math.random() * pool.length)];
  const skillData = SKILLS[skillId];
  if (!skillData) return;

  // 检查是否已学过
  if (!pet.skillBook) { pet.skillBook = []; pet.equippedSkills = [null,null,null,null]; }

  const existingIdx = pet.skillBook.findIndex(s => s.skillId === skillId);

  if (existingIdx >= 0) {
    // 已学过 → 强化
    const entry = pet.skillBook[existingIdx];
    if (entry.level >= 5) {
      // 满级，浪费（方案A）
      addLog(pet.name + ' 领悟了 ' + skillData.name + '，但已满级(Lv.5)，未生效', 'log-comprehend');
      return;
    }
    entry.level++;
    addLog(pet.name + ' 的 ' + skillData.name + ' 强化至 Lv.' + entry.level + '!', 'log-comprehend');
    showToast(skillData.name + ' → Lv.' + entry.level + '!', 'info');
  } else {
    // 新技能 → 加入skillBook
    pet.skillBook.push({ skillId, level: 1 });
    const newIdx = pet.skillBook.length - 1;

    // 如果有空装备槽，自动装备
    const emptySlot = pet.equippedSkills.indexOf(null);
    if (emptySlot >= 0) {
      pet.equippedSkills[emptySlot] = newIdx;
    }

    const gradeName = { common:'普通', fine:'精良', rare:'稀有', legend:'传说' }[chosenGrade] || '';
    addLog(pet.name + ' 领悟了[' + gradeName + ']技能: ' + skillData.name + '!', 'log-comprehend');
    showToast(pet.name + ' 领悟了 ' + skillData.name + '!', 'info');
  }

  // 同步战斗技能
  syncBattleSkills(pet);
}

/**
 * 旧版兼容：战斗后领悟（保留但不再使用，由 tryComprehendOnLevelUp 替代）
 */
export function tryComprehend(pet) {
  // 不再触发，保留空函数避免其他文件import报错
}
