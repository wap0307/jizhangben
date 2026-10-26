# 记账本 · 发布目录（CloudBase 静态托管 + GitHub Pages 双部署）

> **用途**：把 `01_日常记账/记账本.html`（当前 **v8.17 含 PWA + 小数精度 + 金额统一 + 云同步**）发布为可在线访问的网页。
> **数据安全**：应用全部数据存在**访问者自己浏览器的 localStorage**，服务器上只有这一堆静态文件——不含任何账目数据。
>
> **双部署分工（老妹 2026-09-02 拍板）**：
> - **CloudBase = 家人真正使用的入口**（国内快、代码不公开）—— ✅ 已上线
> - **GitHub Pages = 代码备份 / 开源存档**—— ✅ 已上线（公开仓库 zhangluohan/jizhangben）

---

## 一、线上地址

| 平台 | 链接 | 角色 |
|---|---|---|
| **CloudBase（家人日常用）** | **https://prod-d5g2g0gkh52677ca8-1473248310.tcloudbaseapp.com** | 国内快，首次打开有腾讯云风险提醒页，点「确定访问」 |
| **GitHub Pages（代码备份）** | **https://wap0307.github.io/jizhangben/** | 公开仓库，无中间页 |

### ⚠️ CloudBase 首次打开有「风险提醒」中间页

这是腾讯云对所有默认测试域名的**统一安全提示**，不是页面出错：
- 等 1 秒倒计时 → 点 **「确定访问」** → 正常进入
- 同浏览器 cookie 期内**不再提示**
- 彻底去掉需买域名 + 备案（¥30-60/年 + 10~20 天，详见下文第三节）

---

## 二、本目录文件清单

```
记账本_发布/
├── index.html          # 主程序（含 PWA meta + Service Worker 注册），v8.17
├── manifest.json       # PWA 应用清单（name / 图标 / 主题色 / standalone）
├── sw.js               # Service Worker（network-first 策略，避免缓存旧版）
├── icon-192.png        # PWA 标准图标
├── icon-512.png        # PWA 标准图标
├── icon-maskable-512.png  # PWA 适应任意遮罩的安全图标
├── apple-touch-icon.png   # iOS「添加到主屏幕」图标（180×180）
├── .nojekyll           # 告诉 GitHub Pages 别当 Jekyll 站点处理
├── README.md           # 本文件（不部署）
└── 记账本_扫码访问.png  # 二维码（不部署，可重新生成）
```

---

## 三、如何更新版本（改完记账本后重新发布）

### 步骤 1：同步主程序 + PWA 文件

```bash
# 主程序
cp "/Users/wap/Desktop/账务/01_日常记账/记账本.html" \
   "/Users/wap/Desktop/账务/07_技术架构与运维/记账本_发布/index.html"

# 如果改了 PWA 相关（manifest.json / sw.js / 图标），单独更新：
# cp "/Users/wap/Desktop/账务/01_日常记账/manifest.json" "/Users/wap/Desktop/账务/07_技术架构与运维/记账本_发布/manifest.json"
# （PWA 文件当前随主程序一起维护，不需要单独 cp）
```

### 步骤 2：上传到 CloudBase（一次传所有文件）

```bash
cd /Users/wap/.workbuddy/binaries/node/workspace
CLI=node_modules/@cloudbase/cli/bin/tcb
ENV=prod-d5g2g0gkh52677ca8

# 上传整个目录（每个文件单独 deploy，避免 README 等说明文件被传上去）：
for f in index.html manifest.json sw.js icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png; do
  $NODE node_modules/@cloudbase/cli/bin/tcb hosting deploy \
    "/Users/wap/Desktop/账务/07_技术架构与运维/记账本_发布/$f" \
    -e $ENV 2>&1 | tail -2
done
# 注：.nojekyll 不需要（CloudBase 不走 Jekyll）
```

### 步骤 3：上传到 GitHub Pages（每个文件单独 PUT）

