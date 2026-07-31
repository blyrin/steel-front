import { CFG as SIMULATION_CONFIG } from '#simulation'

export const CFG = {
  ...SIMULATION_CONFIG,
  // 菜单和暂停界面中的玩家设置默认值。
  settings: {
    // 主音量，范围通常为 0 到 1。
    masterVolume: 0.65,
    // 鼠标和触摸视角灵敏度倍率。
    mouseSensitivity: 1,
  },
  // 鼠标、触摸摇杆和陀螺仪输入参数。
  input: {
    // 触摸滑动位移转换为视角输入的倍率。
    touchLookScale: 10,
    // 陀螺仪姿态变化转换为视角输入的倍率。
    gyroLookScale: 800,
    // 陀螺仪输入死区。
    gyroDeadzone: 0.0015,
    // 陀螺仪输入平滑倍率。
    gyroSmoothing: 0.3,
    // 单次陀螺仪姿态变化的最大步长。
    gyroMaxStep: 0.08,
    // 触摸摇杆默认半径。
    touchStickRadius: 56,
    // 触摸摇杆半径下限。
    touchStickMinRadius: 40,
    // 触摸摇杆移动死区。
    touchStickDeadzone: 0.12,
    // 摇杆达到该输入强度后触发冲刺。
    touchSprintThreshold: 0.82,
    // 输入归零判定的最小阈值。
    inputEpsilon: 0.001,
  },
  // 部署界面、出生点争夺判定和镜头过渡参数。
  deployment: {
    // 出生点周围用于判断交战的半径。
    contestedRadius: 20,
    // 出生点附近达到该敌人数后标记为交战。
    contestedEnemyCount: 2,
    // 战术俯视镜头的地图边缘留白倍率。
    cameraMargin: 1.05,
    // 经典模式战术俯视镜头的高度缩放。
    cameraHeightScale: 0.9,
    // 丧尸模式战术俯视镜头的高度缩放。
    zombieCameraHeightScale: 0.4,
    // 进入部署界面的镜头动画时长。
    toScreenDuration: 1.15,
    // 进入部署界面时中间镜头的水平位置比例。
    toScreenMidPositionRatio: 0.35,
    // 进入部署界面时中间镜头的最低高度增量。
    toScreenMidHeightOffset: 18,
    // 进入部署界面时中间镜头相对俯视高度比例。
    toScreenMidHeightRatio: 0.45,
    // 进入部署界面时俯仰角回正的时间点。
    toScreenPitchResetStart: 0.95,
    // 进入部署界面时横滚角回正的时间点。
    toScreenRollResetStart: 0.85,
    // 从出生点选择到落地的镜头动画时长。
    deployDuration: 1.45,
    // 出生动画中间镜头的高度比例。
    deployMidHeightRatio: 0.55,
    // 出生动画中间镜头的最大高度。
    deployMidHeightMax: 72,
    // 出生动画俯仰角回正的起始时间点。
    deployPitchResetStart: 0.5,
    // 出生动画俯仰角回正的结束时间点。
    deployPitchResetEnd: 0.95,
    // 出生动画水平角回正的起始时间点。
    deployYawResetStart: 0.68,
    // 出生动画水平角回正的结束时间点。
    deployYawResetEnd: 0.98,
    // 出生动画触发落地音效和震动的时间点。
    landingImpactStart: 0.88,
  },
  // 枪口火光、弹壳、火花、烟雾和血液特效参数。
  effects: {
    // 子弹曳光线的显示时长。
    tracerLife: 0.05,
    // 子弹曳光线的初始透明度。
    tracerOpacity: 0.65,
    // 第一人称枪口火光的显示时长。
    firstPersonMuzzleLife: 0.05,
    // Bot 枪口火光的显示时长。
    botMuzzleLife: 0.06,
    // 第一人称枪口烟雾数量。
    firstPersonSmokeCount: 1,
    // Bot 枪口烟雾数量。
    botSmokeCount: 1,
    // 枪口烟雾的透明度和基础生命周期。
    muzzleSmokeOpacity: 0.08,
    smokeLife: 0.22,
    // 手雷烟雾团的数量和最大透明度。
    smokeCloudPuffCount: 24,
    smokeCloudOpacity: 0.28,
    // 每个后续烟雾粒子的生命周期增量。
    smokeLifeStep: 0.09,
    // 玩家枪口烟团的生命周期。
    smokePuffLife: 0.34,
    // 弹壳粒子的生命周期。
    shellLife: 1.4,
    // 弹壳下落加速度。
    shellGravity: 9.8,
    // 弹壳落地后的垂直反弹倍率。
    shellBounce: -0.28,
    // 弹壳落地后的水平速度保留倍率。
    shellHorizontalDamping: 0.65,
    // 弹壳落地后的旋转速度保留倍率。
    shellRotationDamping: 0.6,
    // 弹壳落地时播放声音的概率。
    shellDropChance: 0.4,
    // 命中障碍物时生成的火花数量。
    sparkCount: 4,
    // 火花粒子的生命周期。
    sparkLife: 0.7,
    // 火花下落加速度。
    sparkGravity: 6,
    // 命中障碍物时尘土粒子的生命周期。
    dustLife: 0.5,
    // 命中角色时生成的血液粒子数量。
    bloodCount: 6,
    // 血液粒子的生命周期。
    bloodLife: 1,
    // 血液粒子的下落加速度。
    bloodGravity: 9,
  },
  // Web Audio 同时播放的声音数量限制。
  audio: {
    // 软上限：普通音效（priority 0）达到后直接丢弃。
    maxVoices: 48,
    // 硬上限溢出：priority >= 1 可占用；满载后由高优先级抢占低优先级声道。
    overflowVoices: 12,
  },
  // 相机、雾效与低分辨率像素渲染参数。
  render: {
    // 相机近裁剪面距离。
    cameraNear: 0.04,
    // 相机远裁剪面距离。
    cameraFar: 1200,
    // 指数平方雾密度，远处渐进消隐而不产生硬交界线。
    fogDensity: 0.0032,
    // 桌面端内部渲染高度，画布由浏览器最近邻放大到视口。
    desktopRenderHeight: 500,
    // 触摸端内部渲染高度。
    touchRenderHeight: 400,
    // 纹理各向异性过滤等级上限。
    maxAnisotropy: 2,
  },
}
