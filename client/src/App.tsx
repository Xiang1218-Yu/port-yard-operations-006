import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Dashboard = { activeVoyages: number; berthMoves: number; yardUtilization: number; gateQueue: number; pendingTasks: number; blockedTasks: number; reeferAlerts: number; hazmatHolds: number; lateVessels: number; inspectionPending?: number; inspectionDetained?: number; inspectionBlocked?: number };
type InspectionState = 'pending' | 'appointed' | 'positioned' | 'inspecting' | 'released' | 'detained';
type FlowAction = 'book_window' | 'cancel_window' | 'move_to_bay' | 'start_inspection' | 'release' | 'detain' | 'reassign';
type InspectionWindow = { start: string; end: string; bay: string; officer: string; status: 'active' | 'cancelled' | 'closed'; cancelReason?: string };
type InspectionEvent = { id: string; at: string; actor: string; action: string; from: InspectionState | '-'; to: InspectionState; reason?: string; override: boolean; duplicate?: boolean; messageId?: string; details: string };
type FlowActionDescriptor = { action: FlowAction; label: string; kind: 'operate' | 'customs' | 'danger' | 'device'; requires?: Array<'window' | 'reason' | 'equipment' | 'messageId'>; disabledReason?: string };
type FlowOverrideDescriptor = { target: InspectionState; label: string; reasonRequired: true };
type InspectionFlow = { id: string; containerId: string; round: number; state: InspectionState; stateLabel: string; originSlot: string; currentBay?: string; windows: InspectionWindow[]; taskId?: string; equipmentId?: string; releaseMessageId?: string; detainReason?: string; updatedAt: string; history: InspectionEvent[]; container: Container; linkedTask?: Task; equipment?: Equipment; appointment?: Appointment; availableActions: FlowActionDescriptor[]; availableOverrides: FlowOverrideDescriptor[] };
type Voyage = { id: string; vessel: string; service: string; eta: string; etd: string; status: string; berth: string; movesPlanned: number; movesDone: number; lateRisk: string };
type Container = { id: string; voyageId: string; size: '20'|'40'|'45'; isoType: string; direction: 'import'|'export'|'transshipment'; status: string; weightT: number; reefer: boolean; temperature?: number; hazmatClass?: string; customs: 'released'|'inspection'|'hold'; priority: string; yardSlot: string; appointmentId?: string; lastEvent: string };
type Block = { id: string; zone: string; capacity: number; occupied: number; reeferPlugs: number; usedPlugs: number; hazmatAllowed: boolean; heat: number; utilization: number; freeSlots: number; pressure: string };
type Conflict = { severity: string; appointmentId: string; reason: string };
type Appointment = { id: string; containerId: string; truckNo: string; driver: string; type: 'pickup'|'dropoff'; windowStart: string; windowEnd: string; lane: 'north'|'south'|'rail'; status: string; exception?: string };
type Task = { id: string; kind: string; containerId: string; from: string; to: string; equipmentId?: string; priority: number; score?: number; status: string; blockingReasons: string[]; estimatedMinutes: number; scheduledAt: string };
type Equipment = { id: string; name: string; kind: string; status: string; location: string; battery: number; queue: number; movesPerHour: number };
type Section = 'control'|'containers'|'inspection'|'gate'|'yard'|'tasks';
type Editor = { entity: 'container'|'appointment'|'task'; mode: 'create'|'edit'; id?: string; values: Record<string, string|boolean> };

