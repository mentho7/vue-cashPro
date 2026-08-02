# CashPro — AI 大盘预测数据看板

> 洞察市场先机，让决策更清晰

## 项目简介

CashPro 是一个基于 Vue 3 + Vite 的静态渲染前端项目，用于展示 AI 驱动的 A 股大盘交易观点预测与复盘数据看板。

## 技术栈

- **Vue 3** — 组合式 API（`<script setup>`）
- **Vite 5** — 构建工具与开发服务器
- **纯 CSS** — 自定义深蓝金融主题，无 UI 框架依赖

## 目录结构

```
codePro/
├── index.html              # 入口 HTML
├── package.json            # 项目配置
├── vite.config.js          # Vite 配置
├── .gitignore
├── DATA_SPEC.md            # 数据格式规范文档
├── DEPLOY.md               # 部署说明文档
├── src/
│   ├── main.js             # 应用入口
│   ├── App.vue             # 根组件
│   ├── style.css           # 全局样式
│   ├── components/
│   │   ├── NavBar.vue          # 顶部导航栏
│   │   ├── HeroSection.vue      # Hero 首屏区
│   │   ├── PredictionCard.vue   # 交易观点预测卡片
│   │   ├── DailyReview.vue      # 市场复盘三列卡片
│   │   ├── HistoryTable.vue     # 历史记录表格 + 环形图 + 时间线
│   │   ├── Footer.vue           # 页脚
│   │   └── DocModal.vue         # Markdown 文档弹窗
│   └── utils/
│       └── dataLoader.js    # 数据加载器（动态拉取 JSON）
├── scripts/
│   ├── build-data.js        # 数据构建脚本
│   └── sample-md/           # 示例数据文件
├── public/
│   ├── data/               # 运行时数据目录
│   └── docs/               # 盘前计划 MD 文档
└── deploy/
    ├── nginx-data.conf      # Nginx 配置
    ├── server-setup.sh      # 服务器初始化脚本
    └── out/                 # 示例输出数据
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器 (http://localhost:3002)
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 构建数据文件
npm run build-data
```

## 数据流

项目通过 `dataLoader.js` 从服务器 `/data/morning/` 和 `/data/evening/` 目录动态拉取按日期命名的 JSON 文件：

- **早盘数据** `YYYY-MM-DD-morning.json` — 预测观点、散户情绪、利好/利空方向、完整报告
- **晚盘数据** `YYYY-MM-DD-evening.json` — 命中结果、盘后总结、市场事件

详见 [DATA_SPEC.md](./DATA_SPEC.md)。

## 部署

详见 [DEPLOY.md](./DEPLOY.md)。
