# 无限画布开源项目研究摘要

调研时间：2026-07-10，Asia/Shanghai。Stars 为当日 Shields 四舍五入快照。ForgeSkill 完成了 40 个候选仓库的发现；GitHub 匿名 API 在 README 富化阶段限流，因此最终项目通过 jsDelivr、Shields、npm 元数据和许可证原文交叉核验。

| 排名 | 项目 | Stars | 借鉴重点 | 主要边界 |
| ---: | --- | ---: | --- | --- |
| 1 | [Excalidraw](https://github.com/excalidraw/excalidraw) | 127k | 开放 JSON、离线、本地保存、导出和聚焦白板体验 | 绘图优先，不是结构化知识模型 |
| 2 | [xyflow](https://github.com/xyflow/xyflow) | 38k | React 节点/边、视口、选择、小地图和控制器 | 是引擎，不提供产品数据与存储 |
| 3 | [Drawnix](https://github.com/plait-board/drawnix) | 14k | 思维导图/流程图、浏览器保存、JSON 和插件边界 | 完整插件架构对 MVP 过重 |
| 4 | [AFFiNE](https://github.com/toeverything/AFFiNE) | 70k | 文档与无边画布共享 block、local-first 后叠加同步 | 系统巨大且路径级混合许可 |
| 5 | [tldraw](https://github.com/tldraw/tldraw) | 49k | shape/tool/binding/runtime 的扩展契约 | 当前 SDK 生产使用需要授权 |
| 6 | [infinite-canvas](https://github.com/basketikun/infinite-canvas) | 3k | 上游上下文、结果回写节点、素材与 MCP Agent | AGPL-3.0，且本地数据兼容尚不稳定 |
| 7 | [JSON Canvas](https://github.com/obsidianmd/jsoncanvas) | 3.6k | 小而开放的节点、分组、边交换规范 | 不包含历史、任务、协作等应用语义 |
| 8 | [LeaferJS](https://github.com/leaferjs/leafer-ui) | 4.3k | 高密度 Canvas 场景树与编辑能力 | 对当前 DOM 卡片产品过于底层 |
| 9 | [Lorien](https://github.com/mbrlabs/Lorien) | 6.7k | 简单、本地文件和紧凑的矢量笔画模型 | Godot 原生、绘图优先、维护较慢 |
| 10 | [Infinite Canvas Tutorial](https://github.com/xiaoiver/infinite-canvas-tutorial) | 1k | Camera、网格、事件、历史、性能和测试方法 | 教程明确尚未达到生产完成度 |

## 融合结论

市场中的缺口不是更多画笔或更多 AI 按钮，而是“白板的直接性 + 知识卡片的结构 + 用户拥有的开放文件”。因此 Nodefield 首版只保留一个清晰闭环：捕获卡片、连接上下文、检查与修改、搜索定位、本地恢复、导入导出。

技术上选择 `@xyflow/react`，因为目标是结构化卡片而非自由绘图；它覆盖本次 MVP 的成熟交互，MIT 许可也比当前 tldraw SDK 的生产许可更适合独立项目。应用持有自己的 `BoardDocument`，避免把 React Flow 内部状态变成用户文件格式。

AI、MCP、协作、资源库和自由绘图被明确放在后续。未来若加入 AI，应读取“选中节点 + 上游节点”，生成可预览、可撤销的结构化命令，并将结果写回为普通节点，而不是把不可追踪的自动化塞进核心模型。

## 许可证决策

- Excalidraw、xyflow、Drawnix、JSON Canvas 和 LeaferJS 为 MIT，可借鉴并在满足许可条件时使用代码。
- tldraw 当前 SDK 为自定义许可，开发环境可用，生产需要 license key 或商业协议；本项目不依赖它。
- AFFiNE 根仓库存在目录级许可差异，不能按“整仓 MIT”处理；本项目只借鉴架构思想。
- basketikun/infinite-canvas 为 AGPL-3.0；本项目只做 clean-room 功能研究，不复制代码。

机器可读的完整重排证据位于工作区 `work/infinite-canvas-github-scan.json`，完整融合蓝图位于 `work/infinite-canvas-fusion-blueprint.md`。
