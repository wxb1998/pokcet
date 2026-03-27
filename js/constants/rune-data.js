// 符文系统常量 - 槽位、套装、副属性池

// 6个槽位，每个槽位的主属性固定
export const RUNE_SLOTS = [
  { id: 0, name: '天位', mainStat: 'hp',       mainLabel: '生命' },
  { id: 1, name: '地位', mainStat: 'atk',      mainLabel: '攻击' },
  { id: 2, name: '玄位', mainStat: 'def',      mainLabel: '防御' },
  { id: 3, name: '黄位', mainStat: 'spd',      mainLabel: '速度' },
  { id: 4, name: '日位', mainStat: 'crit_rate', mainLabel: '暴击率' },
  { id: 5, name: '月位', mainStat: 'crit_dmg',  mainLabel: '暴击伤害' }
];

// 套装定义：2件/4件/6件效果
export const RUNE_SETS = {
  pojun:   { name: '破军', icon: '⚔️',  color: '#e53935',
    2: { desc: '攻击+15%', stat: 'atk_pct', value: 0.15 },
    4: { desc: '攻击+40%', stat: 'atk_pct', value: 0.40 }
  },
  tiebi:   { name: '铁壁', icon: '🛡️',  color: '#1e88e5',
    2: { desc: '防御+15%', stat: 'def_pct', value: 0.15 },
    4: { desc: '生命+20%', stat: 'hp_pct',  value: 0.20 }
  },
  jifeng:  { name: '疾风', icon: '💨',  color: '#43a047',
    2: { desc: '速度+15%', stat: 'spd_pct', value: 0.15 },
    4: { desc: '先手概率+25%', stat: 'first_strike', value: 0.25 }
  },
  xixue:   { name: '吸血', icon: '🩸',  color: '#8e24aa',
    2: { desc: '造成伤害回复15%HP', stat: 'lifesteal', value: 0.15 },
  },
  huixin:  { name: '会心', icon: '💥',  color: '#ff8f00',
    2: { desc: '暴击率+15%', stat: 'crit_rate', value: 0.15 },
    4: { desc: '暴击伤害+40%', stat: 'crit_dmg', value: 0.40 }
  },
  guogan:  { name: '果敢', icon: '🎯',  color: '#00897b',
    2: { desc: '效果命中+15%', stat: 'hit_rate', value: 0.15 },
  }
};

// 符文品质
export const RUNE_QUALITY = {
  white:  { name: '普通', color: '#aaa',    subCount: 1, mainMult: 1.0 },
  green:  { name: '精良', color: '#4caf50', subCount: 2, mainMult: 1.1 },
  blue:   { name: '稀有', color: '#2196f3', subCount: 3, mainMult: 1.2 },
  purple: { name: '史诗', color: '#9c27b0', subCount: 4, mainMult: 1.35 },
  gold:   { name: '传说', color: '#ff9800', subCount: 4, mainMult: 1.5 }
};

export const RUNE_QUALITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold'];

// 主属性基础值（Lv.0时）
export const RUNE_MAIN_BASE = {
  hp:        { base: 120, perLevel: 30 },
  atk:       { base: 8,   perLevel: 3 },
  def:       { base: 5,   perLevel: 2 },
  spd:       { base: 4,   perLevel: 1.5 },
  crit_rate: { base: 3,   perLevel: 1.2 },   // 百分比
  crit_dmg:  { base: 5,   perLevel: 2 }       // 百分比
};

// 副属性池（从中随机抽取）
export const RUNE_SUB_POOL = [
  { id: 'hp_flat',    name: '生命',     min: 20, max: 80 },
  { id: 'atk_flat',   name: '攻击',     min: 3,  max: 15 },
  { id: 'def_flat',   name: '防御',     min: 2,  max: 10 },
  { id: 'spd_flat',   name: '速度',     min: 1,  max: 6 },
  { id: 'hp_pct',     name: '生命%',    min: 2,  max: 8 },
  { id: 'atk_pct',    name: '攻击%',    min: 2,  max: 8 },
  { id: 'def_pct',    name: '防御%',    min: 2,  max: 8 },
  { id: 'crit_rate',  name: '暴击率%',  min: 1,  max: 5 },
  { id: 'crit_dmg',   name: '暴击伤害%', min: 2, max: 8 }
];

// 强化：每+3解锁/提升一条副属性，最高+15
export const RUNE_MAX_LEVEL = 15;
export const RUNE_ENHANCE_INTERVAL = 3; // 每3级触发一次副属性
