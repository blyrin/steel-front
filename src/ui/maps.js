export function createMapSystem({ dom, state, config }) {
  const miniCtx = dom.miniCanvas.getContext('2d')

  function updateMinimap() {
    const width = 180
    const height = 180
    const scale = width / config.mapSize
    const centerX = width / 2
    const centerY = height / 2
    miniCtx.clearRect(0, 0, width, height)
    const gradient = miniCtx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 90)
    gradient.addColorStop(0, 'rgba(48,38,24,0.75)')
    gradient.addColorStop(1, 'rgba(14,11,8,0.95)')
    miniCtx.fillStyle = gradient
    miniCtx.fillRect(0, 0, width, height)
    miniCtx.strokeStyle = 'rgba(120,100,60,0.22)'
    miniCtx.lineWidth = 1
    miniCtx.beginPath()
    miniCtx.moveTo(centerX, 8)
    miniCtx.lineTo(centerX, height - 8)
    miniCtx.moveTo(8, centerY)
    miniCtx.lineTo(width - 8, centerY)
    miniCtx.stroke()
    for (const obstacle of state.obstacles) {
      if (obstacle.x === undefined) continue
      if (!['building', 'tank', 'sandbag'].includes(obstacle.type)) continue
      miniCtx.fillStyle =
        obstacle.type === 'building' ? 'rgba(130,110,75,0.65)' : 'rgba(100,85,55,0.55)'
      miniCtx.fillRect(centerX + obstacle.x * scale - 2, centerY + obstacle.z * scale - 2, 4, 4)
    }
    for (const bot of state.bots) {
      if (!bot.alive) continue
      const x = centerX + bot.position.x * scale
      const y = centerY + bot.position.z * scale
      if (bot.team === 'allies') {
        miniCtx.fillStyle = '#5ad040'
        miniCtx.fillRect(x - 2.6, y - 2.6, 5.2, 5.2)
        miniCtx.strokeStyle = 'rgba(0,0,0,0.55)'
        miniCtx.lineWidth = 1
        miniCtx.strokeRect(x - 2.6, y - 2.6, 5.2, 5.2)
      } else {
        miniCtx.fillStyle = '#ff5a3a'
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
    miniCtx.fillStyle = 'rgba(255,204,64,0.12)'
    miniCtx.beginPath()
    miniCtx.moveTo(x, y)
    const angle = Math.atan2(forwardZ, forwardX)
    miniCtx.arc(x, y, 22, angle - 0.45, angle + 0.45)
    miniCtx.closePath()
    miniCtx.fill()
    miniCtx.strokeStyle = 'rgba(255,220,100,0.9)'
    miniCtx.lineWidth = 2
    miniCtx.beginPath()
    miniCtx.moveTo(x, y)
    miniCtx.lineTo(x + forwardX * 11, y + forwardZ * 11)
    miniCtx.stroke()
    miniCtx.fillStyle = '#ffcc40'
    miniCtx.beginPath()
    miniCtx.arc(x, y, 4, 0, Math.PI * 2)
    miniCtx.fill()
    miniCtx.strokeStyle = 'rgba(0,0,0,0.7)'
    miniCtx.lineWidth = 1.5
    miniCtx.stroke()
  }

  return { updateMinimap }
}
