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

const future = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();

test('inspection workflow drives full happy path with yard, task and customs linkage', async () => {
  const m = await import('./domain.js');
  m.createContainer({ id: 'TEST-INS-0001', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'import', status: 'in-yard', weightT: 20, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R12-T1' });
  const opened = m.openInspectionCase('TEST-INS-0001', '测试布控');
  const container = () => m.containers.find(item => item.id === 'TEST-INS-0001')!;
  assert.equal(opened.status, 'pending');
  assert.equal(container().customs, 'inspection');
  m.runInspectionAction(opened.id, 'book', { windowStart: future(30), windowEnd: future(120) });
  const dispatched = m.runInspectionAction(opened.id, 'dispatch', { equipmentId: 'RS-04' })!;
  assert.equal(dispatched.view.status, 'booked');
  assert.ok(dispatched.view.moveTask && dispatched.view.baySlot?.startsWith('D05'));
  m.runInspectionAction(opened.id, 'arrive', {});
  assert.equal(container().yardSlot, dispatched.view.baySlot);
  m.runInspectionAction(opened.id, 'start', {});
  const released = m.runInspectionAction(opened.id, 'release', { messageId: 'MSG-HAPPY-1' })!;
  assert.equal(released.duplicate, false);
  assert.equal(released.view.status, 'released');
  assert.equal(container().customs, 'released');
  assert.notEqual(container().yardSlot, dispatched.view.baySlot);
  assert.ok(m.tasks.some(task => task.kind === 'rehandle' && task.containerId === 'TEST-INS-0001'));
});

test('duplicate customs release messages are idempotent', async () => {
  const m = await import('./domain.js');
  m.createContainer({ id: 'TEST-INS-0002', voyageId: 'VOY-AX7', size: '20', isoType: '22G1', direction: 'import', status: 'in-yard', weightT: 12, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R12-T2' });
  const opened = m.openInspectionCase('TEST-INS-0002');
  m.runInspectionAction(opened.id, 'book', { windowStart: future(30), windowEnd: future(90) });
  m.runInspectionAction(opened.id, 'dispatch', { equipmentId: 'RS-04' });
  m.runInspectionAction(opened.id, 'arrive', {});
  m.runInspectionAction(opened.id, 'start', {});
  const first = m.runInspectionAction(opened.id, 'release', { messageId: 'MSG-DUP-1' })!;
  assert.equal(first.duplicate, false);
  const eventCount = first.view.events.length;
  const sameAgain = m.runInspectionAction(opened.id, 'release', { messageId: 'MSG-DUP-1' })!;
  assert.equal(sameAgain.duplicate, true);
  assert.equal(sameAgain.view.events.length, eventCount);
  const otherMessage = m.runInspectionAction(opened.id, 'release', { messageId: 'MSG-DUP-2' })!;
  assert.equal(otherMessage.duplicate, true);
  assert.equal(otherMessage.view.events.filter(event => event.action === 'release').length, 1);
  assert.equal(otherMessage.view.events.at(-1)?.action, 'release-duplicate');
  assert.equal(m.containers.find(item => item.id === 'TEST-INS-0002')?.customs, 'released');
});

test('equipment failure blocks the move task and reassign recovers the flow', async () => {
  const m = await import('./domain.js');
  m.createContainer({ id: 'TEST-INS-0003', voyageId: 'VOY-AX7', size: '20', isoType: '22G1', direction: 'import', status: 'in-yard', weightT: 11, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R12-T3' });
  const opened = m.openInspectionCase('TEST-INS-0003');
  m.runInspectionAction(opened.id, 'book', { windowStart: future(30), windowEnd: future(90) });
  const faulty = m.runInspectionAction(opened.id, 'dispatch', { equipmentId: 'RS-02' })!;
  assert.equal(faulty.view.moveTask?.status, 'blocked');
  assert.equal(faulty.view.equipmentFaulty, true);
  assert.ok(faulty.view.nextActions.some(action => action.action === 'reassign-equipment' && action.tone === 'primary'));
  assert.throws(() => m.runInspectionAction(opened.id, 'arrive', {}), /阻塞/);
  const recovered = m.runInspectionAction(opened.id, 'reassign-equipment', { equipmentId: 'RS-04' })!;
  assert.equal(recovered.view.moveTask?.status, 'assigned');
  assert.equal(recovered.view.equipmentFaulty, false);
  const arrived = m.runInspectionAction(opened.id, 'arrive', {})!;
  assert.equal(arrived.view.status, 'positioned');
});

test('cancelled inspection window rolls the flow and the container back', async () => {
  const m = await import('./domain.js');
  const container = () => m.containers.find(item => item.id === 'TEST-INS-0003')!;
  const item = m.inspectionCases.find(entry => entry.containerId === 'TEST-INS-0003')!;
  assert.equal(container().yardSlot.startsWith('D05'), true);
  const rolled = m.runInspectionAction(item.id, 'cancel-window', { note: '海关取消本场查验窗口' })!;
  assert.equal(rolled.view.status, 'pending');
  assert.equal(rolled.view.moveTaskId, undefined);
  assert.equal(container().yardSlot, 'C03-R12-T3');
  assert.ok(m.tasks.some(task => task.kind === 'rehandle' && task.containerId === 'TEST-INS-0003' && task.to === 'C03-R12-T3'));
});

test('detained container suspends existing pickup and rejects new pickup booking', async () => {
  const m = await import('./domain.js');
  m.createContainer({ id: 'TEST-INS-0004', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'import', status: 'in-yard', weightT: 18, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R12-T4' });
  const appointment = m.createGateAppointment({ containerId: 'TEST-INS-0004', truckNo: 'TEST-HOLD-01', driver: '测试司机', type: 'pickup', windowStart: future(60), windowEnd: future(120), lane: 'north' });
  const opened = m.openInspectionCase('TEST-INS-0004');
  m.runInspectionAction(opened.id, 'book', { windowStart: future(30), windowEnd: future(90) });
  m.runInspectionAction(opened.id, 'dispatch', { equipmentId: 'RS-04' });
  m.runInspectionAction(opened.id, 'arrive', {});
  m.runInspectionAction(opened.id, 'start', {});
  assert.throws(() => m.runInspectionAction(opened.id, 'detain', { reason: '短' }), /原因/);
  const detained = m.runInspectionAction(opened.id, 'detain', { reason: '查验发现申报品名不符' })!;
  assert.equal(detained.view.status, 'detained');
  const container = m.containers.find(item => item.id === 'TEST-INS-0004')!;
  assert.equal(container.customs, 'hold');
  assert.equal(container.status, 'hold');
  assert.equal(m.appointments.find(item => item.id === appointment.id)?.status, 'exception');
  assert.throws(() => m.createGateAppointment({ containerId: 'TEST-INS-0004', truckNo: 'TEST-HOLD-02', driver: '测试司机', type: 'pickup', windowStart: future(60), windowEnd: future(120), lane: 'south' }), /扣留/);
});

test('manual override requires a reason and is recorded on the case', async () => {
  const m = await import('./domain.js');
  m.createContainer({ id: 'TEST-INS-0005', voyageId: 'VOY-AX7', size: '20', isoType: '22G1', direction: 'import', status: 'in-yard', weightT: 9.5, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R12-T5' });
  const opened = m.openInspectionCase('TEST-INS-0005');
  m.runInspectionAction(opened.id, 'book', { windowStart: future(30), windowEnd: future(90) });
  m.runInspectionAction(opened.id, 'dispatch', { equipmentId: 'RS-04' });
  m.runInspectionAction(opened.id, 'arrive', {});
  m.runInspectionAction(opened.id, 'start', {});
  assert.throws(() => m.runInspectionAction(opened.id, 'override', { toStatus: 'released', reason: '' }), /原因/);
  const overridden = m.runInspectionAction(opened.id, 'override', { toStatus: 'released', reason: '海关纸质放行单已现场核验' })!;
  assert.equal(overridden.view.status, 'released');
  assert.equal(overridden.view.overrides.length, 1);
  assert.equal(overridden.view.overrides[0].reason, '海关纸质放行单已现场核验');
  assert.equal(m.containers.find(item => item.id === 'TEST-INS-0005')?.customs, 'released');
  assert.throws(() => m.runInspectionAction(opened.id, 'override', { toStatus: 'pending', reason: '尝试覆盖已闭环流程' }), /闭环/);
});

test('invalid transitions, duplicate cases and ledger shortcuts are rejected', async () => {
  const m = await import('./domain.js');
  const pending = m.inspectionCases.find(entry => entry.containerId === 'TEST-INS-0003')!;
  assert.throws(() => m.runInspectionAction(pending.id, 'release', { messageId: 'MSG-X' }), /不能登记放行/);
  assert.throws(() => m.runInspectionAction(pending.id, 'arrive', {}), /不能确认到位/);
  assert.throws(() => m.openInspectionCase('TEST-INS-0003'), /已存在/);
  assert.throws(() => m.updateContainer('TEST-INS-0003', { customs: 'released' }), /查验流程/);
  assert.equal(m.containers.find(item => item.id === 'TEST-INS-0003')?.customs, 'inspection');
});

test('completing the linked yard task auto-advances the inspection flow', async () => {
  const m = await import('./domain.js');
  m.createContainer({ id: 'TEST-INS-0006', voyageId: 'VOY-AX7', size: '20', isoType: '22G1', direction: 'import', status: 'in-yard', weightT: 10, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R12-T6' });
  const opened = m.openInspectionCase('TEST-INS-0006');
  m.runInspectionAction(opened.id, 'book', { windowStart: future(30), windowEnd: future(90) });
  const dispatched = m.runInspectionAction(opened.id, 'dispatch', { equipmentId: 'RS-04' })!;
  m.updateYardTask(dispatched.view.moveTask!.id, { status: 'done' });
  const view = m.getInspectionView(opened.id)!;
  assert.equal(view.status, 'positioned');
  assert.equal(m.containers.find(item => item.id === 'TEST-INS-0006')?.yardSlot, view.baySlot);
});

test('reassigning seeded faulty equipment clears stale short-id blocking reasons', async () => {
  const m = await import('./domain.js');
  const before = m.getInspectionView('INS-301')!;
  assert.equal(before.equipmentFaulty, true);
  assert.equal(before.moveTask?.status, 'blocked');
  const after = m.runInspectionAction('INS-301', 'reassign-equipment', { equipmentId: 'RS-04' })!;
  assert.equal(after.view.moveTask?.status, 'assigned');
  assert.equal(after.view.moveTask?.blockingReasons.length, 0);
  assert.equal(after.view.equipmentFaulty, false);
});