> 背景：国内网络下 `git push` 不稳定，**用 GitHub Contents API** 直连 api.github.com。
> **强烈建议把下面的 `push_one` 写成一个 `.sh` 文件再跑**（本目录曾放过 `push_v814.sh`，用完即弃），别在命令行里手敲——shell 转义会把 base64 大 body 搞坏。
> 已踩平的 5 个坑（沙箱代理会破坏 PUT、curl `-d` 内嵌长 JSON 损坏、字段名是 `message` 不是 `msg`、覆盖需带 `sha`、zsh 里 `path` 是特殊变量），详见末尾"踩坑清单"。

```bash
TOKEN=$(cat "/Users/wap/Desktop/账号密码/git.md" | tr -d '[:space:]')
API="https://api.github.com/repos/zhangluohan/jizhangben/contents"
NODE=/Users/wap/.workbuddy/binaries/node/versions/22.22.2-2/bin/node
PUB="/Users/wap/Desktop/账务/07_技术架构与运维/记账本_发布"

push_one() {
  local file="$1"
  local msg="$2"
  local cur_sha=$($NODE -e "
    const https=require('https');
    let d='';
    https.get('$API/$file',{headers:{'Authorization':'token $TOKEN','User-Agent':'push'}},r=>{
      r.on('data',c=>d+=c);r.on('end',()=>{try{console.log(JSON.parse(d).sha||'')}catch(e){console.log('')}})
    });")
  local b64=$(base64 < "$PUB/$file" | tr -d '\n')
  $NODE -e "
    const fs=require('fs');
    const p={message:'$msg',content:'$b64',branch:'main'};
    if('$cur_sha') p.sha='$cur_sha';
    fs.writeFileSync('/tmp/p.json',JSON.stringify(p));"
  local code=$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' -m 120 -X PUT \
    -H "Authorization: token $TOKEN" -H 'Accept: application/vnd.github+json' \
    --data-binary @/tmp/p.json "$API/$file")
  echo "[$file] HTTP $code"
}

push_one index.html                'v8.14 存款与外账卡片精简：只留数字'
push_one manifest.json             'v8.13 PWA manifest'
push_one sw.js                     'v8.14 bump SW cache key'
push_one icon-192.png              'v8.13 PWA icon 192'
push_one icon-512.png              'v8.13 PWA icon 512'
push_one icon-maskable-512.png     'v8.13 PWA icon maskable'
push_one apple-touch-icon.png      'v8.13 apple-touch-icon 180'
```

### 步骤 4：等构建 + 验收

```bash
# GitHub Pages 等 1-3 分钟构建
TOKEN=$(cat "/Users/wap/Desktop/账号密码/git.md" | tr -d '[:space:]')
for i in 1 2 3 4 5 6 7 8 9 10; do
  ST=$(curl -s --noproxy '*' -H "Authorization: token $TOKEN" https://api.github.com/repos/zhangluohan/jizhangben/pages | grep -o '"status":"[^"]*"' | head -1)
  echo "[$i] $ST"; [[ "$ST" == '"status":"built"' ]] && break; sleep 10
done

# 验收（与本地发布包逐字节一致）
LOCAL="/Users/wap/Desktop/账务/07_技术架构与运维/记账本_发布/index.html"
curl -s -o /tmp/cb.html --compressed -H "Cache-Control: no-cache" \
  "https://prod-d5g2g0gkh52677ca8-1473248310.tcloudbaseapp.com"
diff -q "$LOCAL" /tmp/cb.html && echo "✅ CloudBase 逐字节一致"

curl -s -o /tmp/gh.html "https://wap0307.github.io/jizhangben/?v=13"
diff -q "$LOCAL" /tmp/gh.html && echo "✅ GitHub Pages 逐字节一致"
```

---

## 四、v8.13 新增：PWA「添加到主屏幕」

对 iPhone 用户特别重要——装到桌面后能**豁免 Safari 7 天清数据的限制**（ITP 政策），
配合 v8.12 数据保险箱，才算真正闭环"数据不丢"。

| 平台 | 怎么用 |
|---|---|
| **iPhone Safari** | 打开链接 → 点底部分享按钮「⬆️」→ 选「添加到主屏幕」→ 图标会出现在桌面，下次点开像 App 一样 |
| **Android Chrome** | 通常会自动弹出「添加到主屏幕」的安装提示；或浏览器菜单 → 「添加到主屏幕」 |
| **桌面 Chrome / Edge** | 地址栏右侧会出现「安装」图标，点击即可 |
| **本地双击 file://** | PWA 不生效（serviceWorker 不能在 file:// 注册），不影响功能 |

