# dsh-auto-group

Auto-file newly installed plugins into [dshmarket](https://github.com/dsh-market/dsh-market)
groups by capability, so a growing plugin list stays organised without you
re-filing every install by hand.

## What it does

Every 90 seconds it compares the profile's `package.json` with the market's
`.dsh-market/state.json`. Any installed plugin that is **not in any group yet**
gets appended to the group its name suggests:

```
dsh-latex-formula-editor  →  学习与计算
dsh-browser-cdp           →  浏览器与联网
dsh-pet                   →  界面外观
something-unrecognisable  →  未分类
```

## What it deliberately does not do

**It never touches a plugin that is already in a group.** Move a plugin from one
group to another by hand and it stays there — the plugin treats "already filed"
as your decision, not as a mistake to correct. It adds, it never rebuilds.

It also never groups `dshmarket` itself, mirroring the market's own rule.

## How it decides

Plugin names are split into tokens (`dsh-latex-formula-editor` → `dsh / latex /
formula / editor`) and each token is matched **exactly** against a weighted
table: specific nouns (`latex`, `cdp`, `viewer`) weigh 3, domain words (`memory`,
`image`, `browser`) weigh 2, generic words (`web`, `pro`, `auto`) weigh 1. The
group with the highest total wins; ties break on a fixed group order so the
result is predictable.

Exact-token matching is deliberate. Substring matching against the whole name
plus description looks simpler and is wrong: `ego` matches "cat**ego**ry", `im`
matches "**im**age-viewer", and `model` matches an approval plugin's prose.

If no token matches, the description is checked for a handful of long phrases
(`无限画布`, `web search`, …). If that fails too, the plugin lands in **未分类**
rather than being guessed at.

## Install

```bash
dsh plugin --profile <your-profile> add link:/path/to/dsh-auto-group
```

Or straight from GitHub:

```bash
dsh plugin --profile <your-profile> add github:inaflash123/dsh-auto-group
```

Requires [dshmarket](https://github.com/dsh-market/dsh-market) to be installed —
without the market there is no `state.json` and nothing to file into.

## Configuration

| field | default | meaning |
| --- | --- | --- |
| `profile` | *(auto-detect)* | Profile to file into. Empty finds the profile that has `.dsh-market/state.json` and lists `dshmarket` in its dependencies; if several qualify, the one whose state changed most recently wins. |
| `intervalSeconds` | `90` | How often to look for unfiled plugins. Minimum 10. |

## Turning it off

Disable the plugin. Groups already written stay exactly as they are — the
plugin only adds members, and disabling it clears its timer so nothing keeps
editing `state.json` behind your back.
