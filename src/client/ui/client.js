import * as THREE from 'three'
import { MODE_DEFINITIONS, rayHitObstacle } from '#simulation'
import { CFG } from '../game/config.js'
import { createGame } from '../game/game.js'
import { createDeployState, createGameState } from '../game/state.js'
import { LocalSession, NetworkSession } from '../session/session.js'

const COLORS = {
  ink: '#080c0d',
  paper: '#c9c3ae',
  panel: '#151e24',
  panel2: '#1e2930',
  panelHover: '#253440',
  line: '#2d3e4a',
  text: '#f3efe2',
  textSub: '#a0b2be',
  muted: '#6c8290',
  ally: '#4ecdc4',
  allyBg: 'rgba(78,205,196,0.12)',
  axis: '#e65c5c',
  axisBg: 'rgba(230,92,92,0.12)',
  gold: '#e5b85c',
  goldBright: '#f7d279',
  goldBg: 'rgba(229,184,92,0.14)',
  green: '#5cb887',
  danger: '#dc4e45',
}

const PIXEL_SCALE = 1.5
const TOUCH_ICONS = {
  fire: '●',
  aim: '＋',
  jump: '↑',
  crouch: '↓',
  reload: 'R',
  melee: 'F',
  grenade: 'G',
  item: 'H',
  supply: 'E',
  weapon: '↔',
  scoreboard: '≡',
  pause: 'Ⅱ',
  chat: 'T',
}

function inside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function detectTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches
}