### 用户可见的提示文案

v8.12 数据保险箱卡片的说明里已经提到 iPhone 7 天风险；v8.13 起在浏览器菜单「添加到主屏幕」后，
下次打开应用会**像 App 一样全屏显示**，不再带浏览器地址栏，体验更好。

---

## 五、Service Worker 策略（关键）

老妹最怕的是"改了半天看不到更新"——SW 必须**不会缓存旧版**。

- 策略：**network-first**（先走网络，失败才用缓存）
- 缓存版本号：`ledger-app-v8.17`（每次大版本改）
- 失败兜底：缓存命中 → 兜底 `'. /'`（HTML）
- **不会出现旧版**因为每次都先请求最新

---

## 六、可选：绑定自定义域名（去掉 CloudBase 风险提醒页）

需要三样，缺一不可：
1. 一个域名：腾讯云 DNSPod 买 `.xyz`/`.top`，约 ¥30-60/年
2. ICP 备案：腾讯云备案系统提交，接入方式选「云开发 CloudBase」，免费但 10-20 天
3. SSL 证书：腾讯云域名自动配发免费证书

配置路径：CloudBase 控制台 → 环境 → 静态网站托管 → 域名管理 → 添加域名 → 按指引填域名 + CNAME 解析。

---

## 七、GitHub Pages 踩坑清单（沙箱环境特别提醒）

1. **`git push` 不可用**：代理对 git 隧道报 `CONNECT 502 / HTTP2 framing`；直连则 git 端点 75s 超时
2. **`curl -d "{长JSON}"` 损坏 payload** → **必须** `--data-binary @文件`，用 node 生成 payload
3. **字段名是 `message`**，写成 `msg` 会 422
4. **覆盖文件 PUT 必须带 `sha`**（先 GET 取），新文件不带
5. **zsh 里 `path` 是特殊变量**，别在脚本里用作局部变量名
6. **新仓库 PUT 可能短暂 404**（一致性延迟），等 10 秒或重建 auto_init=true 仓库
7. **空仓库状态健康后 PUT 都 200**（上传第二个文件、覆盖 README 时验证过）

---

## 八、隐私红线

- ⚠️ **不要把 localStorage 导出的 JSON 备份传进任何仓库**——里面是真实家庭账目。
- 服务器上**只有 PWA 静态文件**（HTML / JSON / JS / PNG），不含任何账目数据。
- CloudBase 链接不公开、无目录列表；GitHub 公开仓库任何人可访问页面，但**账目按浏览器隔离**。
- 🔒 **数据隔离硬规矩（v8.24，老妹拍板）**：**个人记个人的数据，绝不共享**。隔离键 = 同步码（每台设备本机随机生成），云端按 `where({code})` 分文档存；云函数**不提供任何「列出全部」的接口**，不存在越权读别人账目的口子。**不提供、也不做「全家共用一本账」的功能。**

---

## 九、当前已上线能力

| 能力 | 上线时间 | 链接 |
|---|---|---|
| 静态托管（CloudBase） | 2026-09-03 | 同上 |
| GitHub Pages 备份 | 2026-09-05 | 同上 |
| 数据保险箱（v8.12 防清缓存丢数据） | 2026-09-05 | 应用内「🛡️ 数据保险箱」卡片 |
| **PWA「添加到主屏幕」（v8.13）** | **2026-09-05** | 浏览器菜单添加即可 |
| **存款与外账精简（v8.14）** | **2026-09-05** | 卡片高度 -16%，只留数字 |
| **各记各的·数据不共享（v8.24）** | **2026-09-14** | 同步码隔离 + 卡片明示「别发给别人」 |
| **当前存款=本月结余（v8.25）** | **2026-10-16** | 当前存款不再手填，动态取本月结余 |

---

## 十、v8.14：存款与外账卡片精简（2026-09-05）

老妹需求："很多提示的文字都不需要，页面简单一点"。

**做法**：删掉卡片内所有情绪/解说/免责/鸡汤文案，只保留数字能力。

