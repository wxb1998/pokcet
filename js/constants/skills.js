// 全部技能数据 - 4级分类 + 状态效果 + 属性缩放 + 联动技
// grade: common(普通) / fine(精良) / rare(稀有) / legend(传说)
// type: single / aoe / self / ally_single / ally_all / link
// scaling: 'spd:spd' = 施放者spd vs 目标spd
//          'atk:def' = 施放者atk vs 目标def
//          'atk+hp'  = 吃自身atk和hp(治疗用)
//          'def+hp'  = 吃自身def和hp(护盾用)

// 缩放比率工具函数（战斗系统使用）
export function scalingRatio(casterVal, targetVal) {
  return Math.min(2.0, Math.max(0.5, casterVal / Math.max(1, targetVal)));
}

// 品级颜色映射
export const GRADE_COLORS = {
  common: '#cccccc',
  fine:   '#4caf50',
  rare:   '#42a5f5',
  legend: '#ffd700'
};

export const GRADE_NAMES = {
  common: '普通',
  fine:   '精良',
  rare:   '稀有',
  legend: '传说'
};

export const SKILLS = {
  // ============================================================
  // ===== 普通 Common (20个) - CD短周转快，基础骨架 =====
  // ============================================================
  slam:         { name:'猛击',   elem:'normal',   type:'single',     power:50,  cooldown:1, grade:'common', desc:'普通力量攻击' },
  tackle:       { name:'冲撞',   elem:'normal',   type:'single',     power:45,  cooldown:1, grade:'common', desc:'猛力冲撞' },
  spark:        { name:'火花',   elem:'fire',     type:'single',     power:50,  cooldown:2, grade:'common', desc:'小型火焰弹' },
  watergun:     { name:'水枪',   elem:'water',    type:'single',     power:50,  cooldown:2, grade:'common', desc:'水弹射击' },
  vinewhip:     { name:'藤鞭',   elem:'grass',    type:'single',     power:50,  cooldown:2, grade:'common', desc:'藤蔓抽击' },
  iceshard:     { name:'冰晶',   elem:'ice',      type:'single',     power:50,  cooldown:2, grade:'common', desc:'冰晶射出，有概率冰冻',
    statusEffect:{ type:'freeze', baseChance:0.15, duration:1, scaling:'spd:spd' }},
  thunderbolt:  { name:'雷击',   elem:'electric', type:'single',     power:50,  cooldown:2, grade:'common', desc:'落雷一击，有概率麻痹',
    statusEffect:{ type:'paralyze', baseChance:0.15, duration:1, scaling:'spd:spd' }},
  rockthrow:    { name:'岩击',   elem:'rock',     type:'single',     power:50,  cooldown:2, grade:'common', desc:'投掷岩石' },
  poisonsting:  { name:'毒针',   elem:'poison',   type:'single',     power:45,  cooldown:2, grade:'common', desc:'毒针攻击，有概率中毒',
    statusEffect:{ type:'poison', baseChance:0.35, duration:2, stacks:1, scaling:'atk:def' }},
  shadow:       { name:'暗影',   elem:'dark',     type:'single',     power:50,  cooldown:2, grade:'common', desc:'暗影突袭' },
  holylight:    { name:'圣光',   elem:'holy',     type:'single',     power:50,  cooldown:2, grade:'common', desc:'圣光照射' },
  dragonbreath: { name:'龙息',   elem:'dragon',   type:'single',     power:55,  cooldown:2, grade:'common', desc:'龙之吐息' },
  gust:         { name:'疾风',   elem:'flying',   type:'single',     power:45,  cooldown:1, grade:'common', desc:'疾风突击' },
  ironpunch:    { name:'铁拳',   elem:'fight',    type:'single',     power:55,  cooldown:2, grade:'common', desc:'铁拳出击' },
  bite:         { name:'撕咬',   elem:'dark',     type:'single',     power:48,  cooldown:1, grade:'common', desc:'暗影撕咬' },
  guard:        { name:'守护',   elem:'normal',   type:'self',       power:0,   cooldown:3, grade:'common', desc:'防御+25%持续2回合',
    statusEffect:{ type:'defUp', baseChance:1.0, duration:2, value:0.25 }},
  heal:         { name:'治愈',   elem:'holy',     type:'self',       power:0,   cooldown:4, grade:'common', desc:'回复自身HP，效果受攻击和生命影响',
    statusEffect:{ type:'heal', baseHeal:50, scaling:'atk+hp', atkRatio:0.5, hpRatio:0.05 }},
  smallheal:    { name:'小治愈', elem:'holy',     type:'ally_single',power:0,   cooldown:3, grade:'common', desc:'回复一个队友HP',
    statusEffect:{ type:'heal', baseHeal:50, scaling:'atk+hp', atkRatio:0.5, hpRatio:0.05 }},
  sandblast:    { name:'扬沙',   elem:'rock',     type:'single',     power:40,  cooldown:2, grade:'common', desc:'扬沙降低攻击',
    statusEffect:{ type:'atkDown', baseChance:0.50, duration:2, value:0.15, scaling:'atk:atk' }},
  encourage:    { name:'鼓舞',   elem:'normal',   type:'ally_all',   power:0,   cooldown:4, grade:'common', desc:'鼓舞全队，增攻效果受自身攻击影响',
    statusEffect:{ type:'atkUp', baseChance:1.0, duration:2, value:0.10, scaling:'atk' }},

  // ============================================================
  // ===== 精良 Fine (24个) - 带轻度状态，策略初现 =====
  // ============================================================
  blaze:        { name:'烈焰',   elem:'fire',     type:'single',     power:65,  cooldown:3, grade:'fine', desc:'强力火焰，有概率灼烧',
    statusEffect:{ type:'burn', baseChance:0.25, duration:2, scaling:'atk:def' }},
  torrent:      { name:'洪流',   elem:'water',    type:'aoe',        power:45,  cooldown:3, grade:'fine', desc:'洪水冲击全体' },
  overgrowth:   { name:'森罗',   elem:'grass',    type:'aoe',        power:45,  cooldown:3, grade:'fine', desc:'草木蔓延全体' },
  freeze:       { name:'冰封',   elem:'ice',      type:'single',     power:60,  cooldown:3, grade:'fine', desc:'冰封锁定，有概率冰冻',
    statusEffect:{ type:'freeze', baseChance:0.20, duration:1, scaling:'spd:spd' }},
  thunder:      { name:'雷霆',   elem:'electric', type:'single',     power:65,  cooldown:3, grade:'fine', desc:'强力雷击，有概率麻痹',
    statusEffect:{ type:'paralyze', baseChance:0.20, duration:2, scaling:'spd:spd' }},
  boulder:      { name:'巨岩',   elem:'rock',     type:'single',     power:65,  cooldown:3, grade:'fine', desc:'巨岩压碎' },
  venom:        { name:'剧毒',   elem:'poison',   type:'single',     power:55,  cooldown:3, grade:'fine', desc:'剧毒侵蚀，较高中毒概率',
    statusEffect:{ type:'poison', baseChance:0.50, duration:3, stacks:1, scaling:'atk:def' }},
  darkbite:     { name:'暗噬',   elem:'dark',     type:'single',     power:65,  cooldown:3, grade:'fine', desc:'暗影吞噬' },
  judgment:     { name:'神裁',   elem:'holy',     type:'single',     power:65,  cooldown:3, grade:'fine', desc:'神圣裁决' },
  dragonroar:   { name:'龙啸',   elem:'dragon',   type:'aoe',        power:50,  cooldown:3, grade:'fine', desc:'龙啸震天' },
  hurricane:    { name:'飓风',   elem:'flying',   type:'aoe',        power:45,  cooldown:3, grade:'fine', desc:'飓风席卷全体' },
  smash:        { name:'碎击',   elem:'fight',    type:'single',     power:65,  cooldown:3, grade:'fine', desc:'粉碎之拳' },
  ironwall:     { name:'铁壁',   elem:'rock',     type:'self',       power:0,   cooldown:4, grade:'fine', desc:'大幅提升防御',
    statusEffect:{ type:'defUp', baseChance:1.0, duration:3, value:0.35 }},
  rejuvenate:   { name:'回春',   elem:'grass',    type:'self',       power:0,   cooldown:5, grade:'fine', desc:'回复自身较多HP',
    statusEffect:{ type:'heal', baseHeal:80, scaling:'atk+hp', atkRatio:0.6, hpRatio:0.06 }},
  firespin:     { name:'火旋',   elem:'fire',     type:'aoe',        power:40,  cooldown:3, grade:'fine', desc:'火焰旋风，有概率灼烧全体',
    statusEffect:{ type:'burn', baseChance:0.15, duration:2, scaling:'atk:def' }},
  aquaring:     { name:'水环',   elem:'water',    type:'self',       power:0,   cooldown:5, grade:'fine', desc:'持续回复HP 3回合',
    statusEffect:{ type:'regen', duration:3, scaling:'atk+hp', atkRatio:0.15, hpRatio:0.02 }},
  thunderwave:  { name:'电磁波', elem:'electric', type:'single',     power:0,   cooldown:4, grade:'fine', desc:'纯控制，较高麻痹概率',
    statusEffect:{ type:'paralyze', baseChance:0.65, duration:2, scaling:'spd:spd' }},
  shadowbind:   { name:'暗缚',   elem:'dark',     type:'single',     power:40,  cooldown:4, grade:'fine', desc:'暗影束缚，有概率沉默',
    statusEffect:{ type:'silence', baseChance:0.50, duration:2, scaling:'atk:def' }},
  warcry:       { name:'战吼',   elem:'fight',    type:'self',       power:0,   cooldown:5, grade:'fine', desc:'提升自身攻击，效果受自身攻击影响',
    statusEffect:{ type:'atkUp', baseChance:1.0, duration:3, value:0.20, scaling:'atk' }},
  iceshield:    { name:'冰盾',   elem:'ice',      type:'self',       power:0,   cooldown:5, grade:'fine', desc:'生成护盾，吸收量受防御和生命影响',
    statusEffect:{ type:'shield', scaling:'def+hp', defRatio:3, hpRatio:0.08 }},
  purify:       { name:'净化',   elem:'holy',     type:'ally_single',power:0,   cooldown:4, grade:'fine', desc:'驱散1个负面状态并回复少量HP',
    statusEffect:{ type:'purify', cleanse:1, baseHeal:30, scaling:'atk+hp', atkRatio:0.3, hpRatio:0.03 }},
  weaken:       { name:'削弱',   elem:'poison',   type:'single',     power:35,  cooldown:4, grade:'fine', desc:'降低目标攻击',
    statusEffect:{ type:'atkDown', baseChance:0.65, duration:3, value:0.20, scaling:'atk:atk' }},
  taunt:        { name:'嘲讽',   elem:'rock',     type:'self',       power:0,   cooldown:4, grade:'fine', desc:'强制敌方攻击自己，嘲讽期间受击减伤受防御影响',
    statusEffect:{ type:'taunt', duration:2, scaling:'def' }},
  speedup:      { name:'疾行',   elem:'flying',   type:'ally_all',   power:0,   cooldown:5, grade:'fine', desc:'全队下回合先手行动',
    statusEffect:{ type:'speedUp', duration:1, value:0.30, scaling:'spd' }},

  // ============================================================
  // ===== 稀有 Rare (22个) - 状态更可靠，战术核心 =====
  // ============================================================
  inferno:      { name:'焚天',   elem:'fire',     type:'aoe',        power:60,  cooldown:5, grade:'rare', desc:'焚天之火，有概率灼烧全体',
    statusEffect:{ type:'burn', baseChance:0.30, duration:3, scaling:'atk:def' }},
  deluge:       { name:'灭世洪', elem:'water',    type:'aoe',        power:60,  cooldown:5, grade:'rare', desc:'大洪水，降低全体速度',
    statusEffect:{ type:'speedDown', baseChance:0.60, duration:2, value:0.20 }},
  verdant:      { name:'万木春', elem:'grass',    type:'aoe',        power:55,  cooldown:5, grade:'rare', desc:'攻击全体并回复全队少量HP',
    statusEffect:{ type:'teamHeal', baseHeal:30, scaling:'atk+hp', atkRatio:0.2, hpRatio:0.02 }},
  absolutezero: { name:'绝对零度',elem:'ice',     type:'single',     power:75,  cooldown:6, grade:'rare', desc:'极寒攻击，较高冰冻概率',
    statusEffect:{ type:'freeze', baseChance:0.40, duration:1, scaling:'spd:spd' }},
  megathunder:  { name:'万雷',   elem:'electric', type:'aoe',        power:60,  cooldown:5, grade:'rare', desc:'全体雷击，有概率麻痹',
    statusEffect:{ type:'paralyze', baseChance:0.20, duration:2, scaling:'spd:spd' }},
  avalanche:    { name:'山崩',   elem:'rock',     type:'aoe',        power:60,  cooldown:5, grade:'rare', desc:'山崩地裂' },
  deathpoison:  { name:'灭毒',   elem:'poison',   type:'aoe',        power:50,  cooldown:5, grade:'rare', desc:'致命毒雾，全体中毒',
    statusEffect:{ type:'poison', baseChance:0.45, duration:3, stacks:2, scaling:'atk:def' }},
  eternalnight: { name:'永夜',   elem:'dark',     type:'aoe',        power:60,  cooldown:5, grade:'rare', desc:'永夜降临，全体降攻',
    statusEffect:{ type:'atkDown', baseChance:0.50, duration:2, value:0.15, scaling:'atk:atk' }},
  divinepunish: { name:'天罚',   elem:'holy',     type:'aoe',        power:60,  cooldown:5, grade:'rare', desc:'天罚降世' },
  dragondescent:{ name:'龙神降', elem:'dragon',   type:'single',     power:85,  cooldown:6, grade:'rare', desc:'龙神降世，最强单体' },
  skyascend:    { name:'天翔',   elem:'flying',   type:'single',     power:75,  cooldown:5, grade:'rare', desc:'天翔万里' },
  heavenbreak:  { name:'破天',   elem:'fight',    type:'single',     power:80,  cooldown:6, grade:'rare', desc:'破天一击，降低目标防御',
    statusEffect:{ type:'defDown', baseChance:0.60, duration:2, value:0.25, scaling:'atk:def' }},
  allheal:      { name:'万象回春',elem:'holy',    type:'ally_all',   power:0,   cooldown:6, grade:'rare', desc:'全队回复HP，效果受攻击和生命影响',
    statusEffect:{ type:'heal', baseHeal:40, scaling:'atk+hp', atkRatio:0.3, hpRatio:0.03 }},
  soulburn:     { name:'焚魂',   elem:'dark',     type:'single',     power:70,  cooldown:5, grade:'rare', desc:'灼烧灵魂，高概率灼烧',
    statusEffect:{ type:'burn', baseChance:0.40, duration:3, scaling:'atk:def' }},
  toxiccloud:   { name:'毒雾',   elem:'poison',   type:'aoe',        power:35,  cooldown:5, grade:'rare', desc:'弥漫毒雾，高概率中毒全体',
    statusEffect:{ type:'poison', baseChance:0.55, duration:3, stacks:1, scaling:'atk:def' }},
  thunderprison:{ name:'雷牢',   elem:'electric', type:'single',     power:60,  cooldown:5, grade:'rare', desc:'雷电牢笼，高概率麻痹',
    statusEffect:{ type:'paralyze', baseChance:0.50, duration:2, scaling:'spd:spd' }},
  soulchain:    { name:'魂锁',   elem:'dark',     type:'single',     power:55,  cooldown:5, grade:'rare', desc:'锁魂，高概率沉默',
    statusEffect:{ type:'silence', baseChance:0.55, duration:2, scaling:'atk:def' }},
  confuseray:   { name:'迷光',   elem:'dark',     type:'single',     power:45,  cooldown:5, grade:'rare', desc:'迷惑之光，有概率混乱',
    statusEffect:{ type:'confuse', baseChance:0.45, duration:2, scaling:'spd:spd' }},
  massheal:     { name:'大治愈', elem:'holy',     type:'ally_all',   power:0,   cooldown:6, grade:'rare', desc:'全队回复较多HP',
    statusEffect:{ type:'heal', baseHeal:60, scaling:'atk+hp', atkRatio:0.35, hpRatio:0.04 }},
  cleanse:      { name:'大净化', elem:'holy',     type:'ally_all',   power:0,   cooldown:7, grade:'rare', desc:'驱散全队所有负面状态',
    statusEffect:{ type:'cleanse', cleanseAll:true }},
  barrier:      { name:'结界',   elem:'holy',     type:'ally_all',   power:0,   cooldown:7, grade:'rare', desc:'全队护盾，吸收量受施放者防御和生命影响',
    statusEffect:{ type:'shield', scaling:'def+hp', defRatio:2, hpRatio:0.05 }},
  atkbreak:     { name:'破甲击', elem:'fight',    type:'single',     power:60,  cooldown:5, grade:'rare', desc:'攻击并大幅降低防御',
    statusEffect:{ type:'defDown', baseChance:0.60, duration:2, value:0.30, scaling:'atk:def' }},

  // ============================================================
  // ===== 传说 Legend (11个联动技) - CD8回合，靠机制制胜 =====
  // 联动技：阵容中需要linkMin只同元素宠物才能释放
  // 触发时该元素所有宠物各攻击一次 + 附加独特效果
  // ============================================================
  link_fire:    { name:'焚天之怒', elem:'fire',     type:'link', power:60,  cooldown:8, grade:'legend',
    linkElem:'fire', linkMin:2,
    desc:'全体火族各攻击一次+灼烧全敌2回合',
    statusEffect:{ type:'burn', baseChance:0.80, duration:2, scaling:'atk:def' }},
  link_water:   { name:'潮汐共鸣', elem:'water',    type:'link', power:0,   cooldown:8, grade:'legend',
    linkElem:'water', linkMin:2,
    desc:'全队回复25%HP+全敌降速30%持续2回合',
    statusEffect:{ type:'speedDown', baseChance:0.80, duration:2, value:0.30 },
    linkHeal:{ baseHeal:40, scaling:'atk+hp', atkRatio:0.25, hpRatio:0.03 }},
  link_dark:    { name:'永夜审判', elem:'dark',     type:'link', power:50,  cooldown:8, grade:'legend',
    linkElem:'dark', linkMin:2,
    desc:'全体暗族各攻击一次+沉默全敌1回合',
    statusEffect:{ type:'silence', baseChance:0.70, duration:1, scaling:'atk:def' }},
  link_dragon:  { name:'龙王降世', elem:'dragon',   type:'link', power:70,  cooldown:8, grade:'legend',
    linkElem:'dragon', linkMin:2,
    desc:'全体龙族各攻击一次，无视闪避和减伤',
    linkFlags:{ ignoreEvasion:true, ignoreRowReduction:true }},
  link_holy:    { name:'神光普照', elem:'holy',     type:'link', power:0,   cooldown:8, grade:'legend',
    linkElem:'holy', linkMin:2,
    desc:'全队回复20%HP+驱散全负面+护盾',
    linkHeal:{ baseHeal:30, scaling:'atk+hp', atkRatio:0.2, hpRatio:0.02 },
    statusEffect:{ type:'cleanse_and_shield', cleanseAll:true, shieldScaling:'def+hp', shieldDefRatio:1.5, shieldHpRatio:0.04 }},
  link_grass:   { name:'万木逢春', elem:'grass',    type:'link', power:40,  cooldown:8, grade:'legend',
    linkElem:'grass', linkMin:2,
    desc:'全体草族各攻击一次+全队持续回复3回合',
    linkHeal:{ type:'regen', duration:3, scaling:'atk+hp', atkRatio:0.1, hpRatio:0.015 }},
  link_ice:     { name:'极寒领域', elem:'ice',      type:'link', power:50,  cooldown:8, grade:'legend',
    linkElem:'ice', linkMin:2,
    desc:'全体冰族各攻击一次+有概率冰冻全敌',
    statusEffect:{ type:'freeze', baseChance:0.35, duration:1, scaling:'spd:spd' }},
  link_electric:{ name:'雷霆万钧', elem:'electric', type:'link', power:50,  cooldown:8, grade:'legend',
    linkElem:'electric', linkMin:2,
    desc:'全体电族各攻击一次+有概率麻痹全敌',
    statusEffect:{ type:'paralyze', baseChance:0.30, duration:2, scaling:'spd:spd' }},
  link_poison:  { name:'瘴气弥漫', elem:'poison',   type:'link', power:30,  cooldown:8, grade:'legend',
    linkElem:'poison', linkMin:2,
    desc:'全体毒族各攻击一次+高概率中毒全敌',
    statusEffect:{ type:'poison', baseChance:0.60, duration:3, stacks:2, scaling:'atk:def' }},
  link_normal:  { name:'混沌共鸣', elem:'normal',   type:'link', power:40,  cooldown:8, grade:'legend',
    linkElem:'normal', linkMin:2,
    desc:'全体普通族各攻击一次+全队增防20%',
    statusEffect:{ type:'defUp', baseChance:1.0, duration:3, value:0.20 }},
  link_flying:  { name:'天风庇护', elem:'flying',   type:'link', power:0,   cooldown:8, grade:'legend',
    linkElem:'flying', linkMin:2,
    desc:'全队增攻15%+先手2回合+闪避提升',
    statusEffect:{ type:'atkUp', baseChance:1.0, duration:2, value:0.15 },
    linkBuff:{ speedUp:true, speedUpDuration:2, evasion:0.20, evasionDuration:2 }}
};

