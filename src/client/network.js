import { pack, unpack } from 'msgpackr'
import { MULTIPLAYER_PROTOCOL } from '../../shared/multiplayer/protocol.js'

export class NetworkSession {
  constructor(handlers) {
    this.handlers = handlers
    this.socket = null
    this.reconnectTimer = 0
    this.wantConnection = false
    this.latency = 0
  }

  connect() {
    this.wantConnection = true
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return
    this.handlers.status?.('connecting')
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/multiplayer?protocol=${MULTIPLAYER_PROTOCOL}`)
    socket.binaryType = 'arraybuffer'
    this.socket = socket
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return
      this.handlers.status?.('online')
      this.ping()
      this.pingTimer = setInterval(() => this.ping(), 2000)
    })
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return
      const message = unpack(new Uint8Array(event.data))
      if (message.type === 'pong') {
        this.latency = Math.max(0, performance.now() - Number(message.at))
        this.handlers.latency?.(this.latency)
      }
      this.handlers.message?.(message)
    })
    socket.addEventListener('close', event => {
      if (this.socket !== socket) return
      clearInterval(this.pingTimer)
      this.socket = null
      this.handlers.status?.(event.code === 4002 ? 'taken_over' : 'offline')
      this.handlers.disconnected?.(event)
      if (this.wantConnection && event.code !== 4002 && event.code !== 4001) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = setTimeout(() => this.connect(), 1400)
      }
    })
  }

  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(pack(message))
    return true
  }

  sendInput(input) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    const payload = [
      input.seq, input.moveX, input.moveZ, input.yaw, input.pitch, input.slot,
      input.crouch, input.sprint, input.aim, input.fire, input.actions,
    ]
    this.socket.send(pack(payload))
    return true
  }

  resultStats() {
    return [`网络延迟: ${Math.round(this.latency)} ms`]
  }

  ping() {
    this.send({ type: 'ping', at: performance.now() })
  }

  close() {
    this.wantConnection = false
    clearTimeout(this.reconnectTimer)
    clearInterval(this.pingTimer)
    this.socket?.close(1000, '客户端退出')
  }
}
