import { MODE_DEFINITIONS } from '#simulation'
import { CFG } from './config.js'
import { createGame } from './game.js'
import { LocalSession } from './local-session.js'
import { NetworkSession } from './network.js'
import { createDeployState, createGameState } from './state.js'
import { createCanvasUi } from './ui/canvas-ui.js'

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    ...options, body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`)
  return text ? JSON.parse(text) : null
}

export function createPortal() {
  const state = createGameState()
  const deploy = createDeployState()
  const ui = createCanvasUi({ state, deploy, config: CFG })
  let user = null
  let room = null
  let rooms = []
  let playerId = null
  let status = ''
  let statusError = false
  let screen = 'choice'
  let register = false
  let selectedMode = 'classic'
  let visibility = 'public'
  let leaderboardMode = 'classic'
  let profileRows = []
  let activeSession = null
  const fields = { username: '', displayName: '', password: '', roomName: '', invite: '' }
  const session = {
    get kind() { return activeSession?.kind },
    send(message) { return activeSession?.send(message) ?? false },
    sendInput(input) { return activeSession?.sendInput(input) ?? false },
  }
  const game = createGame({ session, ui, state, deploy, getPlayerId: () => playerId })
  const networkSession = new NetworkSession({
    status(value) { setStatus(value === 'online' ? '已连接联机服务器' : value === 'connecting' ? '正在连接...' : '连接已断开') },
    latency(value) { game.setLatency(value) },
    disconnected() { if (room) setStatus('连接中断，正在恢复席位...') },
    message: handleMessage,
  })

  function setStatus(value, error = false) {
    status = value
    statusError = error
    render()
  }

  function field(id, label, placeholder, password = false, maxLength = 128) {
    return { id, label, placeholder, password, maxLength, value: fields[id] }
  }

  function render() {
    const common = { status, error: statusError }
    if (screen === 'choice') ui.showPortal({
      ...common, title: '选择作战方式', subtitle: '单人模式与联机模式共用完整战场表现',
      actions: [{ id: 'offline', label: '单人作战', primary: true }, { id: 'online', label: '联机作战' }],
    })
    else if (screen === 'offline') ui.showPortal({
      ...common, title: '单人作战', subtitle: '本地权威模拟',
      rows: MODE_DEFINITIONS.map(mode => {
        const records = state.records[mode.id]
        return { label: `${mode.name}  场次 ${records.matches}  胜 ${records.wins}  击杀 ${records.kills}  阵亡 ${records.deaths}` }
      }),
      actions: MODE_DEFINITIONS.map(mode => ({
        id: `offline:${mode.id}`, label: mode.name, primary: mode.id === 'classic',
      })).concat([{ id: 'choice', label: '返回' }]),
    })
    else if (screen === 'auth') ui.showPortal({
      ...common, title: register ? '创建账号' : '账号登录', subtitle: '输入内容仅在本地用于提交认证', focus: 'username',
      fields: [field('username', '用户名', '3-20 位字母、数字或下划线', false, 20),
        ...(register ? [field('displayName', '战场昵称', '最多 16 个字符', false, 16)] : []),
        field('password', '密码', register ? '至少 10 位' : '账号密码', true)],
      actions: [{ id: 'auth-submit', label: register ? '注册并登录' : '登录', primary: true },
        { id: 'auth-toggle', label: register ? '已有账号' : '创建账号' }, { id: 'choice', label: '返回' }],
    })
    else if (screen === 'lobby') ui.showPortal({
      ...common, title: '联机大厅', subtitle: '快速匹配、公开房与私密邀请码房', profile: `${user.displayName}  @${user.username}`,
      rows: rooms.map(item => ({ label: `${item.name}  ·  ${item.modeId === 'classic' ? '经典' : '丧尸'}  ${item.players}/${item.capacity}`, action: `join:${item.id}`, actionLabel: '加入' })),
      actions: MODE_DEFINITIONS.map(mode => ({ id: `quick:${mode.id}`, label: `${mode.name}快速匹配`, primary: mode.id === 'classic' })).concat([
        { id: 'create', label: '创建房间' }, { id: 'invite', label: '邀请码加入' },
        { id: 'profile', label: '在线战绩' }, { id: 'leaderboard', label: '排行榜' },
        { id: 'logout', label: '退出登录', danger: true },
      ]),
    })
    else if (screen === 'create') ui.showPortal({
      ...common, title: '创建房间', subtitle: `${selectedMode === 'classic' ? '经典对战' : '丧尸合作'} · ${visibility === 'public' ? '公开房' : '私密房'}`,
      fields: [field('roomName', '房间名称', `${user.displayName}的房间`, false, 20)],
      actions: [{ id: 'mode', label: selectedMode === 'classic' ? '模式：经典' : '模式：丧尸' },
        { id: 'visibility', label: visibility === 'public' ? '公开房' : '私密房' },
        { id: 'create-submit', label: '创建', primary: true }, { id: 'lobby', label: '返回大厅' }],
    })
    else if (screen === 'invite') ui.showPortal({
      ...common, title: '邀请码加入', fields: [field('invite', '6 位邀请码', '例如 A3H7KP', false, 6)],
      actions: [{ id: 'invite-submit', label: '加入房间', primary: true }, { id: 'lobby', label: '返回大厅' }],
    })
    else if (screen === 'room') showRoomCanvas(common)
    else if (screen === 'stats') ui.showPortal({
      ...common, title: leaderboardMode ? `公开排行榜 · ${leaderboardMode === 'classic' ? '经典' : '丧尸'}` : '在线战绩',
      rows: profileRows.map(label => ({ label })),
      actions: leaderboardMode ? [{ id: 'leaderboard-mode', label: '切换模式' }, { id: 'lobby', label: '返回大厅' }] : [{ id: 'lobby', label: '返回大厅' }],
    })
  }

  function showRoomCanvas(common = { status, error: statusError }) {
    screen = 'room'
    ui.showPortal({ ...common, title: room.name, subtitle: `${room.modeId === 'classic' ? '经典对战' : '丧尸合作'} · ${room.status}${room.invite ? ` · 邀请码 ${room.invite}` : ''}`,
      profile: user.displayName, rows: room.members.map(member => ({
        label: `${member.displayName}  ·  ${member.team === 'allies' ? '盟军' : '轴心'}${member.connected ? '' : ' · 掉线'}`,
        action: room.hostId === user.id && member.userId !== user.id && room.status === 'waiting' ? `kick:${member.userId}` : null, actionLabel: '移除',
      })), actions: [
        ...(room.hostId === user.id && room.status === 'waiting' ? [{ id: 'start-match', label: '开始对局', primary: true }] : []),
        { id: 'leave-room', label: '退出房间', danger: true },
      ],
    })
  }

  async function checkSession() {
    try {
      user = (await api('/api/auth/session')).user
      if (user) enterLobby(); else { screen = 'auth'; render() }
    } catch (error) { setStatus(error.message, true) }
  }

  function enterLobby() {
    activeSession = networkSession
    screen = 'lobby'
    room = null
    networkSession.connect()
    render()
  }

  async function startLocal(modeId) {
    activeSession = new LocalSession({ message: handleMessage })
    activeSession.start(modeId)
    await game.preparePresentation()
  }

  async function submitAuth() {
    try {
      const result = await api(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: {
        username: fields.username, displayName: fields.displayName, password: fields.password,
      } })
      user = result.user; fields.password = ''; enterLobby()
    } catch (error) { setStatus(error.message, true) }
  }

  async function showProfile() {
    try {
      const result = await api('/api/multiplayer/profile')
      leaderboardMode = null
      profileRows = result.stats.map(row => `${row.mode === 'classic' ? '经典' : '丧尸'} / ${row.scope === 'ranked' ? '排位' : '全部'}  场次 ${row.matches}  胜 ${row.wins}  击杀 ${row.kills}  阵亡 ${row.deaths}  最高波次 ${row.highest_wave}`)
      if (!profileRows.length) profileRows = ['暂无在线战绩']
      screen = 'stats'; render()
    } catch (error) { setStatus(error.message, true) }
  }

  async function showLeaderboard() {
    try {
      const result = await api(`/api/multiplayer/leaderboard?mode=${leaderboardMode}`)
      profileRows = result.entries.map((row, index) => `${index + 1}. ${row.display_name}  胜 ${row.wins}  击杀 ${row.kills}  阵亡 ${row.deaths}  最高波次 ${row.highest_wave}`)
      if (!profileRows.length) profileRows = ['暂无排行数据']
      screen = 'stats'; render()
    } catch (error) { setStatus(error.message, true) }
  }

  async function action(id) {
    if (id === 'offline') { screen = 'offline'; render() }
    else if (id.startsWith('offline:')) await startLocal(id.slice(8))
    else if (id === 'online') await checkSession()
    else if (id === 'choice') { screen = 'choice'; render() }
    else if (id === 'auth-toggle') { register = !register; render() }
    else if (id === 'auth-submit') await submitAuth()
    else if (id === 'lobby') enterLobby()
    else if (id.startsWith('quick:')) networkSession.send({ type: 'quick_match', modeId: id.slice(6) })
    else if (id.startsWith('join:')) networkSession.send({ type: 'join_room', roomId: id.slice(5) })
    else if (id.startsWith('kick:')) networkSession.send({ type: 'kick_member', userId: id.slice(5) })
    else if (id === 'create') { screen = 'create'; render() }
    else if (id === 'mode') { selectedMode = selectedMode === 'classic' ? 'zombie' : 'classic'; render() }
    else if (id === 'visibility') { visibility = visibility === 'public' ? 'private' : 'public'; render() }
    else if (id === 'create-submit') networkSession.send({ type: 'create_room', modeId: selectedMode, visibility, name: fields.roomName.trim() || `${user.displayName}的房间` })
    else if (id === 'invite') { screen = 'invite'; render() }
    else if (id === 'invite-submit') networkSession.send({ type: 'join_room', invite: fields.invite.trim().toUpperCase() })
    else if (id === 'start-match') networkSession.send({ type: 'start_match' })
    else if (id === 'leave-room') networkSession.send({ type: 'leave_room' })
    else if (id === 'profile') await showProfile()
    else if (id === 'leaderboard') { leaderboardMode = 'classic'; await showLeaderboard() }
    else if (id === 'leaderboard-mode') { leaderboardMode = leaderboardMode === 'classic' ? 'zombie' : 'classic'; await showLeaderboard() }
    else if (id === 'logout') { networkSession.close(); activeSession = null; await api('/api/auth/logout', { method: 'POST' }); user = null; screen = 'auth'; render() }
  }

  function handleMessage(message) {
    if (message.type === 'hello' || message.type === 'lobby_snapshot') { rooms = message.rooms ?? rooms; user = message.user || user; if (screen === 'lobby') render() }
    else if (message.type === 'joined') { room = message.room; playerId = message.playerId; showRoomCanvas() }
    else if (message.type === 'room_state') { room = message.room; if (!game.active) showRoomCanvas() }
    else if (message.type === 'left') enterLobby()
    else if (message.type === 'match_start') { screen = 'game'; playerId = message.playerId || playerId; game.boot(message.map, message.snapshot) }
    else if (message.type === 'snapshot') game.snapshot(message.snapshot)
    else if (message.type === 'events') game.events(message.events)
    else if (message.type === 'match_end') game.end(message.snapshot)
    else if (message.type === 'kicked') { room = null; screen = 'lobby'; setStatus('你已被房主移出') }
    else if (message.type === 'error') setStatus(message.message, true)
  }

  ui.setHandlers({
    onPortalAction: action,
    onPortalSubmit: () => screen === 'auth' ? submitAuth() : null,
    onPortalInput(id, value) { fields[id] = value; render() },
    onResume: () => game.togglePause(), onQuit: () => game.leave(),
    onRedeploy: () => game.redeploy(), onSetting: (setting, value) => game.applySetting(setting, value),
    onRestart: () => game.leave(), onSpawn: index => game.deploy(index),
    onLoadout: (kind, id) => game.selectLoadout(kind, id),
  })

  return { start() { render(); game.animate() } }
}