const api = '/api';
const pct = (value: number) => `${Math.round(value * 100)}%`;
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dateTime = (value: string) => new Date(value).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const FLOW_STATE_LABELS: Record<InspectionState, string> = { pending: '待查验', appointed: '已预约', positioned: '移入查验位', inspecting: '查验中', released: '放行', detained: '扣留' };
const FLOW_PIPELINE: InspectionState[] = ['pending', 'appointed', 'positioned', 'inspecting', 'released'];
const FLOW_ACTION_LABELS: Record<string, string> = {
  CREATE: '建立查验流程', BOOK_WINDOW: '预约查验窗口', CANCEL_WINDOW: '取消查验窗口', MOVE_TO_BAY: '移入查验位',
  START_INSPECTION: '开始查验', RELEASE: '海关放行', DETAIN: '海关扣留', REASSIGN: '重派正面吊',
  EQUIPMENT_FAULT: '设备故障', REPAIR: '设备修复', RETURN_TO_YARD: '复位回场区', OVERRIDE: '人工覆盖状态'
};
const toLocalInput = (value?: string) => {
  const date = value ? new Date(value) : new Date(Date.now() + 30 * 60000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const defaultValues = (entity: Editor['entity']): Record<string, string|boolean> => {
  if (entity === 'container') return { id: '', voyageId: 'VOY-AX7', size: '40', isoType: '45G1', direction: 'import', status: 'in-yard', weightT: '20', reefer: false, temperature: '4', hazmatClass: '', customs: 'released', priority: 'normal', yardSlot: 'C03-R01-T1' };
  if (entity === 'appointment') return { containerId: '', truckNo: '', driver: '', type: 'pickup', windowStart: toLocalInput(), windowEnd: toLocalInput(new Date(Date.now() + 60 * 60000).toISOString()), lane: 'north' };
  return { kind: 'receive', containerId: '', from: '闸口', to: 'C03-R01-T1', equipmentId: '', priority: '50', scheduledAt: toLocalInput(), estimatedMinutes: '20', status: 'queued' };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${api}${path}`, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `请求失败 (${response.status})`);
  return body as T;
}

function FlowActionForm({ flow, descriptor, equipmentList, busy, onSubmit }: { flow: InspectionFlow; descriptor: FlowActionDescriptor; equipmentList: Equipment[]; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const activeWindow = flow.windows.find(window => window.status === 'active');
  const [equipmentId, setEquipmentId] = useState(flow.equipmentId ?? '');
  const [reason, setReason] = useState('');
  const [messageId, setMessageId] = useState('');
  const [start, setStart] = useState(toLocalInput(activeWindow?.start));
  const [end, setEnd] = useState(toLocalInput(activeWindow ? activeWindow.end : new Date(Date.now() + 40 * 60000).toISOString()));
  const [bay, setBay] = useState(activeWindow?.bay ?? 'D05-BAY-01');
  const [officer, setOfficer] = useState(activeWindow?.officer ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (descriptor.requires?.includes('reason') && !reason.trim()) { setError2('该动作必须填写原因'); return; }
    const body: Record<string, unknown> = {};
    if (descriptor.requires?.includes('window')) Object.assign(body, { windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(), bay, officer });
    if (descriptor.requires?.includes('equipment')) body.equipmentId = equipmentId;
    if (descriptor.requires?.includes('reason')) body.reason = reason.trim();
    if (descriptor.requires?.includes('messageId')) body.messageId = messageId.trim() || `MSG-WEB-${Date.now()}`;
    onSubmit(body);
  };
  const [localError, setError2] = useState('');

  return <form className="flow-action-form" onSubmit={submit}>
    {descriptor.requires?.includes('window') && <div className="form-grid">
      <label>窗口开始<input type="datetime-local" required value={start} onChange={event => setStart(event.target.value)}/></label>
      <label>窗口结束<input type="datetime-local" required value={end} onChange={event => setEnd(event.target.value)}/></label>
      <label>查验位<input required value={bay} onChange={event => setBay(event.target.value.toUpperCase())}/></label>
      <label>查验关员<input required placeholder="例如 海关 周科" value={officer} onChange={event => setOfficer(event.target.value)}/></label>
    </div>}
    {descriptor.requires?.includes('equipment') && <label className="flow-field">指派 / 重派正面吊
      <select required value={equipmentId} onChange={event => setEquipmentId(event.target.value)}>
        <option value="">选择可用正面吊</option>
        {equipmentList.map(item => <option key={item.id} value={item.id} disabled={item.status === 'maintenance' || item.status === 'offline'}>{item.name} · {item.status}</option>)}
      </select>
    </label>}
    {descriptor.requires?.includes('reason') && <label className="flow-field">原因（强制留痕）<textarea required rows={2} placeholder={descriptor.action === 'detain' ? '海关扣留原因，例如 申报品名与实际货物不符' : descriptor.action === 'cancel_window' ? '窗口取消原因，例如 查验关员临时撤回' : '说明现场原因'} value={reason} onChange={event => setReason(event.target.value)}/></label>}
    {descriptor.requires?.includes('messageId') && <label className="flow-field">海关消息编号（留空自动生成）<input value={messageId} onChange={event => setMessageId(event.target.value)} placeholder="重复消息使用同一编号可幂等去重"/></label>}
    {localError && <div className="form-error">{localError}</div>}
    <button className={`primary-action flow-btn-${descriptor.kind}`} disabled={busy || Boolean(descriptor.disabledReason)}>{busy ? '执行中…' : descriptor.label}{descriptor.disabledReason ? `（${descriptor.disabledReason}）` : ''}</button>
  </form>;
}

function FlowModal({ flow, equipmentList, busy, onClose, onAction, onOverride, onCustoms }: {
  flow: InspectionFlow; equipmentList: Equipment[]; busy: boolean; onClose: () => void;
  onAction: (descriptor: FlowActionDescriptor, body: Record<string, unknown>) => void;
  onOverride: (target: InspectionState, reason: string) => void;
  onCustoms: (decision: 'release' | 'detain', body: { messageId?: string; reason?: string }) => void;
}) {
  const [activeAction, setActiveAction] = useState<FlowAction>();
  const [overrideTarget, setOverrideTarget] = useState<InspectionState | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
  const activeWindow = flow.windows.find(window => window.status === 'active');
  const currentIndex = flow.state === 'detained' ? FLOW_PIPELINE.indexOf('inspecting') : FLOW_PIPELINE.indexOf(flow.state);

  const submitAction = (descriptor: FlowActionDescriptor, body: Record<string, unknown>) => {
    if (descriptor.action === 'release' || descriptor.action === 'detain') { onCustoms(descriptor.action, body as { messageId?: string; reason?: string }); return; }
    onAction(descriptor, body);
    setActiveAction(undefined);
  };

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="editor-modal flow-modal">
      <div className="modal-head"><div>
        <div className="eyebrow">INSPECTION WORKFLOW / {flow.id} · 第 {flow.round} 轮</div>
        <h2>{flow.containerId} <span className={`pill flow-state-${flow.state}`}>{flow.stateLabel}</span></h2>
      </div><button type="button" className="icon-button" onClick={onClose}>×</button></div>

      <div className={`flow-pipeline detained-${flow.state === 'detained'}`}>
        {FLOW_PIPELINE.map((state, index) => <div key={state} className={`flow-step ${index <= currentIndex ? 'done' : ''} ${flow.state === state ? 'current' : ''} ${flow.state === 'detained' && state === 'released' ? 'blocked-end' : ''}`}>
          <i>{index + 1}</i><span>{FLOW_STATE_LABELS[state]}</span>{index < FLOW_PIPELINE.length - 1 && <em/>}
        </div>)}
        {flow.state === 'detained' && <div className="flow-detained-branch"><b>扣留</b><small>{flow.detainReason ?? ''}</small></div>}
      </div>
      {flow.state === 'released' && flow.releaseMessageId && <div className="callout flow-note"><strong>已放行</strong><span>放行消息 {flow.releaseMessageId}；重复到达的放行消息会被幂等忽略。如需二次查验，只能在下方人工覆盖并填写原因，系统不提供直达状态的下拉菜单。</span></div>}
      {flow.state === 'detained' && <div className="conflict"><strong>detained</strong><b>海关扣留</b><span>{flow.detainReason}｜闸口已拦截该箱所有提箱动作，只有解除扣留/放行闭环才能恢复。</span></div>}

      <div className="flow-linked">
        <div className="flow-linked-card"><small>查验窗口</small>{activeWindow ? <b>{dateTime(activeWindow.start)}–{time(activeWindow.end)}<em>{activeWindow.bay} · {activeWindow.officer}</em></b> : flow.windows[0] ? <b className="muted">最近窗口已{flow.windows[0].status === 'cancelled' ? `取消（${flow.windows[0].cancelReason}）` : '关闭'}</b> : <b className="muted">尚未预约</b>}</div>
        <div className="flow-linked-card"><small>联动场内任务</small>{flow.linkedTask ? <><b>{flow.linkedTask.id} · {flow.linkedTask.kind}</b><em className={flow.linkedTask.status === 'blocked' ? 'blocked-text' : ''}>{flow.linkedTask.from} → {flow.linkedTask.to}｜{flow.linkedTask.status}</em>{flow.linkedTask.blockingReasons.map(reason => <em key={reason} className="blocked-text">{reason}</em>)}</> : <b className="muted">无活动任务</b>}</div>
        <div className="flow-linked-card"><small>设备指派</small>{flow.equipment ? <><b>{flow.equipment.name}</b><em className={flow.equipment.status === 'maintenance' ? 'blocked-text' : ''}>{flow.equipment.status} · {flow.equipment.location}</em></> : <b className="muted">待指派正面吊</b>}</div>
        <div className="flow-linked-card"><small>堆位变化</small><b>{flow.originSlot}{flow.currentBay ? ` → ${flow.currentBay}` : ''}</b><em>当前台账堆位：{flow.container.yardSlot}</em></div>
        <div className="flow-linked-card"><small>闸口提箱预约</small>{flow.appointment ? <><b>{flow.appointment.id} · {flow.appointment.truckNo}</b><em className={flow.appointment.status === 'exception' ? 'blocked-text' : ''}>{appointmentStatusLabel(flow.appointment.status)}{flow.appointment.exception ? `｜${flow.appointment.exception}` : ''}</em></> : <b className="muted">无提箱预约</b>}</div>
      </div>

      <div className="flow-actions-head"><div className="eyebrow">NEXT ACTIONS / 仅服务端状态机允许的动作</div></div>
      <div className="flow-actions">
        {flow.availableActions.length === 0 && <div className="muted terminal-note">当前为终态（{flow.stateLabel}），没有可继续推进的动作；如需回退请使用下方人工覆盖。</div>}
        {flow.availableActions.map(descriptor => <div key={descriptor.action} className="flow-action-slot">
          {activeAction === descriptor.action
            ? <FlowActionForm key={descriptor.action} flow={flow} descriptor={descriptor} equipmentList={equipmentList} busy={busy} onSubmit={body => submitAction(descriptor, body)} />
            : <button className={`flow-quick flow-quick-${descriptor.kind}`} disabled={Boolean(descriptor.disabledReason)} title={descriptor.disabledReason} onClick={() => { setActiveAction(descriptor.action); setOverrideTarget(''); }}>{descriptor.label}{descriptor.disabledReason ? <small>{descriptor.disabledReason}</small> : null}</button>}
          {activeAction === descriptor.action && <button type="button" className="flow-cancel-inline" onClick={() => setActiveAction(undefined)}>收起</button>}
        </div>)}
      </div>

      <div className="flow-override">
        <div className="eyebrow">MANUAL OVERRIDE / 人工覆盖（每次强制记录原因）</div>
        {flow.availableOverrides.length === 0 ? <p className="muted">待查验为流程起点，无更早状态可回退。</p> : <>
          <div className="flow-override-row">
            <select value={overrideTarget} onChange={event => setOverrideTarget(event.target.value as InspectionState | '')}>
              <option value="">选择允许的回退目标…</option>
              {flow.availableOverrides.map(item => <option key={item.target} value={item.target}>{item.label}</option>)}
            </select>
            <input placeholder="覆盖原因（必填），例如 查验关员发现封志号不符，退回已预约重排" value={overrideReason} onChange={event => setOverrideReason(event.target.value)}/>
            <button className="danger-action" disabled={busy || !overrideTarget || !overrideReason.trim()} onClick={() => { if (overrideTarget) { onOverride(overrideTarget, overrideReason.trim()); setOverrideTarget(''); setOverrideReason(''); } }}>{busy ? '提交中…' : '提交覆盖'}</button>
          </div>
          <small className="muted">覆盖只能回退到状态机声明的相邻状态；放行/扣留的后续决定由海关消息驱动，不允许直接改写。</small>
        </>}
      </div>

      <div className="flow-history-head"><div className="eyebrow">EVENT STREAM / 闭环留痕</div></div>
      <div className="flow-history">
        {flow.history.map(event => <div key={event.id} className={`flow-event ${event.override ? 'override' : ''} ${event.duplicate ? 'duplicate' : ''}`}>
          <i className={`flow-event-dot ${event.to}`}/>
          <div><b>{FLOW_ACTION_LABELS[event.action] ?? event.action}{event.override ? <em className="override-tag">人工覆盖</em> : null}{event.duplicate ? <em className="duplicate-tag">重复消息已忽略</em> : null}</b>
            <span>{dateTime(event.at)} · {event.actor} · {event.from === '-' ? '—' : FLOW_STATE_LABELS[event.from as InspectionState] ?? event.from} → {FLOW_STATE_LABELS[event.to] ?? event.to}{event.messageId ? ` · ${event.messageId}` : ''}</span>
            <small>{event.details}</small>{event.reason && <small className="flow-reason">原因：{event.reason}</small>}
          </div>
        </div>)}
      </div>
    </div>
  </div>;
}

const appointmentStatusLabel = (status: string) => ({ booked: '已预约', 'checked-in': '已签到', completed: '已完成', cancelled: '已取消', exception: '异常拦截' } as Record<string, string>)[status] ?? status;

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [flows, setFlows] = useState<InspectionFlow[]>([]);
  const [flowModalId, setFlowModalId] = useState<string>();
  const [tab, setTab] = useState<Section>('control');
  const [selectedVoyage, setSelectedVoyage] = useState('VOY-AX7');
  const [editor, setEditor] = useState<Editor>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, v, ctn, b, cf, a, t, e, f] = await Promise.all([
      request<Dashboard>('/dashboard'), request<Voyage[]>('/voyages'), request<Container[]>('/containers'),
      request<Block[]>('/yard/heatmap'), request<Conflict[]>('/gate/conflicts'), request<Appointment[]>('/gate/appointments'),
      request<Task[]>('/tasks'), request<Equipment[]>('/equipment'), request<InspectionFlow[]>('/inspection/flows')
    ]);
    setDashboard(d); setVoyages(v); setContainers(ctn); setBlocks(b); setConflicts(cf); setAppointments(a); setTasks(t); setEquipment(e); setFlows(f);
    return f;
  }, []);
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : '无法连接服务端')); }, [load]);

  const mutate = async (path: string, method: string, body?: unknown) => {
    setBusy(true); setError('');
    try {
      await request(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      await load(); setEditor(undefined); setMessage('操作已保存，作业台数据已刷新');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败'); }
    finally { setBusy(false); }
  };
  const openCreate = (entity: Editor['entity']) => { setError(''); setEditor({ entity, mode: 'create', values: defaultValues(entity) }); };
  const openEdit = (entity: Editor['entity'], id: string, values: Record<string, string|boolean>) => { setError(''); setEditor({ entity, mode: 'edit', id, values: { ...values } }); };
  const updateField = (key: string, value: string|boolean) => setEditor(current => current ? { ...current, values: { ...current.values, [key]: value } } : current);
  const saveEditor = async (event: FormEvent) => {
    event.preventDefault(); if (!editor) return;
    const { entity, mode, id, values } = editor;
    const payload: Record<string, unknown> = entity === 'container' ? {
      ...(mode === 'create' ? { id: values.id } : {}), voyageId: values.voyageId, size: values.size, isoType: values.isoType,
      direction: values.direction, status: values.status, weightT: Number(values.weightT), reefer: Boolean(values.reefer),
      ...(values.reefer ? { temperature: Number(values.temperature) } : {}), ...(values.hazmatClass ? { hazmatClass: values.hazmatClass } : {}),
      customs: values.customs, priority: values.priority, yardSlot: values.yardSlot
    } : entity === 'appointment' ? {
      containerId: values.containerId, truckNo: values.truckNo, driver: values.driver, type: values.type,
      windowStart: new Date(String(values.windowStart)).toISOString(), windowEnd: new Date(String(values.windowEnd)).toISOString(), lane: values.lane
    } : {
      kind: values.kind, containerId: values.containerId, from: values.from, to: values.to, priority: Number(values.priority),
      scheduledAt: new Date(String(values.scheduledAt)).toISOString(), estimatedMinutes: Number(values.estimatedMinutes),
      ...(values.equipmentId ? { equipmentId: values.equipmentId } : {}), ...(mode === 'edit' ? { status: values.status } : {})
    };
    await mutate(entity === 'container' ? `/containers${mode === 'edit' ? `/${id}` : ''}` : entity === 'appointment' ? `/gate/appointments${mode === 'edit' ? `/${id}` : ''}` : `/tasks${mode === 'edit' ? `/${id}` : ''}`, mode === 'create' ? 'POST' : 'PATCH', payload);
  };
  const remove = async (entity: Editor['entity'], id: string) => {
    if (!window.confirm(`确认删除 ${id}？相关数据的联动处理会写入审计记录。`)) return;
    const path = entity === 'container' ? `/containers/${id}` : entity === 'appointment' ? `/gate/appointments/${id}` : `/tasks/${id}`;
    await mutate(path, 'DELETE');
  };
  const updateAppointmentStatus = async (id: string, status: string) => mutate(`/gate/appointments/${id}`, 'PATCH', { status });
  const assign = async (id: string, equipmentId: string) => equipmentId ? mutate(`/tasks/${id}/assign`, 'PATCH', { equipmentId }) : mutate(`/tasks/${id}`, 'PATCH', { equipmentId: '', status: 'queued' });

  const startFlow = async (containerId: string) => {
    setBusy(true); setError('');
    try {
      const created = await request<InspectionFlow>(`/inspection/flows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ containerId }) });
      await load();
      setFlowModalId(created.id);
      setMessage(`查验流程 ${created.id} 已建立，箱号进入待查验`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '发起查验流程失败'); }
    finally { setBusy(false); }
  };
  const openFlow = async (containerId: string) => {
    const existing = flows.find(flow => flow.containerId === containerId);
    if (existing) { setFlowModalId(existing.id); return; }
    await startFlow(containerId);
  };
  const runFlowAction = async (flowId: string, path: string, body: unknown, successText: string) => {
    setBusy(true); setError('');
    try {
      const result = await request<{ flow?: InspectionFlow; duplicate?: boolean }>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const fresh = await load();
      const updated = fresh.find(item => item.id === flowId);
      if (updated) setFlowModalId(updated.id);
      setMessage(result.duplicate ? `${successText}：该海关消息为重复送达，系统已幂等忽略并留痕` : successText);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '流程操作失败'); }
    finally { setBusy(false); }
  };
  const reportFault = async (equipmentId: string) => {
    const reason = window.prompt(`上报 ${equipmentId} 故障原因（将阻塞其在场任务并通知相关查验流程）`);
    if (reason === null) return;
    await mutate(`/equipment/${equipmentId}/fault`, 'PATCH', { reason: reason || '设备故障，暂停派工' });
  };
  const repairMachine = async (equipmentId: string) => mutate(`/equipment/${equipmentId}/repair`, 'PATCH', {});
  const flowModal = flowModalId ? flows.find(flow => flow.id === flowModalId) : undefined;
  const selected = voyages.find(voyage => voyage.id === selectedVoyage);
  const remaining = selected ? selected.movesPlanned - selected.movesDone : 0;
  const maxHeat = useMemo(() => Math.max(...blocks.map(block => block.heat), 1), [blocks]);

  if (!dashboard && error) return <main className="connection-error"><div className="eyebrow">API CONNECTION ERROR</div><h1>无法连接港口作业服务</h1><p>{error}</p><p>请从项目根目录运行 <code>npm run dev</code>，确认前端 5178 和 API 4107 均已启动。</p><button onClick={() => { setError(''); void load().catch(reason => setError(reason instanceof Error ? reason.message : '无法连接服务端')); }}>重新连接</button></main>;
  if (!dashboard) return <div className="loading">正在连接码头实时作业中台…</div>;

  return <main>
    <header><div><div className="eyebrow">PORT OPS / YARD & GATE CONTROL</div><h1>HarborGrid <span>港口集装箱堆场协同与闸口调度</span></h1><p>把船期、箱务、堆场容量、危险品/冷藏约束、闸口预约与场内设备任务放在同一条作业链路上。</p></div><div className="header-right"><span className="live"><i/> TOS LINKED</span><span className="clock">LIVE · {new Date().toLocaleTimeString()}</span></div></header>
    {message && <div className="toast" onClick={() => setMessage('')}>{message} ×</div>}{error && <div className="form-error page-error">{error}<button onClick={() => setError('')}>关闭</button></div>}
    <section className="kpis"><div><small>ACTIVE VESSELS</small><b>{dashboard.activeVoyages}<em> 艘</em></b><span>{dashboard.lateVessels} 艘存在延误风险</span></div><div><small>YARD UTILIZATION</small><b>{pct(dashboard.yardUtilization)}</b><span>可用堆位 / 危险品隔离纳管</span></div><div><small>GATE QUEUE</small><b>{dashboard.gateQueue}<em> 车</em></b><span>预约、已进场与车道排队</span></div><div><small>EXCEPTIONS</small><b>{dashboard.blockedTasks + dashboard.reeferAlerts + dashboard.hazmatHolds}<em> 项</em></b><span>{dashboard.blockedTasks} 作业阻塞 · {dashboard.reeferAlerts} 冷藏告警</span></div></section>
    <nav className="tabs"><button className={tab==='control'?'active':''} onClick={() => setTab('control')}>作业驾驶舱</button><button className={tab==='containers'?'active':''} onClick={() => setTab('containers')}>箱务台账 / CRUD</button><button className={tab==='inspection'?'active':''} onClick={() => setTab('inspection')}>查验作业流程</button><button className={tab==='gate'?'active':''} onClick={() => setTab('gate')}>闸口预约</button><button className={tab==='yard'?'active':''} onClick={() => setTab('yard')}>堆场热区</button><button className={tab==='tasks'?'active':''} onClick={() => setTab('tasks')}>设备任务</button><span>最后同步 {new Date().toLocaleTimeString()}</span></nav>
    {tab === 'control' && <div className="layout"><section className="panel vessel-panel"><div className="panel-head"><div><div className="eyebrow">VESSEL WINDOW / 船期窗口</div><h2>泊位作业进度</h2></div><span className="muted">剩余作业动态计算</span></div>{voyages.map(voyage => <button key={voyage.id} className={`vessel ${selectedVoyage===voyage.id?'selected':''}`} onClick={() => setSelectedVoyage(voyage.id)}><span className={`vessel-dot ${voyage.status}`}/><span className="vessel-main"><b>{voyage.vessel}</b><small>{voyage.id} · {voyage.service} · {voyage.berth}</small><i><em style={{ width: `${Math.min(100, voyage.movesDone / voyage.movesPlanned * 100)}%` }}/></i></span><span className="vessel-move"><b>{voyage.movesDone.toLocaleString()}</b><small>/ {voyage.movesPlanned.toLocaleString()} moves</small></span><strong className={voyage.lateRisk}>{voyage.lateRisk==='high'?'HIGH':voyage.lateRisk==='medium'?'WATCH':'ON TIME'}</strong></button>)}</section><section className="panel focus-panel"><div className="panel-head"><div><div className="eyebrow">SELECTED VOYAGE / {selected?.id}</div><h2>{selected?.vessel}</h2></div><span className={`badge ${selected?.lateRisk}`}>{selected?.status}</span></div><div className="voyage-stats"><div><small>ETA</small><b>{selected&&time(selected.eta)}</b><span>预计靠泊</span></div><div><small>ETD</small><b>{selected&&time(selected.etd)}</b><span>计划离港</span></div><div><small>REMAINING</small><b>{remaining}</b><span>剩余翻箱</span></div></div><div className="berth-map"><div className="water"><span>岸线 / BERTH</span><i className="ship" style={{ left: `${selected?.berth==='B07'?50:24}%` }}>{selected?.vessel}</i><b>B01</b><b>B04</b><b>B07</b><b>B10</b></div></div><div className="callout"><strong>调度策略</strong><span>已把 {dashboard.blockedTasks} 个阻塞任务、{dashboard.gateQueue} 车闸口压力纳入当前窗口；优先保护冷藏与危险品安全约束。</span></div></section><section className="panel wide"><div className="panel-head"><h3>异常与联动信号</h3><span>{conflicts.length} gate conflicts detected</span></div><div className="signal-grid"><div><strong className="critical">{dashboard.blockedTasks}</strong><span>设备/约束阻塞</span><small>{dashboard.inspectionBlocked ? `${dashboard.inspectionBlocked} 个查验流程等待重派正面吊` : '最高优先级：海关查验任务'}</small></div><div><strong className="warning">{conflicts.length}</strong><span>闸口预约冲突</span><small>同车重叠窗口需人工重排</small></div><div><strong className="warning">{dashboard.reeferAlerts}</strong><span>冷藏与温控风险</span><small>查验区电源余量接近阈值</small></div><div><strong className="ok">{equipment.filter(item => item.status==='available').length}</strong><span>可调度设备</span><small>场桥 / 正面吊 / 集卡｜在办查验 {dashboard.inspectionPending ?? 0} · 扣留 {dashboard.inspectionDetained ?? 0}</small></div></div></section></div>}
    {tab === 'containers' && <section className="panel wide"><div className="panel-head"><div><div className="eyebrow">CONTAINER REGISTER / CRUD</div><h2>箱务台账</h2><span className="muted">新增、查询、编辑、删除；危险品与冷藏箱受堆场约束校验</span></div><button className="primary-action" onClick={() => openCreate('container')}>＋ 新增箱务</button></div><div className="table container-table"><div className="tr th"><span>箱号 / 航次</span><span>尺寸 / 流向</span><span>箱况 / 海关</span><span>堆位</span><span>重量 / 属性</span><span>操作</span></div>{containers.map(container => <div className="tr" key={container.id}><span><b>{container.id}</b><small>{container.voyageId} · {container.lastEvent}</small></span><span>{container.size}ft · {container.direction}<small>{container.isoType}</small></span><span><b>{container.status}</b><small>海关：{container.customs}</small></span><span>{container.yardSlot}</span><span>{container.weightT}t<small>{container.reefer?`冷藏 ${container.temperature}°C`:container.hazmatClass?`危险品 ${container.hazmatClass} 类`:'普通箱'}</small></span><span className="row-actions"><button className="flow-entry" onClick={() => void openFlow(container.id)}>{flows.some(flow => flow.containerId === container.id) ? '查验流程' : '发起查验'}</button><button onClick={() => openEdit('container', container.id, { ...container, weightT: String(container.weightT), temperature: String(container.temperature ?? 4), hazmatClass: container.hazmatClass ?? '' })}>编辑</button><button className="danger-action" onClick={() => void remove('container', container.id)}>删除</button></span></div>)}</div></section>}
    {tab === 'inspection' && <section className="panel wide">
      <div className="panel-head"><div><div className="eyebrow">CUSTOMS INSPECTION WORKFLOW / 异常闭环</div><h2>查验作业流程</h2><span className="muted">状态机驱动：待查验 → 已预约 → 移入查验位 → 查验中 → 放行 / 扣留；只能执行系统给出的下一步动作</span></div></div>
      <div className="signal-grid inspection-kpis">
        <div><strong className="warning">{dashboard.inspectionPending ?? 0}</strong><span>在办查验流程</span><small>待查验 / 已预约 / 就位 / 查验中</small></div>
        <div><strong className="critical">{dashboard.inspectionBlocked ?? 0}</strong><span>设备故障待重派</span><small>正面吊维护导致的阻塞流程</small></div>
        <div><strong className="critical">{dashboard.inspectionDetained ?? 0}</strong><span>海关扣留</span><small>闸口提箱已联动拦截</small></div>
        <div><strong className="ok">{flows.filter(flow => flow.state === 'released').length}</strong><span>本时段已放行</span><small>出场任务已联动下发</small></div>
      </div>
      <div className="table flow-table">
        <div className="tr th"><span>流程 / 箱号</span><span>状态机</span><span>查验窗口 / 查验位</span><span>设备 / 联动任务</span><span>堆位变化</span><span>操作</span></div>
        {flows.map(flow => <div className="tr" key={flow.id}>
          <span><b>{flow.containerId}</b><small>{flow.id} · 第 {flow.round} 轮 · {flow.container.hazmatClass ? `危险品 ${flow.container.hazmatClass} 类` : flow.container.reefer ? `冷藏 ${flow.container.temperature}°C` : '普通箱'}</small>{flow.detainReason && <small className="blocked-text">扣留原因：{flow.detainReason}</small>}</span>
          <span><span className={`pill flow-state-${flow.state}`}>{flow.stateLabel}</span><small>{FLOW_ACTION_LABELS[flow.history[0]?.action] ?? '—'} · {dateTime(flow.updatedAt)}</small></span>
          <span>{flow.windows[0] ? <><b>{flow.windows[0].bay}</b><small>{dateTime(flow.windows[0].start)}–{time(flow.windows[0].end)} · {flow.windows[0].officer}</small><small className={flow.windows[0].status === 'active' ? 'ok' : 'blocked-text'}>{flow.windows[0].status === 'active' ? '窗口有效' : flow.windows[0].status === 'cancelled' ? `窗口已取消：${flow.windows[0].cancelReason ?? ''}` : '窗口已关闭'}</small></> : <small>尚无预约窗口</small>}</span>
          <span>{flow.equipment ? <><b>{flow.equipment.name}</b><small className={flow.equipment.status === 'maintenance' ? 'blocked-text' : ''}>{flow.equipment.status === 'maintenance' ? '维护中，待重派' : flow.equipment.status}</small></> : <small>未指派正面吊</small>}{flow.linkedTask && <small>{flow.linkedTask.id} · <span className={flow.linkedTask.status === 'blocked' ? 'blocked-text' : ''}>{flow.linkedTask.status}</span></small>}</span>
          <span><b>{flow.container.yardSlot}</b><small>{flow.originSlot}{flow.currentBay && flow.currentBay !== flow.originSlot ? ` → ${flow.currentBay}` : ''}</small></span>
          <span className="row-actions"><button className="flow-entry" onClick={() => setFlowModalId(flow.id)}>进入流程</button></span>
        </div>)}
      </div>
      <div className="yard-note"><span>放行/扣留消息可重复到达（幂等）；窗口取消、设备故障、人工回退都会同步改写场内任务、设备指派、堆位与闸口预约，每次人工覆盖强制填写原因。</span><b>调度员只能从箱详情或本页进入流程操作</b></div>
    </section>}
    {tab === 'gate' && <section className="panel wide"><div className="panel-head"><div><div className="eyebrow">GATE APPOINTMENT / SLOT CONTROL</div><h2>闸口预约与车道状态</h2><span className="muted">支持新增预约、编辑时隙、签到/完成和删除</span></div><button className="primary-action" onClick={() => openCreate('appointment')}>＋ 新增预约</button></div>{conflicts.map(conflict => <div className="conflict" key={`${conflict.appointmentId}-${conflict.reason}`}><strong>{conflict.severity}</strong><b>{conflict.appointmentId}</b><span>{conflict.reason}</span></div>)}<div className="table"><div className="tr th"><span>预约</span><span>箱号 / 车辆</span><span>窗口</span><span>车道</span><span>状态</span><span>操作</span></div>{appointments.map(appointment => <div className="tr" key={appointment.id}><span><b>{appointment.id}</b><small>{appointment.type}</small></span><span><b>{appointment.containerId}</b><small>{appointment.truckNo} · {appointment.driver}</small></span><span>{time(appointment.windowStart)}—{time(appointment.windowEnd)}</span><span>{appointment.lane}</span><span className={`pill ${appointment.status}`}>{appointment.status}</span><span className="row-actions">{appointment.status==='booked'?<button onClick={() => void updateAppointmentStatus(appointment.id, 'checked-in')}>签到</button>:appointment.status==='checked-in'?<button onClick={() => void updateAppointmentStatus(appointment.id, 'completed')}>完成</button>:null}<button onClick={() => openEdit('appointment', appointment.id, { ...appointment, windowStart: toLocalInput(appointment.windowStart), windowEnd: toLocalInput(appointment.windowEnd) })}>编辑</button><button className="danger-action" onClick={() => void remove('appointment', appointment.id)}>删除</button></span></div>)}</div></section>}
    {tab === 'yard' && <section className="panel wide"><div className="panel-head"><div><div className="eyebrow">YARD HEATMAP / STACK DENSITY</div><h2>堆场容量与安全约束</h2></div><span className="muted">实时区块压力</span></div><div className="yard-grid">{blocks.map(block => <div className={`block ${block.pressure}`} key={block.id}><div className="block-top"><b>{block.id}</b><strong>{pct(block.utilization)}</strong></div><span>{block.zone}</span><div className="heat"><i style={{ width: `${block.heat / maxHeat * 100}%` }}/></div><div className="block-stats"><span>空位 {block.freeSlots}</span><span>冷插 {block.usedPlugs}/{block.reeferPlugs}</span><span>{block.hazmatAllowed?'危险品可入':'普通区'}</span></div></div>)}</div><div className="yard-note"><span>堆位推荐会同时考虑容量、热区、危险品隔离、冷藏插座和设备可达性。</span><b>A01 → C03 重排建议可释放 21 个低热度堆位</b></div></section>}
    {tab === 'tasks' && <div className="layout"><section className="panel wide"><div className="panel-head"><div><div className="eyebrow">TASK DISPATCH / EQUIPMENT POOL</div><h2>场内任务优先级与设备指派</h2><span className="muted">支持新增、编辑、删除和设备指派</span></div><button className="primary-action" onClick={() => openCreate('task')}>＋ 新建任务</button></div><div className="table task-table"><div className="tr th"><span>任务</span><span>箱号</span><span>路径</span><span>优先级</span><span>状态</span><span>设备 / 操作</span></div>{tasks.map(task => <div className="tr" key={task.id}><span><b>{task.id}</b><small>{task.kind} · {task.estimatedMinutes}min</small></span><span>{task.containerId}</span><span>{task.from} → {task.to}</span><span className={(task.score ?? 0)>95?'critical':''}>{task.score ?? task.priority}</span><span><span className={`pill ${task.status}`}>{task.status}</span>{task.blockingReasons.length>0&&<small className="blocked-text">{task.blockingReasons[0]}</small>}</span><span className="task-actions"><select value={task.equipmentId??''} onChange={event => void assign(task.id, event.target.value)}><option value="">未指派</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={() => openEdit('task', task.id, { kind: task.kind, containerId: task.containerId, from: task.from, to: task.to, equipmentId: task.equipmentId ?? '', priority: String(task.priority), estimatedMinutes: String(task.estimatedMinutes), scheduledAt: toLocalInput(task.scheduledAt), status: task.status })}>编辑</button><button className="danger-action" onClick={() => void remove('task', task.id)}>删除</button></span></div>)}</div></section><section className="panel"><div className="panel-head"><h3>设备池</h3><span>{equipment.length} assets</span></div>{equipment.map(item => <div className="equipment" key={item.id}><i className={`equip-dot ${item.status}`}/><div><b>{item.name}</b><small>{item.location} · 队列 {item.queue}</small></div><strong>{item.battery}%</strong>{item.status === 'maintenance' || item.status === 'offline' ? <button onClick={() => void repairMachine(item.id)}>修复</button> : <button className="danger-action" onClick={() => void reportFault(item.id)}>故障</button>}</div>)}</section></div>}
    <footer>HarborGrid · 内存种子数据 + REST API · 箱务台账、闸口预约、场内任务提供完整增删改查操作</footer>
    {editor && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditor(undefined); }}><form className="editor-modal" onSubmit={saveEditor}><div className="modal-head"><div><div className="eyebrow">{editor.mode.toUpperCase()} / {editor.entity.toUpperCase()}</div><h2>{editor.mode==='create'?'创建':'编辑'}{editor.entity==='container'?'箱务记录':editor.entity==='appointment'?'闸口预约':'作业任务'}</h2></div><button type="button" className="icon-button" onClick={() => setEditor(undefined)}>×</button></div>
      {editor.entity === 'container' && <div className="form-grid">
        <label>集装箱号<input required disabled={editor.mode==='edit'} value={String(editor.values.id)} onChange={event => updateField('id', event.target.value.toUpperCase())}/></label>
        <label>关联航次<select value={String(editor.values.voyageId)} onChange={event => updateField('voyageId', event.target.value)}>{voyages.filter(voyage => voyage.status!=='departed').map(voyage => <option key={voyage.id} value={voyage.id}>{voyage.id} · {voyage.vessel}</option>)}</select></label>
        <label>尺寸<select value={String(editor.values.size)} onChange={event => updateField('size', event.target.value)}><option value="20">20 ft</option><option value="40">40 ft</option><option value="45">45 ft</option></select></label>
        <label>ISO 箱型<input required value={String(editor.values.isoType)} onChange={event => updateField('isoType', event.target.value)}/></label>
        <label>作业流向<select value={String(editor.values.direction)} onChange={event => updateField('direction', event.target.value)}><option value="import">进口</option><option value="export">出口</option><option value="transshipment">中转</option></select></label>
        <label>箱状态<select value={String(editor.values.status)} onChange={event => updateField('status', event.target.value)}>{['in-transit','at-gate','in-yard','on-quay','released','hold'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>重量 (吨)<input type="number" min="0.1" step="0.1" required value={String(editor.values.weightT)} onChange={event => updateField('weightT', event.target.value)}/></label>
        <label>海关状态<select value={String(editor.values.customs)} onChange={event => updateField('customs', event.target.value)}><option value="released">已放行</option><option value="inspection">查验中</option><option value="hold">扣留</option></select></label>
        <label>优先级<select value={String(editor.values.priority)} onChange={event => updateField('priority', event.target.value)}><option value="normal">普通</option><option value="hot">急箱</option><option value="reefer">冷藏</option><option value="hazmat">危险品</option></select></label>
        <label>堆位<input required placeholder="例如 B07-R03-T2" value={String(editor.values.yardSlot)} onChange={event => updateField('yardSlot', event.target.value.toUpperCase())}/></label>
        <label>危险品类别<input placeholder="非危险品留空" value={String(editor.values.hazmatClass)} onChange={event => updateField('hazmatClass', event.target.value)}/></label>
        <label className="check-label"><input type="checkbox" checked={Boolean(editor.values.reefer)} onChange={event => updateField('reefer', event.target.checked)}/>冷藏箱</label>
        {Boolean(editor.values.reefer) && <label>目标温度 (°C)<input type="number" step="0.1" value={String(editor.values.temperature)} onChange={event => updateField('temperature', event.target.value)}/></label>}
      </div>}
      {editor.entity === 'appointment' && <div className="form-grid">
        <label>集装箱<select required value={String(editor.values.containerId)} onChange={event => updateField('containerId', event.target.value)}><option value="">选择箱号</option>{containers.map(container => <option key={container.id} value={container.id}>{container.id} · {container.status}</option>)}</select></label>
        <label>预约类型<select value={String(editor.values.type)} onChange={event => updateField('type', event.target.value)}><option value="pickup">提箱</option><option value="dropoff">进场</option></select></label>
        <label>车牌号<input required value={String(editor.values.truckNo)} onChange={event => updateField('truckNo', event.target.value)}/></label><label>司机<input required value={String(editor.values.driver)} onChange={event => updateField('driver', event.target.value)}/></label>
        <label>窗口开始<input type="datetime-local" required value={String(editor.values.windowStart)} onChange={event => updateField('windowStart', event.target.value)}/></label><label>窗口结束<input type="datetime-local" required value={String(editor.values.windowEnd)} onChange={event => updateField('windowEnd', event.target.value)}/></label>
        <label>闸口车道<select value={String(editor.values.lane)} onChange={event => updateField('lane', event.target.value)}><option value="north">北闸口</option><option value="south">南闸口</option><option value="rail">铁路闸口</option></select></label>
      </div>}
      {editor.entity === 'task' && <div className="form-grid">
        <label>任务类型<select value={String(editor.values.kind)} onChange={event => updateField('kind', event.target.value)}>{['receive','deliver','rehandle','load','discharge','inspect'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>关联箱号<select required value={String(editor.values.containerId)} onChange={event => updateField('containerId', event.target.value)}><option value="">选择箱号</option>{containers.map(container => <option key={container.id} value={container.id}>{container.id}</option>)}</select></label>
        <label>起点<input required value={String(editor.values.from)} onChange={event => updateField('from', event.target.value)}/></label><label>终点<input required value={String(editor.values.to)} onChange={event => updateField('to', event.target.value)}/></label>
        <label>优先级 (1–100)<input type="number" min="1" max="100" required value={String(editor.values.priority)} onChange={event => updateField('priority', event.target.value)}/></label><label>预计时长 (分钟)<input type="number" min="1" required value={String(editor.values.estimatedMinutes)} onChange={event => updateField('estimatedMinutes', event.target.value)}/></label>
        <label>计划时间<input type="datetime-local" required value={String(editor.values.scheduledAt)} onChange={event => updateField('scheduledAt', event.target.value)}/></label><label>指派设备<select value={String(editor.values.equipmentId)} onChange={event => updateField('equipmentId', event.target.value)}><option value="">暂不指派</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label>
        {editor.mode==='edit' && <label>任务状态<select value={String(editor.values.status)} onChange={event => updateField('status', event.target.value)}>{['queued','assigned','executing','blocked','done'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
      </div>}
      {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" onClick={() => setEditor(undefined)}>取消</button><button className="primary-action" disabled={busy}>{busy?'保存中…':'保存'}</button></div>
    </form></div>}
    {flowModal && <FlowModal flow={flowModal} equipmentList={equipment} busy={busy} onClose={() => setFlowModalId(undefined)}
      onAction={(descriptor, body) => void runFlowAction(flowModal.id, `/inspection/flows/${flowModal.id}/transitions`, { action: descriptor.action, ...body }, '流程动作已执行，联动数据已刷新')}
      onCustoms={(decision, body) => void runFlowAction(flowModal.id, `/containers/${flowModal.containerId}/customs-message`, { decision, ...body }, decision === 'release' ? '海关放行已登记，出场任务已联动' : '海关扣留已登记，提箱预约与闸口已联动拦截')}
      onOverride={(target, reason) => void runFlowAction(flowModal.id, `/inspection/flows/${flowModal.id}/override`, { target, reason }, '人工覆盖已记录原因，流程联动已重算')} />}
  </main>;
}
