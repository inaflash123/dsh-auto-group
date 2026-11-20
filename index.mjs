// dsh-auto-group — 新装插件自动进 dshmarket 分组。
//
// 为什么是「轮询 + 只做加法」：
//   1) 轮询而非事件——dshmarket 不向其它插件广播安装事件（lib/ 里没有任何
//      ctx.emit 安装钩子），所以定时读 profile 的 package.json 与市场的
//      state.json 是最可靠的观测方式；这两个文件就是市场的真相来源。
//   2) 只做加法——只处理「不在任何组里」的插件。已在组里的视为用户已表态，
//      一律跳过，所以你手工调过的分组不会被覆盖。
//   3) 加权打分而非先命中先归组——初版用「按顺序找第一个命中」，结果
//      zh_pro 被 "harness" 拉进远程接入、image-viewer 被 "image" 拉进创作。
//      现在每个词元带权重，精确词（latex / calculator / viewer / remote）
//      压过泛词（web / pro / auto / image），同分时按固定组顺序裁决。
//   4) 按包名词元精确相等匹配，不做全文 includes——全文匹配会让 'ego' 命中
//      "category"、'im' 命中 "image-viewer"、'model' 命中 approval-gate 的描述。

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const UNKNOWN_GROUP = '未分类'

/**
 * 词元 → [组, 权重]。权重约定：
 *   3 = 一见就能定性的专有名词（latex / calculator / viewer / remote / cdp）
 *   2 = 较强的领域词（memory / image / browser / sidebar）
 *   1 = 泛词，只能做兜底（web / pro / auto / model / map / chat）
 */
const TOKEN_WEIGHTS = {
  // ── 学习与计算 ──
  latex: ['学习与计算', 3], formula: ['学习与计算', 3], math: ['学习与计算', 3],
  calculator: ['学习与计算', 3], geogebra: ['学习与计算', 3],
  equation: ['学习与计算', 3], algebra: ['学习与计算', 2], symbolic: ['学习与计算', 2],

  // ── 记忆 ──
  memory: ['记忆', 3], memories: ['记忆', 3], hindsight: ['记忆', 3],
  recall: ['记忆', 2], engram: ['记忆', 2], mnemon: ['记忆', 2], memento: ['记忆', 2],

  // ── 文档与创作 ──
  univer: ['文档与创作', 3], office: ['文档与创作', 3], canvas: ['文档与创作', 3],
  archify: ['文档与创作', 3], genui: ['文档与创作', 3], diagram: ['文档与创作', 3],
  drawio: ['文档与创作', 3], drawai: ['文档与创作', 3], whiteboard: ['文档与创作', 2],
  docx: ['文档与创作', 3], pptx: ['文档与创作', 3], xlsx: ['文档与创作', 3],
  html: ['文档与创作', 2], answer: ['文档与创作', 2], design: ['文档与创作', 2],
  slides: ['文档与创作', 3], image: ['文档与创作', 2], gen: ['文档与创作', 2],
  creative: ['文档与创作', 2], manim: ['文档与创作', 3], remotion: ['文档与创作', 3],

  // ── 浏览器与联网 ──
  cdp: ['浏览器与联网', 3], browser: ['浏览器与联网', 3], ego: ['浏览器与联网', 3],
  playwright: ['浏览器与联网', 3], puppeteer: ['浏览器与联网', 3],
  bridge: ['浏览器与联网', 2], search: ['浏览器与联网', 2], fetch: ['浏览器与联网', 2],
  crawl: ['浏览器与联网', 2], scrape: ['浏览器与联网', 2], web: ['浏览器与联网', 1],

  // ── 模型与计费 ──
  cost: ['模型与计费', 3], usage: ['模型与计费', 3], stats: ['模型与计费', 2],
  billing: ['模型与计费', 3], token: ['模型与计费', 2], price: ['模型与计费', 2],
  workbuddy: ['模型与计费', 3], connect: ['模型与计费', 2], vision: ['模型与计费', 3],
  modlens: ['模型与计费', 3], provider: ['模型与计费', 2], llm: ['模型与计费', 2],
  meter: ['模型与计费', 3], account: ['模型与计费', 2], model: ['模型与计费', 1],

  // ── 远程接入 ──
  remote: ['远程接入', 3], im: ['远程接入', 3], telegram: ['远程接入', 3],
  wechat: ['远程接入', 3], feishu: ['远程接入', 3], dingtalk: ['远程接入', 3],
  slack: ['远程接入', 3], discord: ['远程接入', 3], whatsapp: ['远程接入', 3],
  qq: ['远程接入', 3], tunnel: ['远程接入', 2], p2p: ['远程接入', 2],
  harness: ['远程接入', 1],

  // ── 开发运维 ──
  ops: ['开发运维', 3], safety: ['开发运维', 3], approval: ['开发运维', 3],
  gate: ['开发运维', 3], restart: ['开发运维', 3], reload: ['开发运维', 3],
  unlag: ['开发运维', 3], guard: ['开发运维', 3], purge: ['开发运维', 3],
  debug: ['开发运维', 3], context: ['开发运维', 3], compress: ['开发运维', 3],
  sandbox: ['开发运维', 3], shell: ['开发运维', 2], patch: ['开发运维', 2],
  auth: ['开发运维', 2], cookie: ['开发运维', 2], inspect: ['开发运维', 2],
  forge: ['开发运维', 2], worktree: ['开发运维', 2], review: ['开发运维', 2],
  sessionreference: ['开发运维', 3], group: ['开发运维', 2], auto: ['开发运维', 1],

  // ── 会话效率 ──
  session: ['会话效率', 2], archive: ['会话效率', 3], skills: ['会话效率', 3],
  skill: ['会话效率', 2], explorer: ['会话效率', 2], git: ['会话效率', 2],
  graph: ['会话效率', 2], todo: ['会话效率', 2], continue: ['会话效率', 3],
  brief: ['会话效率', 3], talk: ['会话效率', 2], map: ['会话效率', 1],
  find: ['会话效率', 2], plugins: ['会话效率', 2], chat: ['会话效率', 1],
  schedule: ['会话效率', 2], reference: ['会话效率', 1],

  // ── 界面外观 ──
  viewer: ['界面外观', 3], sidebar: ['界面外观', 3], layout: ['界面外观', 3],
  panel: ['界面外观', 3], widget: ['界面外观', 3], placement: ['界面外观', 3],
  multipane: ['界面外观', 3], wallpaper: ['界面外观', 3], whale: ['界面外观', 3],
  pet: ['界面外观', 3], meme: ['界面外观', 3], slider: ['界面外观', 3],
  effort: ['界面外观', 2], theme: ['界面外观', 3], skin: ['界面外观', 3],
  font: ['界面外观', 2], style: ['界面外观', 2], notification: ['界面外观', 2],
  boot: ['界面外观', 2], animation: ['界面外观', 2], ui: ['界面外观', 2],
  zh: ['界面外观', 2], pro: ['界面外观', 1],
}