| 位置 | 改前 | 改后 |
|---|---|---|
| 卡片标题 | `🏦 存款与外账（跨月记录，不随月份清空 · 区块内点＋添加）` | `🏦 存款与外账` |
| 三个区块副标题 | 「目标可以没有，但为什么存最好写下来」等 | 删除 |
| 存款目标 label | `目标金额（留空=不设目标）` | `目标金额` |
| 「为什么想存这笔钱？」 | 整行输入框 | **删除**（`targetWhy` 数据保留，仍在 🎯 行展示） |
| 还款预算 | `每月可用于还债 / 存款的预算 已用手填预算` | `每月可还 3000 手填` |
| 达标/还款/应收预估 | 数字 + 情绪长句 | 只剩数字 |
| 底部免责声明 | `以上为按当前收支的算术估算…` | 删除 |
| `.proj-note` 容器 | 8 处 | 0 处（CSS 一并删） |

**保留**：净资产四格、进度条、所有输入、🎯 目标名+理由（老数据兼容）、清账庆祝弹窗。

**卡片高度**：1243px → 1039px（**-204px / -16%**）

**测试**：verify16 精简专项 14 项 + verify17 线上真机 24 项，全过。
| 小数精确到分 + 聚焦清 0（v8.15） | 2026-09-06 | 输入 20 就是 20；12.34 不再显示成 ¥12 |
| 全站金额显示统一（v8.16） | 2026-09-06 | 52 处金额统一走 `_money()`：整数 ¥10000，有小数 ¥12.30 |
| 数据永不丢（v8.17） | 2026-09-07 | 云同步 + 本机快照，换设备/清缓存不丢 |

---

## 十一、v8.17 云同步后端（云函数 ledger-sync）

| 项目 | 值 |
|---|---|
| 云函数 | `ledger-sync`（Nodejs18.15，事件型） |
| HTTP 端点 | `https://prod-d5g2g0gkh52677ca8-1473248310.ap-shanghai.app.tcloudbase.com/ledger-sync` |
| 数据库集合 | `ledger_data` ⚠️ **本环境根本没有文档型数据库，见下方 v8.24 更正** |
| 前端依赖 | 零 SDK，只用 `fetch` |

### 部署命令（可复用）

```bash
cd 07_技术架构与运维/云同步
TCB="node /path/to/@cloudbase/cli/bin/tcb"

# 1. 部署云函数（目录须为 functions/<name>/，且带 cloudbaserc.json）
printf '\n\n' | $TCB fn deploy ledger-sync \
  --dir "$PWD/functions/ledger-sync" \
  --runtime Nodejs18.15 --install-dependency true --force \
  -e prod-d5g2g0gkh52677ca8

# 2. 开通 HTTP 访问服务（只需一次）
printf '\n\n' | $TCB service switch -e prod-d5g2g0gkh52677ca8   # 选 Enable

# 3. 建路由（注意：建完拿到的 *.app.tcloudbase.com 才是可用域名，
#    旧的 *.service.tcloudbase.com 会报 HTTPSERVICE_NONACTIVATED）
$TCB service create -f ledger-sync -p /ledger-sync -e prod-d5g2g0gkh52677ca8
```

### 踩坑清单

1. **`--httpFn` 会部署成 Web 函数**，需要 `scf_bootstrap` 启动 HTTP 服务；若路由按事件函数模式调用会报 `FUNCTIONS_INVOCATION_FAILED`。**统一用事件函数**更稳。
2. **默认域名有两个**：`*.service.tcloudbase.com`（老，常报未激活）和 `<envId>-<appid>.<region>.app.tcloudbase.com`（新，可用）。`service create` 输出里给的是可用的那个。
3. ~~**集合必须控制台建**~~ ⚠️ **2026-09-14 更正**：真正的原因不是「权限不够」，而是**本环境压根没有文档型数据库**（详见第十八节）。
4. **云函数部署有实例复用**：改完代码后 `invoke` 可能仍返回旧结果（Runtime 1ms 即复用），需 `fn delete` + 重新 `fn deploy` 才稳。
5. **GitHub 仓库已转移**到 `wap0307/jizhangben`，Pages 地址是 `https://wap0307.github.io/jizhangben/`；旧地址 `zhangluohan.github.io` 已 404。


