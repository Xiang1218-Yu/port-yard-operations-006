import test from 'node:test'; import assert from 'node:assert/strict'; import { containerPlan, dashboard, gateConflicts, prioritizeTasks } from './domain.js';
test('dashboard aggregates berth, yard, gate and exception signals', () => { const data = dashboard(); assert.equal(data.activeVoyages, 2); assert.ok(data.yardUtilization > 0.7); assert.ok(data.blockedTasks >= 1); });
test('gate conflict engine detects same truck overlap', () => { const conflicts = gateConflicts(); assert.ok(conflicts.some(item => item.appointmentId === 'APT-9001' || item.appointmentId === 'APT-9004')); });
test('yard planner respects reefer and hazmat constraints', () => { const plan = containerPlan('TGHU-9831204'); assert.equal(plan?.recommendedBlock?.hazmatAllowed, true); assert.ok(plan?.reasons.some(reason => reason.includes('危险品'))); });
test('priority queue promotes customs inspection work', () => { const tasks = prioritizeTasks(); assert.equal(tasks[0].containerId, 'TGHU-9831204'); });

test('container create, update and delete form a complete audited CRUD cycle', async () => {
  const { createContainer, updateContainer, deleteContainer, containers } = await import('./domain.js');
  const created = createContainer({ id: 'TEST-CRUD-0001', voyageId: 'VOY-AX7', size: '20', isoType: '22G1', direction: 'import', status: 'in-yard', weightT: 10, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R11-T1' });
  assert.equal(created.id, 'TEST-CRUD-0001');
  assert.equal(updateContainer(created.id, { weightT: 12 })?.weightT, 12);
  assert.equal(deleteContainer(created.id)?.id, 'TEST-CRUD-0001');
  assert.equal(containers.some(item => item.id === 'TEST-CRUD-0001'), false);
});

test('appointment and task domain operations support create, update and delete', async () => {
  const { createGateAppointment, editGateAppointment, deleteGateAppointment, createYardTask, updateYardTask, deleteYardTask } = await import('./domain.js');
  const appointment = createGateAppointment({ containerId: 'MSCU-4829017', truckNo: 'TEST-CRUD-01', driver: '测试司机', type: 'pickup', windowStart: new Date(Date.now()+3600000).toISOString(), windowEnd: new Date(Date.now()+7200000).toISOString(), lane: 'north' });
  assert.equal(editGateAppointment(appointment.id, { driver: '更新司机' })?.driver, '更新司机');
  assert.equal(deleteGateAppointment(appointment.id)?.id, appointment.id);
  const task = createYardTask({ kind: 'deliver', containerId: 'MSCU-4829017', from: 'A01-R01-T1', to: '南闸口', priority: 40, scheduledAt: new Date().toISOString(), estimatedMinutes: 12 });
  assert.equal(updateYardTask(task.id, { to: '北闸口' })?.to, '北闸口');
  assert.equal(deleteYardTask(task.id)?.id, task.id);
});

const soon = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();

test('inspection state machine drives the full pending to released loop with linked entities', async () => {
  const { startInspectionFlow, transitionFlow, receiveCustomsMessage, containers, inspectionFlowDetail, equipment } = await import('./domain.js');
  const created = startInspectionFlow({ containerId: 'MSCU-4829017', reason: '测试布控' });
  assert.equal(created.state, 'pending');
  assert.equal(containers.find(c => c.id === 'MSCU-4829017')?.customs, 'inspection');
  assert.throws(() => startInspectionFlow({ containerId: 'MSCU-4829017' }), /已存在查验流程/);

  assert.throws(() => transitionFlow(created.id, { action: 'book_window', windowStart: soon(10), windowEnd: soon(5), bay: 'D05-BAY-01', officer: '海关测试' }), /时间/);
  const appointed = transitionFlow(created.id, { action: 'book_window', windowStart: soon(10), windowEnd: soon(40), bay: 'D05-BAY-01', officer: '海关测试' });
  assert.equal(appointed.state, 'appointed');
  assert.ok(appointed.linkedTask, '预约窗口应联动生成场内移入任务');
  assert.throws(() => transitionFlow(created.id, { action: 'move_to_bay' }), /尚未指派正面吊/);

  const withMachine = transitionFlow(created.id, { action: 'reassign', equipmentId: 'RS-05' });
  assert.equal(withMachine.equipment?.id, 'RS-05');
  const positioned = transitionFlow(created.id, { action: 'move_to_bay' });
  assert.equal(positioned.state, 'positioned');
  assert.equal(positioned.container.yardSlot, 'D05-BAY-01');
  assert.equal(positioned.linkedTask?.status, 'done');
  assert.equal(equipment.find(e => e.id === 'RS-05')?.status, 'working');

  const inspecting = transitionFlow(created.id, { action: 'start_inspection' });
  assert.equal(inspecting.state, 'inspecting');
  const released = receiveCustomsMessage('MSCU-4829017', { decision: 'release', messageId: 'MSG-REL-1' });
  assert.equal(released.flow.state, 'released');
  assert.equal(released.duplicate, false);
  assert.ok(released.flow.history.some(event => event.action === 'RETURN_TO_YARD' && /出场任务/.test(event.details)), '放行应联动出场任务');

  const duplicate = receiveCustomsMessage('MSCU-4829017', { decision: 'release', messageId: 'MSG-REL-1-REDROP' });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.flow.state, 'released');
  assert.ok(duplicate.flow.history[0].duplicate, '重复放行消息必须留痕而不是再次执行联动');

  assert.equal(inspectionFlowDetail(created.id)?.availableActions.length, 0, '终态不能再直接推进');
});

test('equipment fault blocks the inspection task and reassignment restarts the loop; window cancel rolls back', async () => {
  const { inspectionFlowDetail, reportEquipmentFault, transitionFlow, tasks } = await import('./domain.js');
  const flow = inspectionFlowDetail('INS-2001')!;
  assert.equal(flow.state, 'pending');
  assert.equal(flow.equipment?.status, 'maintenance');
  assert.equal(flow.linkedTask?.status, 'blocked');

  reportEquipmentFault('RS-05', '测试突发故障');
  const blocked = inspectionFlowDetail('INS-2002')!;
  assert.equal(blocked.state, 'appointed');
  assert.equal(blocked.linkedTask?.status, 'blocked');
  assert.throws(() => transitionFlow(blocked.id, { action: 'move_to_bay' }), /维护中/);
  assert.ok(blocked.availableActions.find(a => a.action === 'move_to_bay')?.disabledReason, '下一步动作应明确给出不可用原因');

  // 修复 RS-05 后流程可恢复（也验证了重派路径之外的恢复能力）
  const { repairEquipment } = await import('./domain.js');
  repairEquipment('RS-05');
  assert.equal(tasks.find(t => t.id === blocked.linkedTask?.id)?.status, 'assigned');

  const moved = transitionFlow(blocked.id, { action: 'move_to_bay' });
  assert.equal(moved.state, 'positioned');
  // 窗口取消回退（另一条 appointed 流程）：用 TGHU 重新预约后取消
  const pendingFlow = inspectionFlowDetail('INS-2001')!;
  transitionFlow(pendingFlow.id, { action: 'reassign', equipmentId: 'RS-05', reason: 'RS-02 长期维护，改派 RS-05' });
  const booked = transitionFlow(pendingFlow.id, { action: 'book_window', windowStart: soon(60), windowEnd: soon(90), bay: 'D05-BAY-02', officer: '海关测试' });
  const taskIdBeforeCancel = booked.linkedTask?.id;
  assert.throws(() => transitionFlow(pendingFlow.id, { action: 'cancel_window' }), /原因/);
  const rolledBack = transitionFlow(pendingFlow.id, { action: 'cancel_window', reason: '海关临时取消查验窗口' });
  assert.equal(rolledBack.state, 'pending');
  assert.equal(rolledBack.windows[0].status, 'cancelled');
  assert.equal(tasks.some(t => t.id === taskIdBeforeCancel), false, '取消窗口应撤销未执行的移入任务');
  assert.equal(rolledBack.equipment?.id, 'RS-05', '取消窗口后设备指派保留，便于快速重约');
});

test('detained container pickup attempts are blocked at the gate, and every override keeps its reason', async () => {
  const { createGateAppointment, editGateAppointment, overrideFlowState, inspectionFlowDetail, receiveCustomsMessage } = await import('./domain.js');
  assert.throws(() => createGateAppointment({ containerId: 'MSKU-5501288', truckNo: '测B-0001', driver: '尝试提箱', type: 'pickup', windowStart: soon(5), windowEnd: soon(35), lane: 'north' }), /扣留/);
  // 已存在的 booked 提箱预约（如放行前就存在）签到时同样拦截并转为异常
  const flow = inspectionFlowDetail('INS-2003')!;
  assert.equal(flow.state, 'detained');
  assert.equal(flow.appointment?.status, 'exception');
  assert.throws(() => editGateAppointment(flow.appointment!.id, { status: 'checked-in' }), /扣留/);

  // 无原因覆盖一律拒绝；合法回退留痕并恢复海关状态
  assert.throws(() => overrideFlowState(flow.id, { target: 'pending', reason: '   ' }), /原因/);
  const reopened = overrideFlowState(flow.id, { target: 'pending', reason: '缉私核查无异常，海关要求退箱重查' });
  assert.equal(reopened.state, 'pending');
  assert.equal(reopened.container.customs, 'inspection');
  const overrideEvent = reopened.history.find(event => event.override);
  assert.ok(overrideEvent, '人工覆盖必须写入 override 事件');
  assert.match(overrideEvent!.reason!, /缉私核查/);
  // 二次查验后放行幂等仍然成立
  const released = receiveCustomsMessage('MSKU-5501288', { decision: 'release', messageId: 'MSG-REL-2' });
  assert.equal(released.flow.state, 'released');
});
