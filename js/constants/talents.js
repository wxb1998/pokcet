// 宠物天赋系统
export const TALENTS = {
  fierce: {name:'猛攻', desc:'伤害+8%', effect:'dmg_up', value: 0.08},
  tenacious: {name:'坚韧', desc:'HP低于30%时防御翻倍', effect:'low_hp_def', value: 2.0},
  swift: {name:'迅捷', desc:'首次攻击必定先手', effect:'first_strike', value: 1},
  bloodthirst: {name:'嗜血', desc:'击杀敌人回复15%HP', effect:'kill_heal', value: 0.15},
  thickskin: {name:'厚皮', desc:'受暴击伤害降低30%', effect:'crit_resist', value: 0.30},
  agile: {name:'灵敏', desc:'10%闪避率', effect:'dodge', value: 0.10}
};

export const TALENT_KEYS = Object.keys(TALENTS);
