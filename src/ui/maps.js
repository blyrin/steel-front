export function createMapSystem({ dom, state, config }) {
  const width = 180
  const height = 180
  const scale = width / config.match.mapSize
  const centerX = width / 2
  const centerY = height / 2
  const miniCtx = dom.miniCanvas.getContext('2d')
  const staticCanvas = document.createElement('canvas')
  const staticCtx = staticCanvas.getContext('2d')
  let staticLayerReady = false
  staticCanvas.width = width
  staticCanvas.height = height

  function drawStaticLayer() {
    const gradient = staticCtx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 90)
    gradient.addColorStop(0, 'rgba(224,245,234,0.94)')
    gradient.addColorStop(1, 'rgba(91,158,172,0.96)')
    staticCtx.fillStyle = gradient
    staticCtx.fillRect(0, 0, width, height)
    staticCtx.strokeStyle = 'rgba(32,35,58,0.28)'
    staticCtx.lineWidth = 1
    staticCtx.beginPath()
    staticCtx.moveTo(centerX, 8)
    staticCtx.lineTo(centerX, height - 8)
    staticCtx.moveTo(8, centerY)
    staticCtx.lineTo(width - 8, centerY)
    staticCtx.stroke()
    for (const obstacle of state.obstacles) {
      if (obstacle.x === undefined) continue
      if (
        obstacle.type !== 'building' &&
        obstacle.type !== 'tank' &&
        obstacle.type !== 'sandbag'
      )
        continue
      staticCtx.fillStyle =
        obstacle.type === 'building' ? 'rgba(32,35,58,0.72)' : 'rgba(239,91,103,0.72)'
      staticCtx.fillRect(centerX + obstacle.x * scale - 2, centerY + obstacle.z * scale - 2, 4, 4)
    }
    staticCtx.fillStyle = '#ffd447'
    staticCtx.strokeStyle = '#20233a'
    staticCtx.lineWidth = 1
    for (const station of state.ammoStations) {
      const x = centerX + station.position.x * scale
      const y = centerY + station.position.z * scale
      staticCtx.fillRect(x - 3, y - 3, 6, 6)
      staticCtx.strokeRect(x - 3, y - 3, 6, 6)
    }
    staticLayerReady = true
  }

  function updateMinimap() {
    if (!staticLayerReady) drawStaticLayer()
    miniCtx.clearRect(0, 0, width, height)
    miniCtx.drawImage(staticCanvas, 0, 0)
    for (const bot of state.bots) {
      if (!bot.alive) continue
      const x = centerX + bot.position.x * scale
      const y = centerY + bot.position.z * scale
      if (bot.team === 'allies') {
        miniCtx.fillStyle = '#00c7e6'
        miniCtx.fillRect(x - 2.6, y - 2.6, 5.2, 5.2)
        miniCtx.strokeStyle = 'rgba(0,0,0,0.55)'
        miniCtx.lineWidth = 1
        miniCtx.strokeRect(x - 2.6, y - 2.6, 5.2, 5.2)
      } else {
        miniCtx.fillStyle = '#ff3f5f'
        miniCtx.beginPath()
        miniCtx.moveTo(x, y - 3.4)
        miniCtx.lineTo(x + 3.2, y + 2.4)
        miniCtx.lineTo(x - 3.2, y + 2.4)
        miniCtx.closePath()
        miniCtx.fill()
        miniCtx.strokeStyle = 'rgba(0,0,0,0.55)'
        miniCtx.lineWidth = 1
        miniCtx.stroke()
      }
    }
    if (!state.player.alive) return
    const x = centerX + state.player.position.x * scale
    const y = centerY + state.player.position.z * scale
    const forwardX = -Math.sin(state.player.yaw)
    const forwardZ = -Math.cos(state.player.yaw)
    miniCtx.fillStyle = 'rgba(255,212,71,0.24)'
    miniCtx.beginPath()
    miniCtx.moveTo(x, y)
    const angle = Math.atan2(forwardZ, forwardX)
    miniCtx.arc(x, y, 22, angle - 0.45, angle + 0.45)
    miniCtx.closePath()
    miniCtx.fill()
    miniCtx.strokeStyle = 'rgba(32,35,58,0.9)'
    miniCtx.lineWidth = 2
    miniCtx.beginPath()
    miniCtx.moveTo(x, y)
    miniCtx.lineTo(x + forwardX * 11, y + forwardZ * 11)
    miniCtx.stroke()
    miniCtx.fillStyle = '#ffd447'
    miniCtx.beginPath()
    miniCtx.arc(x, y, 4, 0, Math.PI * 2)
    miniCtx.fill()
    miniCtx.strokeStyle = 'rgba(0,0,0,0.7)'
    miniCtx.lineWidth = 1.5
    miniCtx.stroke()
  }

  return { updateMinimap }
}
