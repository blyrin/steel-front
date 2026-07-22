import { createClassicMode } from './classic-mode.js'
import { createZombieMode } from './zombie-mode.js'

export const MODE_DEFINITIONS = [
  {
    id: 'classic',
    name: '经典对战',
    description: '盟军与轴心部队争夺击杀目标',
    create: createClassicMode,
  },
  {
    id: 'zombie',
    name: '丧尸模式',
    description: '守卫堡垒，迎击不断涌来的丧尸波次',
    create: createZombieMode,
  },
]

export function createMode(id, services) {
  const definition = MODE_DEFINITIONS.find(entry => entry.id === id)
  return definition.create(services)
}
