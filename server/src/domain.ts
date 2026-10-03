export type ContainerStatus = 'in-transit' | 'at-gate' | 'in-yard' | 'on-quay' | 'released' | 'hold';
export type EquipmentKind = 'quay-crane' | 'yard-crane' | 'terminal-truck' | 'reach-stacker';
export type TaskStatus = 'queued' | 'assigned' | 'executing' | 'blocked' | 'done';
export type AppointmentStatus = 'booked' | 'checked-in' | 'completed' | 'cancelled' | 'exception';

export interface Voyage { id: string; vessel: string; imo: string; service: string; eta: string; etd: string; status: 'approaching' | 'berthed' | 'loading' | 'departed'; berth: string; movesPlanned: number; movesDone: number; lateRisk: 'low' | 'medium' | 'high'; }
export interface Container { id: string; voyageId: string; size: '20' | '40' | '45'; isoType: string; direction: 'import' | 'export' | 'transshipment'; status: ContainerStatus; weightT: number; reefer: boolean; temperature?: number; hazmatClass?: string; customs: 'released' | 'inspection' | 'hold'; priority: 'normal' | 'hot' | 'reefer' | 'hazmat'; yardSlot: string; appointmentId?: string; lastEvent: string; }
export interface YardBlock { id: string; zone: string; rows: number; tiers: number; capacity: number; occupied: number; reeferPlugs: number; usedPlugs: number; hazmatAllowed: boolean; equipment: EquipmentKind[]; heat: number; }
export interface GateAppointment { id: string; containerId: string; truckNo: string; driver: string; type: 'pickup' | 'dropoff'; windowStart: string; windowEnd: string; lane: 'north' | 'south' | 'rail'; status: AppointmentStatus; sealVerified: boolean; weightVerified: boolean; exception?: string; }
export interface Equipment { id: string; name: string; kind: EquipmentKind; status: 'available' | 'working' | 'maintenance' | 'offline'; location: string; battery: number; queue: number; movesPerHour: number; }
export interface YardTask { id: string; kind: 'receive' | 'deliver' | 'rehandle' | 'load' | 'discharge' | 'inspect'; containerId: string; from: string; to: string; equipmentId?: string; priority: number; status: TaskStatus; scheduledAt: string; blockingReasons: string[]; estimatedMinutes: number; }
export interface AuditEvent { id: string; actor: string; action: string; entity: string; entityId: string; at: string; details: string; }

// 查验作业流程：待查验 → 已预约 → 移入查验位 → 查验中 → 放行 / 扣留
export type InspectionState = 'pending' | 'appointed' | 'positioned' | 'inspecting' | 'released' | 'detained';
export type InspectionAction = 'CREATE' | 'BOOK_WINDOW' | 'CANCEL_WINDOW' | 'MOVE_TO_BAY' | 'START_INSPECTION' | 'RELEASE' | 'DETAIN' | 'REASSIGN' | 'EQUIPMENT_FAULT' | 'REPAIR' | 'RETURN_TO_YARD' | 'OVERRIDE';
export type WindowStatus = 'active' | 'cancelled' | 'closed';
export interface InspectionWindow { start: string; end: string; bay: string; officer: string; status: WindowStatus; cancelReason?: string; }
export interface InspectionEvent { id: string; at: string; actor: string; action: InspectionAction; from: InspectionState | '-'; to: InspectionState; reason?: string; override: boolean; duplicate?: boolean; messageId?: string; details: string; }
export interface InspectionFlow { id: string; containerId: string; round: number; state: InspectionState; originSlot: string; currentBay?: string; windows: InspectionWindow[]; taskId?: string; equipmentId?: string; releaseMessageId?: string; detainReason?: string; updatedAt: string; history: InspectionEvent[]; }
export interface FlowActionDescriptor { action: 'book_window' | 'cancel_window' | 'move_to_bay' | 'start_inspection' | 'release' | 'detain' | 'reassign'; label: string; kind: 'operate' | 'customs' | 'danger' | 'device'; requires?: Array<'window' | 'reason' | 'equipment' | 'messageId'>; disabledReason?: string; }
export interface FlowOverrideDescriptor { target: InspectionState; label: string; reasonRequired: true; }
export interface InspectionFlowView extends InspectionFlow { stateLabel: string; container: Container; linkedTask: YardTask | undefined; equipment: Equipment | undefined; appointment: GateAppointment | undefined; availableActions: FlowActionDescriptor[]; availableOverrides: FlowOverrideDescriptor[]; }