// ===== 状态效果常量 =====
export const STATUS_EFFECTS = {
  poison:    { name:'中毒',   icon:'🟢', isDebuff:true,  stackable:true,  maxStacks:3 },
  burn:      { name:'灼烧',   icon:'🔴', isDebuff:true,  stackable:false },
  freeze:    { name:'冰冻',   icon:'🔵', isDebuff:true,  stackable:false },
  paralyze:  { name:'麻痹',   icon:'🟡', isDebuff:true,  stackable:false },
  confuse:   { name:'混乱',   icon:'🟣', isDebuff:true,  stackable:false },
  silence:   { name:'沉默',   icon:'⬜', isDebuff:true,  stackable:false },
  atkDown:   { name:'降攻',   icon:'⬇️', isDebuff:true,  stackable:false },
  defDown:   { name:'降防',   icon:'🔽', isDebuff:true,  stackable:false },
  speedDown: { name:'降速',   icon:'🐌', isDebuff:true,  stackable:false },
  atkUp:     { name:'增攻',   icon:'⬆️', isDebuff:false, stackable:false },
  defUp:     { name:'增防',   icon:'🛡️', isDebuff:false, stackable:false },
  speedUp:   { name:'增速',   icon:'💨', isDebuff:false, stackable:false },
  shield:    { name:'护盾',   icon:'🔰', isDebuff:false, stackable:false },
  regen:     { name:'回复',   icon:'💚', isDebuff:false, stackable:false },
  taunt:     { name:'嘲讽',   icon:'😤', isDebuff:false, stackable:false },
  evasion:   { name:'闪避',   icon:'💫', isDebuff:false, stackable:false }
};

// ===== 领悟权重（按grade）=====
export const COMPREHEND_WEIGHTS = {
  common: 50,
  fine:   30,
  rare:   15,
  legend: 5
};