## 十二、v8.18 数据位置指示器（2026-09-13）

- 数据保险箱卡片顶部新增「📍 当前地址 + N 笔 · N 个月 · 最后改动」。
- **结论性实证（probe_deploy_keeps_data.js，11/11）**：部署=替换服务器 HTML，localStorage 按 origin 隔离、不受影响；数据「丢」的真凶是换入口。
- 发版前可跑 `probe_deploy_keeps_data.js` 实证「部署不清数据」，跑 `verify27_online_v818.js` 做双线真机回归。
- ⚠️ **2026-09-14 更正**：本环境是 **PostgreSQL 版**（只有 `auth` / `extensions` / `storage` 三个 schema，**没有文档型数据库**）。
  → **「去控制台建集合 `ledger_data`」这条老待办是错的，做了也没用。** 正确诊断与出路见第十八节。


## 十三、v8.19 备注丢失修复（2026-09-14）

- **症状**：备注重开页面后消失（v8.13~v8.18 均中招）。
- **根因**：`saveData` 写 `notes`，`loadData` 读 `cellNotes`；读不到走「旧格式迁移」分支先把 `cellNotes` 清空，再判断值类型（新格式是对象，被当作非字符串丢弃）。
- **修复**：写侧两字段同写；读侧两字段都认且不清空；新增 `_salvageNotes()` 开机从快照/回收站抢救。
- **验收**：`verify28_notes_persist.js`（16 项，含旧逻辑必丢的对照）+ `verify29_online_v819.js`（16 项真机双线）。


## 十四、v8.20 单项「花得最多 Top5」（2026-09-14）

- 三个汇总视图的项目名都可点，弹出该列本月花得最多的 5 笔 + 备注 + 共 N 笔 / 合计。
- 实现：复用 `modal-overlay` / `modal-content` 现成样式，0 新组件。
- 数据：`entries[日][列key]` 取金额，`cellNotes[日][列key]` 带备注，0 与空串过滤。
- 验收：`verify30_col_top5.js`（33 项 jsdom）+ `verify31_online_v820.js`（12+12 真机双线，含截图）。


### 十四·补：v8.21 饼图入口修复（2026-09-14）

- **坑**：SVG 元素设了 `pointer-events:none` 时点击会穿透，且 **jsdom 的 dispatchEvent 测不出来**（绕过 pointer-events）。
- **覆盖规则要看顺序**：`.donut-lab{pointer-events:none}` 定义在后面，同优先级下后定义者胜出 → 必须用 `.donut-lab.ct-lab-svg`（双类）提高优先级。
- **真实点击验证法**：puppeteer 里在 SVG 包围盒内网格扫描 `document.elementFromPoint(x,y)`，找到落在 `.donut-slice` 上的坐标再 `mouse.click`。
- 验收：`verify30_col_top5.js`（39 项，含 CSS 优先级断言）+ `verify31_online_v820.js`（16+16 真机双线）。


## 十五、v8.22 云同步状态诚实化（2026-09-14）

- **坑**：云函数 pull 的 catch 把 `RESOURCE_NOT_FOUND` 吞成 `ok:true, data:null`，前端误判为「同步正常」。
- **云函数改法**：新增 `isNotReady(msg)` 判定（正则匹配 `not found|not exist|RESOURCE_NOT_FOUND|collection`），pull/push 命中时返回 `{ok:false, error:"CLOUD_NOT_READY"}` + statusCode 503。
- **前端改法**：`cloudPull` 的「云端没数据」分支改为先 `push`，`push.ok` 才 `_setCloudMeta({status:"ok"})`。
- **设计原则**：宁显示「未连接」，不显示假的「已同步」。
- **错误文案双保险**：`_cloudErrText` 对云端原始技术错误（`RESOURCE_NOT_FOUND` 等）也做正则翻译，即使云函数是旧版，卡片也不会出现英文报错。
- 验收：`verify32_cloud_honesty.js`（22 项，A 云端未就绪 / B 旧云函数吞错误 / C 正常 / D 网络不通 / E 文案映射含翻译）+ `verify33_online_v822.js`（14 项真机双线，真实环境卡片显示「未连接」）。


