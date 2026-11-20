# 发布到插件市场（awesome-dsh-plugin）操作手册

目标仓库：`awesome-dsh-plugin`。dshmarket 的 README 明写「这个仓库是市场应用本身，
不是插件目录」，所以投稿走的是精选列表。

## 一、前置（必须全部满足，否则 PR 会被 CI 打回）

| # | 条件 | 本仓现状 |
|---|---|---|
| 1 | GitHub 仓库已创建，且**满 24 小时** | ⏳ 取决于你何时建仓 |
| 2 | 仓库 About 区打上 `dsh-plugin` topic | ⏳ 需你在网页点 |
| 3 | `package.json` 声明 `dsh.bundle` | ✅ 已有 |
| 4 | 只提一个 `data/plugins/<owner>__<repo>.yml`，不改 README | ✅ 材料已备 |
| 5 | category 合法 | ✅ 填 `plugin` |
| 6 | 描述只讲功能不带营销词 | ✅ 已按规范写 |

## 二、建仓（一次性）

```bash
# 1. 在本目录初始化 git
git init
git add -A
git commit -m "feat: auto-file new plugins into dshmarket groups"

# 2. 建远程仓库（需要先 gh auth login）
gh repo create dsh-auto-group --public --source=. --push \
  --description "Auto-file newly installed DSH plugins into dshmarket groups by capability"

# 3. 打 topic（About 区那个，不是 package.json keywords）
gh repo edit inaflash123/dsh-auto-group --add-topic dsh-plugin
gh repo edit inaflash123/dsh-auto-group --add-topic deepseek-harness
```

## 三、投稿

1. Fork `awesome-dsh-plugin`
2. 在 fork 里新建 `data/plugins/inaflash123__dsh-auto-group.yml`，内容见 `entry.yml`
3. 直接打开这个 compare URL（比找按钮可靠）：

```
https://github.com/<awesome-dsh-plugin的owner>/awesome-dsh-plugin/compare/main...inaflash123:dsh-auto-group:main
```

⚠️ 注意：上面 URL 的 base 是 awesome-dsh-plugin 的默认分支，head 要改成你的
**fork**（因为 yml 提在 fork 里）。用 gh 的话更省事：

```bash
gh repo fork awesome-dsh-plugin --clone
cd awesome-dsh-plugin
mkdir -p data/plugins
cp /d/dsh/dsh-auto-group/entry.yml data/plugins/inaflash123__dsh-auto-group.yml
git checkout -b add-dsh-auto-group
git add data/plugins/inaflash123__dsh-auto-group.yml
git commit -m "Add dsh-auto-group"
git push -u origin add-dsh-auto-group
gh pr create --fill
```

## 四、entry.yml 内容

见本目录 `entry.yml`，要点：

- `url` 必须与仓库地址**完全一致**
- `name` 形如 `<owner>/<repo>`
- `category` 必须是合法枚举值
- `description.en` 必填，**句号结尾**；如果含 `: ` 必须整体加引号
- `description.zh` 可选

## 五、提交后

- CI 会校验 6 条门槛，没过就按报错改，不用关 PR
- 「仓库满 1 天」这条是时间门槛，CI 会自己转绿，不需要重提
- 合并后约一天出现在站点与 dshmarket 里
- **在 PR 真的 merged 之前，不要对外说「已上架」**
