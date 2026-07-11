# Nodefield

一个本地优先、开放格式的无限画布：把笔记、来源、洞察和行动整理成可连接的视觉知识地图。

Nodefield 由 ForgeSkill 对 40 个候选仓库进行发现、重排和许可证核验后融合而成。项目没有复制被研究产品的源码、品牌或素材，运行时底座选择 MIT 许可的 `@xyflow/react`。

## 已实现

- 无限平移与缩放、框选、多选、节点拖动、拖拽连线、小地图和视图控制
- 笔记、来源、洞察、行动四种卡片，以及任务状态、标签和来源 URL
- 桌面侧栏、手机底部检查器、选择/移动模式和响应式工具坞
- 搜索并定位节点、拓扑整理布局、复制、删除、撤销和重做
- 版本化 `localStorage` 自动保存，刷新后恢复节点、连线和视口
- Nodefield 原生 JSON 与 JSON Canvas 1.0 双向导入导出
- 对不可信导入文件做结构、类型、ID、引用和几何校验
- WCAG AA 取向的对比度、键盘焦点、可访问名称和减少动态效果

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

默认开发地址由 Vite 输出。本次验收服务器运行在 [http://127.0.0.1:4173](http://127.0.0.1:4173)。

## 验证

```powershell
npm.cmd test
npm.cmd run build
```

当前验证结果：10 个领域测试通过，TypeScript 严格检查通过，Vite 生产构建通过；Playwright 已覆盖新增、编辑、改类型、搜索定位、撤销/重做、刷新持久化、拖拽连线、JSON Canvas 下载与重新导入，并检查 390px、768px 和 1440px 视口。

## 架构

```text
src/
  components/   画布卡片、工具坞、顶部栏、检查器和反馈
  data/         可恢复的示例画布
  lib/          文档校验、历史辅助、布局、存储和格式适配
  types/        应用拥有的版本化领域模型
tests/          存储、布局和 JSON Canvas 适配测试
```

`BoardDocument` 是持久化边界，React Flow 只是可替换的交互渲染器。JSON Canvas 适配器使用标准字段，并在 `nodefield` 扩展字段中无损保留卡片类型、标签、任务状态和 URL。

## 研究结论

完整对比见 [research.md](docs/research.md)，生成规格见 [blueprint.json](docs/blueprint.json)。核心取舍：

- 借鉴 Excalidraw 的开放文件、本地保存和聚焦工作流。
- 用 xyflow 的 MIT 节点/边与视口能力实现结构化知识图。
- 借鉴 Drawnix 的内容类型和插件边界，但不复制其复杂插件系统。
- 借鉴 AFFiNE 的统一 block/local-first 分层，但不引入其大规模架构。
- 采用 JSON Canvas 作为开放交换格式。
- tldraw、AFFiNE 和 AGPL 项目只做模式研究，不作为源码依赖。

## 许可证

Nodefield 使用 MIT License。依赖与研究项目的许可边界见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
