const MULTI_TITLES = ['', '', '双杀', '三杀', '四杀', '五杀', '势不可挡', '无人能挡']

export function getKillNotice(streak, headshot) {
  let kind = headshot ? 'head' : 'normal'
  let title = headshot ? '爆头' : '击倒敌人'
  if (streak >= 2) {
    title = MULTI_TITLES[Math.min(streak, MULTI_TITLES.length - 1)] || `${streak} 连杀`
    kind = 'multi'
    if (headshot) title = `爆头 · ${title}`
  }
  return { kind, title }
}
