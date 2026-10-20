# NPU 原生支持看板

从 `pytorch-pr-analysis` skill 的 `data/runs/*/*/attempt-*/analysis/final/analysis_*.json` 和对应 `extracted/pr_details_*.json`
生成的静态交互看板。本目录作为独立 dashboards 仓库中的 `pytorch-pr-support/` 发布。

数据优先使用 `data/published/` 正式快照和审计 PASS 的运行；保留现有 `data.js` 已交付的历史来源，显式审计 FAIL 的来源排除。新建预览目录时可用 `--previous-bundle 原看板/data.js` 保留旧数据范围，不纳入尚未通过审计的新运行。

## 更新数据

在 `pytorch-pr-analysis` skill 根目录执行：

```powershell
python scripts/export_dashboard_data.py `
  --data-dir data `
  --output D:\workspace\dashboards\pytorch-pr-support\data.js
```

随后直接打开 `D:\workspace\dashboards\pytorch-pr-support\index.html`。也可以启动本地静态服务：

```powershell
python -m http.server 8080 --directory D:\workspace\dashboards
```

访问 `http://127.0.0.1:8080/pytorch-pr-support/`。

支持状态读取分析记录明确给出的 `support_status`；缺少结论时显示“待确定”。测试通过、失败或跳过不会自动改写支持状态。

功能模块保留现有分析规则的 10 大分类：基础框架·API适配、基础框架·运行时、基础框架·taskqueue、基础框架·Tensor支持、基础框架·DFX、图模式·aclgraph后端、图模式·inductor+triton、分布式·FSDP/Shard/DTensor、分布式·Pipeline/Checkpoint/通信库、社区生态。零记录模块也保留筛选入口。旧的 `基础框架·aclgraph/taskqueue` 分类使用 skill 的 `references/dashboard-module-reviews.json` 逐 PR 复核结果，不整类替换；原始分类仍保存在 `function_module`。

总览增加测试执行状态统计；PR 列表显示状态及通过、失败、错误、跳过、无结果计数。点击 PR 可查看报告原文计数、PR 前后用例结果、完整测试分析、逐用例关联与证据、测试环境及报告链接。报告 Total 与参数化计数可能粒度不同，页面不强行加总。缺结果不冒充通过。历史记录无结构化测试分析时可显示旧失败原因。

后续接数据库时，保持 `data.js` 中的字段结构不变即可复用整个页面。
