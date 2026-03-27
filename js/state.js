// 全局游戏状态 - 所有模块共享同一个对象引用
export const gameState = {
  advLv: 1,
  advExp: 0,
  gold: 100,
  materials: { soul_stone: 3, enhance_stone: 0, rare_enhance: 0, rope: 5, seal: 0, fairy_lock: 0, talent_fruit: 0 },
  pets: [],
  formation: [null, null, null, null, null, null], // [0-2]=前排, [3-5]=后排, 直接存宠物对象引用
  treasures: [],
  reserve: [],       // 离线暂存极品
  currentZone: 0,
  battleInterval: null,
  enemies: [],
  battleLog: [],
  dex: {},
  captureMode: false,
  captureTargetIdx: -1,
  totalBattles: 0,
  appraisalUnlocked: false,  // 冒险Lv.15解锁鉴定
  garden: [],        // 灵兽园中的宠物ID
  _battleTickFn: null,  // 战斗tick函数引用，用于暂停/恢复战斗
  battleSpeed: 1,    // 战斗速度倍数 (1-20)
  reserveThreshold: 2,  // 自动保存阈值 (1星以上/2星以上/仅3星)
  reviveTimers: {},  // 复活计时器 {petId: timestamp}
  // 符文系统
  runes: [],         // 符文背包 [{id, slotType, setId, quality, level, ...}]
  // 体力系统
  stamina: 120,
  lastStaminaTime: Date.now(),
  // 副本进度
  dungeonProgress: {} // {floorId: true}
};

// ID计数器用对象包装，避免原始值导出不可变问题
export const counters = {
  petId: 1,
  treasureId: 1
};

/**
 * 获取阵型中存活的宠物列表
 * 放在 state 中避免 battle ↔ ui 循环依赖
 */
export function getFormationPets() {
  const pets = [];
  for (let i = 0; i < 6; i++) {
    const p = gameState.formation[i];
    if (p && p.currentHp > 0) {
      pets.push({ pet: p, slot: i, row: i < 3 ? 'front' : 'back' });
    }
  }
  return pets;
}

/**
 * 获取阵型中所有宠物（包括死亡的）
 */
export function getFormationAllPets() {
  const pets = [];
  for (let i = 0; i < 6; i++) {
    if (gameState.formation[i]) pets.push(gameState.formation[i]);
  }
  return pets;
}

/**
 * 阵型中的宠物数量
 */
export function getFormationCount() {
  return gameState.formation.filter(p => p !== null).length;
}