/** 描述里的长词——只在包名词元完全没命中时才用，避免子串误命中。 */
const DESCRIPTION_HINTS = [
  ['学习与计算', ['符号微积分', '公式编辑', '数学计算']],
  ['记忆', ['cross-session project memory', 'long-term memory', '七层 sqlite']],
  ['文档与创作', ['无限画布', '分镜', '海报', '信息卡']],
  ['浏览器与联网', ['web search', '联网搜索', 'x search']],
  ['模型与计费', ['会话费用', '订阅额度', 'price catalog']],
  ['远程接入', ['远程访问', '扫码配对']],
  ['开发运维', ['自动审批', '破坏性命令', '自动分组', '自动归类']],
  ['会话效率', ['技能中心', '会话归档', '对话地图']],
  ['界面外观', ['桌宠', '挂件', '壁纸', '侧边栏', '推理等级']],
]

/** 组的顺序只用于「同分裁决」，越靠前越优先。 */
const GROUP_ORDER = ['学习与计算', '记忆', '文档与创作', '浏览器与联网', '模型与计费',
  '远程接入', '开发运维', '会话效率', '界面外观']

const INBOX_BUNDLES = new Set([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-headless',
])

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** 包名切词：去掉 @scope/，按 - 和 _ 切开，全小写。 */
export function tokensOf(name) {
  const bare = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name
  return bare.toLowerCase().split(/[-_]+/).filter(Boolean)
}

/**
 * 在 ~/.dsh/profiles/ 下找「装了 dshmarket 的那个 profile」。
 *
 * 不写死 desktop：别人的 profile 可能叫 web、default 或别的名字。
 * 判据是目录里存在 .dsh-market/state.json 且 dependencies 里有 dshmarket
 * —— 只有真正在用市场的 profile 才值得我们去分组。
 * 多个都符合时取 state.json 最近改过的那个（通常是用户正在用的）。
 * @param {string} dshHome - DSH 根目录。
 * @returns {string | null} profile 目录的绝对路径。
 */
export function findMarketProfile(dshHome) {
  const profilesRoot = join(dshHome, 'profiles')
  if (!existsSync(profilesRoot)) return null

  let entries
  try {
    entries = readdirSync(profilesRoot, { withFileTypes: true })
  } catch {
    return null
  }

  let best = null
  let bestMtime = -1
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(profilesRoot, entry.name)
    const statePath = join(dir, '.dsh-market', 'state.json')
    if (!existsSync(statePath)) continue
    const deps = readJson(join(dir, 'package.json'))?.dependencies ?? {}
    if (!Object.hasOwn(deps, 'dshmarket')) continue

    let mtimeMs = 0
    try {
      mtimeMs = statSync(statePath).mtimeMs
    } catch {
      /* stat 失败就按 0 处理，仍让它参与候选 */
    }
    if (mtimeMs > bestMtime) {
      bestMtime = mtimeMs
      best = dir
    }
  }
  return best
}

