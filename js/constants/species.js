// 32种山海经灵兽数据
// role: dps(输出) / aoe(群攻) / tank(坦克) / healer(奶妈) / support(辅助) / hybrid(混合)
export const SPECIES = {
  // ===== 普通系 Normal (3) =====
  hundun:{name:'混沌',icon:'🔮',elem:'normal',role:'tank',baseStats:{hp:90,atk:50,def:70,spd:40},
    evoChain:['浑圆肉团','识面混沌','开明兽'],
    skillPool:{
      common:['slam','tackle','guard'],
      fine:['ironwall','taunt','encourage'],
      rare:['avalanche','heavenbreak'],
      legend:['link_normal']
    },desc:'混沌无面，浑圆如卵'},
  dangkang:{name:'当康',icon:'🐗',elem:'normal',role:'dps',baseStats:{hp:70,atk:65,def:55,spd:60},
    evoChain:['小野猪','利牙当康','神农当康'],
    skillPool:{
      common:['slam','tackle','ironpunch'],
      fine:['smash','boulder','warcry'],
      rare:['heavenbreak','atkbreak'],
      legend:['link_normal']
    },desc:'形如猪，鸣则天下大穰'},
  jiao:{name:'狡',icon:'🐇',elem:'normal',role:'support',baseStats:{hp:55,atk:45,def:40,spd:85},
    evoChain:['三足兔','玉狡','月狡'],
    skillPool:{
      common:['slam','gust','tackle','encourage'],
      fine:['hurricane','speedup','smash'],
      rare:['skyascend','heavenbreak'],
      legend:['link_normal']
    },desc:'三足而速，鸣如犬吠'},

  // ===== 火系 Fire (3) =====
  bifang:{name:'毕方',icon:'🔥',elem:'fire',role:'aoe',baseStats:{hp:55,atk:85,def:40,spd:70},
    evoChain:['火雀','赤焰毕方','神火毕方'],
    skillPool:{
      common:['spark','gust','tackle'],
      fine:['blaze','firespin','hurricane'],
      rare:['inferno','skyascend'],
      legend:['link_fire']
    },desc:'一足鸟，见则邑有讹火'},
  zhulong:{name:'烛龙',icon:'🐉',elem:'fire',role:'dps',baseStats:{hp:80,atk:75,def:60,spd:35},
    evoChain:['火蛇','烛阴','烛龙'],
    skillPool:{
      common:['spark','bite','shadow'],
      fine:['blaze','darkbite','shadowbind'],
      rare:['inferno','soulburn'],
      legend:['link_fire']
    },desc:'视为昼，瞑为夜，吹为冬，呼为夏'},
  luwu:{name:'陆吾',icon:'🐯',elem:'fire',role:'tank',baseStats:{hp:75,atk:70,def:65,spd:40},
    evoChain:['火虎幼崽','赤虎','陆吾神将'],
    skillPool:{
      common:['spark','ironpunch','guard'],
      fine:['blaze','ironwall','taunt'],
      rare:['inferno','heavenbreak'],
      legend:['link_fire']
    },desc:'人面虎身九尾，司天之九部'},

  // ===== 水系 Water (3) =====
  luoyu:{name:'蠃鱼',icon:'🐟',elem:'water',role:'tank',baseStats:{hp:95,atk:45,def:75,spd:35},
    evoChain:['小鱼','蠃蛟','蠃龙王'],
    skillPool:{
      common:['watergun','guard','tackle'],
      fine:['torrent','ironwall','taunt'],
      rare:['deluge','barrier'],
      legend:['link_water']
    },desc:'鱼身而鸟翼，苍文赤尾'},
  wenyao:{name:'文鳐',icon:'🐠',elem:'water',role:'support',baseStats:{hp:55,atk:60,def:45,spd:90},
    evoChain:['飞鱼','文鳐鱼','苍文鳐'],
    skillPool:{
      common:['watergun','gust','encourage'],
      fine:['torrent','hurricane','speedup'],
      rare:['deluge','skyascend'],
      legend:['link_water']
    },desc:'状如鲤鱼，鱼身鸟翼，飞行自在'},
  xiangliu:{name:'相柳',icon:'🐍',elem:'water',role:'hybrid',baseStats:{hp:80,atk:80,def:50,spd:40},
    evoChain:['水蛇','九首蛇','相柳'],
    skillPool:{
      common:['watergun','poisonsting','bite'],
      fine:['torrent','venom','weaken'],
      rare:['deluge','deathpoison','toxiccloud'],
      legend:['link_water']
    },desc:'九首蛇身，食于九土'},

  // ===== 草系 Grass (3) =====
  danghu:{name:'当扈',icon:'🐦',elem:'grass',role:'healer',baseStats:{hp:65,atk:40,def:55,spd:55},
    evoChain:['花鸟','彩翼当扈','神木当扈'],
    skillPool:{
      common:['vinewhip','heal','smallheal'],
      fine:['overgrowth','rejuvenate','purify'],
      rare:['verdant','allheal','massheal','cleanse'],
      legend:['link_grass']
    },desc:'状如雉，羽色斑斓，司木之华'},
  goumang:{name:'句芒',icon:'🌿',elem:'grass',role:'support',baseStats:{hp:70,atk:55,def:60,spd:65},
    evoChain:['草芽精','藤灵','句芒神使'],
    skillPool:{
      common:['vinewhip','tackle','guard','encourage'],
      fine:['overgrowth','ironwall','rejuvenate'],
      rare:['verdant','barrier'],
      legend:['link_grass']
    },desc:'木神句芒，主春与生'},
  bo:{name:'驳',icon:'🐴',elem:'grass',role:'dps',baseStats:{hp:65,atk:80,def:55,spd:50},
    evoChain:['幼马','角驳','天驳'],
    skillPool:{
      common:['vinewhip','ironpunch','slam'],
      fine:['overgrowth','smash','warcry'],
      rare:['verdant','heavenbreak'],
      legend:['link_grass']
    },desc:'如马，白身黑尾，虎齿爪，食虎豹'},

  // ===== 冰系 Ice (2) =====
  yayu:{name:'窫窳',icon:'❄️',elem:'ice',role:'dps',baseStats:{hp:70,atk:80,def:55,spd:45},
    evoChain:['冰兽幼崽','寒窫窳','极冰窫窳'],
    skillPool:{
      common:['iceshard','bite','slam'],
      fine:['freeze','darkbite','warcry'],
      rare:['absolutezero','soulburn'],
      legend:['link_ice']
    },desc:'龙首而居弱水，其音如婴儿'},
  hanhao:{name:'寒号',icon:'🦅',elem:'ice',role:'support',baseStats:{hp:60,atk:50,def:50,spd:75},
    evoChain:['冰雀','霜翎寒号','冰晶寒号'],
    skillPool:{
      common:['iceshard','gust','heal'],
      fine:['freeze','iceshield','speedup'],
      rare:['absolutezero','skyascend','barrier'],
      legend:['link_ice']
    },desc:'寒号之鸟，霜羽冰翎'},

  // ===== 电系 Electric (2) =====
  kui:{name:'夔',icon:'⚡',elem:'electric',role:'dps',baseStats:{hp:60,atk:85,def:40,spd:80},
    evoChain:['雷兽','夔牛','天雷夔'],
    skillPool:{
      common:['thunderbolt','slam','tackle'],
      fine:['thunder','smash','warcry'],
      rare:['megathunder','thunderprison'],
      legend:['link_electric']
    },desc:'一足牛，其声如雷'},
  leishen:{name:'雷神',icon:'🌩️',elem:'electric',role:'support',baseStats:{hp:75,atk:75,def:55,spd:50},
    evoChain:['雷蛋','雷鼓兽','雷泽神'],
    skillPool:{
      common:['thunderbolt','ironpunch','guard'],
      fine:['thunder','thunderwave','ironwall'],
      rare:['megathunder','thunderprison','heavenbreak'],
      legend:['link_electric']
    },desc:'龙身人首，鼓其腹则雷'},

  // ===== 岩系 Rock (2) =====
  yueyu:{name:'猰貐',icon:'🪨',elem:'rock',role:'tank',baseStats:{hp:100,atk:50,def:85,spd:15},
    evoChain:['岩兽','铁甲猰貐','山岳猰貐'],
    skillPool:{
      common:['rockthrow','guard','sandblast'],
      fine:['boulder','ironwall','taunt'],
      rare:['avalanche','barrier'],
      legend:['link_normal']
    },desc:'山中巨兽，其皮如岩石'},
  xingtian:{name:'刑天',icon:'⛰️',elem:'rock',role:'dps',baseStats:{hp:85,atk:75,def:70,spd:20},
    evoChain:['石偶','刑天战士','无首刑天'],
    skillPool:{
      common:['rockthrow','ironpunch','slam'],
      fine:['boulder','smash','warcry'],
      rare:['avalanche','heavenbreak','atkbreak'],
      legend:['link_normal']
    },desc:'无首之人，以乳为目，以脐为口'},

  // ===== 毒系 Poison (2) =====
  xiushe:{name:'修蛇',icon:'🐛',elem:'poison',role:'dps',baseStats:{hp:75,atk:70,def:50,spd:55},
    evoChain:['毒蛇','巨蟒','巴蛇修蛇'],
    skillPool:{
      common:['poisonsting','bite','slam'],
      fine:['venom','darkbite','weaken'],
      rare:['deathpoison','toxiccloud','soulburn'],
      legend:['link_poison']
    },desc:'大蛇吞象，三岁出其骨'},
  gudiao:{name:'蛊雕',icon:'🦇',elem:'poison',role:'support',baseStats:{hp:60,atk:65,def:45,spd:75},
    evoChain:['毒鹰','蛊翼雕','天蛊雕'],
    skillPool:{
      common:['poisonsting','gust','bite'],
      fine:['venom','weaken','shadowbind'],
      rare:['deathpoison','toxiccloud','skyascend'],
      legend:['link_poison']
    },desc:'雕身蛇尾，其毒无解'},

  // ===== 暗系 Dark (3) =====
  wangliang:{name:'魍魉',icon:'👻',elem:'dark',role:'support',baseStats:{hp:55,atk:55,def:40,spd:90},
    evoChain:['幽影','夜魍魉','深渊魍魉'],
    skillPool:{
      common:['shadow','bite','slam'],
      fine:['darkbite','shadowbind','speedup'],
      rare:['eternalnight','soulchain','confuseray'],
      legend:['link_dark']
    },desc:'幽影鬼魅，出没无常'},
  qiongqi:{name:'穷奇',icon:'😈',elem:'dark',role:'dps',baseStats:{hp:65,atk:90,def:45,spd:50},
    evoChain:['暗兽','食梦穷奇','天罪穷奇'],
    skillPool:{
      common:['shadow','bite','ironpunch'],
      fine:['darkbite','smash','warcry'],
      rare:['eternalnight','soulburn','heavenbreak'],
      legend:['link_dark']
    },desc:'状如虎有翼，食人'},
  taotie:{name:'饕餮',icon:'👹',elem:'dark',role:'hybrid',baseStats:{hp:85,atk:80,def:55,spd:30},
    evoChain:['暗影团','噬魂饕餮','混沌饕餮'],
    skillPool:{
      common:['shadow','bite','slam'],
      fine:['darkbite','venom','weaken'],
      rare:['eternalnight','soulburn','soulchain'],
      legend:['link_dark']
    },desc:'羊身人面，目在腋下，贪食无厌'},

  // ===== 神圣系 Holy (2) =====
  baize:{name:'白泽',icon:'✨',elem:'holy',role:'healer',baseStats:{hp:80,atk:45,def:65,spd:55},
    evoChain:['灵兽幼崽','白泽','神明白泽'],
    skillPool:{
      common:['holylight','heal','smallheal'],
      fine:['judgment','rejuvenate','purify'],
      rare:['divinepunish','allheal','massheal','cleanse','barrier'],
      legend:['link_holy']
    },desc:'通万物之情，知鬼神之事'},
  yingzhao:{name:'英招',icon:'🦄',elem:'holy',role:'support',baseStats:{hp:70,atk:55,def:70,spd:55},
    evoChain:['圣马','飞翼英招','天英招'],
    skillPool:{
      common:['holylight','guard','gust','encourage'],
      fine:['judgment','ironwall','purify','speedup'],
      rare:['divinepunish','barrier','cleanse'],
      legend:['link_holy']
    },desc:'马身人面虎纹鸟翼，司四方'},

  // ===== 龙系 Dragon (3) =====
  yinglong:{name:'应龙',icon:'🐲',elem:'dragon',role:'aoe',baseStats:{hp:80,atk:80,def:65,spd:55},
    evoChain:['幼龙','应龙','天命应龙'],
    skillPool:{
      common:['dragonbreath','watergun','slam'],
      fine:['dragonroar','torrent','warcry'],
      rare:['dragondescent','deluge'],
      legend:['link_dragon']
    },desc:'有翼之龙，杀蚩尤夸父，不得复上'},
  zhuyinlong:{name:'烛阴龙',icon:'🌑',elem:'dragon',role:'dps',baseStats:{hp:70,atk:90,def:50,spd:55},
    evoChain:['暗龙','冥烛龙','太初烛龙'],
    skillPool:{
      common:['dragonbreath','shadow','bite'],
      fine:['dragonroar','darkbite','shadowbind'],
      rare:['dragondescent','eternalnight','soulburn'],
      legend:['link_dragon']
    },desc:'龙身暗鳞，视为昼瞑为夜'},
  chilong:{name:'螭龙',icon:'🐊',elem:'dragon',role:'hybrid',baseStats:{hp:75,atk:65,def:65,spd:60},
    evoChain:['角蛇','螭吻','神螭龙'],
    skillPool:{
      common:['dragonbreath','iceshard','guard'],
      fine:['dragonroar','freeze','iceshield'],
      rare:['dragondescent','absolutezero','barrier'],
      legend:['link_dragon']
    },desc:'无角之龙，螭吻含水镇火'},

  // ===== 飞行系 Flying (2) =====
  kunpeng:{name:'鲲鹏',icon:'🦋',elem:'flying',role:'healer',baseStats:{hp:70,atk:55,def:50,spd:90},
    evoChain:['小鲲','化鹏','逍遥鲲鹏'],
    skillPool:{
      common:['gust','heal','smallheal','encourage'],
      fine:['hurricane','aquaring','purify','speedup'],
      rare:['skyascend','allheal','cleanse'],
      legend:['link_flying']
    },desc:'北冥有鱼其名为鲲，化而为鹏'},
  jingwei:{name:'精卫',icon:'🐤',elem:'flying',role:'dps',baseStats:{hp:60,atk:70,def:50,spd:75},
    evoChain:['小鸟','衔石精卫','不屈精卫'],
    skillPool:{
      common:['gust','rockthrow','slam'],
      fine:['hurricane','boulder','warcry'],
      rare:['skyascend','avalanche'],
      legend:['link_flying']
    },desc:'炎帝之女，溺死东海，化为精卫填海'},

  // ===== 格斗系 Fight (1) =====
  chiyou:{name:'蚩尤',icon:'👊',elem:'fight',role:'dps',baseStats:{hp:75,atk:90,def:60,spd:35},
    evoChain:['铜首兽','蚩尤战将','魔神蚩尤'],
    skillPool:{
      common:['ironpunch','slam','guard'],
      fine:['smash','warcry','taunt'],
      rare:['heavenbreak','atkbreak','avalanche'],
      legend:['link_normal']
    },desc:'铜头铁额，兽身人语'},

  // ===== 水/火 双属性 (1) =====
  jiuying:{name:'九婴',icon:'🌊',elem:'water',role:'hybrid',baseStats:{hp:85,atk:75,def:45,spd:45},
    evoChain:['水火幼蛇','九婴','灾厄九婴'],
    skillPool:{
      common:['watergun','spark','bite'],
      fine:['torrent','blaze','weaken'],
      rare:['deluge','inferno','soulburn'],
      legend:['link_water']
    },desc:'水火之怪，为人之害'}
};
