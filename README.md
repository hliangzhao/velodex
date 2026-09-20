# VÉLODEX · 公路车图鉴

面向公路车爱好者的交互式整车图鉴。React + TypeScript 前端、独立 Express 后端，本地开发与部署，不依赖建站平台。

## 本地运行

需要 Node.js 22 或更高版本。

```sh
npm ci
npm run dev
```

- 前端：http://127.0.0.1:5173
- API：http://127.0.0.1:3001
- 退出：Ctrl+C

```sh
npm test          # HTTP API、数据完整性、13 款车默认及极端尺码的 3D 网格检查
npm run build     # TypeScript 检查与生产构建
npm start         # Express 同时提供前端与 API，默认 127.0.0.1:3001
npm run format    # 整理源码格式
```

生产服务可通过 `HOST`、`PORT` 环境变量配置。开发服务使用固定 API 端口 3001，与 Vite 代理对应。生产构建后的页面、字体和车型图片均从本地服务加载。

## GitHub Pages

网站入口：https://hliangzhao.github.io/velodex/ （GitHub 会按个人主页域名配置跳转。）

推送到 `main` 后，`Deploy GitHub Pages` 工作流会运行测试、构建并自动发布，也可以在 Actions 中手动运行。Pages 设置的发布来源为 **GitHub Actions**。

```sh
npm run build:pages
npm run preview:pages  # http://127.0.0.1:4173/velodex/
```

Pages 构建输出到 `dist-pages/`，将 `server/data/catalog.json` 打包为带内容哈希的静态资源，不需要运行 Express。图片、首页链接和 3D 模块使用正确的站点子路径；车型分享链接仍使用 `?bike=xlab-ad9`。本地开发及 `npm run build` / `npm start` 继续使用 Express API。

更新车型数据后推送即可发布新版本。工作流从 Pages 配置读取站点路径；本地 Pages 预览默认使用 `/velodex/`，可通过 `PAGES_BASE_PATH` 覆盖。

## 功能

- 真实整车图上的八类部件热点：车架、手变、曲柄、牙盘、飞轮、功率计、轮组、轮胎。
- 对应车型的详细参数、完整配置弹窗、图片放大、隐藏热点欣赏整车。
- 品牌与车型搜索、在售系列 / 经典存档 / 人气精选，以及气动、全能、爬坡、耐力定位筛选。
- `?bike=xlab-ad9` 等链接可直接分享车型，支持浏览器前进和后退。
- 响应式桌面 / 平板 / 手机布局，键盘操作、弹窗焦点管理、减少动态效果偏好。

首批收录 8 个品牌、13 款车型：Specialized Tarmac SL8 / SL7、Trek Madone SLR 9 Gen 8、Canyon Aeroad CFR、Giant Propel Advanced SL 0、Pinarello Dogma F、Cervélo S5，喜德盛 X-LAB AD7 / AD8 / AD9 / RS7 / RT9，以及迪卡侬 Van Rysel EDR CF。

## 车型 3D 与工程资料

点击“车型 3D”加载 Three.js 视图，鼠标拖拽旋转、滚轮 / 双指缩放，可直接点击部件查询参数。提供正侧视图、复位和“仅看车架”；键盘方向键旋转，`+` / `-` 缩放，`R` 复位。

3D 使用各车型的官方实拍轮廓与所选尺码几何近似重建：连续前车架壳体、变截面前后叉、独立座管、轮圈、辐条、碟片、传动与弯把。Madone 的 IsoFlow 镂空、Dogma 的 ONDA 前叉、Propel 一体座管、S5 深管型、RT9 圆座管及 EDR 储物舱分别建模。AD8 / AD9 的主要轮廓相近，保留其共性，不为区分型号而虚构不同形状。

**精度边界：**这不是原厂 CAD，也不是可用于制造或拟合的扫描模型。Stack、Reach、角度和轴距来自注明的资料；管型深度、侧向宽度、接点曲率与部件表面依据照片估计。3D 使用中性素色；涂装、螺钉、链线与精确零件造型以实拍及原厂资料为准。部分尺码座管长度为插值，Dogma 未公开的轴距仅在绘图中使用近似值，参数表仍显示未列出。

车型的外形参数集中于 `src/data/model-profiles.json`，曲面生成在 `src/buildBikeModel.ts`。新增车型必须同时补充轮廓档案与来源图片，不能自动套用通用车架。网格测试检查默认和最小 / 最大尺码是否生成有效顶点及法线；它不证明外形精度。

“车架几何”按尺码展示 Stack / Reach、角度、轴距等，并与 3D 联动。“空气动力学”说明各车的设计重点，附速度与 CdA 的风阻功率演示。该演示采用静止空气阻力公式，不是任何车型的实测风阻或跨品牌排名。

## 数据与版本

后端读取 `server/data/catalog.json`，通过 HTTP API 提供结构化数据。当前为维护者编辑的只读图鉴，没有账号、评论或后台写入接口。

每条车型记录包括地区 / 世代、来源链接、核对日期、图片、重量参考尺寸及独立部件配置。未公开的参数明确标注，不用其他版本的数据补全。特别注意：

- AD7 为巴西官方展示的 105 Di2 / Branta 铝合金功率曲柄版本；AD8、AD9 为美国官方配置。它们不等同于中国大陆在售配置。
- Madone 使用 2025 年同代官方涂装图，参数参考 Trek 官方 2026 年 ML 码资料，页面有提示。
- RS7、RT9 为美国版本；迪卡侬 EDR CF 为法国 8817922 机械 105 / VR35 Lite 配置，非早期 EDR 同名车架。EDR 几何采用品牌尺寸图的媒体转载，并在页面注明。
- SL7 的官方牙盘字段存在冲突，保留“待核验”，未推测齿数。
- “在售系列”表示地区品牌网站仍有产品展示，不表示实时库存；“人气精选”是编辑选集，不是销量榜。
- 重量按官网所给尺寸与口径展示，不宜直接当作严格同条件对比。

更新数据时增加 `brands` / `bikes` 记录，图片放入 `public/bikes/`，并保留来源、版本与核对日期。每个部件的 `x` / `y` 是相对于页面可见图片画布的百分比。`imageRatio` 与 `imagePosition` 控制展示裁切；调整图片构图后需要重新校准热点。原始图片保持不变。

## API

| 请求                                                              | 返回                 |
| ----------------------------------------------------------------- | -------------------- |
| `GET /api/health`                                                 | 服务状态             |
| `GET /api/catalog`                                                | 品牌、车型与资料说明 |
| `GET /api/brands`                                                 | 品牌列表             |
| `GET /api/bikes?brand=xds&collection=current&q=AD9&kind=气动竞赛` | 筛选后的车型及数量   |
| `GET /api/bikes/xlab-ad9`                                         | 单款整车             |
| `GET /api/bikes/xlab-ad9/components/power`                        | 单个部件             |

未知车型 / 部件返回 404，错误筛选参数返回 400。支持的分类为 `all`、`current`、`classic`、`popular`。

## 目录

```text
src/                   React 页面、交互、样式与类型
server/app.mjs         Express 路由与筛选逻辑
server/index.mjs       服务入口
server/data/           车型档案
server/*.test.mjs       数据、API 与 3D 网格测试
public/bikes/          本地车型图片
docs/image-sources.json 图片原始来源与版本备注
scripts/dev.mjs        同时启动前后端
```

图片、品牌标识与产品名称归各自权利人所有。`docs/image-sources.json` 记录原始来源；官方图片未被声明为开放许可资源。本仓库不为第三方素材授予额外许可。
