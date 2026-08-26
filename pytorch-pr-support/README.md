# NPU 原生支持看板

从 `pytorch-pr-analysis` skill 的 `data/analysis_*.json` 和 `data/pr_details_*.json`
生成的静态交互看板。本目录作为独立 dashboards 仓库中的 `pytorch-pr-support/` 发布。

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

当前四类状态只根据 NPU 验证历史计算：首次运行成功为原生支持，最新运行失败为原生不支持，失败后使用不同 torch-npu SHA 运行成功为修改后支持，没有 NPU 结果为待确定。功能模块统一为 `Core and API`、`分布式`、`图模式`、`社区生态` 四类。

后续接数据库时，保持 `data.js` 中的字段结构不变即可复用整个页面。