const start = Date.now(); const iso = (minutes: number) => new Date(start + minutes * 60000).toISOString();
export const voyages: Voyage[] = [
  { id: 'VOY-AX7', vessel: 'MSC Aurora', imo: 'IMO9382014', service: 'AE-3', eta: iso(-90), etd: iso(350), status: 'berthed', berth: 'B07', movesPlanned: 1240, movesDone: 886, lateRisk: 'medium' },
  { id: 'VOY-QF2', vessel: 'Ever Quartz', imo: 'IMO9721103', service: 'TP9', eta: iso(190), etd: iso(890), status: 'approaching', berth: 'B04', movesPlanned: 760, movesDone: 0, lateRisk: 'high' },
  { id: 'VOY-RD8', vessel: 'ONE Redwood', imo: 'IMO9812340', service: 'PNW', eta: iso(-700), etd: iso(-330), status: 'departed', berth: 'B02', movesPlanned: 520, movesDone: 520, lateRisk: 'low' }
];
export const blocks: YardBlock[] = [
  { id: 'A01', zone: 'North Import', rows: 14, tiers: 5, capacity: 280, occupied: 247, reeferPlugs: 18, usedPlugs: 16, hazmatAllowed: false, equipment: ['yard-crane', 'terminal-truck'], heat: 78 },
  { id: 'B07', zone: 'Central Transshipment', rows: 18, tiers: 5, capacity: 360, occupied: 302, reeferPlugs: 24, usedPlugs: 19, hazmatAllowed: true, equipment: ['yard-crane', 'reach-stacker', 'terminal-truck'], heat: 91 },
  { id: 'C03', zone: 'Export Pre-staging', rows: 12, tiers: 4, capacity: 192, occupied: 128, reeferPlugs: 8, usedPlugs: 3, hazmatAllowed: false, equipment: ['yard-crane', 'terminal-truck'], heat: 54 },
  { id: 'D05', zone: 'Inspection & Hold', rows: 8, tiers: 3, capacity: 96, occupied: 73, reeferPlugs: 5, usedPlugs: 4, hazmatAllowed: true, equipment: ['reach-stacker'], heat: 63 }
];
export const containers: Container[] = [
  { id: 'MSCU-4829017', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'import', status: 'in-yard', weightT: 22.4, reefer: false, customs: 'released', priority: 'hot', yardSlot: 'A01-R07-T3', lastEvent: '卸船完成 08:42' },
  { id: 'EISU-1288420', voyageId: 'VOY-AX7', size: '40', isoType: '45R1', direction: 'import', status: 'in-yard', weightT: 27.8, reefer: true, temperature: -18, customs: 'released', priority: 'reefer', yardSlot: 'B07-R03-T2', lastEvent: '温度回传正常 08:51' },
  { id: 'TGHU-9831204', voyageId: 'VOY-AX7', size: '20', isoType: '22K2', direction: 'transshipment', status: 'hold', weightT: 19.7, reefer: false, hazmatClass: '3', customs: 'inspection', priority: 'hazmat', yardSlot: 'D05-R02-T1', lastEvent: '海关查验挂起' },
  { id: 'OOLU-7734201', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'export', status: 'at-gate', weightT: 24.1, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R06-T1', appointmentId: 'APT-9001', lastEvent: '南闸口已称重' },
  { id: 'CMAU-6001722', voyageId: 'VOY-QF2', size: '40', isoType: '45G1', direction: 'import', status: 'in-transit', weightT: 23.5, reefer: false, customs: 'released', priority: 'hot', yardSlot: 'B07-R10-T1', lastEvent: '船期 ETA +35min' },
  { id: 'FCIU-9920310', voyageId: 'VOY-QF2', size: '20', isoType: '22G1', direction: 'export', status: 'in-yard', weightT: 12.2, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R04-T2', lastEvent: '待装船' },
  { id: 'TEMU-1774029', voyageId: 'VOY-AX7', size: '40', isoType: '45R1', direction: 'import', status: 'in-yard', weightT: 26.3, reefer: true, temperature: 4, customs: 'inspection', priority: 'reefer', yardSlot: 'D05-R05-T1', lastEvent: '待海关查验' },
  { id: 'MSKU-5501288', voyageId: 'VOY-AX7', size: '20', isoType: '22G1', direction: 'import', status: 'hold', weightT: 17.9, reefer: false, customs: 'hold', priority: 'normal', yardSlot: 'D05-R06-T1', appointmentId: 'APT-9005', lastEvent: '海关扣留，禁止提箱' }
];
export const appointments: GateAppointment[] = [
  { id: 'APT-9001', containerId: 'OOLU-7734201', truckNo: '沪A·7K229', driver: '陈海', type: 'dropoff', windowStart: iso(-14), windowEnd: iso(16), lane: 'south', status: 'checked-in', sealVerified: true, weightVerified: true },
  { id: 'APT-9002', containerId: 'MSCU-4829017', truckNo: '苏E·66218', driver: '王建国', type: 'pickup', windowStart: iso(34), windowEnd: iso(64), lane: 'north', status: 'booked', sealVerified: false, weightVerified: false },
  { id: 'APT-9003', containerId: 'EISU-1288420', truckNo: '沪B·02891', driver: '赵晨', type: 'pickup', windowStart: iso(38), windowEnd: iso(68), lane: 'north', status: 'booked', sealVerified: false, weightVerified: false },
  { id: 'APT-9004', containerId: 'FCIU-9920310', truckNo: '沪A·7K229', driver: '陈海', type: 'pickup', windowStart: iso(4), windowEnd: iso(22), lane: 'south', status: 'booked', sealVerified: false, weightVerified: false, exception: '同一车辆相邻窗口过短' },
  { id: 'APT-9005', containerId: 'MSKU-5501288', truckNo: '浙A·9D170', driver: '林涛', type: 'pickup', windowStart: iso(-20), windowEnd: iso(10), lane: 'north', status: 'exception', sealVerified: false, weightVerified: false, exception: '箱号海关扣留，闸口已拦截提箱尝试' }
];
export const equipment: Equipment[] = [
  { id: 'QC-07', name: '岸桥 QC-07', kind: 'quay-crane', status: 'working', location: 'B07 / MSC Aurora', battery: 96, queue: 4, movesPerHour: 31 },
  { id: 'YC-12', name: '场桥 YC-12', kind: 'yard-crane', status: 'working', location: 'B07-R03', battery: 72, queue: 9, movesPerHour: 24 },
  { id: 'YC-05', name: '场桥 YC-05', kind: 'yard-crane', status: 'available', location: 'C03-R06', battery: 88, queue: 3, movesPerHour: 27 },
  { id: 'TT-31', name: '集卡 TT-31', kind: 'terminal-truck', status: 'working', location: '南闸口', battery: 61, queue: 2, movesPerHour: 8 },
  { id: 'RS-02', name: '正面吊 RS-02', kind: 'reach-stacker', status: 'maintenance', location: 'D05', battery: 34, queue: 0, movesPerHour: 14 },
  { id: 'RS-05', name: '正面吊 RS-05', kind: 'reach-stacker', status: 'available', location: 'D05 待命位', battery: 82, queue: 0, movesPerHour: 16 }
];
export const tasks: YardTask[] = [
  { id: 'TASK-101', kind: 'deliver', containerId: 'MSCU-4829017', from: 'A01-R07-T3', to: '南闸口', equipmentId: 'YC-12', priority: 92, status: 'assigned', scheduledAt: iso(12), blockingReasons: [], estimatedMinutes: 18 },
  { id: 'TASK-102', kind: 'rehandle', containerId: 'EISU-1288420', from: 'B07-R03-T2', to: 'D05-R05-T1', equipmentId: 'YC-12', priority: 88, status: 'queued', scheduledAt: iso(24), blockingReasons: ['查验区插件余量接近阈值'], estimatedMinutes: 26 },
  { id: 'TASK-103', kind: 'inspect', containerId: 'TGHU-9831204', from: 'D05-R02-T1', to: 'D05-BAY-02', equipmentId: 'RS-02', priority: 135, status: 'blocked', scheduledAt: iso(4), blockingReasons: ['RS-02 维护中，等待重派正面吊', '待海关查验窗口'], estimatedMinutes: 32 },
  { id: 'TASK-104', kind: 'load', containerId: 'FCIU-9920310', from: 'C03-R04-T2', to: 'B07 / VOY-QF2', equipmentId: 'YC-05', priority: 75, status: 'queued', scheduledAt: iso(76), blockingReasons: [], estimatedMinutes: 21 },
  { id: 'TASK-105', kind: 'inspect', containerId: 'TEMU-1774029', from: 'D05-R05-T1', to: 'D05-BAY-01', equipmentId: 'RS-05', priority: 100, status: 'assigned', scheduledAt: iso(30), blockingReasons: [], estimatedMinutes: 28 }
];
export const auditEvents: AuditEvent[] = [{ id: 'AUD-500', actor: '中控调度员', action: 'REPLAN', entity: 'voyage', entityId: 'VOY-AX7', at: new Date(start - 20 * 60000).toISOString(), details: '因 QC-07 瞬时降速，重新计算 14 个高优先级作业' }];

const seedFlowEvents = (rows: Array<[number, string, InspectionAction, InspectionState | '-', InspectionState, string, boolean, string?]>): InspectionEvent[] =>
  rows.map(([minutes, actor, action, from, toState, details, override, reason], index) => ({ id: `IEV-${index + 1}`, at: iso(minutes), actor, action, from, to: toState, override, details, ...(reason ? { reason } : {}) }));

export const inspectionFlows: InspectionFlow[] = [
  {
    id: 'INS-2001', containerId: 'TGHU-9831204', round: 1, state: 'pending', originSlot: 'D05-R02-T1',
    windows: [], taskId: 'TASK-103', equipmentId: 'RS-02', updatedAt: iso(2),
    history: seedFlowEvents([
      [-160, '海关布控', 'CREATE', '-', 'pending', '危险品 3 类，命中随机查验布控，生成查验流程', false],
      [2, '中控调度员', 'EQUIPMENT_FAULT', 'pending', 'pending', '正面吊 RS-02 吊具液压报警进入维护，TASK-103 阻塞，等待重派', false]
    ])
  },
  {
    id: 'INS-2002', containerId: 'TEMU-1774029', round: 1, state: 'appointed', originSlot: 'D05-R05-T1',
    windows: [{ start: iso(26), end: iso(71), bay: 'D05-BAY-01', officer: '海关 周科', status: 'active' }],
    taskId: 'TASK-105', equipmentId: 'RS-05', updatedAt: iso(-12),
    history: seedFlowEvents([
      [-95, '海关布控', 'CREATE', '-', 'pending', '冷藏箱温度抽核，生成查验流程', false],
      [-12, '海关窗口系统', 'BOOK_WINDOW', 'pending', 'appointed', '预约查验窗口（今日 查验位 D05-BAY-01 / 海关 周科），生成移入任务 TASK-105', false]
    ])
  },
  {
    id: 'INS-2003', containerId: 'MSKU-5501288', round: 1, state: 'detained', originSlot: 'D05-R06-T1',
    windows: [{ start: iso(-60), end: iso(-15), bay: 'D05-BAY-01', officer: '海关 周科', status: 'closed' }],
    taskId: undefined, equipmentId: undefined, updatedAt: iso(-8), detainReason: '开箱查验发现申报品名与实际货物不符，移交缉私',
    history: seedFlowEvents([
      [-220, '海关布控', 'CREATE', '-', 'pending', '申报重量偏差布控，生成查验流程', false],
      [-110, '海关窗口系统', 'BOOK_WINDOW', 'pending', 'appointed', '预约查验窗口（查验位 D05-BAY-01）', false],
      [-70, '中控调度员', 'MOVE_TO_BAY', 'appointed', 'positioned', 'RS-05 执行 TASK 移入查验位 D05-BAY-01', false],
      [-58, '海关查验关员', 'START_INSPECTION', 'positioned', 'inspecting', '查验关员到场，开始开箱查验', false],
      [-8, '海关查验关员', 'DETAIN', 'inspecting', 'detained', '扣留指令 MSG-7741：申报品名与实际货物不符，移交缉私；在途提箱预约 APT-9005 已置为异常', false, '开箱查验发现申报品名与实际货物不符，移交缉私']
    ])
  }
];

function parseSlot(slot: string) { const match = slot.match(/^([A-Z]\d\d)-/); return match?.[1]; }
export function dashboard() {
  const activeVoyages = voyages.filter(v => v.status !== 'departed');
  const yardCapacity = blocks.reduce((sum, block) => sum + block.capacity, 0); const yardOccupied = blocks.reduce((sum, block) => sum + block.occupied, 0);
  return { activeVoyages: activeVoyages.length, berthMoves: activeVoyages.reduce((sum, v) => sum + v.movesPlanned - v.movesDone, 0), yardUtilization: yardOccupied / yardCapacity, gateQueue: appointments.filter(a => a.status === 'checked-in').length + 7, pendingTasks: tasks.filter(t => t.status !== 'done').length, blockedTasks: tasks.filter(t => t.status === 'blocked').length, reeferAlerts: containers.filter(c => c.reefer && (c.customs === 'inspection' || (c.temperature ?? 0) > 5)).length, hazmatHolds: containers.filter(c => c.hazmatClass && c.customs !== 'released').length, lateVessels: activeVoyages.filter(v => v.lateRisk === 'high').length, inspectionPending: inspectionFlows.filter(f => f.state !== 'released' && f.state !== 'detained').length, inspectionDetained: inspectionFlows.filter(f => f.state === 'detained').length, inspectionBlocked: inspectionFlows.filter(f => (f.state === 'pending' || f.state === 'appointed') && f.equipmentId && equipment.find(e => e.id === f.equipmentId && e.status === 'maintenance')).length };
}
export function gateConflicts() {
  const result: { severity: 'critical' | 'warning'; appointmentId: string; reason: string }[] = [];
  appointments.forEach((a, index) => appointments.slice(index + 1).forEach(b => {
    const overlap = a.truckNo === b.truckNo && new Date(a.windowStart).getTime() < new Date(b.windowEnd).getTime() && new Date(b.windowStart).getTime() < new Date(a.windowEnd).getTime();
    if (overlap) result.push({ severity: 'critical', appointmentId: a.id, reason: `车辆 ${a.truckNo} 与 ${b.id} 时间窗口重叠，需重新分配闸口时隙` });
  }));
  appointments.filter(a => a.status === 'booked').forEach(a => { const container = containers.find(c => c.id === a.containerId); if (container?.customs !== 'released') result.push({ severity: 'warning', appointmentId: a.id, reason: `箱 ${a.containerId} 海关状态为 ${container?.customs}，无法无条件放行` }); });
  return result;
}
export function yardHeatmap() { return blocks.map(block => ({ ...block, utilization: block.occupied / block.capacity, freeSlots: block.capacity - block.occupied, pressure: block.heat > 85 ? 'critical' : block.heat > 65 ? 'warning' : 'normal' })); }
export function containerPlan(containerId: string) {
  const container = containers.find(c => c.id === containerId); if (!container) return undefined;
  const reasons: string[] = []; const candidates = blocks.filter(block => block.capacity > block.occupied && (!container.hazmatClass || block.hazmatAllowed) && (!container.reefer || block.reeferPlugs > block.usedPlugs));
  if (container.customs !== 'released' && container.status === 'in-yard') reasons.push('海关未放行，必须保持在查验/监管区');
  const ranked = candidates.map(block => ({ block, score: (block.capacity - block.occupied) * 2 - block.heat - (container.reefer && block.reeferPlugs - block.usedPlugs < 3 ? 18 : 0) - (container.hazmatClass && !block.hazmatAllowed ? 100 : 0) })).sort((a, b) => b.score - a.score);
  if (!ranked.length) reasons.push('没有同时满足危险品、冷藏电源与容量约束的区块');
  const selected = ranked[0]?.block; if (container.reefer && selected) reasons.push(`需要占用 ${selected.reeferPlugs - selected.usedPlugs} 个剩余冷插位中的 1 个`);
  if (container.hazmatClass) reasons.push(`危险品 ${container.hazmatClass} 级，只能进入有隔离资质的区块`);
  return { container, recommendedBlock: selected, alternatives: ranked.slice(1, 3).map(item => item.block), reasons };
}
export function prioritizeTasks() { return tasks.map(task => ({ ...task, score: task.priority + (task.blockingReasons.length ? -20 : 10) + (task.kind === 'inspect' ? 12 : 0) })).sort((a, b) => b.score - a.score); }
export function createAppointment(input: Omit<GateAppointment, 'id' | 'status' | 'sealVerified' | 'weightVerified'>) {
  const container = containers.find(item => item.id === input.containerId); if (!container) throw new Error('箱号不存在');
  if (container.customs !== 'released' && input.type === 'pickup') throw new Error('海关未放行，不能预约提箱');
  const item: GateAppointment = { ...input, id: `APT-${Date.now()}`, status: 'booked', sealVerified: false, weightVerified: false }; appointments.unshift(item); container.appointmentId = item.id; return item;
}
export function updateAppointment(id: string, patch: Partial<Pick<GateAppointment, 'status' | 'sealVerified' | 'weightVerified' | 'exception'>>) { const item = appointments.find(a => a.id === id); if (!item) return undefined; Object.assign(item, patch); const container = containers.find(c => c.id === item.containerId); if (item.status === 'checked-in' && container) container.status = 'at-gate'; if (item.status === 'completed' && container) container.status = item.type === 'pickup' ? 'released' : 'in-yard'; auditEvents.unshift({ id: `AUD-${Date.now()}`, actor: '闸口值班员', action: 'GATE_UPDATE', entity: 'appointment', entityId: id, at: new Date().toISOString(), details: JSON.stringify(patch) }); return item; }
export function assignTask(id: string, equipmentId: string) { const task = tasks.find(item => item.id === id); const machine = equipment.find(item => item.id === equipmentId); if (!task || !machine) return undefined; const blockingReasons = [...task.blockingReasons]; if (machine.status === 'maintenance' || machine.status === 'offline') blockingReasons.push(`${machine.name} 当前不可用`); if (task.kind === 'inspect' && machine.kind !== 'reach-stacker') blockingReasons.push('查验作业需要正面吊或专用设备'); task.equipmentId = equipmentId; task.status = blockingReasons.length ? 'blocked' : 'assigned'; task.blockingReasons = blockingReasons; auditEvents.unshift({ id: `AUD-${Date.now()}`, actor: '中控调度员', action: 'ASSIGN_TASK', entity: 'yard-task', entityId: id, at: new Date().toISOString(), details: `${equipmentId} -> ${task.containerId}` }); return task; }
export function containerDetail(id: string) { const container = containers.find(item => item.id === id); if (!container) return undefined; return { container, voyage: voyages.find(v => v.id === container.voyageId), appointment: appointments.find(a => a.id === container.appointmentId), plan: containerPlan(id), tasks: tasks.filter(t => t.containerId === id), inspectionFlow: inspectionFlowDetail(id) }; }

export type ContainerInput = Omit<Container, 'lastEvent' | 'appointmentId'> & { appointmentId?: string };
export type AppointmentInput = Pick<GateAppointment, 'containerId' | 'truckNo' | 'driver' | 'type' | 'windowStart' | 'windowEnd' | 'lane'>;
export type TaskInput = Pick<YardTask, 'kind' | 'containerId' | 'from' | 'to' | 'priority' | 'scheduledAt' | 'estimatedMinutes'> & { equipmentId?: string };

function recordAudit(action: string, entity: string, entityId: string, details: string) {
  auditEvents.unshift({ id: `AUD-${Date.now()}`, actor: '中控调度员', action, entity, entityId, at: new Date().toISOString(), details });
}

export function createContainer(input: ContainerInput) {
  const id = input.id.trim().toUpperCase();
  if (!id) throw new Error('箱号不能为空');
  if (containers.some(item => item.id === id)) throw new Error(`箱号 ${id} 已存在`);
  if (!voyages.some(item => item.id === input.voyageId)) throw new Error('关联航次不存在');
  const blockId = parseSlot(input.yardSlot);
  if (blockId && !blocks.some(block => block.id === blockId)) throw new Error('堆位所属区块不存在');
  if (input.hazmatClass && blockId && !blocks.find(block => block.id === blockId)?.hazmatAllowed) throw new Error('危险品不能进入当前堆场区块');
  if (input.reefer && blockId) {
    const block = blocks.find(item => item.id === blockId);
    if (block && block.reeferPlugs <= block.usedPlugs) throw new Error('当前区块没有可用冷藏插座');
  }
  const item: Container = { ...input, id, lastEvent: `人工建档 ${new Date().toLocaleString()}` };
  containers.unshift(item);
  recordAudit('CREATE', 'container', item.id, '新增集装箱台账记录');
  return item;
}

export function updateContainer(id: string, patch: Partial<Omit<Container, 'id' | 'lastEvent'>>) {
  const item = containers.find(container => container.id === id);
  if (!item) return undefined;
  if (patch.voyageId && !voyages.some(voyage => voyage.id === patch.voyageId)) throw new Error('关联航次不存在');
  const next = { ...item, ...patch };
  const blockId = parseSlot(next.yardSlot);
  if (blockId && !blocks.some(block => block.id === blockId)) throw new Error('堆位所属区块不存在');
  if (next.hazmatClass && blockId && !blocks.find(block => block.id === blockId)?.hazmatAllowed) throw new Error('危险品不能进入当前堆场区块');
  Object.assign(item, patch, { lastEvent: `台账更新 ${new Date().toLocaleString()}` });
  recordAudit('UPDATE', 'container', id, '更新集装箱台账字段');
  return item;
}

export function deleteContainer(id: string) {
  const index = containers.findIndex(item => item.id === id);
  if (index < 0) return undefined;
  const [item] = containers.splice(index, 1);
  const removedAppointments = appointments.filter(appointment => appointment.containerId === id);
  for (const appointment of removedAppointments) appointments.splice(appointments.indexOf(appointment), 1);
  const removedTasks = tasks.filter(task => task.containerId === id);
  for (const task of removedTasks) tasks.splice(tasks.indexOf(task), 1);
  const removedFlows = inspectionFlows.filter(flow => flow.containerId === id);
  for (const flow of removedFlows) inspectionFlows.splice(inspectionFlows.indexOf(flow), 1);
  recordAudit('DELETE', 'container', id, `删除箱务记录，并级联清理 ${removedAppointments.length} 条预约、${removedTasks.length} 条未完成任务、${removedFlows.length} 条查验流程`);
  return item;
}

export function createGateAppointment(input: AppointmentInput) {
  const container = containers.find(item => item.id === input.containerId);
  if (!container) throw new Error('箱号不存在');
  if (input.type === 'pickup') { const blocked = pickupBlockedReason(input.containerId); if (blocked) throw new Error(blocked); }
  if (new Date(input.windowEnd) <= new Date(input.windowStart)) throw new Error('预约结束时间必须晚于开始时间');
  const item: GateAppointment = { ...input, id: `APT-${Date.now()}`, status: 'booked', sealVerified: false, weightVerified: false };
  appointments.unshift(item);
  container.appointmentId = item.id;
  recordAudit('CREATE', 'appointment', item.id, `为 ${item.containerId} 创建闸口预约`);
  return item;
}

export function editGateAppointment(id: string, patch: Partial<AppointmentInput & Pick<GateAppointment, 'status' | 'sealVerified' | 'weightVerified' | 'exception'>>) {
  const item = appointments.find(appointment => appointment.id === id);
  if (!item) return undefined;
  if (patch.containerId && !containers.some(container => container.id === patch.containerId)) throw new Error('箱号不存在');
  if (patch.windowStart && patch.windowEnd && new Date(patch.windowEnd) <= new Date(patch.windowStart)) throw new Error('预约结束时间必须晚于开始时间');
  const previousContainer = containers.find(container => container.id === item.containerId);
  Object.assign(item, patch);
  const nextContainer = containers.find(container => container.id === item.containerId);
  if (item.type === 'pickup' && (item.status === 'checked-in' || item.status === 'completed')) {
    const blocked = nextContainer ? pickupBlockedReason(nextContainer.id) : undefined;
    if (blocked) { item.status = 'exception'; item.exception = blocked; throw new Error(blocked); }
  }
  if (previousContainer && previousContainer.id !== nextContainer?.id && previousContainer.appointmentId === id) previousContainer.appointmentId = undefined;
  if (nextContainer) nextContainer.appointmentId = id;
  if (item.status === 'checked-in' && nextContainer) nextContainer.status = 'at-gate';
  if (item.status === 'completed' && nextContainer) nextContainer.status = item.type === 'pickup' ? 'released' : 'in-yard';
  recordAudit('UPDATE', 'appointment', id, `更新预约状态/时隙：${JSON.stringify(patch)}`);
  return item;
}

export function deleteGateAppointment(id: string) {
  const index = appointments.findIndex(item => item.id === id);
  if (index < 0) return undefined;
  const [item] = appointments.splice(index, 1);
  const container = containers.find(entry => entry.id === item.containerId);
  if (container?.appointmentId === id) container.appointmentId = undefined;
  recordAudit('DELETE', 'appointment', id, `取消并删除 ${item.containerId} 的闸口预约`);
  return item;
}

export function createYardTask(input: TaskInput) {
  if (!containers.some(container => container.id === input.containerId)) throw new Error('关联箱号不存在');
  if (input.priority < 1 || input.priority > 100) throw new Error('优先级范围为 1–100');
  if (input.estimatedMinutes <= 0) throw new Error('预计作业时长必须大于 0');
  const item: YardTask = { ...input, id: `TASK-${Date.now()}`, status: input.equipmentId ? 'assigned' : 'queued', blockingReasons: [], scheduledAt: input.scheduledAt };
  tasks.unshift(item);
  recordAudit('CREATE', 'yard-task', item.id, `创建 ${input.kind} 任务，关联 ${input.containerId}`);
  return item;
}

export function updateYardTask(id: string, patch: Partial<TaskInput & Pick<YardTask, 'status' | 'blockingReasons'>>) {
  const item = tasks.find(task => task.id === id);
  if (!item) return undefined;
  if (patch.containerId && !containers.some(container => container.id === patch.containerId)) throw new Error('关联箱号不存在');
  if (patch.priority !== undefined && (patch.priority < 1 || patch.priority > 100)) throw new Error('优先级范围为 1–100');
  Object.assign(item, patch);
  recordAudit('UPDATE', 'yard-task', id, `更新场内作业任务：${JSON.stringify(patch)}`);
  return item;
}

export function deleteYardTask(id: string) {
  const index = tasks.findIndex(item => item.id === id);
  if (index < 0) return undefined;
  const [item] = tasks.splice(index, 1);
  recordAudit('DELETE', 'yard-task', id, `删除 ${item.containerId} 的场内任务`);
  return item;
}

// ============================== 查验作业流程状态机 ==============================

export const INSPECTION_STATE_LABELS: Record<InspectionState, string> = {
  pending: '待查验',
  appointed: '已预约',
  positioned: '移入查验位',
  inspecting: '查验中',
  released: '放行',
  detained: '扣留'
};
export const INSPECTION_ACTION_LABELS: Record<InspectionAction, string> = {
  CREATE: '建立查验流程', BOOK_WINDOW: '预约查验窗口', CANCEL_WINDOW: '取消查验窗口',
  MOVE_TO_BAY: '移入查验位', START_INSPECTION: '开始查验', RELEASE: '海关放行',
  DETAIN: '海关扣留', REASSIGN: '重派正面吊', EQUIPMENT_FAULT: '设备故障',
  REPAIR: '设备修复', RETURN_TO_YARD: '复位回场区', OVERRIDE: '人工覆盖状态'
};
const TERMINAL_TASK: TaskStatus[] = ['done'];
const ACTIVE_TASK: TaskStatus[] = ['queued', 'assigned', 'executing', 'blocked'];
const OVERRIDE_TARGETS: Partial<Record<InspectionState, InspectionState[]>> = {
  appointed: ['pending'],
  positioned: ['appointed', 'pending'],
  inspecting: ['positioned', 'appointed', 'pending'],
  released: ['pending'],
  detained: ['pending']
};

let flowSeq = 3000;
let runtimeSeq = 200;
const nowIso = () => new Date().toISOString();
const newRuntimeId = (prefix: string) => `${prefix}-${Date.now()}-${++runtimeSeq}`;
const flowById = (id: string) => inspectionFlows.find(flow => flow.id === id);
const flowOfContainer = (containerId: string) => inspectionFlows.find(flow => flow.containerId === containerId);
const activeWindow = (flow: InspectionFlow) => flow.windows.find(window => window.status === 'active');
const linkedTaskOf = (flow: InspectionFlow) => tasks.find(task => task.id === flow.taskId);
const inspectionZone = (slot: string) => blocks.find(block => block.id === parseSlot(slot) && block.zone.toLowerCase().includes('inspection'));

/** 移箱时同步区块占用与冷藏插座；查验位（D05-BAY-xx）与查验存储区同属 D05，不重复计数 */
function relocate(container: Container, toSlot: string) {
  const toBlock = blocks.find(block => block.id === parseSlot(toSlot));
  if (!toBlock) throw new Error('目标堆位所属区块不存在');
  if (toBlock.occupied >= toBlock.capacity && parseSlot(container.yardSlot) !== toBlock.id) throw new Error(`区块 ${toBlock.id} 容量已满，无法移入`);
  if (container.hazmatClass && !toBlock.hazmatAllowed) throw new Error('危险品查验位必须位于有隔离资质的区块');
  const fromBlock = blocks.find(block => block.id === parseSlot(container.yardSlot));
  if (fromBlock && fromBlock.id !== toBlock.id) {
    fromBlock.occupied -= 1; toBlock.occupied += 1;
    if (container.reefer) { fromBlock.usedPlugs -= 1; toBlock.usedPlugs += 1; }
  }
  container.yardSlot = toSlot;
}

function logFlow(flow: InspectionFlow, actor: string, action: InspectionAction, from: InspectionState | '-', toState: InspectionState, details: string, opts: { reason?: string; override?: boolean; duplicate?: boolean; messageId?: string } = {}) {
  const event: InspectionEvent = {
    id: `INS-EV-${++flowSeq}`, at: nowIso(), actor, action, from, to: toState, details, override: opts.override ?? false,
    ...(opts.reason ? { reason: opts.reason } : {}), ...(opts.duplicate ? { duplicate: true } : {}), ...(opts.messageId ? { messageId: opts.messageId } : {})
  };
  flow.history.unshift(event);
  flow.updatedAt = event.at;
  recordAudit(opts.override ? 'INSPECTION_OVERRIDE' : `INSPECTION_${action}`, 'inspection-flow', flow.id, opts.override ? `[人工覆盖] 原因：${opts.reason ?? '未填写'}｜${details}` : details);
  return event;
}

function removeTaskById(id: string) {
  const index = tasks.findIndex(task => task.id === id);
  if (index >= 0) tasks.splice(index, 1);
}

/** 同步指派任务的阻塞原因：保留窗口/海关类阻塞，清除并重算设备类阻塞 */
function refreshTaskEquipment(task: YardTask, machine?: Equipment) {
  task.blockingReasons = task.blockingReasons.filter(reason => !/RS-|正面吊|设备/.test(reason));
  if (!machine) {
    task.status = 'blocked';
    if (!task.blockingReasons.includes('待指派正面吊')) task.blockingReasons.push('待指派正面吊');
    return;
  }
  if (machine.status === 'maintenance' || machine.status === 'offline') {
    task.status = 'blocked';
    task.blockingReasons.push(`${machine.name} ${machine.status === 'maintenance' ? '维护中' : '离线'}，等待重派正面吊`);
  } else if (task.blockingReasons.length) {
    task.status = 'blocked';
  } else {
    task.status = 'assigned';
  }
}

function ensureInspectionTask(flow: InspectionFlow, bay: string): YardTask {
  const existing = linkedTaskOf(flow);
  if (existing && existing.status !== 'done') return existing;
  const container = containers.find(item => item.id === flow.containerId);
  const task: YardTask = {
    id: newRuntimeId('TASK'), kind: 'inspect', containerId: flow.containerId,
    from: flow.currentBay ?? flow.originSlot, to: bay,
    ...(flow.equipmentId ? { equipmentId: flow.equipmentId } : {}),
    priority: container?.hazmatClass ? 120 : container?.reefer ? 105 : 90,
    status: 'queued', scheduledAt: nowIso(), blockingReasons: [], estimatedMinutes: 30
  };
  refreshTaskEquipment(task, equipment.find(item => item.id === flow.equipmentId));
  tasks.unshift(task);
  flow.taskId = task.id;
  return task;
}

/** 查验位物理复位回原堆位：即时生效并留一条已完成的场内复位任务作为联动痕迹 */
function returnFromBay(flow: InspectionFlow, actor: string, action: InspectionAction, reason: string, override: boolean, detailPrefix: string) {
  const container = containers.find(item => item.id === flow.containerId);
  if (!flow.currentBay || !container || container.yardSlot !== flow.currentBay) return;
  const bay = flow.currentBay;
  relocate(container, flow.originSlot);
  const resetTask: YardTask = { id: newRuntimeId('TASK'), kind: 'rehandle', containerId: flow.containerId, from: bay, to: flow.originSlot, ...(flow.equipmentId ? { equipmentId: flow.equipmentId } : {}), priority: 80, status: 'done', scheduledAt: nowIso(), blockingReasons: [], estimatedMinutes: 16 };
  tasks.unshift(resetTask);
  logFlow(flow, actor, action, flow.state, flow.state, `${detailPrefix}：箱 ${flow.containerId} 由查验位 ${bay} 复位至 ${flow.originSlot}，复位任务 ${resetTask.id} 已闭环`, { reason, override });
  flow.currentBay = undefined;
}

function cancelActiveWindow(flow: InspectionFlow, reason: string) {
  flow.windows.filter(window => window.status === 'active').forEach(window => { window.status = 'cancelled'; window.cancelReason = reason; });
}

/** 回退到待查验时清理窗口与未完成的查验/出场任务 */
function resetForPending(flow: InspectionFlow, actor: string, reason: string, override: boolean) {
  cancelActiveWindow(flow, override ? `人工回退：${reason}` : reason);
  const linked = linkedTaskOf(flow);
  if (linked && !TERMINAL_TASK.includes(linked.status)) { removeTaskById(linked.id); flow.taskId = undefined; }
  if (flow.currentBay) {
    tasks.filter(task => task.containerId === flow.containerId && ACTIVE_TASK.includes(task.status) && task.from === flow.currentBay).forEach(task => removeTaskById(task.id));
    returnFromBay(flow, actor, 'RETURN_TO_YARD', reason, override, '状态回退至待查验');
  }
}

export interface StartInspectionInput { containerId: string; actor?: string; reason?: string; }
export function startInspectionFlow(input: StartInspectionInput): InspectionFlowView {
  const container = containers.find(item => item.id === input.containerId.trim().toUpperCase());
  if (!container) throw new Error('箱号不存在');
  const active = inspectionFlows.find(flow => flow.containerId === container.id && flow.state !== 'released');
  if (active) throw new Error(`该箱已存在查验流程 ${active.id}（${INSPECTION_STATE_LABELS[active.state]}）；放行后二次查验请在流程内人工回退`);
  if (container.status === 'released' || container.status === 'at-gate') throw new Error('已离场或在闸口的箱号不能发起查验流程');
  const bayBlock = blocks.find(block => block.id === 'D05');
  if (bayBlock && bayBlock.occupied >= bayBlock.capacity && !inspectionZone(container.yardSlot)) throw new Error('查验监管区（D05）容量已满，无法安排移入');
  const round = inspectionFlows.filter(flow => flow.containerId === container.id).length + 1;
  const flow: InspectionFlow = {
    id: `INS-${++flowSeq}`, containerId: container.id, round, state: 'pending',
    originSlot: container.yardSlot, windows: [], updatedAt: nowIso(), history: []
  };
  inspectionFlows.unshift(flow);
  container.customs = 'inspection'; container.status = 'in-yard';
  container.lastEvent = `发起查验流程 ${flow.id}（第 ${round} 轮）${new Date().toLocaleTimeString()}`;
  logFlow(flow, input.actor ?? '中控调度员', 'CREATE', '-', 'pending', input.reason || '海关布控/风险抽核，箱号纳入查验闭环');
  return flowView(flow);
}

export interface FlowTransitionInput {
  action: 'book_window' | 'cancel_window' | 'move_to_bay' | 'start_inspection' | 'reassign';
  actor?: string; reason?: string; windowStart?: string; windowEnd?: string; bay?: string; officer?: string; equipmentId?: string;
}
export function transitionFlow(id: string, input: FlowTransitionInput): InspectionFlowView {
  const flow = flowById(id);
  if (!flow) throw new Error('查验流程不存在');
  const actor = input.actor ?? '中控调度员';
  const container = containers.find(item => item.id === flow.containerId);
  if (!container) throw new Error('流程关联箱号已不存在');

  if (input.action === 'book_window') {
    if (flow.state !== 'pending') throw new Error(`当前状态（${INSPECTION_STATE_LABELS[flow.state]}）不能预约查验窗口`);
    const startText = input.windowStart ?? ''; const endText = input.windowEnd ?? '';
    if (!startText || !endText || new Date(endText) <= new Date(startText)) throw new Error('查验窗口开始/结束时间不合法');
    const bay = (input.bay ?? 'D05-BAY-01').trim().toUpperCase();
    if (!inspectionZone(bay)) throw new Error('查验位必须位于查验/监管堆区（D05）');
    const officer = (input.officer ?? '').trim();
    if (!officer) throw new Error('请填写查验海关关员');
    flow.windows.unshift({ start: startText, end: endText, bay, officer, status: 'active' });
    const task = ensureInspectionTask(flow, bay);
    flow.state = 'appointed';
    container.lastEvent = `查验窗口已预约 ${new Date(startText).toLocaleString()} / ${bay}`;
    logFlow(flow, actor, 'BOOK_WINDOW', 'pending', 'appointed', `预约窗口 ${new Date(startText).toLocaleString()}–${new Date(endText).toLocaleString()}，查验位 ${bay}，关员 ${officer}；联动任务 ${task.id}`);
    return flowView(flow);
  }

  if (input.action === 'cancel_window') {
    if (flow.state !== 'appointed') throw new Error(`当前状态（${INSPECTION_STATE_LABELS[flow.state]}）不能取消窗口；查验位之后的回退请使用人工覆盖并填写原因`);
    if (!input.reason?.trim()) throw new Error('取消查验窗口必须填写原因');
    const linked = linkedTaskOf(flow);
    if (linked && !TERMINAL_TASK.includes(linked.status)) { removeTaskById(linked.id); flow.taskId = undefined; }
    cancelActiveWindow(flow, input.reason.trim());
    flow.state = 'pending';
    container.lastEvent = '查验窗口取消，流程回退待查验';
    logFlow(flow, actor, 'CANCEL_WINDOW', 'appointed', 'pending', `查验窗口取消并撤销未执行的移入任务，流程回退待查验（设备指派保留，可直接重新预约）`, { reason: input.reason.trim() });
    return flowView(flow);
  }

  if (input.action === 'move_to_bay') {
    if (flow.state !== 'appointed') throw new Error(`当前状态（${INSPECTION_STATE_LABELS[flow.state]}）不能移入查验位`);
    const window = activeWindow(flow);
    if (!window) throw new Error('没有有效查验窗口，请重新预约');
    const task = ensureInspectionTask(flow, window.bay);
    const machine = equipment.find(item => item.id === flow.equipmentId);
    if (!machine) throw new Error('尚未指派正面吊，请先重派可用设备');
    if (machine.kind !== 'reach-stacker') throw new Error('查验移入作业必须使用正面吊');
    if (machine.status === 'maintenance' || machine.status === 'offline') throw new Error(`${machine.name} 当前${machine.status === 'maintenance' ? '维护中' : '离线'}，请先重派其他正面吊`);
    relocate(container, window.bay);
    flow.currentBay = window.bay;
    task.from = flow.originSlot; task.to = window.bay; task.equipmentId = machine.id;
    task.status = 'done'; task.blockingReasons = [];
    machine.status = 'working'; machine.location = window.bay;
    flow.state = 'positioned';
    container.lastEvent = `已由 ${machine.name} 移入查验位 ${window.bay}`;
    logFlow(flow, actor, 'MOVE_TO_BAY', 'appointed', 'positioned', `${machine.name} 执行 ${task.id}，箱号移入查验位 ${window.bay}，D05 区内移位不重复占用堆位容量`);
    return flowView(flow);
  }

  if (input.action === 'start_inspection') {
    if (flow.state !== 'positioned') throw new Error(`当前状态（${INSPECTION_STATE_LABELS[flow.state]}）不能开始查验`);
    if (!activeWindow(flow)) throw new Error('查验窗口已失效，请人工覆盖回退后重新预约');
    flow.state = 'inspecting';
    container.lastEvent = '海关到场，查验开始';
    logFlow(flow, input.actor ?? '海关查验关员', 'START_INSPECTION', 'positioned', 'inspecting', '查验关员到场，开箱/机检查验开始');
    return flowView(flow);
  }

  // 设备故障后重派：仅允许在真正开始移箱前进行
  if (input.action === 'reassign') {
    if (flow.state !== 'pending' && flow.state !== 'appointed') throw new Error(`当前状态（${INSPECTION_STATE_LABELS[flow.state]}）不能重派设备`);
    const machine = equipment.find(item => item.id === input.equipmentId);
    if (!machine) throw new Error('设备不存在');
    if (machine.kind !== 'reach-stacker') throw new Error('查验作业只能指派正面吊');
    if (machine.status === 'maintenance' || machine.status === 'offline') throw new Error(`${machine.name} 不可用（${machine.status}），请选择其他正面吊`);
    const previous = flow.equipmentId;
    const bay = activeWindow(flow)?.bay ?? 'D05-BAY-01';
    const task = ensureInspectionTask(flow, bay);
    flow.equipmentId = machine.id;
    task.equipmentId = machine.id;
    refreshTaskEquipment(task, machine);
    logFlow(flow, actor, 'REASSIGN', flow.state, flow.state, previous && previous !== machine.id ? `设备故障/调整：${previous} → ${machine.name}，任务 ${task.id} 阻塞状态已重算` : `指派 ${machine.name} 承担移入任务 ${task.id}`, { reason: input.reason?.trim() || undefined });
    return flowView(flow);
  }

  throw new Error('不支持的流程动作');
}

export interface CustomsMessageInput { decision: 'release' | 'detain'; messageId?: string; reason?: string; }
export function receiveCustomsMessage(containerId: string, input: CustomsMessageInput): { flow: InspectionFlowView; duplicate: boolean } {
  const flow = flowOfContainer(containerId.trim().toUpperCase());
  if (!flow) throw new Error('未找到该箱的查验流程');
  const container = containers.find(item => item.id === flow.containerId);
  if (!container) throw new Error('流程关联箱号已不存在');
  const actor = '海关放行消息';
  const messageId = input.messageId?.trim() || `MSG-${Date.now()}`;

  if (input.decision === 'release') {
    if (flow.state === 'released') {
      logFlow(flow, actor, 'RELEASE', 'released', 'released', `重复放行消息 ${messageId} 已幂等忽略（首次放行 ${flow.releaseMessageId ?? ''}）`, { duplicate: true, messageId });
      return { flow: flowView(flow), duplicate: true };
    }
    if (flow.state === 'inspecting' || flow.state === 'positioned' || flow.state === 'appointed' || flow.state === 'pending' || flow.state === 'detained') {
      const from = flow.state;
      flow.windows.filter(window => window.status === 'active').forEach(window => { window.status = 'closed'; });
      const linked = linkedTaskOf(flow);
      if (linked && !TERMINAL_TASK.includes(linked.status)) { removeTaskById(linked.id); flow.taskId = undefined; }
      if (flow.currentBay) {
        const exitTask: YardTask = { id: newRuntimeId('TASK'), kind: 'deliver', containerId: flow.containerId, from: flow.currentBay, to: '北闸口', ...(flow.equipmentId ? { equipmentId: flow.equipmentId } : {}), priority: 110, status: 'queued', scheduledAt: nowIso(), blockingReasons: [], estimatedMinutes: 22 };
        tasks.unshift(exitTask);
        logFlow(flow, actor, 'RETURN_TO_YARD', from, 'released', `放行联动：生成出场任务 ${exitTask.id}（${flow.currentBay} → 北闸口）`, { messageId });
      }
      // 扣留/布控期间被闸口置为异常的提箱预约，放行后窗口仍有效的自动恢复
      appointments.filter(appointment => appointment.containerId === flow.containerId && appointment.type === 'pickup' && appointment.status === 'exception' && new Date(appointment.windowEnd).getTime() > Date.now()).forEach(appointment => {
        appointment.status = 'booked'; appointment.exception = undefined;
      });
      flow.state = 'released'; flow.releaseMessageId = messageId; flow.detainReason = undefined;
      container.customs = 'released'; container.status = 'in-yard';
      container.lastEvent = `海关放行（${messageId}），等待提箱出场`;
      logFlow(flow, actor, 'RELEASE', from, 'released', from === 'detained' ? `解除扣留并放行（${messageId}），海关状态置为 released` : `海关放行消息 ${messageId}，海关状态置为 released`, { messageId });
      return { flow: flowView(flow), duplicate: false };
    }
  }

  if (input.decision === 'detain') {
    const reason = input.reason?.trim();
    if (!reason) throw new Error('扣留必须填写海关扣留原因');
    if (flow.state === 'detained') {
      logFlow(flow, '海关扣留指令', 'DETAIN', 'detained', 'detained', `重复扣留消息 ${messageId} 已幂等忽略（${flow.detainReason ?? ''}）`, { duplicate: true, messageId, reason });
      return { flow: flowView(flow), duplicate: true };
    }
    if (flow.state === 'released') throw new Error('已放行箱不能直接扣留，请在流程内人工回退发起二次查验');
    const from = flow.state;
    flow.windows.filter(window => window.status === 'active').forEach(window => { window.status = 'closed'; });
    const linked = linkedTaskOf(flow);
    if (linked && ACTIVE_TASK.includes(linked.status)) {
      linked.status = 'blocked';
      if (!linked.blockingReasons.includes('箱号海关扣留，场内作业冻结')) linked.blockingReasons.push('箱号海关扣留，场内作业冻结');
    }
    const blockedAppointments = appointments.filter(appointment => appointment.containerId === flow.containerId && appointment.type === 'pickup' && (appointment.status === 'booked' || appointment.status === 'checked-in'));
    blockedAppointments.forEach(appointment => { appointment.status = 'exception'; appointment.exception = `查验流程 ${flow.id} 海关扣留：${reason}，闸口禁止提箱`; });
    flow.state = 'detained'; flow.detainReason = reason;
    container.customs = 'hold'; container.status = 'hold';
    container.lastEvent = `海关扣留（${messageId}）：${reason}`;
    logFlow(flow, '海关扣留指令', 'DETAIN', from, 'detained', `海关扣留消息 ${messageId}：${reason}；关联任务冻结，${blockedAppointments.length} 个提箱预约置为异常并联动闸口拦截`, { reason, messageId });
    return { flow: flowView(flow), duplicate: false };
  }

  throw new Error('不支持的海关指令');
}

export interface FlowOverrideInput { target: InspectionState; actor?: string; reason: string; }
export function overrideFlowState(id: string, input: FlowOverrideInput): InspectionFlowView {
  const flow = flowById(id);
  if (!flow) throw new Error('查验流程不存在');
  const reason = input.reason?.trim();
  if (!reason) throw new Error('人工覆盖必须填写原因，该原因会随状态变更永久留痕');
  const allowed = OVERRIDE_TARGETS[flow.state] ?? [];
  if (!allowed.includes(input.target)) throw new Error(`不允许从 ${INSPECTION_STATE_LABELS[flow.state]} 直接覆盖为 ${INSPECTION_STATE_LABELS[input.target]}`);
  const actor = input.actor ?? '中控调度员';
  const from = flow.state;
  const container = containers.find(item => item.id === flow.containerId);
  if (!container) throw new Error('流程关联箱号已不存在');
  const target = input.target;

  if (target === 'pending') {
    resetForPending(flow, actor, reason, true);
    flow.state = 'pending';
    if (from === 'released') container.customs = 'inspection';
    if (from === 'detained') container.customs = 'inspection';
    container.status = 'in-yard';
    if (from === 'released') flow.releaseMessageId = undefined;
    if (from === 'detained') flow.detainReason = undefined;
  } else if (target === 'appointed') {
    // positioned/inspecting 回退：窗口保留，查验位复位，并重建一条移入任务等待二次移入
    const window = activeWindow(flow);
    returnFromBay(flow, actor, 'RETURN_TO_YARD', reason, true, '人工覆盖回退已预约');
    if (window) {
      const linked = linkedTaskOf(flow);
      if (!linked || linked.status === 'done') {
        const task: YardTask = { id: newRuntimeId('TASK'), kind: 'inspect', containerId: flow.containerId, from: flow.originSlot, to: window.bay, ...(flow.equipmentId ? { equipmentId: flow.equipmentId } : {}), priority: container.hazmatClass ? 120 : 95, status: 'queued', scheduledAt: nowIso(), blockingReasons: [], estimatedMinutes: 30 };
        refreshTaskEquipment(task, equipment.find(item => item.id === flow.equipmentId));
        tasks.unshift(task); flow.taskId = task.id;
      }
    }
    flow.state = 'appointed';
  } else if (target === 'positioned') {
    // 查验中断（设备/关员原因）回到已就位，窗口与堆位保持不变
    flow.state = 'positioned';
  }
  container.lastEvent = `人工覆盖：${INSPECTION_STATE_LABELS[from]} → ${INSPECTION_STATE_LABELS[target]}`;
  logFlow(flow, actor, 'OVERRIDE', from, target, `人工覆盖状态：${INSPECTION_STATE_LABELS[from]} → ${INSPECTION_STATE_LABELS[target]}；关联堆位/任务/预约已按规则联动`, { reason, override: true });
  return flowView(flow);
}

/** 设备故障上报：冻结设备、阻塞其在场任务，并向相关查验流程写入同状态事件 */
export function reportEquipmentFault(equipmentId: string, reason: string, actor = '中控调度员'): Equipment {
  const machine = equipment.find(item => item.id === equipmentId);
  if (!machine) throw new Error('设备不存在');
  const detail = reason.trim() || '设备故障，暂停派工';
  machine.status = 'maintenance';
  tasks.filter(task => task.equipmentId === machine.id && ACTIVE_TASK.includes(task.status)).forEach(task => {
    task.status = 'blocked';
    if (!task.blockingReasons.includes(`${machine.name} 故障：${detail}`)) task.blockingReasons.push(`${machine.name} 故障：${detail}`);
  });
  inspectionFlows.filter(flow => flow.equipmentId === machine.id && (flow.state === 'pending' || flow.state === 'appointed')).forEach(flow => {
    const linked = linkedTaskOf(flow);
    if (linked) refreshTaskEquipment(linked, machine);
    logFlow(flow, actor, 'EQUIPMENT_FAULT', flow.state, flow.state, `${machine.name} 上报故障（${detail}），联动任务阻塞，可在流程内重派其他正面吊`, { reason: detail });
  });
  recordAudit('EQUIPMENT_FAULT', 'equipment', machine.id, `${machine.name} 故障：${detail}，在场任务已阻塞`);
  return machine;
}

/** 设备修复：恢复可派工，并自动刷新相关查验流程任务上的设备类阻塞原因 */
export function repairEquipment(equipmentId: string, actor = '设备维保'): Equipment {
  const machine = equipment.find(item => item.id === equipmentId);
  if (!machine) throw new Error('设备不存在');
  machine.status = 'available';
  tasks.filter(task => task.equipmentId === machine.id && task.status === 'blocked').forEach(task => refreshTaskEquipment(task, machine));
  inspectionFlows.filter(flow => flow.equipmentId === machine.id).forEach(flow => logFlow(flow, actor, 'REPAIR', flow.state, flow.state, `${machine.name} 修复完成恢复可用，关联任务阻塞原因已刷新`));
  recordAudit('EQUIPMENT_REPAIR', 'equipment', machine.id, `${machine.name} 修复完成，恢复派工`);
  return machine;
}

/** 闸口提箱拦截：查验流程未放行（尤其扣留）的箱号，任何预约/签到/完成都不允许提箱 */
export function pickupBlockedReason(containerId: string): string | undefined {
  const flow = inspectionFlows.find(item => item.containerId === containerId);
  if (flow?.state === 'detained') return `查验流程 ${flow.id} 已海关扣留（${flow.detainReason ?? '原因待补录'}），系统拦截提箱，请走放行/解除扣留闭环`;
  if (flow && flow.state !== 'released') return `查验流程 ${flow.id} 状态为「${INSPECTION_STATE_LABELS[flow.state]}」，海关未放行，不能提箱`;
  const container = containers.find(item => item.id === containerId);
  if (container?.customs === 'hold') return '箱号被海关扣留，不能预约提箱';
  if (container?.customs !== 'released') return '海关未放行，不能预约提箱';
  return undefined;
}

function availableActions(flow: InspectionFlow): FlowActionDescriptor[] {
  const task = linkedTaskOf(flow);
  const machine = equipment.find(item => item.id === flow.equipmentId);
  switch (flow.state) {
    case 'pending':
      return [
        { action: 'book_window', label: '预约查验窗口', kind: 'operate', requires: ['window'] },
        { action: 'reassign', label: task ? '重派正面吊' : '预派正面吊', kind: 'device', requires: ['equipment'] }
      ];
    case 'appointed':
      return [
        { action: 'move_to_bay', label: '移入查验位', kind: 'operate', requires: ['equipment'], ...((!machine || machine.kind !== 'reach-stacker' || machine.status === 'maintenance' || machine.status === 'offline') ? { disabledReason: !machine ? '尚未指派正面吊' : `${machine.name} 不可用，请先重派` } : {}) },
        { action: 'reassign', label: '重派正面吊', kind: 'device', requires: ['equipment'] },
        { action: 'cancel_window', label: '取消窗口并回退', kind: 'danger', requires: ['reason'] }
      ];
    case 'positioned':
      return [
        { action: 'start_inspection', label: '开始查验', kind: 'operate' },
        { action: 'release', label: '登记海关放行', kind: 'customs', requires: ['messageId'] },
        { action: 'detain', label: '登记海关扣留', kind: 'danger', requires: ['reason', 'messageId'] }
      ];
    case 'inspecting':
      return [
        { action: 'release', label: '登记海关放行', kind: 'customs', requires: ['messageId'] },
        { action: 'detain', label: '登记海关扣留', kind: 'danger', requires: ['reason', 'messageId'] }
      ];
    default:
      return [];
  }
}

function availableOverrides(flow: InspectionFlow): FlowOverrideDescriptor[] {
  return (OVERRIDE_TARGETS[flow.state] ?? []).map(target => ({ target, label: `人工覆盖 → ${INSPECTION_STATE_LABELS[target]}`, reasonRequired: true }));
}

export function flowView(flow: InspectionFlow): InspectionFlowView {
  const container = containers.find(item => item.id === flow.containerId)!;
  return {
    ...flow,
    history: [...flow.history].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    stateLabel: INSPECTION_STATE_LABELS[flow.state],
    container,
    linkedTask: linkedTaskOf(flow),
    equipment: equipment.find(item => item.id === flow.equipmentId),
    appointment: appointments.find(item => item.id === container.appointmentId) ?? appointments.find(item => item.containerId === container.id && item.type === 'pickup'),
    availableActions: availableActions(flow),
    availableOverrides: availableOverrides(flow)
  };
}

export function inspectionFlowList(): InspectionFlowView[] {
  return [...inspectionFlows].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map(flowView);
}

export function inspectionFlowDetail(id: string): InspectionFlowView | undefined {
  const flow = flowById(id) ?? inspectionFlows.find(item => item.containerId === id.toUpperCase());
  return flow ? flowView(flow) : undefined;
}
