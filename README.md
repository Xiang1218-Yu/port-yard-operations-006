# HarborGrid · 港口集装箱堆场作业协同与闸口调度系统

React + Vite + TypeScript 前端，Node.js + Express + TypeScript 服务端。面向中型集装箱码头，把船期、箱务、堆场区块、闸口预约、设备作业和异常闭环放在同一套作业控制台中。

## 启动

```bash
npm install
npm run dev
```

前端默认 Vite 端口 5178，API 默认 `http://localhost:4107`。

## 业务能力

- 船舶航次、泊位窗口、计划/已完成翻箱和延误风险
- 箱号、尺寸、冷藏温度、危险品级别、海关状态、进出口/中转流向
- 堆场区块容量、堆存热度、冷藏插座、危险品隔离和设备可达性
- 闸口预约时隙、车道、OCR/称重/封志校验状态与同车冲突检测
- 岸桥、场桥、集卡、正面吊设备池和约束感知任务队列
- 自动堆位推荐、冷藏/危险品约束、海关查验阻塞、任务指派审计
- **查验作业流程状态机**：待查验 → 已预约 → 移入查验位 → 查验中 → 放行 / 扣留，联动场内任务、正面吊指派、堆位变化与闸口提箱预约；支持设备故障重派、查验窗口取消回退、放行消息重复幂等、扣留箱提箱拦截，每次人工覆盖强制记录原因
- React 控制台支持船期驾驶舱、查验作业流程、闸口操作、堆场热区与设备任务操作

## 查验作业流程

调度员只能从「箱务台账 → 查验流程/发起查验」或「查验作业流程」页进入流程，动作由服务端状态机下发，界面不提供任意跳转的状态下拉：

| 状态 | 允许的下一步 |
| --- | --- |
| 待查验 pending | 预约查验窗口、（预）指派正面吊 |
| 已预约 appointed | 移入查验位、重派正面吊、取消窗口回退待查验 |
| 移入查验位 positioned | 开始查验、登记海关放行/扣留 |
| 查验中 inspecting | 登记海关放行/扣留 |
| 放行 released / 扣留 detained | 终态，仅允许带原因的人工覆盖回退 |

边界处理：设备故障上报后关联任务阻塞并可在流程内重派正面吊；窗口取消撤销未执行的移入任务并回退状态；重复放行/扣留消息按消息编号幂等忽略并留痕；扣留箱的提箱预约在创建、签到、完成三个闸口环节都会被拦截并置为异常；人工覆盖只能回退到状态机声明的相邻状态，原因写入流程事件流与审计日志（`INSPECTION_OVERRIDE`）。

主要 API：`GET/POST /api/inspection/flows`、`POST /api/inspection/flows/:id/transitions`（book_window / cancel_window / move_to_bay / start_inspection / reassign）、`POST /api/inspection/flows/:id/override`、`POST /api/containers/:id/customs-message`（release/detain，支持重复消息）、`PATCH /api/equipment/:id/fault|repair`。

当前使用内存种子数据，领域服务通过 REST API 暴露，后续可接入 TOS、OCR、称重、RTG 遥测、预约配额和优化求解器。