/** 一个插件属于哪个组；认不出返回 UNKNOWN_GROUP。 */
export function groupFor(name, description = '') {
  const scores = new Map()
  for (const token of tokensOf(name)) {
    const hit = TOKEN_WEIGHTS[token]
    if (hit === undefined) continue
    const [group, weight] = hit
    scores.set(group, (scores.get(group) ?? 0) + weight)
  }

  if (scores.size === 0) {
    const desc = description.toLowerCase()
    if (desc !== '') {
      for (const [group, phrases] of DESCRIPTION_HINTS) {
        if (phrases.some((p) => desc.includes(p))) return group
      }
    }
    return UNKNOWN_GROUP
  }

  let best = UNKNOWN_GROUP
  let bestScore = -1
  for (const group of GROUP_ORDER) {
    const score = scores.get(group) ?? 0
    if (score > bestScore) {
      best = group
      bestScore = score
    }
  }
  return bestScore > 0 ? best : UNKNOWN_GROUP
}

function installedNames(pkg) {
  const deps = pkg?.dependencies ?? {}
  return Object.keys(deps).filter((name) => !INBOX_BUNDLES.has(name))
}

function assignedNames(state) {
  const assigned = new Set()
  for (const members of Object.values(state?.groups ?? {})) {
    for (const m of members) assigned.add(m)
  }
  return assigned
}

/**
 * 一轮：把还没进组的新插件 append 进对应组。
 *
 * 直接写 state.json 而不走 /dsh-market/groups：那条路由要求请求带 Origin 头
 * 且要求请求方监听同一端口；插件侧只需「文件即真相」，而市场每次读写都会
 * refreshMarketState() 重新读盘，所以改文件安全且立刻可见。
 *
 * @param {string} profileDir - profile 目录。
 * @param {(text: string) => void} [log] - 可选的日志回调。
 * @returns {string[]} 本次归类的 `包名→组` 描述；空数组表示什么都没做。
 */
export function reconcile(profileDir, log = () => {}) {
  const pkg = readJson(join(profileDir, 'package.json'))
  const statePath = join(profileDir, '.dsh-market', 'state.json')
  const state = readJson(statePath)
  if (pkg === null || state === null) return []

  const installed = installedNames(pkg)
  const assigned = assignedNames(state)
  // 市场自身永不入组（市场自己的规则）。
  const fresh = installed.filter((n) => !assigned.has(n) && n !== 'dshmarket')
  if (fresh.length === 0) return []

  state.groups ??= {}
  state.groupOrder ??= []

  const touched = []
  for (const name of fresh) {
    const manifest = readJson(join(profileDir, 'node_modules', name, 'package.json'))
    const description = typeof manifest?.description === 'string' ? manifest.description : ''
    const group = groupFor(name, description)
    state.groups[group] ??= []
    if (!state.groupOrder.includes(group)) state.groupOrder.push(group)
    state.groups[group].push(name)
    touched.push(`${name}→${group}`)
  }

  try {
    writeFileSync(statePath, JSON.stringify(state))
    log(`归类 ${fresh.length} 个: ${touched.join(', ')}`)
  } catch (error) {
    log(`写 state.json 失败: ${error instanceof Error ? error.message : String(error)}`)
  }
  return touched
}

export const name = 'dsh-auto-group'

/**
 * 挂载自动分组。
 *
 * 不导出 Config：本插件的两个旋钮（profile / intervalSeconds）都有安全的默认值，
 * 而 cordis 的 Config 一旦声明就必须是 Schemastery 形态，写错会让设置卡渲染失败、
 * 甚至在启动时被拒。配置仍然生效——patch 行里的 config 会原样传进来。
 *
 * @param ctx - Host plugin context.
 * @param config - 来自 cordis.patch.yml 该行的 config（可为空）。
 */
export function apply(ctx, config = {}) {
  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const intervalMs = Math.max(10, Number(config.intervalSeconds) || 90) * 1000

  /** 每轮重新解析一次 profile：用户可能中途切 profile，缓存会读到旧目录。 */
  const resolveProfile = () => {
    if (typeof config.profile === 'string' && config.profile !== '') {
      const explicit = join(dshHome, 'profiles', config.profile)
      return existsSync(join(explicit, 'package.json')) ? explicit : null
    }
    return findMarketProfile(dshHome)
  }

  const tick = () => {
    const profileDir = resolveProfile()
    if (profileDir === null) return
    reconcile(profileDir, (text) => ctx.logger?.info?.(text))
  }

  // 启动即跑一次：覆盖「插件装好了，但 DSH 是装完之后才重启」的情形。
  tick()

  const timer = setInterval(tick, intervalMs)
  timer.unref?.()

  // 卸载时务必清掉定时器，否则禁用本插件后它还会在后台改 state.json。
  ctx.on('dispose', () => clearInterval(timer))
}
