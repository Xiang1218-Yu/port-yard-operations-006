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

export type InspectionStatus = 'pending' | 'booked' | 'positioned' | 'inspecting' | 'released' | 'detained';
export type InspectionAction = 'book' | 'dispatch' | 'reassign-equipment' | 'arrive' | 'start' | 'release' | 'detain' | 'cancel-window' | 'override';
export interface InspectionEvent { id: string; at: string; from: InspectionStatus | 'none'; to: InspectionStatus; action: string; actor: string; note: string; }
export interface InspectionOverride { id: string; at: string; actor: string; action: string; reason: string; }
export interface InspectionCase { id: string; containerId: string; status: InspectionStatus; windowStart?: string; windowEnd?: string; originSlot: string; baySlot?: string; moveTaskId?: string; equipmentId?: string; releaseMessageId?: string; detentionReason?: string; events: InspectionEvent[]; overrides: InspectionOverride[]; createdAt: string; updatedAt: string; }
export interface InspectionActionInfo { action: InspectionAction; label: string; tone: 'primary' | 'neutral' | 'danger'; disabledReason?: string; }

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
  { id: 'D05', zone: 'Inspection & Hold', rows: 8, tiers: 3, capacity: 96, occupied: 72, reeferPlugs: 5, usedPlugs: 4, hazmatAllowed: true, equipment: ['reach-stacker'], heat: 63 }
];
export const containers: Container[] = [
  { id: 'MSCU-4829017', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'import', status: 'in-yard', weightT: 22.4, reefer: false, customs: 'released', priority: 'hot', yardSlot: 'A01-R07-T3', lastEvent: '卸船完成 08:42' },
  { id: 'EISU-1288420', voyageId: 'VOY-AX7', size: '40', isoType: '45R1', direction: 'import', status: 'in-yard', weightT: 27.8, reefer: true, temperature: -18, customs: 'released', priority: 'reefer', yardSlot: 'B07-R03-T2', lastEvent: '温度回传正常 08:51' },
  { id: 'TGHU-9831204', voyageId: 'VOY-AX7', size: '20', isoType: '22K2', direction: 'transshipment', status: 'hold', weightT: 19.7, reefer: false, hazmatClass: '3', customs: 'inspection', priority: 'hazmat', yardSlot: 'D05-R02-T1', lastEvent: '海关查验挂起' },
  { id: 'OOLU-7734201', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'export', status: 'at-gate', weightT: 24.1, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R06-T1', appointmentId: 'APT-9001', lastEvent: '南闸口已称重' },
  { id: 'CMAU-6001722', voyageId: 'VOY-QF2', size: '40', isoType: '45G1', direction: 'import', status: 'in-transit', weightT: 23.5, reefer: false, customs: 'released', priority: 'hot', yardSlot: 'B07-R10-T1', lastEvent: '船期 ETA +35min' },
  { id: 'FCIU-9920310', voyageId: 'VOY-QF2', size: '20', isoType: '22G1', direction: 'export', status: 'in-yard', weightT: 12.2, reefer: false, customs: 'released', priority: 'normal', yardSlot: 'C03-R04-T2', lastEvent: '待装船' },
  { id: 'TEMU-1774029', voyageId: 'VOY-AX7', size: '40', isoType: '45R1', direction: 'import', status: 'in-yard', weightT: 26.3, reefer: true, temperature: 4, customs: 'inspection', priority: 'reefer', yardSlot: 'D05-R05-T1', lastEvent: '待海关查验' },
  { id: 'SEGU-3355881', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'import', status: 'in-yard', weightT: 21.2, reefer: false, customs: 'inspection', priority: 'hot', yardSlot: 'A01-R12-T2', lastEvent: '海关布控，待移入查验位' }
];
export const appointments: GateAppointment[] = [
  { id: 'APT-9001', containerId: 'OOLU-7734201', truckNo: '沪A·7K229', driver: '陈海', type: 'dropoff', windowStart: iso(-14), windowEnd: iso(16), lane: 'south', status: 'checked-in', sealVerified: true, weightVerified: true },
  { id: 'APT-9002', containerId: 'MSCU-4829017', truckNo: '苏E·66218', driver: '王建国', type: 'pickup', windowStart: iso(34), windowEnd: iso(64), lane: 'north', status: 'booked', sealVerified: false, weightVerified: false },
  { id: 'APT-9003', containerId: 'EISU-1288420', truckNo: '沪B·02891', driver: '赵晨', type: 'pickup', windowStart: iso(38), windowEnd: iso(68), lane: 'north', status: 'booked', sealVerified: false, weightVerified: false },
  { id: 'APT-9004', containerId: 'FCIU-9920310', truckNo: '沪A·7K229', driver: '陈海', type: 'pickup', windowStart: iso(4), windowEnd: iso(22), lane: 'south', status: 'booked', sealVerified: false, weightVerified: false, exception: '同一车辆相邻窗口过短' },
  { id: 'APT-9005', containerId: 'TEMU-1774029', truckNo: '沪C·55201', driver: '刘洋', type: 'pickup', windowStart: iso(150), windowEnd: iso(180), lane: 'north', status: 'booked', sealVerified: false, weightVerified: false }
];
export const equipment: Equipment[] = [
  { id: 'QC-07', name: '岸桥 QC-07', kind: 'quay-crane', status: 'working', location: 'B07 / MSC Aurora', battery: 96, queue: 4, movesPerHour: 31 },
  { id: 'YC-12', name: '场桥 YC-12', kind: 'yard-crane', status: 'working', location: 'B07-R03', battery: 72, queue: 9, movesPerHour: 24 },
  { id: 'YC-05', name: '场桥 YC-05', kind: 'yard-crane', status: 'available', location: 'C03-R06', battery: 88, queue: 3, movesPerHour: 27 },
  { id: 'TT-31', name: '集卡 TT-31', kind: 'terminal-truck', status: 'working', location: '南闸口', battery: 61, queue: 2, movesPerHour: 8 },
  { id: 'RS-02', name: '正面吊 RS-02', kind: 'reach-stacker', status: 'maintenance', location: 'D05', battery: 34, queue: 0, movesPerHour: 14 },
  { id: 'RS-04', name: '正面吊 RS-04', kind: 'reach-stacker', status: 'available', location: 'D05', battery: 82, queue: 1, movesPerHour: 16 }
];
export const tasks: YardTask[] = [
  { id: 'TASK-101', kind: 'deliver', containerId: 'MSCU-4829017', from: 'A01-R07-T3', to: '南闸口', equipmentId: 'YC-12', priority: 92, status: 'assigned', scheduledAt: iso(12), blockingReasons: [], estimatedMinutes: 18 },
  { id: 'TASK-102', kind: 'rehandle', containerId: 'EISU-1288420', from: 'B07-R03-T2', to: 'D05-R05-T1', equipmentId: 'YC-12', priority: 88, status: 'queued', scheduledAt: iso(24), blockingReasons: ['查验区插件余量接近阈值'], estimatedMinutes: 26 },
  { id: 'TASK-103', kind: 'inspect', containerId: 'TGHU-9831204', from: 'D05-R02-T1', to: 'D05-R02-T1', equipmentId: 'RS-02', priority: 125, status: 'blocked', scheduledAt: iso(4), blockingReasons: ['RS-02 维护中'], estimatedMinutes: 32 },
  { id: 'TASK-104', kind: 'load', containerId: 'FCIU-9920310', from: 'C03-R04-T2', to: 'B07 / VOY-QF2', equipmentId: 'YC-05', priority: 75, status: 'queued', scheduledAt: iso(76), blockingReasons: [], estimatedMinutes: 21 },
  { id: 'TASK-105', kind: 'inspect', containerId: 'SEGU-3355881', from: 'A01-R12-T2', to: 'D05-R01-T1', equipmentId: 'RS-04', priority: 80, status: 'assigned', scheduledAt: iso(15), blockingReasons: [], estimatedMinutes: 24 }
];
export const auditEvents: AuditEvent[] = [{ id: 'AUD-500', actor: '中控调度员', action: 'REPLAN', entity: 'voyage', entityId: 'VOY-AX7', at: new Date(start - 20 * 60000).toISOString(), details: '因 QC-07 瞬时降速，重新计算 14 个高优先级作业' }];

export const inspectionCases: InspectionCase[] = [
  { id: 'INS-301', containerId: 'TGHU-9831204', status: 'booked', windowStart: iso(20), windowEnd: iso(110), originSlot: 'D05-R02-T1', baySlot: 'D05-R02-T1', moveTaskId: 'TASK-103', equipmentId: 'RS-02', createdAt: iso(-60), updatedAt: iso(-14), overrides: [], events: [
    { id: 'INE-1', at: iso(-60), from: 'none', to: 'pending', action: 'open', actor: '海关风控', note: '危险品布控，开立查验流程' },
    { id: 'INE-2', at: iso(-16), from: 'pending', to: 'booked', action: 'book', actor: '中控调度员', note: '预约海关查验窗口' },
    { id: 'INE-3', at: iso(-14), from: 'booked', to: 'booked', action: 'dispatch', actor: '中控调度员', note: '指派 正面吊 RS-02 原地就位，设备维护中任务阻塞' }
  ] },
  { id: 'INS-302', containerId: 'TEMU-1774029', status: 'pending', originSlot: 'D05-R05-T1', createdAt: iso(-40), updatedAt: iso(-40), overrides: [], events: [
    { id: 'INE-4', at: iso(-40), from: 'none', to: 'pending', action: 'open', actor: '海关风控', note: '冷链进口箱抽查布控' }
  ] },
  { id: 'INS-303', containerId: 'SEGU-3355881', status: 'booked', windowStart: iso(10), windowEnd: iso(90), originSlot: 'A01-R12-T2', baySlot: 'D05-R01-T1', moveTaskId: 'TASK-105', equipmentId: 'RS-04', createdAt: iso(-50), updatedAt: iso(-25), overrides: [], events: [
    { id: 'INE-5', at: iso(-50), from: 'none', to: 'pending', action: 'open', actor: '海关风控', note: '进口箱抽查布控' },
    { id: 'INE-6', at: iso(-30), from: 'pending', to: 'booked', action: 'book', actor: '中控调度员', note: '预约海关查验窗口' },
    { id: 'INE-7', at: iso(-25), from: 'booked', to: 'booked', action: 'dispatch', actor: '中控调度员', note: '指派 正面吊 RS-04 执行移位 A01-R12-T2 → D05-R01-T1' }
  ] }
];
let inspectionSeq = 304; let inspectionEventSeq = 100; let inspectionOverrideSeq = 1;

function parseSlot(slot: string) { const match = slot.match(/^([A-Z]\d\d)-/); return match?.[1]; }
export function dashboard() {
  const activeVoyages = voyages.filter(v => v.status !== 'departed');
  const yardCapacity = blocks.reduce((sum, block) => sum + block.capacity, 0); const yardOccupied = blocks.reduce((sum, block) => sum + block.occupied, 0);
  return { activeVoyages: activeVoyages.length, berthMoves: activeVoyages.reduce((sum, v) => sum + v.movesPlanned - v.movesDone, 0), yardUtilization: yardOccupied / yardCapacity, gateQueue: appointments.filter(a => a.status === 'checked-in').length + 7, pendingTasks: tasks.filter(t => t.status !== 'done').length, blockedTasks: tasks.filter(t => t.status === 'blocked').length, reeferAlerts: containers.filter(c => c.reefer && (c.customs === 'inspection' || (c.temperature ?? 0) > 5)).length, hazmatHolds: containers.filter(c => c.hazmatClass && c.customs !== 'released').length, lateVessels: activeVoyages.filter(v => v.lateRisk === 'high').length, activeInspections: inspectionCases.filter(c => !INSPECTION_TERMINAL.includes(c.status)).length, detainedInspections: inspectionCases.filter(c => c.status === 'detained').length };
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
export function assignTask(id: string, equipmentId: string) { const task = tasks.find(item => item.id === id); const machine = equipment.find(item => item.id === equipmentId); if (!task || !machine) return undefined; const linked = inspectionCases.find(item => item.moveTaskId === id && item.status === 'booked'); if (linked) { reassignEquipment(linked, equipmentId, '中控调度员', `通过任务看板改派为 ${machine.name}`); return task; } const blockingReasons = [...task.blockingReasons]; if (machine.status === 'maintenance' || machine.status === 'offline') blockingReasons.push(`${machine.name} 当前不可用`); if (task.kind === 'inspect' && machine.kind !== 'reach-stacker') blockingReasons.push('查验作业需要正面吊或专用设备'); task.equipmentId = equipmentId; task.status = blockingReasons.length ? 'blocked' : 'assigned'; task.blockingReasons = blockingReasons; auditEvents.unshift({ id: `AUD-${Date.now()}`, actor: '中控调度员', action: 'ASSIGN_TASK', entity: 'yard-task', entityId: id, at: new Date().toISOString(), details: `${equipmentId} -> ${task.containerId}` }); return task; }
export function containerDetail(id: string) { const container = containers.find(item => item.id === id); if (!container) return undefined; return { container, voyage: voyages.find(v => v.id === container.voyageId), appointment: appointments.find(a => a.id === container.appointmentId), plan: containerPlan(id), tasks: tasks.filter(t => t.containerId === id), inspection: inspectionForContainer(id) }; }

// ============ 查验作业流程：状态机 + 联动 ============
export const INSPECTION_BLOCK = 'D05';
export const INSPECTION_TERMINAL: InspectionStatus[] = ['released', 'detained'];
export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = { pending: '待查验', booked: '已预约', positioned: '移入查验位', inspecting: '查验中', released: '已放行', detained: '已扣留' };

function blockOfSlot(slot?: string) { const id = slot ? parseSlot(slot) : undefined; return blocks.find(block => block.id === id); }
function mustContainer(containerId: string) { const container = containers.find(item => item.id === containerId); if (!container) throw new Error('箱号不存在'); return container; }
function mustCase(caseId: string) { const item = inspectionCases.find(entry => entry.id === caseId); if (!item) throw new Error('查验流程不存在'); return item; }
export function activeInspectionFor(containerId: string) { return inspectionCases.find(item => item.containerId === containerId && !INSPECTION_TERMINAL.includes(item.status)); }
export function inspectionForContainer(containerId: string) { const item = inspectionCases.find(entry => entry.containerId === containerId); return item ? inspectionView(item) : undefined; }

function pushEvent(item: InspectionCase, action: string, to: InspectionStatus, actor: string, note: string) {
  item.events.push({ id: `INE-${inspectionEventSeq++}`, at: new Date().toISOString(), from: item.status, to, action, actor, note });
  item.status = to; item.updatedAt = new Date().toISOString();
}
function logEvent(item: InspectionCase, action: string, actor: string, note: string) {
  item.events.push({ id: `INE-${inspectionEventSeq++}`, at: new Date().toISOString(), from: item.status, to: item.status, action, actor, note });
  item.updatedAt = new Date().toISOString();
}

/** 堆位联动：搬移时同步区块占用与冷藏插座计数，并更新箱台账堆位 */
function moveSlot(container: Container, toSlot: string) {
  const fromSlot = container.yardSlot;
  if (fromSlot === toSlot) return;
  const fromBlock = blockOfSlot(fromSlot); const toBlock = blockOfSlot(toSlot);
  if (fromBlock) { fromBlock.occupied = Math.max(0, fromBlock.occupied - 1); if (container.reefer && fromBlock.reeferPlugs > 0) fromBlock.usedPlugs = Math.max(0, fromBlock.usedPlugs - 1); }
  if (toBlock) { toBlock.occupied = Math.min(toBlock.capacity, toBlock.occupied + 1); if (container.reefer && toBlock.reeferPlugs > 0) toBlock.usedPlugs = Math.min(toBlock.reeferPlugs, toBlock.usedPlugs + 1); }
  container.yardSlot = toSlot;
}

/** 在指定区块分配空闲堆位；进行中查验流程已预留的查验位不参与分配 */
function allocateSlot(blockId: string): string | undefined {
  const block = blocks.find(item => item.id === blockId);
  if (!block || block.occupied >= block.capacity) return undefined;
  const used = new Set(containers.map(item => item.yardSlot));
  inspectionCases.filter(item => !INSPECTION_TERMINAL.includes(item.status)).forEach(item => { if (item.baySlot) used.add(item.baySlot); });
  for (let row = 1; row <= block.rows; row += 1) for (let tier = 1; tier <= block.tiers; tier += 1) {
    const slot = `${blockId}-R${String(row).padStart(2, '0')}-T${tier}`;
    if (!used.has(slot)) return slot;
  }
  return undefined;
}

function removeTaskInternal(taskId: string, reason: string) {
  const index = tasks.findIndex(item => item.id === taskId);
  if (index >= 0) { tasks.splice(index, 1); recordAudit('DELETE', 'yard-task', taskId, `查验流程联动移除：${reason}`); }
}

function createLinkedTask(input: Pick<YardTask, 'kind' | 'containerId' | 'from' | 'to' | 'priority' | 'estimatedMinutes'> & { equipmentId?: string; blockingReasons?: string[]; scheduledAt?: string }) {
  const item: YardTask = { id: `TASK-${Date.now()}-${Math.floor(Math.random() * 1000)}`, kind: input.kind, containerId: input.containerId, from: input.from, to: input.to, equipmentId: input.equipmentId, priority: input.priority, status: input.equipmentId ? (input.blockingReasons?.length ? 'blocked' : 'assigned') : 'queued', scheduledAt: input.scheduledAt ?? new Date().toISOString(), blockingReasons: input.blockingReasons ?? [], estimatedMinutes: input.estimatedMinutes };
  tasks.unshift(item);
  return item;
}

export function openInspectionCase(containerId: string, note = '', actor = '中控调度员') {
  const container = mustContainer(containerId);
  const existing = activeInspectionFor(containerId);
  if (existing) throw new Error(`该箱已存在进行中的查验流程 ${existing.id}（${INSPECTION_STATUS_LABEL[existing.status]}）`);
  container.customs = 'inspection';
  const item: InspectionCase = { id: `INS-${inspectionSeq++}`, containerId, status: 'pending', originSlot: container.yardSlot, events: [], overrides: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  inspectionCases.unshift(item);
  item.events.push({ id: `INE-${inspectionEventSeq++}`, at: new Date().toISOString(), from: 'none', to: 'pending', action: 'open', actor, note: note || '海关布控，开立查验流程' });
  container.lastEvent = '开立查验流程，待预约窗口';
  recordAudit('INSPECTION_OPEN', 'inspection', item.id, `${containerId} 开立查验流程`);
  return item;
}

function bookWindow(item: InspectionCase, payload: { windowStart?: string; windowEnd?: string }, actor: string) {
  if (item.status !== 'pending') throw new Error(`当前状态为「${INSPECTION_STATUS_LABEL[item.status]}」，不能预约查验窗口`);
  if (!payload.windowStart || !payload.windowEnd) throw new Error('请提供查验窗口起止时间');
  if (new Date(payload.windowEnd) <= new Date(payload.windowStart)) throw new Error('窗口结束时间必须晚于开始时间');
  item.windowStart = payload.windowStart; item.windowEnd = payload.windowEnd;
  pushEvent(item, 'book', 'booked', actor, `预约查验窗口 ${new Date(payload.windowStart).toLocaleString()} — ${new Date(payload.windowEnd).toLocaleString()}`);
  mustContainer(item.containerId).lastEvent = '查验窗口已预约，待指派设备';
  recordAudit('INSPECTION_BOOK', 'inspection', item.id, `${item.containerId} 预约查验窗口`);
}

function dispatchMove(item: InspectionCase, equipmentId: string, actor: string) {
  if (item.status !== 'booked') throw new Error(`当前状态为「${INSPECTION_STATUS_LABEL[item.status]}」，不能指派移位设备`);
  if (item.moveTaskId) throw new Error('已生成移位任务，如需更换设备请使用「重新指派」');
  const machine = equipment.find(entry => entry.id === equipmentId);
  if (!machine) throw new Error('设备不存在');
  if (machine.kind !== 'reach-stacker') throw new Error('查验移位需要正面吊（reach-stacker）');
  const container = mustContainer(item.containerId);
  const alreadyInBay = parseSlot(container.yardSlot) === INSPECTION_BLOCK;
  const baySlot = alreadyInBay ? container.yardSlot : allocateSlot(INSPECTION_BLOCK);
  if (!baySlot) throw new Error('查验区已满，无可用查验位');
  const bayBlock = blockOfSlot(INSPECTION_BLOCK);
  if (container.reefer && !alreadyInBay && bayBlock && bayBlock.usedPlugs >= bayBlock.reeferPlugs) throw new Error('查验区冷藏插座不足，无法安排冷藏箱进入');
  const blockingReasons: string[] = [];
  if (machine.status === 'maintenance' || machine.status === 'offline') blockingReasons.push(`${machine.name} 当前不可用`);
  const task = createLinkedTask({ kind: 'inspect', containerId: item.containerId, from: container.yardSlot, to: baySlot, equipmentId, priority: 90, estimatedMinutes: 25, blockingReasons, scheduledAt: item.windowStart });
  item.moveTaskId = task.id; item.equipmentId = equipmentId; item.baySlot = baySlot;
  logEvent(item, 'dispatch', actor, blockingReasons.length ? `指派 ${machine.name} 生成移位任务 ${task.id}，任务阻塞：${blockingReasons.join('；')}` : `指派 ${machine.name} 执行移位 ${task.from} → ${task.to}（任务 ${task.id}）`);
  container.lastEvent = `移位任务 ${task.id} 已生成`;
  recordAudit('INSPECTION_DISPATCH', 'inspection', item.id, `${item.containerId} 指派 ${equipmentId}，任务 ${task.id}`);
}

function reassignEquipment(item: InspectionCase, equipmentId: string, actor: string, note?: string) {
  if (item.status !== 'booked' || !item.moveTaskId) throw new Error('仅「已预约」且已生成移位任务的流程可重派设备');
  const task = tasks.find(entry => entry.id === item.moveTaskId);
  if (!task) throw new Error('关联移位任务不存在');
  const machine = equipment.find(entry => entry.id === equipmentId);
  if (!machine) throw new Error('设备不存在');
  if (machine.kind !== 'reach-stacker') throw new Error('查验移位需要正面吊（reach-stacker）');
  const kept = task.blockingReasons.filter(reason => !equipment.some(entry => reason.includes(entry.name) || reason.includes(entry.id)) && !reason.includes('不可用'));
  if (machine.status === 'maintenance' || machine.status === 'offline') kept.push(`${machine.name} 当前不可用`);
  task.equipmentId = equipmentId; task.blockingReasons = kept; task.status = kept.length ? 'blocked' : 'assigned';
  item.equipmentId = equipmentId;
  logEvent(item, 'reassign-equipment', actor, note || `设备重派为 ${machine.name}${kept.length ? '，任务仍阻塞' : '，任务恢复可执行'}`);
  mustContainer(item.containerId).lastEvent = `移位设备重派为 ${machine.name}`;
  recordAudit('INSPECTION_REASSIGN', 'inspection', item.id, `${item.containerId} 重派设备 ${equipmentId}`);
}

function completeArrival(item: InspectionCase, actor: string, note?: string) {
  const container = mustContainer(item.containerId);
  const task = tasks.find(entry => entry.id === item.moveTaskId);
  if (task && task.status !== 'done') task.status = 'done';
  moveSlot(container, item.baySlot!);
  pushEvent(item, 'arrive', 'positioned', actor, note || `已移入查验位 ${item.baySlot}`);
  container.lastEvent = `已到位 ${item.baySlot}，等待海关查验`;
  recordAudit('INSPECTION_POSITIONED', 'inspection', item.id, `${item.containerId} 到位 ${item.baySlot}`);
}

function arriveBay(item: InspectionCase, actor: string, note?: string) {
  if (item.status !== 'booked') throw new Error(`当前状态为「${INSPECTION_STATUS_LABEL[item.status]}」，不能确认到位`);
  if (!item.moveTaskId || !item.baySlot) throw new Error('请先指派设备生成移位任务');
  const task = tasks.find(entry => entry.id === item.moveTaskId);
  if (task?.status === 'blocked') throw new Error(`移位任务阻塞中：${task.blockingReasons.join('；')}`);
  completeArrival(item, actor, note);
}

function startInspection(item: InspectionCase, actor: string, note?: string) {
  if (item.status !== 'positioned') throw new Error(`当前状态为「${INSPECTION_STATUS_LABEL[item.status]}」，不能开始查验`);
  pushEvent(item, 'start', 'inspecting', actor, note || '海关开始查验');
  mustContainer(item.containerId).lastEvent = '海关查验中';
  recordAudit('INSPECTION_START', 'inspection', item.id, `${item.containerId} 开始查验`);
}

function applyRelease(item: InspectionCase, messageId: string, actor: string, note: string) {
  const container = mustContainer(item.containerId);
  item.releaseMessageId = messageId;
  container.customs = 'released';
  if (container.status === 'hold') container.status = 'in-yard';
  const plan = containerPlan(container.id);
  const targetSlot = plan?.recommendedBlock ? allocateSlot(plan.recommendedBlock.id) : undefined;
  let moveNote = '';
  if (targetSlot && targetSlot !== container.yardSlot) {
    const task = createLinkedTask({ kind: 'rehandle', containerId: item.containerId, from: container.yardSlot, to: targetSlot, priority: 60, estimatedMinutes: 20 });
    moveSlot(container, targetSlot);
    moveNote = `；放行后移出查验区 → ${targetSlot}（任务 ${task.id}）`;
  }
  pushEvent(item, 'release', 'released', actor, `${note}${moveNote}`);
  container.lastEvent = '海关放行，查验闭环';
  recordAudit('INSPECTION_RELEASE', 'inspection', item.id, `${item.containerId} 海关放行，报文 ${messageId}`);
}

/** 放行登记：按报文号幂等，重复到达的放行消息不会重复推进或重复联动 */
function releaseCase(item: InspectionCase, messageId: string | undefined, actor: string, note?: string): boolean {
  if (item.status === 'released') {
    if (messageId && item.releaseMessageId === messageId) return true;
    logEvent(item, 'release-duplicate', actor, `重复放行报文 ${messageId ?? '未携带报文号'} 已忽略`);
    return true;
  }
  if (item.status !== 'inspecting') throw new Error(`当前状态为「${INSPECTION_STATUS_LABEL[item.status]}」，不能登记放行（仅查验中可放行）`);
  applyRelease(item, messageId || `AUTO-${Date.now()}`, actor, note || `海关放行报文 ${messageId ?? '自动生成'}`);
  return false;
}

function applyDetain(item: InspectionCase, reason: string, actor: string) {
  const container = mustContainer(item.containerId);
  item.detentionReason = reason;
  container.customs = 'hold'; container.status = 'hold';
  let suspended = 0;
  appointments.forEach(appointment => { if (appointment.containerId === item.containerId && appointment.type === 'pickup' && (appointment.status === 'booked' || appointment.status === 'checked-in')) { appointment.status = 'exception'; appointment.exception = '海关扣留，暂停提箱'; suspended += 1; } });
  pushEvent(item, 'detain', 'detained', actor, `海关扣留：${reason}${suspended ? `；${suspended} 条提箱预约已挂起` : ''}`);
  container.lastEvent = `海关扣留：${reason}`;
  recordAudit('INSPECTION_DETAIN', 'inspection', item.id, `${item.containerId} 海关扣留：${reason}`);
}

function detainCase(item: InspectionCase, reason: string | undefined, actor: string) {
  if (item.status !== 'inspecting' && item.status !== 'positioned') throw new Error(`当前状态为「${INSPECTION_STATUS_LABEL[item.status]}」，不能登记扣留`);
  if (!reason || reason.trim().length < 4) throw new Error('扣留必须填写原因（至少 4 个字符）');
  applyDetain(item, reason.trim(), actor);
}

/** 窗口取消 / 人工回退：清理移位任务，已入查验位的箱退回原堆位 */
function rollbackToPending(item: InspectionCase, action: 'cancel-window' | 'override', actor: string, note: string) {
  const container = mustContainer(item.containerId);
  if (item.moveTaskId) removeTaskInternal(item.moveTaskId, '查验流程回退');
  if (item.baySlot && container.yardSlot === item.baySlot && item.baySlot !== item.originSlot) {
    createLinkedTask({ kind: 'rehandle', containerId: item.containerId, from: item.baySlot, to: item.originSlot, priority: 55, estimatedMinutes: 20 });
    moveSlot(container, item.originSlot);
  }
  item.windowStart = undefined; item.windowEnd = undefined; item.moveTaskId = undefined; item.equipmentId = undefined; item.baySlot = undefined;
  pushEvent(item, action, 'pending', actor, note);
  container.lastEvent = '查验流程回退，待重新预约窗口';
  recordAudit('INSPECTION_ROLLBACK', 'inspection', item.id, `${item.containerId} 回退待查验`);
}

function cancelWindow(item: InspectionCase, actor: string, note?: string) {
  if (item.status !== 'booked' && item.status !== 'positioned') throw new Error(`当前状态为「${INSPECTION_STATUS_LABEL[item.status]}」，不能取消窗口回退`);
  rollbackToPending(item, 'cancel-window', actor, note || '海关查验窗口取消，流程回退待查验');
}

/** 人工覆盖：必须填写原因，全程留痕；已闭环（放行/扣留）的流程不允许覆盖 */
function overrideCase(item: InspectionCase, toStatus: InspectionStatus | undefined, reason: string | undefined, actor: string) {
  if (INSPECTION_TERMINAL.includes(item.status)) throw new Error('流程已闭环（放行/扣留），如需重新查验请开立新的查验流程');
  if (!reason || reason.trim().length < 4) throw new Error('人工覆盖必须填写原因（至少 4 个字符）');
  const allowed: InspectionStatus[] = ['pending', 'positioned', 'released', 'detained'];
  if (!toStatus || !allowed.includes(toStatus)) throw new Error('人工覆盖仅支持：回退待查验、强制到位、强制放行、强制扣留');
  if (toStatus === item.status) throw new Error('覆盖目标与当前状态相同');
  const trimmed = reason.trim();
  item.overrides.push({ id: `INO-${inspectionOverrideSeq++}`, at: new Date().toISOString(), actor, action: `覆盖为「${INSPECTION_STATUS_LABEL[toStatus]}」`, reason: trimmed });
  recordAudit('INSPECTION_OVERRIDE', 'inspection', item.id, `${item.containerId} 人工覆盖 ${INSPECTION_STATUS_LABEL[item.status]} → ${INSPECTION_STATUS_LABEL[toStatus]}：${trimmed}`);
  if (toStatus === 'released') applyRelease(item, `OVERRIDE-${Date.now()}`, actor, `人工覆盖放行：${trimmed}`);
  else if (toStatus === 'detained') applyDetain(item, trimmed, actor);
  else if (toStatus === 'pending') rollbackToPending(item, 'override', actor, `人工覆盖回退：${trimmed}`);
  else {
    const container = mustContainer(item.containerId);
    if (!item.baySlot) {
      if (parseSlot(container.yardSlot) === INSPECTION_BLOCK) item.baySlot = container.yardSlot;
      else { const slot = allocateSlot(INSPECTION_BLOCK); if (!slot) throw new Error('查验区已满，无法强制到位'); item.baySlot = slot; }
    }
    if (item.moveTaskId) { const task = tasks.find(entry => entry.id === item.moveTaskId); if (task) task.status = 'done'; }
    moveSlot(container, item.baySlot);
    pushEvent(item, 'override', 'positioned', actor, `人工覆盖到位：${trimmed}`);
    container.lastEvent = `人工覆盖到位 ${item.baySlot}`;
  }
}

export interface InspectionActionPayload { windowStart?: string; windowEnd?: string; equipmentId?: string; messageId?: string; reason?: string; note?: string; toStatus?: InspectionStatus; actor?: string; }
export function runInspectionAction(caseId: string, action: InspectionAction, payload: InspectionActionPayload) {
  const item = inspectionCases.find(entry => entry.id === caseId);
  if (!item) return undefined;
  const actor = payload.actor?.trim() || '中控调度员';
  let duplicate = false;
  switch (action) {
    case 'book': bookWindow(item, payload, actor); break;
    case 'dispatch': dispatchMove(item, payload.equipmentId ?? '', actor); break;
    case 'reassign-equipment': reassignEquipment(item, payload.equipmentId ?? '', actor, payload.note); break;
    case 'arrive': arriveBay(item, actor, payload.note); break;
    case 'start': startInspection(item, actor, payload.note); break;
    case 'release': duplicate = releaseCase(item, payload.messageId, actor, payload.note); break;
    case 'detain': detainCase(item, payload.reason, actor); break;
    case 'cancel-window': cancelWindow(item, actor, payload.note); break;
    case 'override': overrideCase(item, payload.toStatus, payload.reason, actor); break;
    default: throw new Error('未知的查验流程操作');
  }
  return { view: inspectionView(item), duplicate };
}

function nextActions(item: InspectionCase): InspectionActionInfo[] {
  const moveTask = tasks.find(entry => entry.id === item.moveTaskId);
  const machine = equipment.find(entry => entry.id === item.equipmentId);
  const equipmentFaulty = !!machine && (machine.status === 'maintenance' || machine.status === 'offline');
  switch (item.status) {
    case 'pending': return [{ action: 'book', label: '预约查验窗口', tone: 'primary' }];
    case 'booked': {
      if (!item.moveTaskId) return [{ action: 'dispatch', label: '指派正面吊并生成移位任务', tone: 'primary' }, { action: 'cancel-window', label: '取消查验窗口', tone: 'neutral' }];
      const blocked = !moveTask || moveTask.status === 'blocked';
      const actions: InspectionActionInfo[] = [];
      if (equipmentFaulty || blocked) actions.push({ action: 'reassign-equipment', label: equipmentFaulty ? '设备故障 · 重新指派' : '任务阻塞 · 重新指派', tone: 'primary' });
      actions.push({ action: 'arrive', label: '确认已移入查验位', tone: blocked ? 'neutral' : 'primary', ...(blocked ? { disabledReason: `移位任务阻塞：${moveTask?.blockingReasons.join('；') || '任务缺失'}` } : {}) });
      if (!equipmentFaulty && !blocked) actions.push({ action: 'reassign-equipment', label: '改派设备', tone: 'neutral' });
      actions.push({ action: 'cancel-window', label: '取消查验窗口', tone: 'neutral' });
      return actions;
    }
    case 'positioned': return [{ action: 'start', label: '开始查验', tone: 'primary' }, { action: 'cancel-window', label: '取消窗口并回退', tone: 'neutral' }, { action: 'detain', label: '海关扣留', tone: 'danger' }];
    case 'inspecting': return [{ action: 'release', label: '登记海关放行', tone: 'primary' }, { action: 'detain', label: '海关扣留', tone: 'danger' }];
    default: return [];
  }
}

export function inspectionView(item: InspectionCase) {
  const container = containers.find(entry => entry.id === item.containerId);
  const moveTask = tasks.find(entry => entry.id === item.moveTaskId);
  const machine = equipment.find(entry => entry.id === item.equipmentId);
  const equipmentFaulty = !!machine && (machine.status === 'maintenance' || machine.status === 'offline');
  return { ...item, container, moveTask, equipmentFaulty, nextActions: nextActions(item), canOverride: !INSPECTION_TERMINAL.includes(item.status) };
}
export type InspectionView = ReturnType<typeof inspectionView>;
export function getInspectionView(id: string) { const item = inspectionCases.find(entry => entry.id === id); return item ? inspectionView(item) : undefined; }
export function listInspections() { return [...inspectionCases].sort((a, b) => Number(INSPECTION_TERMINAL.includes(a.status)) - Number(INSPECTION_TERMINAL.includes(b.status)) || b.updatedAt.localeCompare(a.updatedAt)).map(inspectionView); }

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
  if (patch.customs && patch.customs !== item.customs) {
    const active = activeInspectionFor(id);
    if (active) throw new Error(`该箱存在进行中的查验流程 ${active.id}，海关状态须通过查验流程推进，不能直接改台账`);
  }
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
  const active = activeInspectionFor(id);
  if (active) throw new Error(`该箱存在进行中的查验流程 ${active.id}，请先推进或回退闭环后再删除`);
  const [item] = containers.splice(index, 1);
  const removedAppointments = appointments.filter(appointment => appointment.containerId === id);
  for (const appointment of removedAppointments) appointments.splice(appointments.indexOf(appointment), 1);
  const removedTasks = tasks.filter(task => task.containerId === id);
  for (const task of removedTasks) tasks.splice(tasks.indexOf(task), 1);
  const removedInspections = inspectionCases.filter(entry => entry.containerId === id);
  for (const entry of removedInspections) inspectionCases.splice(inspectionCases.indexOf(entry), 1);
  recordAudit('DELETE', 'container', id, `删除箱务记录，并级联清理 ${removedAppointments.length} 条预约、${removedTasks.length} 条未完成任务、${removedInspections.length} 条已闭环查验流程`);
  return item;
}

export function createGateAppointment(input: AppointmentInput) {
  const container = containers.find(item => item.id === input.containerId);
  if (!container) throw new Error('箱号不存在');
  if (input.type === 'pickup' && container.customs !== 'released') throw new Error(container.customs === 'hold' ? '海关扣留中，禁止预约提箱' : '海关未放行，不能预约提箱');
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
  if (item.status === 'done') {
    const linked = inspectionCases.find(entry => entry.moveTaskId === item.id && entry.status === 'booked');
    if (linked) completeArrival(linked, '系统·任务联动', `移位任务 ${item.id} 完成，自动确认到位`);
  }
  recordAudit('UPDATE', 'yard-task', id, `更新场内作业任务：${JSON.stringify(patch)}`);
  return item;
}

export function deleteYardTask(id: string) {
  const index = tasks.findIndex(item => item.id === id);
  if (index < 0) return undefined;
  const linked = inspectionCases.find(entry => entry.moveTaskId === id && !INSPECTION_TERMINAL.includes(entry.status));
  if (linked) throw new Error(`该任务关联查验流程 ${linked.id}（${INSPECTION_STATUS_LABEL[linked.status]}），请在查验流程中取消窗口或推进处理`);
  const [item] = tasks.splice(index, 1);
  recordAudit('DELETE', 'yard-task', id, `删除 ${item.containerId} 的场内任务`);
  return item;
}
