# dsh-auto-group

新装的插件自动归进 [dshmarket](https://github.com/dsh-market/dsh-market) 的分组，
插件越装越多也不用每次手工整理一遍。

## 它做什么

每 90 秒比对一次 profile 的 `package.json` 与市场的 `.dsh-market/state.json`。
凡是**还没进任何分组**的已装插件，就按包名建议的类别塞进对应组：

```
dsh-latex-formula-editor  →  学习与计算
dsh-browser-cdp           →  浏览器与联网
dsh-pet                   →  界面外观
认不出用途的               →  未分类
```

## 它刻意不做什么

**已经在任何分组里的插件，它一个都不碰。** 你手工把某个插件从 A 组拖到 B 组，
它就永远待在那儿——这个插件把「已经在组里」当成你的决定，而不是一个要纠正的错误。
它只做加法，从不重建分组。

它也不会给 `dshmarket` 自己分组，与市场自身的规则一致。

## 它怎么判断

包名会被切成词元（`dsh-latex-formula-editor` → `dsh / latex / formula / editor`），
每个词元与一张加权表做**精确**匹配：专有名词（`latex`、`cdp`、`viewer`）权重 3，
领域词（`memory`、`image`、`browser`）权重 2，泛词（`web`、`pro`、`auto`）权重 1。
总分最高的组胜出；同分时按固定组顺序裁决，结果可预测。

用精确匹配而不是子串匹配是刻意的。拿「包名 + 描述」整段做子串匹配看着简单，
但实测是错的：`ego` 会命中 "cat**ego**ry"，`im` 会命中 "**im**age-viewer"，
`model` 会命中某个审批插件描述里的散文。

如果一个词元都没命中，就去描述里找少量长词（`无限画布`、`web search` 等）。
还是找不到，就丢进**未分类**，绝不瞎猜。

## 安装

```bash
dsh plugin --profile <你的profile> add link:/path/to/dsh-auto-group
```

或者直接从 GitHub 装：

```bash
dsh plugin --profile <你的profile> add github:inaflash123/dsh-auto-group
```

需要先装 [dshmarket](https://github.com/dsh-market/dsh-market)——没有市场就没有
`state.json`，也就没有可归的组。

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `profile` | 自动探测 | 要归入哪个 profile。留空则找那个同时具备 `.dsh-market/state.json` 且 dependencies 里有 `dshmarket` 的 profile；若有多个，取 state 最近改过的那个。 |
| `intervalSeconds` | `90` | 检查间隔秒数，最小 10。 |

## 关掉它

在市场里停用本插件即可。已经分好的组原样保留——它只加成员，停用时还会清掉自己的
定时器，不会在后台偷偷改 `state.json`。
