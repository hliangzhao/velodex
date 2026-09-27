# Van Rysel RCR 家族资料核对

核对日期：2026-09-27。新增五套零售配置，连同原有 RCR Pro Ultegra 组成专题的六车配置表。产品年未获官方明确说明，统一保留 `modelYear: null`。当前系列在官网展示不代表实时有货。

## 版本与图片

| 图鉴条目                         | 官方市场及编号                   | 涂装                       |
| -------------------------------- | -------------------------------- | -------------------------- |
| RCR / RCR-R 105 Di2              | 英国 8883075                     | 极白                       |
| RCR Pro / RCR-R Pro Force AXS E1 | 法国 8941079 / 8941080 / 8941081 | 裸碳黑 / 午夜蓝 / 珍珠白粉 |
| RCR-F Pro 105 Di2                | 英国 8913505                     | 月灰                       |
| RCR-F Pro Ultegra Di2            | 英国 8913506                     | 电光紫                     |
| RCR-F Pro Dura-Ace Di2           | 英国 8913100                     | Signature 碳黑             |

原有英国 8929970 Ultegra 条目补齐车把、座管和坐垫资料，保留旧手册几何。所有新图来自对应产品官方页面，保留图片原文件，只通过 CSS 展示画布裁去留白。七张图片及版本的溯源记录在 [image-sources.json](image-sources.json)。品牌产品图未找到开放许可，署名并不代表获得授权。

本次未取得可核验的中国大陆官方售价，没有录入人民币估价，也未将海外版本描述为国行。

## 几何与参数冲突

- 当前 [RCR 产品几何图](https://contents.mediadecathlon.com/p2926284/k$70e3c15ca2d6a7c6435ef9719778d3df/2926284_default.jpg) 同时出现在 RCR 105 与法国 Force E1 页面。按该图录入新增两款车的六个尺码，M 码 Stack / Reach 为 546 / 388 mm。原有 Ultegra 版本保留 2024 手册的 542 / 389 mm，不据此宣称换代。
- 当前 [RCR-F 产品几何图](https://contents.mediadecathlon.com/p2908039/k$65d3eff3dd1b010a6d394250a9477cb2/2908039_default.jpg) 出现在本次三种配置页面，M 码为 535 / 392 mm；L 码 Stack 取 561 mm。[2025-01-29 技术手册](https://cdn.decathlon-share.com/product-user-guide/3e19111440061/doc-source-rcr-f-en-2025-01-29.pdf) 的 L 码写为 551 mm，条目保留该冲突说明。官方图包含 XXS，并不表示每种配置在当地供应 XXS。
- 新 RCR 页面与 Force E1 页面正文的前叉重量为 380 g、规格栏为 350 g，未选取其中一个作为统一答案。RCR-F 的 1010 g 车架标为 gross weight，未将其与 RCR / Pro 的含漆 830 / 790 g 做严格同口径减法。
- RCR 105 页 HADRON Classic 470 的型号与 45 mm 规格栏不能互相印证，框高留空；RCR Pro Ultegra 保留原有轮组重量字段冲突说明。
- RCR-F Ultegra 飞轮按详细配置和品牌系列表录入 11–34T，注明结构化规格栏误列 10/34；Dura-Ace 按详细配置录入 FC-R9200-P，未照抄摘要的 Ultegra 或系列对照页的 Inpeak 字段。
- RCR-F Ultimate 轮组的页面重量混入 Classic 文案，未记录为 Ultimate 的确定重量。105 / Ultegra 坐垫仅有德国对照表作为补充，英国条目标注地区待核对。
- 胎宽上限按每款产品和手册区分，RCR 页面出现 33 mm、旧资料为 32 mm，保留说明；未采用法国 Force E1 结构化栏的 40 mm。

## 专题与数据联动

[专题](https://hliangzhao.me/velodex/?view=stories&story=vanrysel-rcr-guide) 位于既有专题列表和首页近期选集，所有六款车详情页均有返回入口。介绍命名、铺层、几何、风阻宣传条件、齿比、轮胎接口与选择思路。配置表直接读取整车档案，避免另维护一份套件、轮组或重量数据。

“节省 13 W（45 km/h）”与头管刚性提高 7% 均注明为 [Van Rysel 品牌声明](https://www.vanrysel.com/en-GB/browse/rcr-f)，不转换为个人实骑收益或整车效率。系列关系另参照 [官方铺层介绍](https://www.vanryselus.com/blogs/news/introducing-rcr-and-rcr-pro) 与 [当前车型目录](https://www.vanrysel.com/en-GB/browse/race-road-bikes)。
