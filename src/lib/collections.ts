import type { Locale } from '#/lib/ggemu'

// Curated landing-page collections (platforms + themes) for the
// /$locale/platform/$collectionId route. Platform collections filter the
// catalog by platform name; theme collections match by title/keywords in
// the server function (see getCollectionPageData in lib/ggemu.ts).

export type LocalizedText = Record<Locale, string>

export type CollectionDef = {
  id: string
  kind: 'platform' | 'theme'
  // For kind 'platform': the exact catalog platform name to filter by.
  platformName?: string
  title: LocalizedText
  intro: LocalizedText
}

export function platformSlug(platformName: string) {
  return platformName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function platformCollection(
  platformName: string,
  title: LocalizedText,
  intro: LocalizedText,
): CollectionDef {
  return {
    id: platformSlug(platformName),
    kind: 'platform',
    platformName,
    title,
    intro,
  }
}

export const PLATFORM_COLLECTIONS: Array<CollectionDef> = [
  platformCollection(
    'Arcade',
    {
      'zh-CN': '街机游戏',
      en: 'Arcade Games',
      ja: 'アーケードゲーム',
    },
    {
      'zh-CN': '拳皇、合金弹头、恐龙快打……当年塞满游戏厅的那些名字，全都在这里，打开就能玩。',
      en: 'The King of Fighters, Metal Slug, Cadillacs and Dinosaurs — the cabinets that packed the arcades, ready to play in your browser.',
      ja: 'ザ・キング・オブ・ファイターズ、メタルスラッグ、恐竜戦隊——ゲーセンを埋め尽くした名作たちが、ブラウザですぐ遊べます。',
    },
  ),
  platformCollection(
    'Famicom',
    {
      'zh-CN': '红白机 FC 游戏',
      en: 'Famicom / NES Games',
      ja: 'ファミコンゲーム',
    },
    {
      'zh-CN': '魂斗罗、超级马里奥、坦克大战——插卡带、吹一吹、按开始，那个暑假回来了。',
      en: 'Contra, Super Mario Bros., Battle City — blow on the cartridge, press start, and summer break is back.',
      ja: '魂斗羅、スーパーマリオ、バトルシティ——カセットを吹いてスタートボタンを押せば、あの夏休みが戻ってきます。',
    },
  ),
  platformCollection(
    'Super Famicom',
    {
      'zh-CN': '超级任天堂 SFC 游戏',
      en: 'Super Famicom / SNES Games',
      ja: 'スーパーファミコンゲーム',
    },
    {
      'zh-CN': '16 位黄金年代的主机经典：最终幻想、塞尔达、超级马里奥世界，一台超任装下整个童年。',
      en: 'The 16-bit golden age: Final Fantasy, Zelda, Super Mario World — a whole childhood on one console.',
      ja: '16ビット黄金時代の名作たち：ファイナルファンタジー、ゼルダ、スーパーマリオワールド。',
    },
  ),
  platformCollection(
    'Game Boy Advance',
    {
      'zh-CN': 'GBA 游戏',
      en: 'Game Boy Advance Games',
      ja: 'ゲームボーイアドバンス',
    },
    {
      'zh-CN': '宝可梦、火焰纹章、黄金太阳——书包里那台 GBA 上的游戏，现在手机上就能接着玩。',
      en: 'Pokémon, Fire Emblem, Golden Sun — the games from the GBA in your school bag, now on your phone.',
      ja: 'ポケモン、ファイアーエムブレム、黄金の太陽——ランドセルの中のGBAが、スマホでそのまま遊べます。',
    },
  ),
  platformCollection(
    'Game Boy',
    {
      'zh-CN': 'Game Boy 游戏',
      en: 'Game Boy Games',
      ja: 'ゲームボーイゲーム',
    },
    {
      'zh-CN': '绿屏、四节五号电池、一整个童年。俄罗斯方块和宝可梦的起点都在这里。',
      en: 'A green screen, four AA batteries and a whole childhood. Where Tetris and Pokémon began.',
      ja: '緑色の画面と単三電池4本で一つの時代。テトリスとポケモンの原点です。',
    },
  ),
  platformCollection(
    'Game Boy Color',
    {
      'zh-CN': 'GBC 游戏',
      en: 'Game Boy Color Games',
      ja: 'ゲームボーイカラー',
    },
    {
      'zh-CN': 'Game Boy 有了颜色：宝可梦金银、塞尔达不可思议的果实，彩色掌机的第一页。',
      en: 'Game Boy in color: Pokémon Gold & Silver and the Oracle Zelda games — the first page of color handhelds.',
      ja: 'カラーになったゲームボーイ：ポケモン金・銀、ゼルダの伝説 ふしぎの木の実。',
    },
  ),
  platformCollection(
    'Nintendo DS',
    {
      'zh-CN': 'NDS 游戏',
      en: 'Nintendo DS Games',
      ja: 'ニンテンドーDSゲーム',
    },
    {
      'zh-CN': '双屏加触控笔：新超级马里奥兄弟、宝可梦黑白、脑锻炼，NDS 的全盛时代。',
      en: 'Two screens and a stylus: New Super Mario Bros., Pokémon Black & White, Brain Age — the DS at its peak.',
      ja: '2画面とタッチペン：Newスーパーマリオブラザーズ、ポケモンブラック・ホワイト、脳トレ。',
    },
  ),
  platformCollection(
    'Nintendo 64',
    {
      'zh-CN': 'N64 游戏',
      en: 'Nintendo 64 Games',
      ja: 'NINTENDO 64 ゲーム',
    },
    {
      'zh-CN': '马里奥第一次变成立体的、塞尔达时之笛、007 黄金眼——3D 游戏的开场白。',
      en: 'Mario in 3D for the first time, Ocarina of Time, GoldenEye 007 — where 3D gaming began.',
      ja: '初めて3Dになったマリオ、時のオカリナ、ゴールデンアイ——3Dゲームの幕開け。',
    },
  ),
  platformCollection(
    'PlayStation 1',
    {
      'zh-CN': 'PS1 游戏',
      en: 'PlayStation 1 Games',
      ja: 'プレイステーション ゲーム',
    },
    {
      'zh-CN': '光盘转起来的声音就是信号：最终幻想7、生化危机、合金装备，PS 一代的经典全集。',
      en: 'The sound of a spinning disc was the signal: Final Fantasy VII, Resident Evil, Metal Gear Solid.',
      ja: 'ディスクが回る音が合図：ファイナルファンタジーVII、バイオハザード、メタルギアソリッド。',
    },
  ),
  platformCollection(
    'Genesis',
    {
      'zh-CN': '世嘉 MD 游戏',
      en: 'Sega Genesis / Mega Drive Games',
      ja: 'メガドライブ ゲーム',
    },
    {
      'zh-CN': '索尼克、怒之铁拳、梦幻模拟战——任天堂之外的另一种童年，速度与街机感拉满。',
      en: 'Sonic, Streets of Rage, Langrisser — the other childhood, all speed and arcade punch.',
      ja: 'ソニック、ベアナックル、ラングリッサー——もう一つの少年時代。',
    },
  ),
  platformCollection(
    'FLASH',
    {
      'zh-CN': 'Flash 小游戏',
      en: 'Flash Games',
      ja: 'Flash ゲーム',
    },
    {
      'zh-CN': '微机课上偷偷打开的那些网页小游戏，Flash 停更了，它们还在。',
      en: 'The little web games you sneaked into during computer class — Flash is gone, they are still here.',
      ja: 'パソコンの授業でこっそり開いたあのミニゲームたち。Flashは終わっても、彼らは残っています。',
    },
  ),
  platformCollection(
    'HTML5',
    {
      'zh-CN': 'HTML5 网页游戏',
      en: 'HTML5 Web Games',
      ja: 'HTML5 ブラウザゲーム',
    },
    {
      'zh-CN': '不用插件、不挑设备，现代浏览器直接跑的网页版经典：GTA 罪恶都市、红色警戒都在这一页。',
      en: 'No plugins, any device: modern web ports of the classics — GTA: Vice City, Red Alert and more.',
      ja: 'プラグイン不要、どの端末でも：GTAバイスシティやレッドアラートなど、名作のWeb移植版。',
    },
  ),
]

export const THEME_COLLECTIONS: Array<CollectionDef> = [
  {
    id: 'pokemon',
    kind: 'theme',
    title: {
      'zh-CN': '宝可梦系列',
      en: 'Pokémon Series',
      ja: 'ポケモンシリーズ',
    },
    intro: {
      'zh-CN': '从红绿到绿宝石，再到玩家自制的改版和中文版——44 款宝可梦游戏一次集齐，接着当年的存档继续冒险。',
      en: 'From Red and Green to Emerald, plus fan-made hacks and translations — the full Pokémon shelf in one place.',
      ja: '赤・緑からエメラルド、ファンメイドの改造版まで——ポケモンの棚をひとまとめに。',
    },
  },
  {
    id: 'mario',
    kind: 'theme',
    title: {
      'zh-CN': '马里奥系列',
      en: 'Mario Series',
      ja: 'マリオシリーズ',
    },
    intro: {
      'zh-CN': '水管工的全部冒险：从红白机的超级马里奥兄弟，到 GBA、N64 的 3D 世界，一页跳到底。',
      en: "The plumber's whole career: from Super Mario Bros. on the NES to the 3D worlds of the N64 and GBA.",
      ja: '配管工の冒険のすべて：ファミコンのスーパーマリオブラザーズから、N64・GBAの3Dワールドまで。',
    },
  },
  {
    id: 'kof',
    kind: 'theme',
    title: {
      'zh-CN': '拳皇系列',
      en: 'The King of Fighters Series',
      ja: 'ザ・キング・オブ・ファイターズ',
    },
    intro: {
      'zh-CN': '94 到 2003，加上大蛇版、十周年版等改版——三对三组队格斗的完整年表，街机厅的擂台还开着。',
      en: "From '94 to 2003 plus the hack editions — the complete chronicle of 3-on-3 team fighting.",
      ja: '94から2003、そして改造版まで——3対3チームバトルの完全年表。',
    },
  },
  {
    id: 'mahjong',
    kind: 'theme',
    title: {
      'zh-CN': '麻将游戏',
      en: 'Mahjong Games',
      ja: '麻雀ゲーム',
    },
    intro: {
      'zh-CN': '街机麻将、日式麻雀、雀旅人……不用凑人，随时开一局。',
      en: 'Arcade mahjong, Japanese riichi, solo travelers — no need to gather four players, start a hand anytime.',
      ja: 'アーケード麻雀から本格リーチ麻雀まで。人数を集めなくても、いつでも一局。',
    },
  },
  {
    id: 'three-kingdoms',
    kind: 'theme',
    title: {
      'zh-CN': '三国题材',
      en: 'Three Kingdoms Games',
      ja: '三国志ゲーム',
    },
    intro: {
      'zh-CN': '吞食天地、三国战纪、三国群英传——从街机动作到策略经营，三国迷的一页书架。',
      en: 'Tenchi wo Kurau, Knights of Valour, Heroes of the Three Kingdoms — one shelf for Three Kingdoms fans.',
      ja: '天地を喰らう、三国戦記、三国群英伝——三国志ファンのための一棚。',
    },
  },
]

export const FC_CARTRIDGES_ID = 'fc-cartridges'

export const FC_CARTRIDGES_COPY = {
  title: {
    'zh-CN': 'FC 卡带收藏',
    en: 'FC Cartridge Collection',
    ja: 'FCカセットコレクション',
  } satisfies LocalizedText,
  intro: {
    'zh-CN': '一张卡带一个编号，按发售年份排成一册收藏簿。点收藏把卡带收进你的柜子，点卡带直接开玩——就像小时候从抽屉里抽出那张黄卡。',
    en: 'One cartridge, one number, shelved by release year. Collect the carts into your cabinet and click any of them to play — like pulling the yellow cartridge from the drawer.',
    ja: '1本ごとに番号を付け、発売年順に並べたコレクション帳。集めて、クリックすればそのまま遊べます。',
  } satisfies LocalizedText,
}

export function getCollectionDef(id: string): CollectionDef | null {
  return (
    PLATFORM_COLLECTIONS.find((collection) => collection.id === id) ??
    THEME_COLLECTIONS.find((collection) => collection.id === id) ??
    null
  )
}