function createCanvasUi({ state, deploy, config }) {
  const canvas = document.createElement('canvas')
  canvas.id = 'uiCanvas'
  canvas.setAttribute('aria-label', '游戏界面')
  document.body.appendChild(canvas)
  const keyboardInput = document.createElement('input')
  keyboardInput.tabIndex = -1
  keyboardInput.autocomplete = 'off'
  keyboardInput.autocapitalize = 'off'
  keyboardInput.enterKeyHint = 'send'
  keyboardInput.spellcheck = false
  keyboardInput.style.cssText = 'position:fixed;display:none;box-sizing:border-box;border:1px solid #626b66;border-radius:0;outline:none;background:#202928;color:#f3efe2;padding:0 8px;font:16px "Microsoft YaHei",sans-serif;z-index:21'
  document.body.appendChild(keyboardInput)
  const ctx = canvas.getContext('2d', { alpha: true })
  ctx.imageSmoothingEnabled = false

  let camera = null
  let width = 960
  let height = 540
  let touchMode = false
  let screen = 'boot'
  let gameVisible = false
  let paused = false
  let pauseStopsMatch = true
  let rotateVisible = false
  let selectedMode = 'classic'
  let portal = null
  let activePortalField = null
  const portalInputs = new Map()
  const visiblePortalInputs = new Set()
  let hoveredAction = null
  let deployment = null
  let endData = null
  let getMode = () => null
  let dirty = true
  let lastDraw = 0
  let fps = 0
  let fpsFrames = 0
  let fpsLast = 0
  let activeSlider = null
  let activeTouch = new Map()
  const blockedPointers = new Set()
  let handlers = {}
  let touchHandlers = {}
  let touchVisible = false
  let stickOffset = { x: 0, y: 0 }
  let scoreboardVisible = false
  let chatOpen = false
  let chatChannels = []
  let chatChannel = 'world'
  let chatValue = ''
  const chatMessages = []
  let deathText = ''
  let hitMarkerUntil = 0
  let damageUntil = 0
  let directionDamage = null
  let centerMessage = null
  let actionMessage = null
  let killNotice = null
  const killFeed = []
  const touchLabels = {
    fire: '开火', aim: '瞄准', jump: '跳跃', crouch: '蹲下', reload: '装弹',
    melee: '刺刀', grenade: '手雷', item: '道具', supply: '补给', weapon: '副',
    scoreboard: '战况', pause: '暂停', chat: '聊天',
  }
  const touchActive = {}
  const horizontalTouchActions = new Set([
    'scoreboard', 'pause', 'chat', 'reload', 'melee', 'grenade', 'item', 'supply', 'weapon',
  ])
  const hits = []
  const healthBarPosition = new THREE.Vector3()
  const actorScreenPosition = new THREE.Vector3()
  const visibilityTarget = new THREE.Vector3()
  const visibilityDirection = new THREE.Vector3()
  const healthBarUntil = new WeakMap()

  function resize() {
    height = 540
    width = Math.max(960, Math.round((height * innerWidth) / innerHeight))
    canvas.width = Math.round(width * PIXEL_SCALE)
    canvas.height = Math.round(height * PIXEL_SCALE)
    ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0)
    ctx.imageSmoothingEnabled = false
    dirty = true
  }

  function font(size, weight = 600) {
    ctx.font = `${weight} ${Math.round(size)}px "Microsoft YaHei", ui-monospace, monospace`
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '0px'
  }

  function text(value, x, y, size = 11, color = COLORS.text, align = 'left', weight = 600) {
    font(size, weight)
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(String(value ?? ''), Math.round(x), Math.round(y))
  }

  function positionInput(input, rect) {
    input.style.left = `${rect.x / width * innerWidth}px`
    input.style.top = `${rect.y / height * innerHeight}px`
    input.style.width = `${rect.w / width * innerWidth}px`
    input.style.height = `${rect.h / height * innerHeight}px`
  }

  function showPortalInput(field, rect) {
    let input = portalInputs.get(field.id)
    if (!input) {
      input = document.createElement('input')
      input.autocomplete = 'off'
      input.autocapitalize = 'off'
      input.enterKeyHint = 'done'
      input.spellcheck = false
      input.style.cssText = 'position:fixed;box-sizing:border-box;border:0;border-radius:0;outline:none;background:transparent;color:#f3efe2;padding:0 12px;font:15px "Microsoft YaHei",sans-serif;z-index:21;box-shadow:none;'
      input.addEventListener('focus', () => {
        activePortalField = field.id
        dirty = true
      })
      input.addEventListener('input', () => handlers.onPortalInput?.(field.id, input.value))
      input.addEventListener('keydown', event => {
        if (event.isComposing || event.keyCode === 229 || event.key !== 'Enter') return
        event.preventDefault()
        handlers.onPortalSubmit?.()
      })
      document.body.appendChild(input)
      portalInputs.set(field.id, input)
    }
    input.type = field.password ? 'password' : 'text'
    input.maxLength = field.maxLength || 128
    input.placeholder = field.placeholder || ''
    if (input.value !== field.value) input.value = field.value
    input.style.background = 'transparent'
    input.style.borderColor = 'transparent'
    input.style.display = 'block'
    positionInput(input, rect)
    visiblePortalInputs.add(field.id)
  }

  function box(x, y, w, h, fill = COLORS.panel) {
    ctx.fillStyle = fill
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  function button(rect, label, action, selected = false, color = COLORS.panel2, fontSize = 10, accent = COLORS.ally) {
    drawTacticalButton(rect, label, action, { selected, accent, fontSize })
  }

  function drawMainBackdrop() {
    const background = ctx.createLinearGradient(0, 0, 0, height)
    background.addColorStop(0, '#0e161c')
    background.addColorStop(0.5, '#131e26')
    background.addColorStop(1, '#090e12')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }

  function drawBoot() {
    drawMainBackdrop()
    const cx = width / 2
    ctx.save()
    font(13, 800)
    text('S T E E L   F R O N T', cx, height * 0.35, 11, COLORS.gold, 'center', 700)
    text('钢 铁 前 线', cx, height * 0.43, 30, COLORS.text, 'center', 800)
    text('TACTICAL BATTLEFIELD SIMULATION', cx, height * 0.50, 9, COLORS.muted, 'center', 600)

    const w = Math.min(380, width * 0.5)
    const barY = Math.round(height * 0.58)
    box(cx - w / 2, barY, w, 10, '#10181e')

    const progress = state.uiBootProgress || 0
    if (progress > 0) {
      const grad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0)
      grad.addColorStop(0, COLORS.ally)
      grad.addColorStop(1, COLORS.gold)
      ctx.fillStyle = grad
      ctx.fillRect(cx - w / 2 + 1, barY + 1, (w - 2) * progress, 8)
    }
    text(state.uiBootStatus || '正在装配武器...', cx, barY + 24, 9, COLORS.muted, 'center')
    ctx.restore()
  }

  function portalMargin() {
    return Math.max(24, Math.floor(width * 0.038))
  }

  function drawTacticalPanel(x, y, w, h, fill = 'rgba(20,29,36,0.92)', stroke = 'rgba(229,184,92,0.22)', overlay = null) {
    x = Math.round(x)
    y = Math.round(y)
    w = Math.round(w)
    h = Math.round(h)
    ctx.fillStyle = fill
    ctx.fillRect(x, y, w, h)
    if (overlay) {
      ctx.fillStyle = overlay.fill
      ctx.fillRect(Math.round(overlay.x), Math.round(overlay.y), Math.round(overlay.w), Math.round(overlay.h))
    }
  }

  function drawTacticalButton(rect, label, action, options = {}) {
    const {
      primary = false,
      selected = false,
      danger = false,
      fontSize = 10,
      icon = null,
      sublabel = null,
      disabled = false,
    } = options

    const hovered = !disabled && hoveredAction === action
    if (!disabled && action) {
      hits.push({ ...rect, action })
    }

    let bgFill = '#1a252d'
    let strokeColor = 'rgba(255,255,255,0.08)'
    let textColor = COLORS.text

    if (disabled) {
      bgFill = '#131b20'
      textColor = COLORS.muted
    } else if (primary) {
      if (hovered) {
        bgFill = '#f5c667'
        strokeColor = '#ffdf96'
      } else {
        bgFill = COLORS.gold
        strokeColor = COLORS.goldBright
      }
      textColor = '#0a0e11'
    } else if (danger) {
      bgFill = hovered ? '#632e2c' : '#452221'
      strokeColor = COLORS.axis
      textColor = '#ffc0c0'
    } else if (selected) {
      bgFill = hovered ? '#253542' : '#1e2c37'
      strokeColor = COLORS.gold
      textColor = COLORS.goldBright
    } else if (hovered) {
      bgFill = '#243442'
      strokeColor = 'rgba(229,184,92,0.4)'
    }

    drawTacticalPanel(rect.x, rect.y, rect.w, rect.h, bgFill)
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1
    ctx.strokeRect(Math.round(rect.x) + 0.5, Math.round(rect.y) + 0.5, Math.round(rect.w) - 1, Math.round(rect.h) - 1)

    const displayLabel = icon ? `${icon} ${label}` : label
    if (sublabel) {
      text(displayLabel, rect.x + 8, rect.y + rect.h / 2 - 6, fontSize, textColor, 'left', 700)
      text(sublabel, rect.x + 8, rect.y + rect.h / 2 + 7, fontSize - 2, primary ? '#2a3430' : COLORS.muted, 'left')
    } else {
      text(displayLabel, rect.x + rect.w / 2, rect.y + rect.h / 2, fontSize, textColor, 'center', primary ? 800 : 700)
    }
  }

  function compactPortalStatus(value) {
    if (!value) return ''
    if (value === '已连接联机服务器') return '在线'
    if (value === '正在连接...') return '连接中'
    if (value === '连接已断开') return '未连接'
    if (value.includes('恢复')) return '恢复中'
    return value.length > 10 ? `${value.slice(0, 10)}…` : value
  }

  function drawPortalHeader(portal, margin) {
    const headerH = 50
    box(0, 0, width, headerH, 'rgba(12,18,23,0.96)')

    font(14, 800)
    text('钢 铁 前 线', margin, 20, 15, COLORS.gold, 'left', 800)
    text('STEEL FRONT', margin, 36, 7, COLORS.muted, 'left', 600)

    const user = portal.user || (portal.account?.label && portal.account.label !== '登录'
      ? { displayName: portal.account.label }
      : null)
    const accountW = user && user.displayName ? Math.min(220, width * 0.28) : 110
    const accountX = width - margin - accountW
    const compactStatus = compactPortalStatus(portal.status)
    if (compactStatus) {
      const statusW = Math.min(128, Math.max(60, compactStatus.length * 8 + 28))
      const statusX = accountX - statusW - 8
      const isErr = portal.error
      drawTacticalPanel(statusX, 10, statusW, 30,
        isErr ? 'rgba(70,20,18,0.92)' : 'rgba(18,27,33,0.92)',
        isErr ? COLORS.axis : 'rgba(229,184,92,0.25)')
      ctx.fillStyle = isErr ? COLORS.axis : COLORS.green
      ctx.fillRect(statusX + 8, 22, 5, 5)
      text(compactStatus, statusX + 20, 25, 8, isErr ? '#ffaaaa' : COLORS.textSub, 'left')
    }

    if (user && user.displayName) {
      const chipW = accountW
      const chipX = accountX
      box(chipX, 10, chipW, 30, 'rgba(26,37,45,0.9)')

      text(user.displayName, chipX + 10, 25, 9, COLORS.text, 'left', 700)

      drawTacticalButton({ x: chipX + chipW - 54, y: 13, w: 48, h: 24 }, '退出', 'portal:logout', {
        danger: true,
        fontSize: 8,
      })
    } else {
      drawTacticalButton({ x: accountX, y: 12, w: accountW, h: 26 }, '登录 / 注册', 'portal:login', {
        primary: true,
        fontSize: 8,
      })
    }
  }

  function drawPortalFooter(portal, margin) {
    if (chatChannels.length) {
      drawTacticalButton({ x: margin, y: height - 28, w: 76, h: 22 }, '聊天', 'chat-open', {
        accent: COLORS.green,
        fontSize: 8,
      })
    }
  }

  function getScreenType(portal) {
    if (portal.screenType) return portal.screenType
    const title = portal.title || ''
    if (title.includes('账号') || title.includes('登录') || title.includes('注册')) return 'auth'
    if (title.includes('创建房间')) return 'create'
    if (title.includes('邀请码')) return 'invite'
    if (title.includes('战绩排行')) return 'stats'
    if (portal.profile || portal.room) return 'room'
    return 'choice'
  }

  function drawChoiceScreen(portal, margin) {
    const curMode = portal.selectedMode || selectedMode || 'classic'
    const curTeam = portal.selectedTeam || 'allies'
    const recs = portal.records || state.records || {}
    const user = portal.user

    const usableY = 62
    const usableH = height - usableY - 34
    const usableW = width - margin * 2
    const leftW = Math.floor(usableW * 0.54)
    const rightX = margin + leftW + 16
    const rightW = usableW - leftW - 16

    text('选择作战模式', margin, usableY + 10, 9, COLORS.gold, 'left', 700)

    const cardW = Math.floor((leftW - 12) / 2)
    const cardH = 144
    const cardY = usableY + 24

    const c1Selected = curMode === 'classic'
    const c1Rect = { x: margin, y: cardY, w: cardW, h: cardH }
    drawTacticalPanel(c1Rect.x, c1Rect.y, c1Rect.w, c1Rect.h,
      c1Selected ? 'rgba(30,45,56,0.92)' : 'rgba(18,26,32,0.85)',
      c1Selected ? COLORS.gold : (hoveredAction === 'portal:select-mode:classic' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'))
    text('经典对抗', c1Rect.x + 12, c1Rect.y + 22, 14, c1Selected ? COLORS.goldBright : COLORS.text, 'left', 800)
    text('PVP / AI 战术对抗', c1Rect.x + 12, c1Rect.y + 40, 8, COLORS.muted, 'left')
    text('控制关键要点，消灭敌方兵力', c1Rect.x + 12, c1Rect.y + 64, 8, COLORS.textSub, 'left')
    text('率先达成设定击杀目标', c1Rect.x + 12, c1Rect.y + 78, 8, COLORS.textSub, 'left')

    const recClassic = recs.classic || { matches: 0, wins: 0, kills: 0 }
    text(`战绩: ${recClassic.matches || 0}场 | ${recClassic.wins || 0}胜 | ${recClassic.kills || 0}杀`, c1Rect.x + 12, c1Rect.y + 124, 8, c1Selected ? COLORS.gold : COLORS.muted, 'left')
    hits.push({ ...c1Rect, action: 'portal:select-mode:classic' })

    const c2Selected = curMode === 'zombie'
    const c2Rect = { x: margin + cardW + 12, y: cardY, w: cardW, h: cardH }
    drawTacticalPanel(c2Rect.x, c2Rect.y, c2Rect.w, c2Rect.h,
      c2Selected ? 'rgba(30,45,56,0.92)' : 'rgba(18,26,32,0.85)',
      c2Selected ? COLORS.gold : (hoveredAction === 'portal:select-mode:zombie' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'))
    text('丧尸围城', c2Rect.x + 12, c2Rect.y + 22, 14, c2Selected ? COLORS.goldBright : COLORS.text, 'left', 800)
    text('PVE 极限阵地生存', c2Rect.x + 12, c2Rect.y + 40, 8, COLORS.muted, 'left')
    text('坚守防线要塞', c2Rect.x + 12, c2Rect.y + 64, 8, COLORS.textSub, 'left')
    text('抵抗源源不断的丧尸浪潮', c2Rect.x + 12, c2Rect.y + 78, 8, COLORS.textSub, 'left')

    const recZombie = recs.zombie || { matches: 0, wins: 0, kills: 0 }
    text(`战绩: ${recZombie.matches || 0}场 | ${recZombie.kills || 0}杀`, c2Rect.x + 12, c2Rect.y + 124, 8, c2Selected ? COLORS.gold : COLORS.muted, 'left')
    hits.push({ ...c2Rect, action: 'portal:select-mode:zombie' })

    const pracY = cardY + cardH + 14
    const pracH = usableH - (pracY - usableY)
    drawTacticalPanel(margin, pracY, leftW, pracH, 'rgba(18,26,32,0.85)', 'rgba(229,184,92,0.2)')
    text('离线单人试炼', margin + 14, pracY + 20, 10, COLORS.gold, 'left', 700)
    text('无需登陆注册，体验完整的兵种、武器与仿真AI对战', margin + 14, pracY + 38, 8, COLORS.textSub, 'left')

    if (curMode === 'classic') {
      const btnY = pracY + 54
      const teamBtnW = 140
      const startBtnW = leftW - 28 - teamBtnW - 10
      drawTacticalButton({ x: margin + 14, y: btnY, w: teamBtnW, h: 36 },
        `阵营: ${curTeam === 'allies' ? '盟军' : '轴心'}`, 'portal:team', {
          accent: curTeam === 'allies' ? COLORS.ally : COLORS.axis,
          fontSize: 8,
        })
      drawTacticalButton({ x: margin + 14 + teamBtnW + 10, y: btnY, w: startBtnW, h: 36 },
        '开始单人对战', 'portal:offline-start', {
          primary: true,
          fontSize: 10,
        })
    } else {
      drawTacticalButton({ x: margin + 14, y: pracY + 54, w: leftW - 28, h: 36 },
        '开始单人对战', 'portal:offline-start', {
          primary: true,
          fontSize: 10,
        })
    }

    text('联机作战大厅', rightX, usableY + 10, 9, COLORS.gold, 'left', 700)

    const quickModeName = curMode === 'classic' ? '经典对抗' : '丧尸围城'
    drawTacticalButton({ x: rightX, y: cardY, w: rightW, h: 44 },
      `快速匹配  [ ${quickModeName} ]`, `portal:quick:${curMode}`, {
        primary: true,
        fontSize: 11,
      })

    const actY = cardY + 52
    if (user) {
      const actW = Math.floor((rightW - 12) / 3)
      drawTacticalButton({ x: rightX, y: actY, w: actW, h: 32 }, '创建房间', 'portal:create', { fontSize: 8 })
      drawTacticalButton({ x: rightX + actW + 6, y: actY, w: actW, h: 32 }, '邀请码', 'portal:invite', { fontSize: 8 })
      drawTacticalButton({
        x: rightX + (actW + 6) * 2,
        y: actY,
        w: rightW - (actW + 6) * 2,
        h: 32,
      }, '排行榜', 'portal:stats', { fontSize: 8 })
    } else {
      drawTacticalButton({ x: rightX, y: actY, w: rightW, h: 32 }, '登录账号解锁联机建房与全服排行', 'portal:login', {
        accent: COLORS.gold,
        fontSize: 8,
      })
    }

    const roomY = actY + 40
    const roomH = usableH - (roomY - usableY)
    drawTacticalPanel(rightX, roomY, rightW, roomH, 'rgba(18,26,32,0.85)', 'rgba(229,184,92,0.18)')
    text('公开房间列表', rightX + 14, roomY + 18, 9, COLORS.gold, 'left', 700)

    const roomRows = (portal.rooms || []).map(r => ({
      label: `${r.name}  [${r.modeId === 'classic' ? '经典' : '丧尸'}]  ${r.players}/${r.capacity}`,
      action: `join:${r.id}`,
      actionLabel: '加入',
    }))

    if (!roomRows.length && portal.rows) {
      for (const row of portal.rows) {
        if (row.action && row.action.startsWith('join:')) {
          roomRows.push(row)
        }
      }
    }

    const listY = roomY + 32
    const listH = roomH - 40
    const maxItems = Math.max(1, Math.floor(listH / 30))

    if (roomRows.length > 0) {
      roomRows.slice(0, maxItems).forEach((row, idx) => {
        const itemY = listY + idx * 30
        const itemRect = { x: rightX + 8, y: itemY, w: rightW - 16, h: 26 }
        drawTacticalPanel(itemRect.x, itemRect.y, itemRect.w, itemRect.h,
          idx % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)', 'rgba(255,255,255,0.05)',
          { x: itemRect.x, y: itemRect.y, w: 2, h: itemRect.h, fill: COLORS.ally })
        text(row.label, itemRect.x + 8, itemRect.y + itemRect.h / 2, 8, COLORS.text)

        const btnW = 50
        drawTacticalButton({ x: itemRect.x + itemRect.w - btnW - 3, y: itemRect.y + 2, w: btnW, h: 22 },
          '加入', `portal:${row.action}`, { primary: true, fontSize: 7 })
      })
    } else {
      text('当前暂无公开房间', rightX + rightW / 2, roomY + roomH / 2 - 8, 9, COLORS.muted, 'center')
      text('可随时【创建房间】或使用【快速匹配】', rightX + rightW / 2, roomY + roomH / 2 + 10, 8, COLORS.textSub, 'center')
    }
  }

  function drawAuthScreen(portal, margin) {
    const isRegister = portal.register ?? (portal.title?.includes('创建') || false)
    const boxW = Math.min(400, width - 40)
    const boxH = Math.min(370, height - 60)
    const boxX = Math.round((width - boxW) / 2)
    const boxY = Math.round((height - boxH) / 2)

    drawTacticalPanel(boxX, boxY, boxW, boxH, 'rgba(16,23,29,0.96)', COLORS.gold)
    text('战场终端账号', boxX + 20, boxY + 22, 11, COLORS.gold, 'left', 800)

    const tabW = Math.floor((boxW - 48) / 2)
    drawTacticalButton({ x: boxX + 20, y: boxY + 42, w: tabW, h: 32 },
      '账号登录', 'portal:auth-toggle', { selected: !isRegister, fontSize: 9 })
    drawTacticalButton({ x: boxX + 20 + tabW + 8, y: boxY + 42, w: tabW, h: 32 },
      '创建账号', 'portal:auth-toggle', { selected: isRegister, fontSize: 9 })

    let cursorY = boxY + 90
    for (const field of portal.fields || []) {
      text(field.label, boxX + 24, cursorY, 8, COLORS.gold, 'left', 700)
      const inputRect = { x: boxX + 24, y: cursorY + 12, w: boxW - 48, h: 36 }
      drawTacticalPanel(inputRect.x, inputRect.y, inputRect.w, inputRect.h,
        activePortalField === field.id ? '#1e2b34' : '#141d24',
        activePortalField === field.id ? COLORS.gold : 'rgba(229,184,92,0.3)')
      showPortalInput(field, inputRect)
      cursorY += 62
    }

    drawTacticalButton({ x: boxX + 24, y: boxY + boxH - 86, w: boxW - 48, h: 38 },
      isRegister ? '注册并登录' : '立即登录', 'portal:auth-submit', { primary: true, fontSize: 10 })
    drawTacticalButton({ x: boxX + 24, y: boxY + boxH - 42, w: boxW - 48, h: 28 },
      '返回', 'portal:choice', { fontSize: 8 })
  }

  function drawCreateScreen(portal, margin) {
    const boxW = Math.min(420, width - 40)
    const boxH = Math.min(340, height - 60)
    const boxX = Math.round((width - boxW) / 2)
    const boxY = Math.round((height - boxH) / 2)

    drawTacticalPanel(boxX, boxY, boxW, boxH, 'rgba(16,23,29,0.96)', COLORS.gold)
    text('创建作战房间', boxX + 24, boxY + 24, 12, COLORS.gold, 'left', 800)

    let cursorY = boxY + 54
    for (const field of portal.fields || []) {
      text(field.label, boxX + 24, cursorY, 8, COLORS.gold, 'left', 700)
      const inputRect = { x: boxX + 24, y: cursorY + 12, w: boxW - 48, h: 36 }
      drawTacticalPanel(inputRect.x, inputRect.y, inputRect.w, inputRect.h,
        activePortalField === field.id ? '#1e2b34' : '#141d24',
        activePortalField === field.id ? COLORS.gold : 'rgba(229,184,92,0.3)')
      showPortalInput(field, inputRect)
      cursorY += 62
    }

    const modeBtn = portal.actions?.find(a => a.id === 'mode')
    if (modeBtn) {
      drawTacticalButton({ x: boxX + 24, y: cursorY, w: boxW - 48, h: 36 },
        modeBtn.label, 'portal:mode', { accent: COLORS.ally, fontSize: 9 })
      cursorY += 46
    }

    const visBtn = portal.actions?.find(a => a.id === 'visibility')
    if (visBtn) {
      drawTacticalButton({ x: boxX + 24, y: cursorY, w: boxW - 48, h: 36 },
        visBtn.label, 'portal:visibility', { accent: COLORS.gold, fontSize: 9 })
      cursorY += 46
    }

    drawTacticalButton({ x: boxX + 24, y: boxY + boxH - 86, w: boxW - 48, h: 38 },
      '确认创建房间', 'portal:create-submit', { primary: true, fontSize: 10 })
    drawTacticalButton({ x: boxX + 24, y: boxY + boxH - 42, w: boxW - 48, h: 28 },
      '返回大厅', 'portal:lobby', { fontSize: 8 })
  }

  function drawInviteScreen(portal, margin) {
    const boxW = Math.min(380, width - 40)
    const boxH = Math.min(260, height - 60)
    const boxX = Math.round((width - boxW) / 2)
    const boxY = Math.round((height - boxH) / 2)

    drawTacticalPanel(boxX, boxY, boxW, boxH, 'rgba(16,23,29,0.96)', COLORS.gold)
    text('邀请码加入房间', boxX + 24, boxY + 24, 11, COLORS.gold, 'left', 800)

    let cursorY = boxY + 58
    for (const field of portal.fields || []) {
      text(field.label, boxX + 24, cursorY, 8, COLORS.gold, 'left', 700)
      const inputRect = { x: boxX + 24, y: cursorY + 12, w: boxW - 48, h: 40 }
      drawTacticalPanel(inputRect.x, inputRect.y, inputRect.w, inputRect.h,
        activePortalField === field.id ? '#1e2b34' : '#141d24',
        activePortalField === field.id ? COLORS.gold : 'rgba(229,184,92,0.3)')
      showPortalInput(field, inputRect)
    }

    drawTacticalButton({ x: boxX + 24, y: boxY + boxH - 86, w: boxW - 48, h: 38 },
      '加入房间', 'portal:invite-submit', { primary: true, fontSize: 10 })
    drawTacticalButton({ x: boxX + 24, y: boxY + boxH - 42, w: boxW - 48, h: 28 },
      '返回大厅', 'portal:lobby', { fontSize: 8 })
  }

  function drawRoomScreen(portal, margin) {
    const rows = portal.rows || []
    const actions = portal.actions || []

    const usableY = 62
    const usableW = width - margin * 2
    const listY = usableY + 48
    const actionY = height - 68
    const listH = actionY - listY - 12

    drawTacticalPanel(margin, usableY, usableW, 40, 'rgba(18,27,34,0.92)', 'rgba(229,184,92,0.3)')
    text(`房间: ${portal.title || '作战房间'}`, margin + 14, usableY + 20, 12, COLORS.goldBright, 'left', 800)
    if (portal.profile) {
      text(portal.profile, margin + usableW - 14, usableY + 20, 8, COLORS.textSub, 'right')
    }

    if (rows.some(r => r.accent === COLORS.ally || r.label.includes('[盟军]') || r.label.includes('[轴心]'))) {
      const colW = Math.floor((usableW - 16) / 2)

      drawTacticalPanel(margin, listY, colW, listH, 'rgba(14,23,28,0.9)', COLORS.ally,
        { x: margin, y: listY, w: colW, h: 24, fill: COLORS.ally })
      text('盟军小队', margin + 12, listY + 12, 9, '#0a0e11', 'left', 800)

      const axisX = margin + colW + 16
      drawTacticalPanel(axisX, listY, colW, listH, 'rgba(24,16,18,0.9)', COLORS.axis,
        { x: axisX, y: listY, w: colW, h: 24, fill: COLORS.axis })
      text('轴心小队', axisX + 12, listY + 12, 9, '#0a0e11', 'left', 800)

      let allyIdx = 0
      let axisIdx = 0
      rows.forEach(r => {
        const isAlly = r.accent === COLORS.ally || r.label.includes('[盟军]')
        const colX = isAlly ? margin : axisX
        const idx = isAlly ? allyIdx++ : axisIdx++
        const itemY = listY + 30 + idx * 32
        const itemW = colW - 16
        if (itemY + 28 <= listY + listH) {
          box(colX + 8, itemY, itemW, 26, 'rgba(255,255,255,0.04)')
          text(r.label.replace(/\[盟军]\s*|\[轴心]\s*/, ''), colX + 16, itemY + 13, 8, COLORS.text)

          if (r.action) {
            drawTacticalButton({ x: colX + 8 + itemW - 50, y: itemY + 2, w: 46, h: 22 },
              '移除', `portal:${r.action}`, { danger: true, fontSize: 7 })
          }
        }
      })
    } else {
      drawTacticalPanel(margin, listY, usableW, listH, 'rgba(16,24,30,0.9)', COLORS.gold)
      text('房间战士列表', margin + 14, listY + 18, 10, COLORS.gold, 'left', 700)

      rows.forEach((r, idx) => {
        const itemY = listY + 32 + idx * 32
        if (itemY + 28 <= listY + listH) {
          box(margin + 12, itemY, usableW - 24, 26, 'rgba(255,255,255,0.04)')
          text(r.label, margin + 20, itemY + 13, 9, COLORS.text)

          if (r.action) {
            drawTacticalButton({ x: margin + usableW - 70, y: itemY + 2, w: 56, h: 22 },
              '移除', `portal:${r.action}`, { danger: true, fontSize: 7 })
          }
        }
      })
    }

    const changeTeamBtn = actions.find(a => a.id === 'change-team')
    const startBtn = actions.find(a => a.id === 'start-match')
    const leaveBtn = actions.find(a => a.id === 'leave-room')

    if (changeTeamBtn) {
      drawTacticalButton({ x: margin, y: actionY, w: 180, h: 34 },
        '切换阵营', 'portal:change-team', { accent: changeTeamBtn.accent || COLORS.ally, fontSize: 9 })
    }

    if (startBtn) {
      drawTacticalButton({ x: Math.round(width / 2 - 100), y: actionY, w: 200, h: 34 },
        '开始游戏', 'portal:start-match', { primary: true, fontSize: 10 })
    }

    if (leaveBtn) {
      drawTacticalButton({ x: width - margin - 120, y: actionY, w: 120, h: 34 },
        '退出房间', 'portal:leave-room', { danger: true, fontSize: 9 })
    }
  }

  function drawStatsScreen(portal, margin) {
    const boxW = Math.min(680, width - 40)
    const boxH = Math.min(440, height - 50)
    const boxX = Math.round((width - boxW) / 2)
    const boxY = Math.round((height - boxH) / 2)

    drawTacticalPanel(boxX, boxY, boxW, boxH, 'rgba(16,23,29,0.96)', COLORS.gold)
    text('战场排行榜 & 个人战绩', boxX + 24, boxY + 24, 12, COLORS.gold, 'left', 800)

    const modeBtn = portal.actions?.find(a => a.id === 'leaderboard-mode')
    if (modeBtn) {
      drawTacticalButton({ x: boxX + boxW - 164, y: boxY + 12, w: 140, h: 28 },
        modeBtn.label, 'portal:leaderboard-mode', { accent: COLORS.gold, fontSize: 8 })
    }

    const rows = portal.profileRows || portal.rows || []
    const listY = boxY + 50
    const listH = boxH - 100
    const maxItems = Math.max(1, Math.floor(listH / 30))

    rows.slice(0, maxItems).forEach((row, idx) => {
      const itemY = listY + idx * 30
      const label = typeof row === 'string' ? row : row.label
      const rank = typeof row === 'object' && Number.isInteger(row.rank) ? row.rank : null

      box(boxX + 16, itemY, boxW - 32, 26, idx % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.15)')

      let rankColor = COLORS.text
      let rankPrefix = ''
      if (rank === 1) {
        rankColor = COLORS.goldBright
        rankPrefix = '[1] '
      } else if (rank === 2) {
        rankColor = '#d0d0d0'
        rankPrefix = '[2] '
      } else if (rank === 3) {
        rankColor = '#cd7f32'
        rankPrefix = '[3] '
      } else if (rank) {
        rankColor = COLORS.gold
        rankPrefix = `[${rank}] `
      }

      text(`${rankPrefix}${label}`, boxX + 20, itemY + 13, 8, rankColor)
    })

    drawTacticalButton({ x: boxX + 24, y: boxY + boxH - 42, w: boxW - 48, h: 30 },
      '返回大厅', 'portal:lobby', { fontSize: 8 })
  }

  function drawPortal() {
    if (!portal) return
    drawMainBackdrop()
    const margin = portalMargin()
    drawPortalHeader(portal, margin)

    const type = getScreenType(portal)

    if (type === 'choice') {
      drawChoiceScreen(portal, margin)
    } else if (type === 'auth') {
      drawAuthScreen(portal, margin)
    } else if (type === 'create') {
      drawCreateScreen(portal, margin)
    } else if (type === 'invite') {
      drawInviteScreen(portal, margin)
    } else if (type === 'room') {
      drawRoomScreen(portal, margin)
    } else if (type === 'stats') {
      drawStatsScreen(portal, margin)
    }

    drawPortalFooter(portal, margin)
  }

  function drawMenu() {
    drawPortal()
  }

  function drawSlider(x, y, w, label, action, value, min, max, dark = false) {
    text(label, x, y - 12, 8, dark ? COLORS.muted : COLORS.ink)
    const rect = { x, y, w, h: 12 }
    box(x, y, w, 12, dark ? '#313d40' : '#68736f')
    const ratio = (value - min) / (max - min)
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(x + 1, y + 1, (w - 2) * ratio, 10)
    ctx.fillStyle = dark ? COLORS.text : COLORS.ink
    ctx.fillRect(x + 1 + (w - 2) * ratio - 2, y - 2, 4, 16)
    text(Math.round(value), x + w + 10, y + 6, 8, dark ? COLORS.text : COLORS.ink)
    hits.push({ ...rect, action: 'slider', setting: action, min, max })
  }

  function drawHud(now) {
    if (!state.player || deploy.phase !== 'none') return
    const player = state.player
    const mode = getMode()?.getHudState()
    drawActorHealthBars(now)
    if (mode) {
      const friendlyIsAllies = player.team === 'allies'
      const friendlyLabel = friendlyIsAllies ? mode.alliesLabel : mode.axisLabel
      const friendlyScore = friendlyIsAllies ? mode.alliesScore : mode.axisScore
      const enemyLabel = friendlyIsAllies ? mode.axisLabel : mode.alliesLabel
      const enemyScore = friendlyIsAllies ? mode.axisScore : mode.alliesScore
      const friendlyColor = friendlyIsAllies ? COLORS.ally : COLORS.axis
      const enemyColor = friendlyIsAllies ? COLORS.axis : COLORS.ally
      const topW = 220
      const x = width / 2 - topW / 2
      box(x, 8, topW, 30, 'rgba(18,24,27,.66)')
      ctx.fillStyle = friendlyColor
      ctx.fillRect(x, 8, 3, 30)
      ctx.fillStyle = enemyColor
      ctx.fillRect(x + topW - 3, 8, 3, 30)
      text(`${friendlyLabel}  ${friendlyScore}`, width / 2 - 52, 18, 11, friendlyColor, 'center', 700)
      text(`${enemyScore}  ${enemyLabel}`, width / 2 + 52, 18, 11, enemyColor, 'center', 700)
      text(mode.targetText, width / 2, 31, 7, COLORS.muted, 'center')
    }

    box(16, height - 48, 168, 30, 'rgba(18,24,27,.82)')
    text('HP', 24, height - 38, 7, COLORS.muted)
    text(`${Math.ceil(player.health)} / ${player.maxHealth}`, 176, height - 38, 8, COLORS.text, 'right', 700)
    ctx.fillStyle = '#4a5554'
    ctx.fillRect(24, height - 28, 152, 4)
    ctx.fillStyle = player.health < 30 ? COLORS.danger : COLORS.green
    ctx.fillRect(24, height - 28, 152 * clamp(player.health / player.maxHealth, 0, 1), 4)

    const equipmentX = width - 236
    box(equipmentX, height - 58, 220, 40, 'rgba(18,24,27,.82)')
    text(player.activeSlot === 2 ? player.secondaryData.name : player.weaponData.name, equipmentX + 8, height - 48, 8, COLORS.gold, 'left', 700)
    const onSecondary = player.activeSlot === 2
    const onRpg = onSecondary && player.secondaryData.kind === 'rpg'
    const ammo = onSecondary ? (onRpg ? (player.rpgLoaded ? 1 : 0) : player.secondaryCount) : player.ammo
    const reserve = onSecondary ? player.secondaryCount - ammo : player.reserveAmmo
    const ammoText = onSecondary && !onRpg ? `${ammo} 枚` : `${ammo} / ${Math.max(0, reserve)}`
    text(ammoText, width - 24, height - 48, 10, COLORS.text, 'right', 700)
    drawEquipmentState(player, equipmentX + 8, height - 28, 204)

    drawMinimap(width - 128, 8, 120)
    text(`${fps} FPS`, 2, 8, 8, '#ffffff')
    if (!player.aiming && !deathText) drawCrosshair(player)
    if (now < hitMarkerUntil) drawHitMarker()
    if (now < damageUntil) drawDamageBorder()
    if (directionDamage && now < directionDamage.until) {
      drawDirectionDamage(directionDamage.source, now)
    } else {
      directionDamage = null
    }
    drawTimedText(now)
    drawFeed(now)
    if (scoreboardVisible) drawScoreboard()
  }

  function drawActorHealthBars(now) {
    if (!camera) return
    for (const actor of state.actors) {
      if (!actor.alive) {
        healthBarUntil.delete(actor)
        continue
      }
      healthBarPosition.set(actor.position.x, actor.position.y + 2.45, actor.position.z).project(camera)
      if (healthBarPosition.z < -1 || healthBarPosition.z > 1 || Math.abs(healthBarPosition.x) > 1.08 || Math.abs(healthBarPosition.y) > 1.08) continue
      const x = (healthBarPosition.x * 0.5 + 0.5) * width
      const y = (-healthBarPosition.y * 0.5 + 0.5) * height
      actorScreenPosition.set(actor.position.x, actor.position.y + 1.05, actor.position.z).project(camera)
      const actorX = (actorScreenPosition.x * 0.5 + 0.5) * width
      const actorY = (-actorScreenPosition.y * 0.5 + 0.5) * height
      const nearCrosshair = Math.hypot(actorX - width / 2, actorY - height / 2) < 34
      const human = actor.actorKind === 'player'
      const nameAlwaysVisible = human && actor.team === state.player.team
      const shownUntil = healthBarUntil.get(actor) || 0
      const healthVisible = nearCrosshair || shownUntil > now
      if (!healthVisible && !nameAlwaysVisible) {
        healthBarUntil.delete(actor)
        continue
      }
      const actorVisible = hasActorLineOfSight(actor)
      if (nearCrosshair && actorVisible) healthBarUntil.set(actor, now + config.hud.healthBarHoldDuration)
      if (healthVisible && actorVisible) drawActorHealth(actor, x, y)
      if (human && (nameAlwaysVisible || healthVisible && actorVisible)) drawActorName(actor, x, y)
    }
  }

  function hasActorLineOfSight(actor) {
    visibilityTarget.set(actor.position.x, actor.position.y + 1.25, actor.position.z)
    visibilityDirection.subVectors(visibilityTarget, camera.position)
    const distance = visibilityDirection.length()
    visibilityDirection.multiplyScalar(1 / distance)
    for (const obstacle of state.obstacles) {
      if (obstacle.type === 'ground' || obstacle.type === 'crater') continue
      if (rayHitObstacle(camera.position, visibilityDirection, obstacle, distance) != null) return false
    }
    return true
  }

  function drawActorHealth(actor, x, y) {
    const barW = 28
    ctx.fillStyle = 'rgba(18,24,27,.82)'
    ctx.fillRect(x - barW / 2, y - 11, barW, 3)
    ctx.fillStyle = actor.health / actor.maxHealth < 0.3
      ? COLORS.danger
      : actor.team === 'allies' ? COLORS.ally : COLORS.axis
    ctx.fillRect(x - barW / 2 + 1, y - 10, (barW - 2) * clamp(actor.health / actor.maxHealth, 0, 1), 1)
  }

  function drawActorName(actor, x, y) {
    const maxWidth = 96
    let fontSize = 8
    while (fontSize > 6) {
      font(fontSize, 700)
      if (ctx.measureText(actor.name).width <= maxWidth) break
      fontSize--
    }
    text(actor.name, clamp(x, maxWidth / 2, width - maxWidth / 2), y - 16, fontSize,
      actor.team === 'allies' ? COLORS.ally : COLORS.axis, 'center', 700)
  }

  function drawEquipmentState(player, x, y, w) {
    const secondary = player.secondaryData.kind === 'rpg'
      ? `RPG ${player.rpgLoaded ? '已装' : '空'} ${player.secondaryCount}`
      : `C4 ×${player.secondaryCount}`
    const grenade = `${player.grenadeData.kind === 'frag' ? '破片' : '烟雾'} ×${player.grenadeCount}`
    const item = `${player.itemData.kind === 'heal' ? '急救' : '弹药'} ×${player.itemUses}`
    const entries = [
      [secondary, player.activeSlot === 2],
      [grenade, false],
      [item, false],
    ]
    const itemW = w / entries.length
    entries.forEach(([label, active], index) => {
      const itemX = x + index * itemW
      ctx.fillStyle = active ? 'rgba(231,197,104,.22)' : 'rgba(255,255,255,.04)'
      ctx.fillRect(itemX, y - 7, itemW - 2, 14)
      text(label, itemX + itemW / 2 - 1, y, 7, active ? COLORS.gold : COLORS.muted, 'center', active ? 700 : 600)
    })
  }

  function drawCrosshair(player) {
    const spread = player.currentSpread || player.getSpread()
    const gap = 7 + spread * config.hud.crosshairSpreadScale
    const cx = width / 2
    const cy = height / 2
    ctx.fillStyle = '#f4f1d8'
    ctx.fillRect(cx - 1, cy - gap - 8, 2, 6)
    ctx.fillRect(cx - 1, cy + gap + 2, 2, 6)
    ctx.fillRect(cx - gap - 8, cy - 1, 6, 2)
    ctx.fillRect(cx + gap + 2, cy - 1, 6, 2)
    ctx.fillRect(cx - 1, cy - 1, 2, 2)
  }

  function drawHitMarker() {
    const cx = width / 2
    const cy = height / 2
    ctx.strokeStyle = '#fff1be'
    ctx.lineWidth = 3
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath()
      ctx.moveTo(cx + sx * 7, cy + sy * 7)
      ctx.lineTo(cx + sx * 14, cy + sy * 14)
      ctx.stroke()
    }
  }

  function drawDamageBorder() {
    ctx.strokeStyle = 'rgba(210,49,45,.72)'
    ctx.lineWidth = 18
    ctx.strokeRect(4, 4, width - 8, height - 8)
  }

  function drawDirectionDamage(source, now) {
    const position = source.position || source
    const angle = Math.atan2(position.x - state.player.position.x, -(position.z - state.player.position.z)) + state.player.yaw
    const radius = 86 + Math.sin(now * 0.012) * 3
    const cx = width / 2 + Math.sin(angle) * radius
    const cy = height / 2 - Math.cos(angle) * radius
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.fillStyle = COLORS.danger
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(-7, 5)
    ctx.lineTo(0, 2)
    ctx.lineTo(7, 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  function drawTimedText(now) {
    if (centerMessage && now < centerMessage.until) {
      text(centerMessage.big, width / 2, height * 0.34, 23, COLORS.gold, 'center', 800)
      text(centerMessage.text, width / 2, height * 0.4, 12, COLORS.text, 'center', 700)
    }
    if (actionMessage && now < actionMessage.until) {
      text(actionMessage.text, width / 2, height * 0.7, 10, COLORS.gold, 'center', 700)
    }
    if (killNotice && now < killNotice.until) {
      text(killNotice.title, width / 2, height * 0.72, 17, COLORS.gold, 'center', 800)
      text(killNotice.sub, width / 2, height * 0.76, 9, COLORS.text, 'center')
    }
  }

  function drawFeed(now) {
    while (killFeed[0] && killFeed[0].until <= now) killFeed.shift()
    killFeed.slice(-6).reverse().forEach((item, index) => {
      const y = (touchMode ? 66 : 24) + index * 17
      ctx.fillStyle = 'rgba(18,24,27,.72)'
      ctx.fillRect(16, y - 7, 188, 14)
      ctx.fillStyle = item.type === 'player' ? COLORS.gold : COLORS.axis
      ctx.fillRect(16, y - 7, 2, 14)
      text(`${item.killer}  >  ${item.victim}`, 23, y, 8, item.type === 'player' ? COLORS.gold : COLORS.text)
    })
  }

  function drawMinimap(x, y, size) {
    box(x, y, size, size, 'rgba(18,24,27,.82)')
    const scale = (size - 10) / state.mapSize
    for (const obstacle of state.obstacles) {
      if (obstacle.x == null || !['building', 'tank', 'sandbag'].includes(obstacle.type)) continue
      ctx.fillStyle = '#758078'
      ctx.fillRect(x + size / 2 + obstacle.x * scale - 1, y + size / 2 + obstacle.z * scale - 1, 3, 3)
    }
    for (const actor of state.actors) {
      if (!actor.alive) continue
      ctx.fillStyle = actor.team === 'allies' ? COLORS.ally : COLORS.axis
      ctx.fillRect(x + size / 2 + actor.position.x * scale - 2, y + size / 2 + actor.position.z * scale - 2, 4, 4)
    }
    if (state.player?.alive) {
      const px = x + size / 2 + state.player.position.x * scale
      const py = y + size / 2 + state.player.position.z * scale
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(-state.player.yaw)
      ctx.fillStyle = COLORS.gold
      ctx.beginPath()
      ctx.moveTo(0, -6)
      ctx.lineTo(-4, 5)
      ctx.lineTo(0, 2)
      ctx.lineTo(4, 5)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  function drawScoreboard() {
    const panelW = Math.min(720, width - 80)
    const x = (width - panelW) / 2
    const y = 78
    const panelH = height - y - 62
    box(x, y, panelW, panelH, 'rgba(18,24,27,.96)')
    text('战 况', width / 2, y + 25, 16, COLORS.gold, 'center', 700)
    const me = { name: '你', kills: state.player.kills, deaths: state.player.deaths, alive: state.player.alive, me: true }
    const friendly = state.actors.filter(actor => actor.team === state.player.team)
    const enemy = state.actors.filter(actor => actor.team !== state.player.team)
    friendly.unshift(me)
    const friendlyLabel = state.player.team === 'allies' ? '盟军' : '轴心'
    const enemyLabel = state.player.team === 'allies' ? '轴心' : '盟军'
    const friendlyColor = state.player.team === 'allies' ? COLORS.ally : COLORS.axis
    const enemyColor = state.player.team === 'allies' ? COLORS.axis : COLORS.ally
    const teamY = y + 62
    drawTeamRows(friendly, x + 22, teamY, panelW / 2 - 34, friendlyColor, friendlyLabel)
    drawTeamRows(enemy, x + panelW / 2 + 12, teamY, panelW / 2 - 34, enemyColor, enemyLabel)
  }

  function drawTeamRows(entries, x, y, w, color, label) {
    entries.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    text(`${label}士兵`, x, y, 9, color)
    text('K  D', x + w, y, 9, color, 'right')
    const rowGap = 19
    entries.slice(0, 14).forEach((entry, index) => {
      const rowY = y + 24 + index * rowGap
      const rowH = 17
      ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.12)'
      ctx.fillRect(x - 4, rowY - Math.floor(rowH / 2), w + 8, rowH)
      if (entry.me) {
        ctx.fillStyle = 'rgba(224,189,98,.15)'
        ctx.fillRect(x - 4, rowY - Math.floor(rowH / 2), w + 8, rowH)
      }
      text(entry.name || '士兵', x, rowY, 8, entry.alive === false ? '#707773' : COLORS.text)
      text(`${entry.kills || 0}  ${entry.deaths || 0}`, x + w, rowY, 8, COLORS.muted, 'right')
    })
  }

  function drawDeath() {
    ctx.fillStyle = 'rgba(28,8,8,.56)'
    ctx.fillRect(0, 0, width, height)
    text('阵 亡', width / 2, height * 0.42, 29, COLORS.axis, 'center', 800)
    text('击杀者', width / 2, height * 0.5, 8, COLORS.muted, 'center', 700)
    text(deathText, width / 2, height * 0.55, 16, COLORS.text, 'center', 800)
  }

  function drawDeployment() {
    if (!deployment) return
    ctx.fillStyle = 'rgba(8,13,15,.24)'
    ctx.fillRect(0, 0, width, height)
    deployment.markers.forEach((marker, index) => {
      const markerX = (marker.x / innerWidth) * width
      const markerY = (marker.y / innerHeight) * height
      const rect = { x: markerX - 35, y: markerY - 21, w: 70, h: 42 }
      ctx.fillStyle = marker.contested ? '#713d39' : '#38584e'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      text(`${marker.id} ${marker.name}`, rect.x + rect.w / 2, rect.y + 15, 8, COLORS.text, 'center', 700)
      text(marker.contested ? '交战' : '安全', rect.x + rect.w / 2, rect.y + 29, 7, marker.contested ? '#ffc0aa' : '#bde0bd', 'center')
      hits.push({ ...rect, action: `spawn:${index}` })
    })

    const groups = deployment.loadoutGroups
    const groupAccents = [COLORS.gold, COLORS.ally, COLORS.axis, COLORS.green]
    const panelW = clamp(width * 0.22, 154, 210)
    const panelX = [12, width - panelW - 12]
    ;[groups.slice(0, 2), groups.slice(2)].forEach((panelGroups, panelIndex) => {
      const panelH = 20 + panelGroups.reduce((sum, group) => sum + 26 + Math.ceil(group.items.length / 2) * 32, 0)
      const x = panelX[panelIndex]
      const y = (height - panelH) / 2
      box(x, y, panelW, panelH, 'rgba(18,24,27,.94)')
      let groupY = y + 12
      panelGroups.forEach(group => {
        const accent = groupAccents[groups.indexOf(group)]
        ctx.fillStyle = accent
        ctx.fillRect(x + 10, groupY, 3, 10)
        text(group.label, x + 19, groupY + 5, 8, accent, 'left', 700)
        groupY += 18
        const gap = 4
        const itemW = (panelW - 24 - gap) / 2
        group.items.forEach((item, index) => {
          const rect = {
            x: x + 10 + index % 2 * (itemW + gap),
            y: groupY + Math.floor(index / 2) * 32,
            w: itemW,
            h: 27,
          }
          const action = `loadout:${group.kind}:${item.id}`
          ctx.fillStyle = item.selected ? COLORS.gold : '#303c40'
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
          if (hoveredAction === action && !item.selected) {
            ctx.fillStyle = 'rgba(255,255,255,.08)'
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
          }
          text(item.name, rect.x + rect.w / 2, rect.y + rect.h / 2, 7,
            item.selected ? COLORS.ink : COLORS.text, 'center', 700)
          hits.push({ ...rect, action })
        })
        groupY += Math.ceil(group.items.length / 2) * 32 + 8
      })
    })
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(7,11,13,.7)'
    ctx.fillRect(0, 0, width, height)
    const panelW = 348
    const panelH = 252
    const x = width / 2 - panelW / 2
    const y = height / 2 - panelH / 2
    box(x, y, panelW, panelH, '#1b2428')
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(x + 24, y + 18, 3, 16)
    text(pauseStopsMatch ? '战斗暂停' : '作战菜单', x + 34, y + 26, 17, COLORS.text, 'left', 700)
    text(pauseStopsMatch ? 'PAUSED / 作战设置' : '联机游戏不会暂停', x + 24, y + 45, 7, pauseStopsMatch ? COLORS.muted : COLORS.axis)
    ctx.fillStyle = COLORS.line
    ctx.fillRect(x + 24, y + 60, panelW - 48, 1)
    text('音频与控制', x + 24, y + 76, 7, COLORS.gold, 'left', 700)
    drawSlider(x + 24, y + 100, 264, '总音量', 'volume', state.settings.masterVolume * 100, 0, 100, true)
    drawSlider(x + 24, y + 140, 264, '鼠标灵敏度', 'sensitivity', state.settings.mouseSensitivity * 100, 20, 200, true)
    button({ x: x + 24, y: y + 166, w: panelW - 48, h: 30 }, '继续战斗', 'resume', true)
    button({ x: x + 24, y: y + 208, w: 145, h: 26 }, '重新部署', 'redeploy', false, COLORS.panel2, 9, COLORS.green)
    button({ x: x + 179, y: y + 208, w: 145, h: 26 }, '退出战场', 'quit', false, '#5c3433', 9, COLORS.axis)
  }

  function drawEnd() {
    ctx.fillStyle = 'rgba(9,13,14,.78)'
    ctx.fillRect(0, 0, width, height)
    const x = width / 2 - 280
    const y = 52
    box(x, y, 560, height - 104, COLORS.panel)
    ctx.fillStyle = endData.won ? COLORS.gold : COLORS.axis
    ctx.fillRect(x, y, 560, 3)
    text(endData.title, width / 2, y + 38, 25, endData.won ? COLORS.gold : COLORS.axis, 'center', 800)
    endData.stats.forEach((line, index) => text(line, x + 40, y + 84 + index * 27, 9, COLORS.text))
    button({ x: width / 2 - 110, y: height - 102, w: 220, h: 34 }, '再战一场', 'restart', true)
  }

  function drawRotate() {
    ctx.save()
    ctx.setTransform(canvas.width / innerWidth, 0, 0, canvas.height / innerHeight, 0, 0)
    ctx.fillStyle = '#cbd2c5'
    ctx.fillRect(0, 0, innerWidth, innerHeight)
    text('需要全屏横屏后继续', innerWidth / 2, innerHeight * 0.42, 16, COLORS.ink, 'center', 700)
    const rect = { x: innerWidth / 2 - 100, y: innerHeight * 0.52, w: 200, h: 42 }
    box(rect.x, rect.y, rect.w, rect.h, COLORS.gold)
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(rect.x, rect.y, rect.w, 2)
    text('点击全屏', innerWidth / 2, rect.y + rect.h / 2, 10, COLORS.ink, 'center', 700)
    ctx.restore()
    hits.push({ ...touchRect(rect.x, rect.y, rect.w, rect.h), action: 'fullscreen' })
  }

  function touchRect(x, y, w, h) {
    return { x: (x / innerWidth) * width, y: (y / innerHeight) * height, w: (w / innerWidth) * width, h: (h / innerHeight) * height }
  }

  function pixelPanel(rect, fill) {
    ctx.fillStyle = fill
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  }

  function drawTouchButton(action, rect, accent, hitAction = `touch:${action}`) {
    const active = touchActive[action]
    const fill = active
      ? COLORS.gold
      : action === 'fire' ? 'rgba(112,43,40,.94)' : 'rgba(18,24,27,.9)'
    ctx.fillStyle = fill
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    const iconColor = active ? COLORS.ink : action === 'fire' ? COLORS.text : accent
    const labelColor = active ? COLORS.ink : COLORS.text
    if (horizontalTouchActions.has(action)) {
      text(TOUCH_ICONS[action], rect.x + rect.w * 0.27, rect.y + rect.h / 2, 13, iconColor, 'center', 700)
      text(touchLabels[action], rect.x + rect.w * 0.65, rect.y + rect.h / 2, 9, labelColor, 'center', 700)
    } else {
      text(TOUCH_ICONS[action], rect.x + rect.w / 2, rect.y + rect.h * 0.4, rect.h >= 58 ? 18 : 14, iconColor, 'center', 700)
      text(touchLabels[action], rect.x + rect.w / 2, rect.y + rect.h * 0.72, 8, labelColor, 'center', 700)
    }
    hits.push({ ...rect, action: hitAction })
  }

  function drawTouch() {
    const stick = touchRect(16, innerHeight - 196, 132, 132)
    pixelPanel(stick, 'rgba(18,24,27,.32)')
    ctx.fillStyle = 'rgba(102,194,206,.18)'
    ctx.fillRect(stick.x + stick.w / 2 - 1, stick.y + 14, 2, stick.h - 28)
    ctx.fillRect(stick.x + 14, stick.y + stick.h / 2 - 1, stick.w - 28, 2)
    const kx = stick.x + stick.w / 2 + (stickOffset.x / innerWidth) * width
    const ky = stick.y + stick.h / 2 + (stickOffset.y / innerHeight) * height
    pixelPanel({ x: kx - 20, y: ky - 20, w: 40, h: 40 }, 'rgba(102,194,206,.84)')
    ctx.fillStyle = COLORS.ink
    ctx.fillRect(kx - 5, ky - 1, 10, 2)
    ctx.fillRect(kx - 1, ky - 5, 2, 10)
    hits.push({ ...stick, action: 'touch:stick' })

    const buttons = [
      ['fire', innerWidth - 108, innerHeight - 152, 88, 88, COLORS.axis],
      ['aim', innerWidth - 202, innerHeight - 132, 68, 68, COLORS.ally],
      ['jump', innerWidth - 96, innerHeight - 230, 64, 58, COLORS.gold],
      ['crouch', innerWidth - 190, innerHeight - 224, 62, 54, COLORS.green],
      ['reload', innerWidth / 2 - 156, innerHeight - 50, 48, 36, COLORS.text],
      ['melee', innerWidth / 2 - 104, innerHeight - 50, 48, 36, COLORS.axis],
      ['grenade', innerWidth / 2 - 52, innerHeight - 50, 48, 36, COLORS.gold],
      ['item', innerWidth / 2, innerHeight - 50, 48, 36, COLORS.ally],
      ['supply', innerWidth / 2 + 52, innerHeight - 50, 48, 36, COLORS.text],
      ['weapon', innerWidth / 2 + 104, innerHeight - 50, 48, 36, COLORS.green],
      ['scoreboard', 14, 14, 64, 32, COLORS.ally],
      ['pause', 84, 14, 64, 32, COLORS.gold],
      ['chat', 154, 14, 64, 32, COLORS.green],
    ]
    for (const [action, x, y, w, h, color] of buttons) {
      const rect = touchRect(x, y, w, h)
      drawTouchButton(action, rect, color, action === 'chat' ? 'chat-open' : `touch:${action}`)
    }
  }

  function drawRecentChat(now) {
    if (chatOpen || !chatChannels.length) return
    const recent = chatMessages.filter(message =>
      chatChannels.includes(message.channel) && now - message.receivedAt < 10_000).slice(-5)
    if (!recent.length) return
    const labels = { world: '世界', room: '房间', squad: '小队' }
    const lineH = 19
    const panelH = recent.length * lineH + 12
    const panelW = Math.min(gameVisible ? 250 : 330, width - 32)
    const x = gameVisible ? 16 : portalMargin()
    const y = gameVisible ? height / 2 - panelH / 2 : height - 37 - panelH
    if (!gameVisible) box(x, y, panelW, panelH, 'rgba(10,15,16,.72)')
    recent.forEach((message, index) => {
      const age = now - message.receivedAt
      ctx.globalAlpha = age > 8000 ? 1 - (age - 8000) / 2000 : 1
      const lineY = y + 12 + index * lineH
      const color = message.channel === 'squad' ? COLORS.green : message.channel === 'room' ? COLORS.ally : COLORS.gold
      text(`[${labels[message.channel]}]`, x + 9, lineY, 7, color, 'left', 700)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 44, lineY - 8, panelW - 53, 16)
      ctx.clip()
      text(`${message.displayName}: ${message.text}`, x + 46, lineY, 8, COLORS.text)
      ctx.restore()
      ctx.globalAlpha = 1
    })
  }

  function drawChat() {
    if (!chatOpen) return
    const panelW = Math.min(360, width - 32)
    const panelH = Math.min(196, height - 32)
    const x = 16
    const y = height - panelH - 16
    box(x, y, panelW, panelH, 'rgba(10,15,16,.94)')
    ctx.strokeStyle = 'rgba(216,180,95,.45)'
    ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1)
    const labels = { world: '世界', room: '房间', squad: '小队' }
    let tabX = x + 12
    for (const channel of chatChannels) {
      const selected = channel === chatChannel
      const tabW = 52
      const action = `chat-channel:${channel}`
      if (selected) {
        box(tabX, y + 10, tabW, 22, '#465450')
      } else if (hoveredAction === action) box(tabX, y + 10, tabW, 22, 'rgba(255,255,255,.08)')
      text(labels[channel], tabX + tabW / 2, y + 21, 8, selected ? COLORS.gold : COLORS.muted, 'center', 700)
      hits.push({ x: tabX, y: y + 10, w: tabW, h: 22, action })
      tabX += tabW + 4
    }
    const closeRect = { x: x + panelW - 34, y: y + 8, w: 22, h: 22 }
    if (hoveredAction === 'chat-close') box(closeRect.x, closeRect.y, closeRect.w, closeRect.h, 'rgba(255,255,255,.08)')
    text('X', closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2, 9, COLORS.muted, 'center', 700)
    hits.push({ ...closeRect, action: 'chat-close' })
    ctx.fillStyle = 'rgba(255,255,255,.1)'
    ctx.fillRect(x + 12, y + 39, panelW - 24, 1)
    const visible = chatMessages.filter(message => chatChannels.includes(message.channel)).slice(-6)
    visible.forEach((message, index) => {
      const lineY = y + 53 + index * 18
      const color = message.channel === 'squad' ? COLORS.green : message.channel === 'room' ? COLORS.ally : COLORS.gold
      text(`[${labels[message.channel]}]`, x + 12, lineY, 7, color, 'left', 700)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 47, lineY - 8, panelW - 59, 16)
      ctx.clip()
      text(`${message.displayName}: ${message.text}`, x + 49, lineY, 8, COLORS.text)
      ctx.restore()
    })
    const inputY = y + panelH - 35
    const inputRect = { x: x + 12, y: inputY, w: panelW - 24, h: 24 }
    box(inputRect.x, inputRect.y, inputRect.w, inputRect.h, '#202928')
    keyboardInput.style.display = 'block'
    positionInput(keyboardInput, inputRect)
  }

  function render(now = performance.now()) {
    if (!fpsLast) fpsLast = now
    fpsFrames++
    const fpsElapsed = now - fpsLast
    if (fpsElapsed >= 500) {
      fps = Math.round((fpsFrames * 1000) / fpsElapsed)
      fpsFrames = 0
      fpsLast = now
      dirty = true
    }
    if (!dirty && now - lastDraw < 33) return
    lastDraw = now
    dirty = false
    hits.length = 0
    visiblePortalInputs.clear()
    ctx.clearRect(0, 0, width, height)
    if (screen === 'boot') {
      drawBoot()
    } else if (screen === 'portal') {
      drawPortal()
    } else if (screen === 'menu') {
      drawMenu()
    } else if (gameVisible) {
      drawHud(now)
      if (deathText) drawDeath()
      if (deployment?.visible) drawDeployment()
      if (paused) drawPause()
      if (endData) drawEnd()
      if (touchVisible && !paused && !deployment?.visible && !endData) drawTouch()
    }
    drawRecentChat(now)
    drawChat()
    keyboardInput.style.display = chatOpen && !rotateVisible ? 'block' : 'none'
    for (const [id, input] of portalInputs) {
      input.style.display = !rotateVisible && visiblePortalInputs.has(id) ? 'block' : 'none'
    }
    if (rotateVisible) drawRotate()
  }

  function logicalPosition(event) {
    return { x: (event.clientX / innerWidth) * width, y: (event.clientY / innerHeight) * height }
  }

  function findHit(event) {
    const point = logicalPosition(event)
    for (let i = hits.length - 1; i >= 0; i--) {
      const hit = hits[i]
      if (rotateVisible && hit.action !== 'fullscreen') continue
      if (chatOpen && hit.action === 'chat-open') continue
      if (inside(point.x, point.y, hit) && (!chatOpen || rotateVisible || hit.action.startsWith('chat-'))) return hit
    }
    return null
  }

  function updateSlider(hit, event) {
    const point = logicalPosition(event)
    const value = hit.min + clamp((point.x - hit.x) / hit.w, 0, 1) * (hit.max - hit.min)
    handlers.onSetting?.(hit.setting, value)
    dirty = true
  }

  function openChat() {
    if (!chatChannels.length) return
    chatOpen = true
    chatValue = ''
    keyboardInput.type = 'text'
    keyboardInput.maxLength = 160
    keyboardInput.value = ''
    keyboardInput.style.display = 'block'
    keyboardInput.focus({ preventScroll: true })
    handlers.onChatToggle?.(true)
    dirty = true
  }

  canvas.addEventListener('pointerdown', event => {
    if (rotateVisible) {
      blockedPointers.add(event.pointerId)
      if (findHit(event)?.action === 'fullscreen') handlers.onFullscreen?.()
      return
    }
    if (chatOpen) {
      event.preventDefault()
      return
    }
    const hit = findHit(event)
    if (hit?.action === 'chat-open') return
    if (hit?.action === 'slider') {
      activeSlider = hit
      canvas.setPointerCapture(event.pointerId)
      updateSlider(hit, event)
      return
    }
    if (hit?.action?.startsWith('touch:')) {
      const action = hit.action.slice(6)
      activeTouch.set(event.pointerId, action)
      canvas.setPointerCapture(event.pointerId)
      touchHandlers.down?.(action, event)
      return
    }
    if (touchVisible && gameVisible && !paused && !deployment?.visible) {
      activeTouch.set(event.pointerId, 'look')
      canvas.setPointerCapture(event.pointerId)
      touchHandlers.down?.('look', event)
    }
  })

  canvas.addEventListener('pointermove', event => {
    if (blockedPointers.has(event.pointerId)) return
    if (activeSlider) updateSlider(activeSlider, event)
    if (activeTouch.has(event.pointerId)) touchHandlers.move?.(event)
    if (!touchMode && !activeSlider && !activeTouch.has(event.pointerId)) {
      const action = findHit(event)?.action || null
      if (action !== hoveredAction) {
        hoveredAction = action
        canvas.style.cursor = action ? 'pointer' : 'default'
        dirty = true
      }
    }
  })
  canvas.addEventListener('pointerleave', () => {
    hoveredAction = null
    canvas.style.cursor = 'default'
    dirty = true
  })

  canvas.addEventListener('pointerup', event => {
    if (blockedPointers.delete(event.pointerId)) return
    if (activeSlider) {
      activeSlider = null
      return
    }
    const touchAction = activeTouch.get(event.pointerId)
    if (touchAction) {
      activeTouch.delete(event.pointerId)
      touchHandlers.up?.(event)
      return
    }
    const hit = findHit(event)
    if (!hit) return
    if (hit.action === 'chat-open') {
      openChat()
    } else if (hit.action === 'chat-close') {
      chatOpen = false
      keyboardInput.blur()
      handlers.onChatToggle?.(false)
    } else if (hit.action.startsWith('chat-channel:')) {
      chatChannel = hit.action.slice(13)
      keyboardInput.focus({ preventScroll: true })
    } else if (hit.action === 'start') {
      handlers.onStart?.()
    } else if (hit.action === 'mode') {
      handlers.onMode?.(hit.value)
    } else if (hit.action === 'resume') {
      handlers.onResume?.()
    } else if (hit.action === 'redeploy') {
      handlers.onRedeploy?.()
    } else if (hit.action === 'quit') {
      handlers.onQuit?.()
    } else if (hit.action === 'restart') {
      handlers.onRestart?.()
    } else if (hit.action.startsWith('spawn:')) {
      handlers.onSpawn?.(Number(hit.action.split(':')[1]))
    } else if (hit.action.startsWith('loadout:')) {
      const [, kind, id] = hit.action.split(':')
      handlers.onLoadout?.(kind, id)
    } else if (hit.action.startsWith('portal:')) handlers.onPortalAction?.(hit.action.slice(7))
    dirty = true
  })
  canvas.addEventListener('pointercancel', event => {
    blockedPointers.delete(event.pointerId)
    activeTouch.delete(event.pointerId)
    activeSlider = null
    touchHandlers.up?.(event)
  })

  window.addEventListener('resize', resize)
  keyboardInput.addEventListener('input', () => {
    if (!chatOpen) return
    chatValue = keyboardInput.value
    dirty = true
  })
  keyboardInput.addEventListener('keydown', event => {
    if (!chatOpen || event.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter') {
      const value = chatValue.trim()
      if (value) handlers.onChatSend?.(chatChannel, value)
      chatValue = ''
      keyboardInput.value = ''
    } else if (event.key === 'Escape') {
      chatOpen = false
      keyboardInput.blur()
      handlers.onChatToggle?.(false)
    } else if (event.key === 'Tab' || event.ctrlKey || event.metaKey || event.altKey || event.key.length > 1) {
      event.preventDefault()
      event.stopPropagation()
      return
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    dirty = true
  })
  window.addEventListener('keydown', event => {
    if (rotateVisible) {
      event.preventDefault()
      return
    }
    if (event.code === 'KeyT' && chatChannels.length && document.activeElement !== keyboardInput) {
      openChat()
      event.preventDefault()
      event.stopPropagation()
      dirty = true
      return
    }
    if (screen !== 'portal') return
    if (event.target instanceof HTMLInputElement) return
    if (event.key === 'Escape') {
      handlers.onPortalBack?.()
      event.preventDefault()
      return
    }
    if (!activePortalField || document.activeElement === keyboardInput) return
    const field = portal?.fields?.find(item => item.id === activePortalField)
    if (!field) return
    if (event.key === 'Enter') {
      handlers.onPortalSubmit?.()
    } else if (event.key === 'Backspace') {
      handlers.onPortalInput?.(field.id, field.value.slice(0, -1))
    } else if (event.key === 'Tab') {
      const fields = portal.fields
      activePortalField = fields[(fields.indexOf(field) + 1) % fields.length]?.id || null
    } else if (event.key.length === 1 && field.value.length < (field.maxLength || 128)) {
      handlers.onPortalInput?.(field.id, field.value + event.key)
    } else {
      return
    }
    event.preventDefault()
    dirty = true
  }, true)
  resize()

  return {
    canvas,
    setCamera(value) { camera = value },
    bindRuntime(callback) { getMode = callback },
    setHandlers(value) { handlers = value },
    setTouchHandlers(value) { touchHandlers = value },
    setBoot(progress, status) {
      state.uiBootProgress = clamp(progress / 100, 0, 1)
      if (status) state.uiBootStatus = status
      dirty = true
    },
    showMenu() {
      screen = 'menu'
      gameVisible = false
      dirty = true
    },
    showPortal(value) {
      if (screen !== 'portal' || value.title !== portal?.title) hoveredAction = null
      portal = value
      screen = 'portal'
      gameVisible = false
      if (!value.fields?.some(field => field.id === activePortalField)) activePortalField = value.focus || null
      dirty = true
    },
    showGame() {
      screen = 'game'
      gameVisible = true
      endData = null
      dirty = true
    },
    setPaused(value, stopsMatch = true) {
      paused = value
      pauseStopsMatch = stopsMatch
      dirty = true
    },
    setRotateVisible(value) {
      rotateVisible = value
      if (value) {
        activeSlider = null
        activeTouch.clear()
        keyboardInput.blur()
      }
      dirty = true
    },
    setDeployment(value) {
      deployment = value
      dirty = true
    },
    setTouchMode(value) {
      touchMode = value
      resize()
    },
    setTouchVisible(value) {
      touchVisible = value
      dirty = true
    },
    setTouchLabel(action, label) {
      touchLabels[action] = label
      dirty = true
    },
    setTouchActive(action, value) {
      touchActive[action] = value
      dirty = true
    },
    setStickOffset(x, y) {
      stickOffset = { x, y }
      dirty = true
    },
    getTouchStickRect() { return { left: 16, top: innerHeight - 196, width: 132, height: 132 } },
    showHitMarker() {
      hitMarkerUntil = performance.now() + 160
      dirty = true
    },
    showDamage() {
      damageUntil = performance.now() + config.hud.damageVignetteDuration
      dirty = true
    },
    showDirectionDamage(source) {
      directionDamage = { source, until: performance.now() + config.hud.directionDamageDuration }
      dirty = true
    },
    showCenter(textValue, duration, big = '') {
      centerMessage = { text: textValue, big, until: performance.now() + duration }
      dirty = true
    },
    showAction(textValue, duration) {
      actionMessage = { text: textValue, until: performance.now() + duration }
      dirty = true
    },
    showKillNotice(title, sub, duration) {
      killNotice = { title, sub, until: performance.now() + duration }
      dirty = true
    },
    addFeed(item, duration) {
      killFeed.push({ ...item, until: performance.now() + duration })
      dirty = true
    },
    showDeath(textValue) {
      deathText = textValue
      dirty = true
    },
    hideDeath() {
      deathText = ''
      dirty = true
    },
    setScoreboardVisible(value) {
      scoreboardVisible = value
      dirty = true
    },
    setChatChannels(channels) {
      chatChannels = channels
      if (!chatChannels.includes(chatChannel)) chatChannel = chatChannels[0] || 'world'
      if (!chatChannels.length && chatOpen) {
        chatOpen = false
        keyboardInput.blur()
        handlers.onChatToggle?.(false)
      }
      dirty = true
    },
    addChatMessage(message) {
      chatMessages.push({ ...message, receivedAt: performance.now() })
      if (chatMessages.length > 50) chatMessages.shift()
      dirty = true
    },
    showEnd(data) {
      endData = data
      paused = false
      deployment = null
      dirty = true
    },
    invalidate() { dirty = true },
    render,
    resize,
    destroy() {
      canvas.remove()
      keyboardInput.remove()
      for (const input of portalInputs.values()) input.remove()
    },
  }
}

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

export function createClient() {
  const state = createGameState()
  const deploy = createDeployState()
  const ui = createCanvasUi({ state, deploy, config: CFG })
  const touchDevice = detectTouchDevice()

  function syncPageOrientation() {
    ui.setRotateVisible(touchDevice && (innerHeight > innerWidth || !document.fullscreenElement))
  }

  async function lockLandscape() {
    const root = document.documentElement
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' })
    }
    if (window.screen.orientation?.lock) await window.screen.orientation.lock('landscape')
  }

  ui.setTouchMode(touchDevice)
  syncPageOrientation()
  window.addEventListener('resize', syncPageOrientation)
  window.addEventListener('orientationchange', syncPageOrientation)
  document.addEventListener('fullscreenchange', syncPageOrientation)

  let user = null
  let room = null
  let rooms = []
  let playerId = null
  let status = ''
  let statusError = false
  let networkConnected = false
  let screen = 'choice'
  let register = false
  let selectedMode = 'classic'
  let selectedTeam = 'allies'
  let visibility = 'public'
  let leaderboardMode = 'classic'
  let profileRows = []
  let activeSession = null
  const fields = { username: '', displayName: '', password: '', roomName: '', invite: '' }
  const session = {
    send(message) { return activeSession?.send(message) ?? false },
    sendInput(input) { return activeSession?.sendInput(input) ?? false },
    canPause() { return activeSession?.canPause?.() ?? false },
    setPaused(paused) { activeSession?.setPaused?.(paused) },
    resultStats(context) { return activeSession?.resultStats?.(context) ?? [] },
  }
  const game = createGame({ session, ui, state, deploy, getPlayerId: () => playerId })
  const networkSession = new NetworkSession({
    status(value) {
      networkConnected = value === 'online'
      syncChatContext()
      setStatus(value === 'online' ? '已连接联机服务器' : value === 'connecting' ? '正在连接...' : '连接已断开')
    },
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

  function syncChatContext() {
    if (!networkConnected || activeSession !== networkSession) return ui.setChatChannels([])
    if (!room) return ui.setChatChannels(['world'])
    ui.setChatChannels(screen === 'game' ? ['room', 'squad'] : ['world', 'room', 'squad'])
  }

  function render() {
    syncChatContext()
    const common = {
      status,
      error: statusError,
      user,
      account: user ? { label: user.displayName, logout: true } : { label: '登录' },
    }
    if (screen === 'choice') {
      const modeRows = MODE_DEFINITIONS.map(mode => {
        const records = state.records[mode.id]
        return {
          label: `${mode.name}　${records.matches} 场　${records.wins} 胜　${records.kills} 击杀`,
          action: `select-mode:${mode.id}`,
          actionLabel: mode.id === selectedMode ? '已选择' : '选择',
          selected: mode.id === selectedMode,
        }
      })
      const roomRows = user ? rooms.map(item => ({
        label: `${item.name}　${item.modeId === 'classic' ? '经典' : '丧尸'}　${item.players}/${item.capacity}`,
        action: `join:${item.id}`,
        actionLabel: '加入',
      })) : []
      ui.showPortal({
        ...common,
        screenType: 'choice',
        selectedMode,
        selectedTeam,
        user,
        rooms,
        records: state.records,
        title: '作战部署',
        rows: modeRows.concat(user ? [
          { label: '联机房间', muted: true, section: true },
          ...(roomRows.length ? roomRows : [{ label: '暂无公开房间', muted: true }]),
        ] : []),
        actions: [
          ...(selectedMode === 'classic' ? [
            {
              id: 'team', label: `单人：${selectedTeam === 'allies' ? '盟军' : '轴心'}`, paired: true,
              accent: selectedTeam === 'allies' ? COLORS.ally : COLORS.axis,
            },
            { id: 'offline-start', label: '单人作战', primary: true, paired: true },
          ] : [{ id: 'offline-start', label: '单人作战', primary: true }]),
          { id: `quick:${selectedMode}`, label: '快速匹配' },
          ...(user ? [{ id: 'create', label: '创建房间' }, { id: 'invite', label: '邀请码' },
            { id: 'stats', label: '战绩排行' }] : []),
        ],
      })
    } else if (screen === 'auth') {
      ui.showPortal({
        ...common,
        screenType: 'auth',
        register,
        title: register ? '创建账号' : '账号登录',
        focus: 'username',
        fields: [field('username', '用户名', '3-20 位字母、数字或下划线', false, 20),
          ...(register ? [field('displayName', '战场昵称', '最多 16 个字符', false, 16)] : []),
          field('password', '密码', register ? '至少 10 位' : '账号密码', true)],
        actions: [{ id: 'auth-submit', label: register ? '注册并登录' : '登录', primary: true },
          { id: 'auth-toggle', label: register ? '已有账号' : '创建账号' }, { id: 'choice', label: '返回' }],
      })
    } else if (screen === 'create') {
      ui.showPortal({
        ...common,
        screenType: 'create',
        selectedMode,
        visibility,
        user,
        title: '创建房间',
        fields: [field('roomName', '房间名称', `${user?.displayName || '玩家'}的房间`, false, 20)],
        actions: [{ id: 'mode', label: selectedMode === 'classic' ? '模式：经典' : '模式：丧尸' },
          { id: 'visibility', label: visibility === 'public' ? '公开房' : '私密房' },
          { id: 'create-submit', label: '创建', primary: true }, { id: 'lobby', label: '返回大厅' }],
      })
    } else if (screen === 'invite') {
      ui.showPortal({
        ...common,
        screenType: 'invite',
        title: '邀请码加入',
        fields: [field('invite', '6 位邀请码', '例如 A3H7KP', false, 6)],
        actions: [{ id: 'invite-submit', label: '加入房间', primary: true }, { id: 'lobby', label: '返回大厅' }],
      })
    } else if (screen === 'room') {
      showRoomCanvas(common)
    } else if (screen === 'stats') {
      ui.showPortal({
        ...common,
        screenType: 'stats',
        leaderboardMode,
        profileRows,
        title: `战绩排行　${leaderboardMode === 'classic' ? '经典' : '丧尸'}`,
        rows: profileRows,
        actions: [{ id: 'leaderboard-mode', label: leaderboardMode === 'classic' ? '丧尸' : '经典' },
          { id: 'lobby', label: '返回' }],
      })
    }
  }

  function showRoomCanvas(common = { status, error: statusError }) {
    screen = 'room'
    syncChatContext()
    const ownMember = room.members.find(member => member.userId === user.id)
    ui.showPortal({
      ...common,
      screenType: 'room',
      room,
      user,
      title: room.name,
      profile: `${user.displayName}　${room.modeId === 'classic' ? '经典' : '丧尸'}　${room.status}${room.invite ? `　${room.invite}` : ''}`,
      rows: [...room.members]
        .sort((a, b) => (a.team === 'allies' ? 0 : 1) - (b.team === 'allies' ? 0 : 1))
        .map(member => ({
          label: `[${member.team === 'allies' ? '盟军' : '轴心'}]  ${member.displayName}${member.connected ? '' : ' · 掉线'}`,
          accent: member.team === 'allies' ? COLORS.ally : COLORS.axis,
          action: room.hostId === user.id && member.userId !== user.id && room.status === 'waiting' ? `kick:${member.userId}` : null,
          actionLabel: '移除',
        })),
      actions: [
        ...(room.modeId === 'classic' && !['active', 'results'].includes(room.status) ? [{
          id: 'change-team',
          label: `当前：${ownMember?.team === 'allies' ? '盟军' : '轴心'} · 切换${ownMember?.team === 'allies' ? '轴心' : '盟军'}`,
          accent: ownMember?.team === 'allies' ? COLORS.ally : COLORS.axis,
        }] : []),
        ...(room.hostId === user.id && room.status === 'waiting' ? [{ id: 'start-match', label: '开始对局', primary: true }] : []),
        { id: 'leave-room', label: '退出房间', danger: true },
      ],
    })
  }

  async function checkSession() {
    try {
      user = (await api('/api/auth/session')).user
      if (user) {
        activeSession = networkSession
        networkSession.connect()
      }
      screen = 'choice'
      render()
    } catch (error) { setStatus(error.message, true) }
  }

  function enterLobby() {
    activeSession = networkSession
    screen = 'choice'
    room = null
    networkSession.connect()
    render()
  }

  async function startLocal(modeId) {
    activeSession = new LocalSession({ message: handleMessage }, state.records)
    activeSession.start(modeId, modeId === 'classic' ? selectedTeam : 'allies')
    await game.preparePresentation()
  }

  async function submitAuth() {
    try {
      const result = await api(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST', body: {
          username: fields.username, displayName: fields.displayName, password: fields.password,
        },
      })
      user = result.user
      fields.password = ''
      enterLobby()
    } catch (error) { setStatus(error.message, true) }
  }

  async function showStats() {
    try {
      const [profile, leaderboard] = await Promise.all([
        api('/api/multiplayer/profile'),
        api(`/api/multiplayer/leaderboard?mode=${leaderboardMode}`),
      ])
      const waveLabel = row => leaderboardMode === 'zombie' ? `　最高波次 ${row.highest_wave ?? 0}` : ''
      const statLabel = row => `${row.matches ?? 0} 场　${row.wins ?? 0} 胜　${row.losses ?? 0} 负　${row.kills ?? 0} 击杀　${row.deaths ?? 0} 阵亡${waveLabel(row)}`
      const ownRows = profile.stats
        .filter(row => row.mode === leaderboardMode)
        .sort((a, b) => Number(b.scope === 'ranked') - Number(a.scope === 'ranked'))
        .map(row => ({ label: `我的　${row.scope === 'ranked' ? '排位' : '全部'}　${statLabel(row)}` }))
      const rankRows = leaderboard.entries.map((row, index) => ({
        rank: index + 1,
        label: `${row.display_name ?? row.displayName ?? '-'}　${statLabel(row)}`,
      }))
      profileRows = ownRows.concat(rankRows)
      if (!profileRows.length) profileRows = [{ label: '暂无数据' }]
      screen = 'stats'
      render()
    } catch (error) { setStatus(error.message, true) }
  }

  async function action(id) {
    if (id.startsWith('select-mode:')) {
      selectedMode = id.slice(12)
      render()
    } else if (id === 'offline-start') {
      await startLocal(selectedMode)
    } else if (id === 'login') {
      screen = 'auth'
      render()
    } else if (id === 'choice') {
      screen = 'choice'
      render()
    } else if (id === 'auth-toggle') {
      register = !register
      render()
    } else if (id === 'auth-submit') {
      await submitAuth()
    } else if (id === 'lobby') {
      enterLobby()
    } else if (id.startsWith('quick:')) {
      if (!user) {
        screen = 'auth'
        render()
      } else {
        networkSession.send({ type: 'quick_match', modeId: id.slice(6) })
      }
    } else if (id.startsWith('join:')) {
      networkSession.send({ type: 'join_room', roomId: id.slice(5) })
    } else if (id.startsWith('kick:')) {
      networkSession.send({ type: 'kick_member', userId: id.slice(5) })
    } else if (id === 'create') {
      screen = 'create'
      render()
    } else if (id === 'mode') {
      selectedMode = selectedMode === 'classic' ? 'zombie' : 'classic'
      render()
    } else if (id === 'team') {
      selectedTeam = selectedTeam === 'allies' ? 'axis' : 'allies'
      render()
    } else if (id === 'visibility') {
      visibility = visibility === 'public' ? 'private' : 'public'
      render()
    } else if (id === 'create-submit') {
      networkSession.send({
        type: 'create_room',
        modeId: selectedMode,
        visibility,
        name: fields.roomName.trim() || `${user.displayName}的房间`,
      })
    } else if (id === 'invite') {
      screen = 'invite'
      render()
    } else if (id === 'invite-submit') {
      networkSession.send({ type: 'join_room', invite: fields.invite.trim().toUpperCase() })
    } else if (id === 'change-team') {
      const ownTeam = room.members.find(member => member.userId === user.id)?.team
      networkSession.send({ type: 'change_team', team: ownTeam === 'allies' ? 'axis' : 'allies' })
    } else if (id === 'start-match') {
      networkSession.send({ type: 'start_match' })
    } else if (id === 'leave-room') {
      networkSession.send({ type: 'leave_room' })
    } else if (id === 'stats') {
      leaderboardMode = selectedMode
      await showStats()
    } else if (id === 'leaderboard-mode') {
      leaderboardMode = leaderboardMode === 'classic' ? 'zombie' : 'classic'
      await showStats()
    } else if (id === 'logout') {
      networkSession.close()
      activeSession = null
      await api('/api/auth/logout', { method: 'POST' })
      user = null
      rooms = []
      screen = 'choice'
      render()
    }
  }

  function handleMessage(message) {
    if (message.type === 'hello' || message.type === 'lobby_snapshot') {
      rooms = message.rooms ?? rooms
      user = message.user || user
      if (screen === 'choice') render()
    } else if (message.type === 'joined') {
      room = message.room
      playerId = message.playerId
      showRoomCanvas()
    } else if (message.type === 'room_state') {
      room = message.room
      if (!game.active) showRoomCanvas()
    } else if (message.type === 'left') {
      enterLobby()
    } else if (message.type === 'match_start') {
      screen = 'game'
      syncChatContext()
      playerId = message.playerId || playerId
      game.boot(message.map, message.snapshot)
    } else if (message.type === 'snapshot') {
      game.snapshot(message.snapshot)
    } else if (message.type === 'events') {
      game.events(message.events)
    } else if (message.type === 'match_end') {
      game.end(message.snapshot)
    } else if (message.type === 'chat') {
      ui.addChatMessage(message)
    } else if (message.type === 'kicked') {
      room = null
      screen = 'choice'
      setStatus('你已被房主移出')
    } else if (message.type === 'error') setStatus(message.message, true)
  }

  ui.setHandlers({
    onFullscreen() { lockLandscape().catch(console.error) },
    onPortalAction: action,
    onPortalBack() {
      if (screen === 'choice') return
      if (screen === 'room') {
        action('leave-room')
      } else if (['create', 'invite', 'stats'].includes(screen)) {
        action('lobby')
      } else {
        action('choice')
      }
    },
    onPortalSubmit: () => screen === 'auth' ? submitAuth() : null,
    onChatToggle(value) { game.setChatOpen(value) },
    onChatSend(channel, text) {
      networkSession.send({ type: 'chat', channel, text })
    },
    onPortalInput(id, value) {
      fields[id] = value
      render()
    },
    onResume: () => game.togglePause(), onQuit: () => game.leave(),
    onRedeploy: () => game.redeploy(), onSetting: (setting, value) => game.applySetting(setting, value),
    onRestart: () => game.leave(), onSpawn: index => game.deploy(index),
    onLoadout: (kind, id) => game.selectLoadout(kind, id),
  })

  return {
    start() {
      checkSession()
      game.animate()
    },
  }
}