## 十六、v8.23 保存失败不静默（2026-09-14）

- **坑**：`localStorage.setItem` 裸写，配额满会抛异常中断，状态条却还显示「已自动保存」。
- **改法**：新增 `_lsWrite(key,value)` —— try 写入 → 失败删最老快照重试 → 再失败清回收站重试 → 仍失败返回 `{ok:false}`；`updateSaveStatus(ok,err)` 失败时红色警示。四处写入全部接入。
- **验收**：`verify34_save_failure.js`（24 项，jsdom 里替换 localStorage 模拟抛异常，覆盖「每次失败」「只失败一次后腾空间成功」两条路径）。

## 十七、v8.24 「各记各的」数据隔离（2026-09-14）

- **背景**：老妹拍板「**我是希望就是个人记个人的数据，不要共享啊**」——此后不再询问同类问题。
- **核实结论：架构本来就是隔离的**（无需改数据层）
  - 隔离键 = **同步码**（`ledger_sync_code_v1`），每台设备首次开启云同步时由 `_genSyncCode()` **本机随机生成**（`crypto.getRandomValues`，8 位，去掉易混的 I/O/0/1）。
  - 云端 `ledger_data` 按 `where({code:code})` **分文档存**（pull / push 各一处），`coll.add({code:code,...})` 写入时带上自己的码。
  - 云函数**只有 pull / push 两个 action**，**没有 list / all 之类的接口** → 拿不到别人的数据。
  - `_cloudCall` 每次都带本机 `this.cloudCode()`，不存在"用了别人的码"的路径。
- **本次实际改动（把规矩说清楚，防误共享）**
  1. 未开启态文案 → 「开启后账目自动存到云端，**换手机、清缓存都不会丢**。**每人一份，各记各的**。」
  2. 已开启态新增一行 → 「**各记各的 · 同步码只属于这台设备，别发给别人**」（旁边就是「复制」按钮，这是唯一的误共享入口）。
  3. 源码云端区块顶部写明隔离设计 + 「不提供、也不做任何『全家共用一本账』的入口」。
- **验收**：`verify36_isolation.js`（22 项）
  - A 同步码随机性：500 次生成零重复 / 三台设备开启得到 3 个不同的码 / 重复开启沿用同码 / 上传请求带的就是本机码 / 全新设备默认无码。
  - B 服务端隔离：两处 `where({code:code})` / `add` 带 code / 无 list 接口 / 强制校验码格式 / 集合名固定。
  - C 界面防误共享：两态文案都含「各记各的」/ 无「共享、一起记」诱导词 / 关闭同步后本机码被清除 / 无写死的固定码。
  - D 0 JS 错误。
- **验收（真机双线）**：`verify37_online_v824.js`（18 项，CloudBase 9 + GitHub 9）——全新设备无码 / 未开启态文案 / 无共享诱导词 / 已开启态文案 / 码读回 / 0 JS 错误。
- **已就绪待跑**：`verify38_cloud_isolation.js` —— 云端「两个码互不串数据」真机测试（推 A/B 两份 → 各拉各的 → 不存在的码拉回空 → A 覆盖不动 B → 非法码 400）。集合 `ledger_data` 建好后执行 `node verify38_cloud_isolation.js` 即可；**未建好时会明确报 SKIP 并退出 0**（环境未就绪 ≠ 代码有问题）。

## 十八、v8.24 重大更正：云同步后端为何一直不通（2026-09-14）

### 发现过程

之前一直以为「云同步差最后一步：老妹去控制台建集合 `ledger_data`」。这次用 CLI 深挖环境，发现**根本不是权限问题**。

### 实测证据

```bash
# 环境：prod-d5g2g0gkh52677ca8（体验版 / Normal / ap-shanghai）

# ① 列出所有 schema —— 没有文档型数据库的容身处
tcb db execute -e prod-d5g2g0gkh52677ca8 --sql "SELECT schema_name FROM information_schema.schemata"
# → 只有 auth / extensions / storage

# ② 列出所有表 —— 全是 Supabase 风格的系统表
tcb db execute -e prod-d5g2g0gkh52677ca8 --sql \
  "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')"
# → auth.*（users/token/config…）、storage.*（buckets/objects…）

# ③ 试文档库命令 —— 直接空指针
tcb db nosql execute -e ... --command '[{"TableName":"ledger_data","CommandType":"COMMAND","Command":"{\"create\":\"ledger_data\"}"}]'
# → {"error":{"name":"TypeError","message":"Cannot read properties of null (reading '0')"}}
#    （Mongo 连接器为 null，即环境里没有文档库实例）

# ④ storage.buckets 是空的
tcb db execute -e ... --sql "SELECT id, name, public FROM storage.buckets"   # → Rows: null
```

