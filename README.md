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
npm test          # HTTP API、数据完整性、车库备份、对比链接、几何投影与 3D 网格检查
npm run build     # TypeScript 检查与生产构建
npm start         # Express 同时提供前端与 API，默认 127.0.0.1:3001
npm run format    # 整理源码格式
```

生产服务可通过 `HOST`、`PORT` 环境变量配置。开发服务使用固定 API 端口 3001，与 Vite 代理对应。生产构建后的页面、字体和车型图片均从本地服务加载。

## GitHub Pages

网站入口：https://hliangzhao.me/velodex/ 。

推送到 `main` 后，`Deploy GitHub Pages` 工作流会运行测试、构建并自动发布，也可以在 Actions 中手动运行。Pages 设置的发布来源为 **GitHub Actions**。

```sh
npm run build:pages
npm run preview:pages  # http://127.0.0.1:4173/velodex/
```

Pages 构建输出到 `dist-pages/`，将 `server/data/catalog.json` 与 `server/data/parts.json` 打包为带内容哈希的静态资源，不需要运行 Express。图片、首页链接和 3D 模块使用正确的站点子路径；车型分享链接仍使用 `?bike=xlab-ad9`。本地开发及 `npm run build` / `npm start` 继续使用 Express API。

更新车型数据后推送即可发布新版本。工作流从 Pages 配置读取站点路径；本地 Pages 预览默认使用 `/velodex/`，可通过 `PAGES_BASE_PATH` 覆盖。

## 发现、对比与私人车库

首页改为编辑式发现页：经典车型主视觉、三个专题、展厅精选与随机车型。整车图鉴和车型详情分别展示，导航可直达配件、专题、整车对比与车库。已有 `?bike=...` / `?paint=...` 分享链接继续有效。

- `?view=bikes`：完整车型与品牌筛选；每张卡片可收藏、加入对比。
- `?view=compare`：最多三款整车分别选尺码，以五通为原点、相同毫米比例叠加几何；可放大前端、隐藏某款、切换基准车、查看 Stack / Reach 差值、只看不同参数。
- 对比页分享链接包含车型顺序与独立尺码，打开即可复现。照片仅作外观对照，未进行实物比例标定；尺寸骨架不代表真实管型，未公布轴距时不推算前轴。重量保留各厂商的版本与称重口径，不作统一排名。
- `?view=garage`：按具体涂装收藏，分类为“想拥有 / 已拥有 / 只是喜欢”，支持个人笔记、移除后撤销、JSON 导出与导入。
- 车库无需账号，使用当前浏览器的 localStorage，不同步到服务器或其他设备。导入合并新增条目、保留已有笔记；不认识的车型 / 涂装会跳过并提示。浏览器存储失败时显示提示，仍可导出本次状态。
- `?view=stories`：Tarmac 三代档案、国产品牌观察、耐力与砾石三篇编辑选集，附原厂来源，并可一键进入相关整车对比。专题年份指收录版本，不等同于车架首次发布年份。
- 车型详情新增涂装缩略图与“照片细看”：原始图片 1–4 倍缩放、拖拽平移、键盘操作。缩放倍率相对适配画面，不会增加原图分辨率。

## 功能

- 真实整车图上的八类部件热点：车架、手变、曲柄、牙盘、飞轮、功率计、轮组、轮胎。
- 对应车型的详细参数、完整配置弹窗、图片放大、隐藏热点欣赏整车。
- 品牌与车型搜索、在售系列 / 经典存档 / 人气精选，以及气动、全能、爬坡、耐力、砾石及 TT 计时定位筛选。
- `?bike=xlab-ad9` 等链接可直接分享车型，支持浏览器前进和后退。
- 响应式桌面 / 平板 / 手机布局，键盘操作、弹窗焦点管理、减少动态效果偏好。

目前收录 15 个品牌、37 款车型。首批车型：Specialized Tarmac SL8 / SL7、Trek Madone SLR 9 Gen 8、Canyon Aeroad CFR、Giant Propel Advanced SL 0、Pinarello Dogma F、Cervélo S5，喜德盛 X-LAB AD7 / AD8 / AD9 / RS7 / RT9，以及迪卡侬 Van Rysel EDR CF。

新增 TCR Advanced Pro 0 AXS、Defy Advanced Pro 0、Ultimate CF SLX 8 Di2、Endurace CF SLX 8 Di2、Cannondale SuperSix EVO 2 Gen 5、美利达 SCULTURA 8000 / SCULTURA ENDURANCE 8000，以及迪卡侬 Van Rysel RCR-R Pro。新增项均有实拍、八类部件记录、逐尺码几何和独立 3D 轮廓。

新增 Colnago Y1Rs / V5Rs、BMC Teammachine R 01 ONE、Cervélo R5 / P5 和 Canyon Speedmax CFR TT。职业赛场标签附官方车队报道，价格保留原币种和地区；零售配置与车手赛日配置分开说明。

国产品牌补充 WINSPACE 银贝斯 T1600 / SLC5.0、PARDUS 瑞豹第三代 ROBIN EVO / 第四代 SPARK EVO，以及 SUNPEED 速比特 MARS-A PRO / 2026 UNIVERSE；后两款为铝合金车架。经典存档增加 2019 S-Works Venge 与 2020 S-Works Tarmac SL6 RED AXS。

砾石公路车收录 2025 Diverge Comp Carbon Apex AXS 与 2025 Revolt Advanced 0 英国版 GRX RX820，可独立筛选。提供胎容、安装点、储物、单 / 双盘传动等资料；Revolt 的几何和 3D 统一使用 Flip Chip 短档，长档差异另行说明。

## 涂装与配件图鉴

- 已收录 12 款车的多涂装，共 57 个整车外观条目。点击色块切换官方图片，`?bike=y1rs&paint=ysbo` 可直接分享，支持浏览器前进 / 后退。
- 不同构图的涂装有独立热点；部分官方展示车的附件和齿比与所列零售选项不同，页面明确提示。
- `?view=parts` 打开独立配件图鉴：11 个厂商、18 款轮组 / 变速系统 / 轮胎。
- 按类别、厂商、在售 / 经典、关键词筛选；查看参数、设计特点、适用场景与兼容性；同类最多三款并排比较。
- `?view=parts&product=zipp-303-firecrest` 支持产品直达；整车部件与对应配件系列双向链接。
- 配件资料在 `server/data/parts.json`，Pages 与 Express 共用；性能介绍区分设计取向和实测，不虚构统一评分或跨品牌瓦数排名。
- 有图片的产品使用厂商素材；无图时显示明确的类别图示，不将其作为准确产品外观。

## 车型 3D 与工程资料

3D 收入详情页底部的“实验功能 / 近似 3D 结构示意”，不再作为主要浏览方式。展开后点击“在上方打开结构示意”加载 Three.js 视图，鼠标拖拽旋转、滚轮 / 双指缩放，可直接点击部件查询参数。提供正侧视图、复位和“仅看车架”；键盘方向键旋转，`+` / `-` 缩放，`R` 复位。

3D 使用各车型的官方实拍轮廓与所选尺码几何近似重建：连续前车架壳体、变截面前后叉、独立座管、轮圈、辐条、碟片、传动与弯把。Madone 的 IsoFlow 镂空、Dogma 的 ONDA 前叉、Propel 一体座管、S5 深管型、RT9 圆座管及 EDR 储物舱分别建模。新增 P5 / Speedmax 的 TT 基础把、托肘与延伸把，Speedmax 的封闭后轮，以及 Y1Rs 的双 Y 接点与鸥翼把组。AD8 / AD9 的主要轮廓相近，保留其共性，不为区分型号而虚构不同形状。

**精度边界：** 这不是原厂 CAD，也不是可用于制造或拟合的扫描模型。Stack、Reach、角度和轴距来自注明的资料；管型深度、侧向宽度、接点曲率与部件表面依据照片估计。3D 使用中性素色；涂装、螺钉、链线与精确零件造型以实拍及原厂资料为准。部分尺码座管长度为插值，Dogma 未公开的轴距仅在绘图中使用近似值，参数表仍显示未列出。

车型的外形参数集中于 `src/data/model-profiles.json`，曲面生成在 `src/buildBikeModel.ts`。新增车型必须同时补充轮廓档案与来源图片，不能自动套用通用车架。网格测试检查默认和最小 / 最大尺码是否生成有效顶点及法线；它不证明外形精度。

新增车型按已公开的齿数与速别生成传动：单盘不显示内盘和前拨，飞轮保留最大 / 最小齿与片数，中间齿数仍为外形插值。砾石模型增加宽胎肩部胎纹、外撇弯把、前叉 / 上管安装点与储物舱轮廓；Diverge 的 Future Shock 前端及第四代 SPARK 的外置前端单独表达。

“车架几何”按尺码展示 Stack / Reach、角度、轴距等，并与 3D 联动。“空气动力学”说明各车的设计重点，附速度与 CdA 的风阻功率演示。该演示采用静止空气阻力公式，不是任何车型的实测风阻或跨品牌排名。

## 数据与版本

后端读取 `server/data/catalog.json`，通过 HTTP API 提供结构化数据。车型与配件资料由维护者编辑，没有账号、评论或后台写入接口；私人车库只保存在浏览器本地。

每条车型记录包括地区 / 世代、来源链接、核对日期、图片、重量参考尺寸及独立部件配置。未公开的参数明确标注，不用其他版本的数据补全。特别注意：

- AD7 为巴西官方展示的 105 Di2 / Branta 铝合金功率曲柄版本；AD8、AD9 为美国官方配置。它们不等同于中国大陆在售配置。
- Madone 使用 2025 年同代官方涂装图，参数参考 Trek 官方 2026 年 ML 码资料，页面有提示。
- RS7、RT9 为美国版本；迪卡侬 EDR CF 为法国 8817922 机械 105 / VR35 Lite 配置，非早期 EDR 同名车架。EDR 几何采用品牌尺寸图的媒体转载，并在页面注明。
- 新增美利达两款为 2025 国际版官方存档；SCULTURA 8000 使用 Reynolds AR 46，与瑞士 CH 版的 Vision 配置不同。
- Endurace 为产品 4432（官网核对时标注 Coming soon），不混用旧款 4277 几何；Ultimate 为 4372。Canyon 的整车重量从官网磅值换算。
- RCR-R Pro 为英国 8929970 配置；几何采用 2024 RCR 官方手册第 9 页。官网轮组重量有冲突，未擅自选取。
- 未明确列出原配功率计的车型，照片不标注虚构的功率计位置，3D 不额外生成传感器；仍可通过部件档案查看说明。
- SL7 的官方牙盘字段存在冲突，保留“待核验”，未推测齿数。
- 银贝斯整车参数采用 Build Specs 表；官方涂装图为跨配置展示，套件、轮组与轮胎可能不同。T1600 宣传段与配置表冲突时使用配置表，SLC5.0 的座管字段与展示外形差异亦有提示。
- 瑞豹按第三代 ROBIN / 第四代 SPARK 页面录入，ROBIN 的 710 g 是 M 码车架重量。SPARK 的 XXS 座管角保留官方表原值。
- 速比特火星选择 MARS-A PRO，未混用普通版铝叉配置；宇宙是官方公路产品，32C 原配胎不代表砾石用途认证。
- Venge 为十一速 Dura-Ace Di2；SL6 为原代 RED AXS，均不链接到当前世代套件。SL6 官网未列出盘片齿数，参数保留缺项，3D 盘片外形仅为近似。
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

未知车型 / 部件返回 404，错误筛选参数返回 400。支持的分类为 `all`、`current`、`classic`、`popular`、`pro`、`flagship`。

配件 API：`GET /api/parts?category=wheels&brand=zipp&q=303`，`GET /api/parts/zipp-303-firecrest`。非法分类和重复筛选参数返回 400，未知产品返回 404。

图片、品牌标识与产品名称归各自权利人所有。`docs/image-sources.json` 记录原始来源；官方图片未被声明为开放许可资源。本仓库不为第三方素材授予额外许可。
