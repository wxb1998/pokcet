// 符文副本常量 - 10层塔，固定Boss

export const DUNGEON_FLOORS = [
  {
    id: 0, name: '第一层·青丘狐', bossLevel: 15,
    bossSpecies: 'jiao', bossStars: 1,
    staminaCost: 10,
    desc: '青丘之地的妖狐，实力平平',
    runeDropQuality: { white: 50, green: 35, blue: 15 },
    runeDropSets: ['pojun', 'tiebi', 'jifeng'],
    goldReward: 200, expReward: 80
  },
  {
    id: 1, name: '第二层·赤焰鸟', bossLevel: 25,
    bossSpecies: 'bifang', bossStars: 1,
    staminaCost: 10,
    desc: '火焰山谷中的毕方鸟',
    runeDropQuality: { white: 40, green: 40, blue: 20 },
    runeDropSets: ['pojun', 'tiebi', 'jifeng'],
    goldReward: 300, expReward: 120
  },
  {
    id: 2, name: '第三层·玄武蛇', bossLevel: 35,
    bossSpecies: 'xiangliu', bossStars: 2,
    staminaCost: 12,
    desc: '九头相柳，毒雾弥漫',
    runeDropQuality: { white: 30, green: 40, blue: 25, purple: 5 },
    runeDropSets: ['pojun', 'xixue', 'huixin'],
    goldReward: 400, expReward: 160
  },
  {
    id: 3, name: '第四层·雷兽', bossLevel: 45,
    bossSpecies: 'kui', bossStars: 2,
    staminaCost: 12,
    desc: '夔牛一足，雷鸣震天',
    runeDropQuality: { white: 20, green: 40, blue: 30, purple: 10 },
    runeDropSets: ['jifeng', 'huixin', 'guogan'],
    goldReward: 500, expReward: 200
  },
  {
    id: 4, name: '第五层·九婴', bossLevel: 55,
    bossSpecies: 'jiuying', bossStars: 2,
    staminaCost: 14,
    desc: '九首水火齐喷，凶名远播',
    runeDropQuality: { green: 35, blue: 35, purple: 25, gold: 5 },
    runeDropSets: ['pojun', 'tiebi', 'xixue'],
    goldReward: 650, expReward: 260
  },
  {
    id: 5, name: '第六层·穷奇', bossLevel: 65,
    bossSpecies: 'qiongqi', bossStars: 2,
    staminaCost: 14,
    desc: '不忠不信之凶兽',
    runeDropQuality: { green: 25, blue: 40, purple: 30, gold: 5 },
    runeDropSets: ['huixin', 'xixue', 'guogan'],
    goldReward: 800, expReward: 320
  },
  {
    id: 6, name: '第七层·饕餮', bossLevel: 75,
    bossSpecies: 'taotie', bossStars: 3,
    staminaCost: 16,
    desc: '贪食无厌的上古凶兽',
    runeDropQuality: { blue: 35, purple: 40, gold: 25 },
    runeDropSets: ['pojun', 'jifeng', 'huixin'],
    goldReward: 1000, expReward: 400
  },
  {
    id: 7, name: '第八层·蚩尤', bossLevel: 85,
    bossSpecies: 'chiyou', bossStars: 3,
    staminaCost: 18,
    desc: '战神蚩尤，铜头铁额',
    runeDropQuality: { blue: 25, purple: 45, gold: 30 },
    runeDropSets: ['pojun', 'tiebi', 'xixue'],
    goldReward: 1200, expReward: 500
  },
  {
    id: 8, name: '第九层·鲲鹏', bossLevel: 95,
    bossSpecies: 'kunpeng', bossStars: 3,
    staminaCost: 20,
    desc: '北冥有鱼，化而为鹏',
    runeDropQuality: { purple: 50, gold: 50 },
    runeDropSets: ['jifeng', 'huixin', 'guogan'],
    goldReward: 1500, expReward: 600
  },
  {
    id: 9, name: '第十层·烛龙', bossLevel: 100,
    bossSpecies: 'zhulong', bossStars: 3,
    staminaCost: 20,
    desc: '开目为昼，闭目为夜，极难击败',
    runeDropQuality: { purple: 40, gold: 60 },
    runeDropSets: ['pojun', 'tiebi', 'jifeng', 'xixue', 'huixin', 'guogan'],
    goldReward: 2000, expReward: 800
  }
];

// 体力系统
export const STAMINA_MAX = 120;
export const STAMINA_REGEN_INTERVAL = 5 * 60 * 1000; // 5分钟1点 (ms)
