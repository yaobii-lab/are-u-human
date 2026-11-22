# are u human

CPX 2026 Hackathon · Track 2 (Reverse UX)

2040 年，个人 Agent 替人选课、发邮件、回消息。Neverland 是一个只允许真人进入的论坛，守门的是一个叫 Gate 的 AI 验证系统。它要确认的不是你的身份，而是此刻在屏幕前的是你本人，不是你的 Agent。

> Your agent already has your ID. We need you.

故事前提和设计理由见 [docs/STORY.md](docs/STORY.md)。

## 体验流程

Neverland 首页 → Gate 入口（start）→ Stage 1 人脸在场验证 → … → 陪审关 → 通行证 → 论坛

| 页面 | 内容 |
| --- | --- |
| `index.html` | Neverland 首页，Win95 浏览器 + GeoCities 风 |
| `start.html` | Gate 入口页 |
| `face.html` | Stage 1：看镜头、眨眼、判定，两次失败后放行 |
| `jury.html` | 陪审关：判断三份材料是不是人写的 |
| `pass.html` | 通行证 |
| `forum.html` | 论坛（常开摄像头） |
| `flow.js` / `gate.css` | 页面间跳转（`]` 下一页）与 Gate 共用样式 |

其余 HTML（`proto-white`、`tone`、`stage1-tone`、`scan`、`scan-compare`、`bg-compare`、`stage`、`verify`）是过程中的视觉和交互探索稿，保留作记录。

## 本地运行

摄像头需要 localhost 或 https：

```bash
python3 deploy/visitors.py --preview --port 8000 --db "${TMPDIR:-/tmp}/neverland-preview.sqlite3"
```

然后打开 http://127.0.0.1:8000 。

访客完成陪审关后获得全站编号。生产环境由 nginx 保护通行证和论坛，转发取号请求给 `neverland-visitors.service`。服务脚本安装在 `/opt/neverland-visitors/visitors.py`，数据库保存在 `/var/lib/neverland-visitors/visitors.sqlite3`，独立于静态站点发布目录。

## 目录

- `assets/img/` 挥手、点赞等贴纸 GIF
- `assets/bg/` 首页背景候选，来源与授权见 [assets/bg/SOURCES.md](assets/bg/SOURCES.md)
- `docs/` 故事设定、关卡方案与评审记录
- `briefs/` 派给协作 Agent 的任务说明
- `skills/` 协作中用到的 skill（野心原则、anti-defensive、tasteskill），来源见 [skills/README.md](skills/README.md)

## 素材授权

代码以 MIT 发布。`assets/bg/` 中 Wikimedia 照片按各自 CC 协议使用；GeoCities 存档图和贴纸 GIF 授权不明，仅作非商业展示，如有权利人提出会移除。

---

Made by Yaobii ([github.com/yaobii-lab](https://github.com/yaobii-lab)) with AI collaborators.