### 结论

1. 本环境是 **CloudBase「AI 原生」PostgreSQL 环境**（Supabase 内核），**没有文档型数据库**。
2. 云函数里 `cloudbase.init(...)` + `db.collection('ledger_data')` 这套 **Mongo 风格 API 在这个环境里永远不可能成功** —— 不是配置问题，是**架构不匹配**。
3. 控制台里也**不会有「新建集合」这一步**可做（只有 PostgreSQL 表）。
4. 所以 v8.22 之后卡片老老实实显示「未连接」是**正确的**——功能确实没通，界面没骗人。

### 另一条重要线索（文档原文）

> **Web 云函数（HTTP 云函数）的运行环境不会注入 `TENCENTCLOUD_SECRETID` / `TENCENTCLOUD_SECRETKEY` 鉴权环境变量**……在 Web 云函数中初始化 SDK 时**必须显式指定**鉴权方式：**API Key（推荐）**：在函数环境变量中配置 `CLOUDBASE_APIKEY`，初始化时传入 `accessKey`。

我们的 `ledger-sync` 是 **HTTP 访问服务**触发的函数，而代码里 `cloudbase.init({ env: SYMBOL_CURRENT_ENV })` **没传任何鉴权** → 即便有文档库，这条路也是断的。

### 可走的出路（按成本排序）

| 方案 | 要做什么 | 需要老妹操作 | 成本 |
|---|---|---|---|
| **A. 云函数直连 PG**（推荐） | 装 `pg`；云函数用 `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` 直连 PostgreSQL；建一张 `public.ledger_data(code text primary key, payload jsonb, updated_at timestamptz)`；云函数按 `code` 精确查询 | 去控制台「数据库 → 连接信息」拿到连接串/账号密码，配到云函数环境变量 | 中（1 次部署 + 1 次配置） |
| **B. 走 HTTP REST（`/v1/rdb/rest/`）** | 云函数改为请求 `https://<env>.api.tcloudbasegateway.com/v1/rdb/rest/ledger_data?code=eq.XXX`，带 Bearer 令牌 | 控制台创建 **api_key** 类型 API Key（CLI 只能建 `publish_key`，**建不了 api_key**） | 中 |
| **C. 给现有 SDK 补鉴权** | 给 `cloudbase.init` 传 `accessKey: process.env.CLOUDBASE_APIKEY` | 同上（需 api_key） | 低，但**大概率仍不通**（因为文档库不存在） |
| **D. 暂时不做云同步** | 维持现状：数据保险箱 + 本机快照 + 回收站 + PWA（iPhone 加主屏幕可豁免 Safari 7 天清数据） | 无 | 0 |

**已就绪**：无论选 A/B/C，`verify38_cloud_isolation.js`（11 项双码隔离）都能直接复用来验收。

## 十九、v8.25 当前存款 = 本月结余（2026-10-16）

- **需求**：老妹「当前存款的值，动态的取本月结余的值」。
- **改动**：
  - 新增 `_currentSavings()` = `getNetIncome() − getGrandTotal()`，精确到分。
  - `_netWorth()` / `refreshAssetsDyn()` / 存款摘要三处统一改用动态值。
  - 表单「当前存款」手填框 `as_cur` 移除 → 只读展示 `as_cur_ro`（¥结余 ＋「＝本月结余」标注）。
  - 应收收回庆祝文案同步修正（「加到当前存款」→「记到本月收入与扣款」）。
- **语义**：「当前存款」从「累计余额」改为「本月净流入」，每月按当月收支重算，不跨月累加。
- **验收**：verify39（14 项新增）+ verify18 适配 + verify28/30 修复日期硬编码，本地全量 199 项 0 失败。

