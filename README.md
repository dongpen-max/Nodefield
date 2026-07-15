# Nodefield

一个本地优先、开放格式的无限画布：把笔记、来源、洞察和行动整理成可连接的视觉知识地图。

Nodefield 由 ForgeSkill 对 40 个候选仓库进行发现、重排和许可证核验后融合而成。项目没有复制被研究产品的源码、品牌或素材，运行时底座选择 MIT 许可的 `@xyflow/react`。

当前版本为 V0.4。

## 已实现

- 无限平移与缩放、框选、多选、节点拖动、拖拽连线、小地图和视图控制
- 笔记、来源、洞察、行动四种卡片，以及任务状态、标签和来源 URL
- 桌面侧栏、手机底部检查器、选择/移动模式和响应式工具坞
- 搜索并定位节点、拓扑整理布局、复制、删除、撤销和重做
- 多画布新建、切换、重命名和删除，活动画布在刷新后恢复
- 原生 IndexedDB 版本化存储，并自动迁移 V0.1 的 `localStorage` 画布
- 全工作区备份与原子恢复；归档在替换前完整校验，损坏文件不会改动现有数据
- 文件菜单显示容量、最近保存和最近备份状态，并用单写者锁防止多标签页互相覆盖
- 大画布按视口渲染可见图元，自动保存延后整图快照并避免扫描全部非活动画布
- 空画布提供首张笔记引导，菜单支持 Escape/点外关闭，移动端连线触控区扩大
- 关系标签、路径与方向编辑，以及多选节点的统一类型、批量复制和删除
- Nodefield 原生 JSON 与 JSON Canvas 1.0 双向导入导出
- JSON Canvas 的 `nodefield` 扩展无损保留卡片语义和关系路径
- 可安装 PWA；首次在线加载后可离线打开、编辑并继续写入 IndexedDB
- 对不可信导入文件做结构、类型、ID、引用和几何校验
- WCAG AA 取向的对比度、键盘焦点、可访问名称和减少动态效果

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

默认开发地址由 Vite 输出。自动化 E2E 会先构建生产版本，再在 `http://127.0.0.1:4173` 启动独立预览服务。

为避免多个标签页同时写入同一 IndexedDB 工作区，Nodefield 需要支持 Web Locks 的现代浏览器；第二个标签页会等待当前写入页关闭后自动接管。

## 验证

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

当前验证结果：30 个领域测试和 21 个 Playwright E2E 测试通过，TypeScript 严格检查与 Vite/PWA 生产构建通过。浏览器测试覆盖多画布隔离与持久化、V0.1 存储迁移、工作区备份恢复、损坏归档保护、单写者接管、Web Locks 兼容性阻断、离线刷新与编辑、大画布性能、空画布引导、菜单关闭、移动触控、边属性、批量操作、撤销重做和降级存储提示，并从 `390x844`、`768x1024`、`1280x800` 和 `1440x900` 独立启动验收。

600 节点浏览器基准中，稳定状态的画布节点 DOM 从 600 个降到 25 个；选择交互阶段不再复制整张节点数组，普通自动保存也不再读取并解析全部画布。移动端选中卡片的连线命中区保持至少 `40x40` CSS 像素。

## 架构

```text
src/
  components/   画布卡片、空状态、画布管理、工具坞、顶部栏、存储状态、检查器和反馈
  data/         可恢复的示例画布
  lib/          文档校验、历史辅助、布局、IndexedDB 存储、工作区归档和格式适配
  types/        应用拥有的版本化领域模型
tests/          存储、布局和 JSON Canvas 适配测试
e2e/            Playwright 真实浏览器工作流与响应式验收
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
