export const CFG = {
  // 对局与地图参数，距离单位为米，时间单位为秒。
  match: {
    // 地图边长。
    mapSize: 240,
    // 任一队伍达到该击杀数后结束比赛。
    killTarget: 150,
    // 每支队伍的人数，包含玩家所在队伍的玩家。
    teamSize: 20,
    // Bot 阵亡后的复活等待时间。
    respawnTime: 5,
    // Bot 出生点周围的随机散布范围。
    spawnScatter: 4,
    // 单帧最大模拟时间，避免切后台后瞬移。
    maxFrameDelta: 0.05,
    // 启动加载阶段的相机高度。
    initialCameraHeight: 5,
  },
  // 菜单和暂停界面中的玩家设置默认值。
  settings: {
    // 主音量，范围通常为 0 到 1。
    masterVolume: 0.65,
    // 鼠标和触摸视角灵敏度倍率。
    mouseSensitivity: 1,
  },
  // 武器和射击手感参数。
  weapon: {
    // 弹匣、备弹、换弹和攻击间隔。
    // 每个弹匣的弹药数量。
    magazineSize: 8,
    // 玩家初始备用弹药数量。
    reserveAmmo: 96,
    // 非空弹匣的换弹时长。
    reloadDuration: 1.75,
    // 打空弹匣后的换弹时长。
    emptyReloadDuration: 1.55,
    // 两次射击之间的最短间隔。
    fireDelay: 0.15,
    // 打空弹匣后自动开始换弹的延迟。
    emptyReloadDelay: 0.42,
    // 刺刀攻击动画时长。
    meleeAnimationDuration: 0.58,
    // 枪机往复动画时长。
    boltAnimationDuration: 0.36,
    // 两次近战攻击之间的最短间隔。
    meleeDelay: 0.72,
    // 近战判定距离。
    meleeRange: 2.55,
    // 近战命中伤害。
    meleeDamage: 100,
    // 散布值是方向向量偏移量，越大越不准。
    // 玩家静止时的基础射击散布。
    baseSpread: 0.005,
    // Bot 静止时的基础射击散布。
    botBaseSpread: 0.018,
    // 射击散布的最大值。
    maxSpread: 0.08,
    // 连续射击额外散布的上限。
    spreadBloomMax: 0.02,
    // 连续射击散布每秒恢复量。
    spreadBloomRecovery: 0.04,
    // 玩家每次非瞄准射击增加的散布。
    spreadBloomPerShot: 0.005,
    // 玩家瞄准射击每次增加的散布。
    aimedSpreadBloomPerShot: 0.004,
    // 瞄准时的散布倍率。
    aimingSpreadMultiplier: 0.28,
    // 蹲伏时的散布倍率。
    crouchingSpreadMultiplier: 0.65,
    // 冲刺时的散布倍率。
    sprintingSpreadMultiplier: 2.6,
    // 普通移动时的散布倍率。
    movingSpreadMultiplier: 1.6,
    // 离地时的散布倍率。
    airborneSpreadMultiplier: 1.8,
    // 换弹状态下的散布倍率。
    reloadingSpreadMultiplier: 1.35,
    // Bot 技能不足时额外增加的散布系数。
    botSkillSpread: 0.01,
    // Bot 被视为快速移动的速度阈值。
    botMovingFastThreshold: 4,
    // Bot 被视为普通移动的速度阈值。
    botMovingSlowThreshold: 0.4,
    // Bot 快速移动时的散布倍率。
    botMovingFastMultiplier: 2.6,
    // Bot 普通移动时的散布倍率。
    botMovingSlowMultiplier: 1.55,
    // 玩家开始计算移动散布的速度阈值。
    playerMovingThreshold: 0.4,
    // 玩家射击时的后坐力和屏幕震动。
    // 玩家腰射的垂直后坐力。
    hipRecoilPitch: 0.02,
    // 玩家瞄准时的垂直后坐力。
    aimingRecoilPitch: 0.01,
    // 每次射击附加的随机垂直后坐力。
    recoilPitchRandom: 0.005,
    // 玩家腰射的水平后坐力。
    hipRecoilYaw: 0.01,
    // 玩家瞄准时的水平后坐力。
    aimingRecoilYaw: 0.004,
    // 玩家腰射的横滚后坐力。
    hipRecoilRoll: 0.015,
    // 玩家瞄准时的横滚后坐力。
    aimingRecoilRoll: 0.008,
    // 开镜时枪模额外机械后坐相对实际视角后坐的倍率。
    aimingViewModelRecoilMultiplier: 0.22,
    // 玩家腰射时的屏幕震动强度。
    hipFireShake: 0.15,
    // 玩家瞄准射击时的屏幕震动强度。
    aimingFireShake: 0.08,
  },
  // 可在部署界面选择的主武器。高射速武器以远距衰减和散布换取近战压制力。
  weapons: {
    garand: {
      modelId: 'garand',
      name: 'M1 加兰德',
      fireMode: '半自动',
      automatic: false,
      magazineSize: 8,
      reserveAmmo: 80,
      fireDelay: 0.18,
      reloadDuration: 1.75,
      emptyReloadDuration: 1.55,
      bodyDamage: 35,
      headDamage: 100,
      effectiveRange: 72,
      minDamageMultiplier: 0.78,
      baseSpread: 0.005,
      botBaseSpread: 0.018,
      spreadBloomPerShot: 0.005,
      aimedSpreadBloomPerShot: 0.004,
      recoilMultiplier: 1,
      aiCadenceMultiplier: 1,
      modelScale: [1, 1, 1],
      bayonet: true,
    },
    carbine: {
      modelId: 'carbine',
      name: 'M1 卡宾枪',
      fireMode: '半自动',
      automatic: false,
      magazineSize: 15,
      reserveAmmo: 105,
      fireDelay: 0.14,
      reloadDuration: 1.65,
      emptyReloadDuration: 1.8,
      bodyDamage: 27,
      headDamage: 78,
      effectiveRange: 55,
      minDamageMultiplier: 0.7,
      baseSpread: 0.007,
      botBaseSpread: 0.021,
      spreadBloomPerShot: 0.0045,
      aimedSpreadBloomPerShot: 0.0035,
      recoilMultiplier: 0.76,
      aiCadenceMultiplier: 0.72,
      modelScale: [0.96, 0.96, 0.96],
      bayonet: true,
    },
    thompson: {
      modelId: 'thompson',
      name: 'M1A1 汤姆逊',
      fireMode: '全自动',
      automatic: true,
      magazineSize: 30,
      reserveAmmo: 120,
      fireDelay: 0.095,
      reloadDuration: 2.15,
      emptyReloadDuration: 2.35,
      bodyDamage: 20,
      headDamage: 58,
      effectiveRange: 28,
      minDamageMultiplier: 0.5,
      baseSpread: 0.011,
      botBaseSpread: 0.026,
      spreadBloomPerShot: 0.004,
      aimedSpreadBloomPerShot: 0.003,
      recoilMultiplier: 0.68,
      aiCadenceMultiplier: 0.32,
      modelScale: [1.02, 1.02, 1.02],
      bayonet: true,
    },
    bar: {
      modelId: 'bar',
      name: 'M1918 BAR',
      fireMode: '全自动',
      automatic: true,
      magazineSize: 20,
      reserveAmmo: 80,
      fireDelay: 0.12,
      reloadDuration: 2.45,
      emptyReloadDuration: 2.65,
      bodyDamage: 30,
      headDamage: 86,
      effectiveRange: 60,
      minDamageMultiplier: 0.72,
      baseSpread: 0.009,
      botBaseSpread: 0.024,
      spreadBloomPerShot: 0.0065,
      aimedSpreadBloomPerShot: 0.005,
      recoilMultiplier: 1.18,
      aiCadenceMultiplier: 0.46,
      modelScale: [1.04, 1.04, 1.04],
      bayonet: true,
    },
  },
  grenades: {
    frag: {
      name: 'MK II 破片手雷',
      kind: 'frag',
      count: 2,
      fuse: 2.6,
      throwSpeed: 22,
      radius: 12,
      damage: 110,
      color: 0x4f6f58,
    },
    smoke: {
      name: 'M18 烟雾弹',
      kind: 'smoke',
      count: 2,
      fuse: 1.4,
      throwSpeed: 21,
      radius: 8,
      duration: 12,
      color: 0x12b6d2,
    },
  },
  items: {
    medkit: {
      name: '急救包',
      kind: 'heal',
      uses: 1,
      amount: 50,
    },
    ammoPouch: {
      name: '携行弹药包',
      kind: 'ammo',
      uses: 1,
    },
  },
  loadout: {
    defaultWeapon: 'garand',
    defaultGrenade: 'frag',
    defaultItem: 'medkit',
  },
  grenade: {
    cooldown: 0.8,
    gravity: 13,
    bounce: 0.38,
    aiMinDistance: 9,
    aiMaxDistance: 28,
    aiThrowChancePerSecond: 0.32,
    aiCooldownMin: 9,
    aiCooldownRange: 7,
  },
  supply: {
    interactRadius: 3.4,
    aiArrivalDistance: 2.7,
  },
  // 玩家生命、移动、视角和受击反馈参数。
  player: {
    // 玩家的最大生命值。
    maxHealth: 100,
    // 玩家移动碰撞半径。
    radius: 0.4,
    // 玩家站立时的高度。
    standHeight: 1.7,
    // 玩家蹲伏时的高度。
    crouchHeight: 1.1,
    // 玩家头部命中体相对半径倍率。
    headHitboxRadiusMultiplier: 0.78,
    // 玩家身体命中体顶部相对高度偏移。
    bodyHitboxHeightOffset: 0.22,
    // 玩家头部命中体底部相对高度偏移。
    headHitboxHeightOffset: 0.32,
    // 玩家普通移动速度。
    walkSpeed: 5.2,
    // 玩家蹲伏移动速度。
    crouchSpeed: 2.2,
    // 玩家冲刺速度。
    sprintSpeed: 9.5,
    // 玩家下落加速度。
    gravity: 18,
    // 玩家跳跃初速度。
    jumpVelocity: 6,
    // 玩家松开移动输入后的速度保留倍率。
    movementDamping: 0.8,
    // 玩家站立和蹲伏高度的过渡速度。
    crouchTransitionSpeed: 10,
    // 玩家每秒生命恢复量。
    healthRegen: 4,
    // 玩家默认视野角。
    baseFov: 75,
    // 玩家瞄准时的视野角。
    aimingFov: 55,
    // 玩家冲刺时的视野角。
    sprintingFov: 86,
    // 视角输入到相机旋转的基础倍率。
    lookSensitivity: 0.0011,
    // 瞄准时的视角灵敏度倍率。
    aimingLookMultiplier: 0.5,
    // 视角上下旋转距离垂直方向的保留角度。
    pitchLimit: 0.1,
    // 玩家受击时的基础屏幕震动。
    damageShakeBase: 0.18,
    // 玩家受击震动随伤害增加的倍率。
    damageShakeScale: 0.004,
    // 玩家单次受击屏幕震动上限。
    damageShakeMax: 0.55,
    // 玩家受击时的基础垂直视角后坐力。
    damageRecoilPitchBase: 0.008,
    // 玩家受击后坐力随伤害增加的倍率。
    damageRecoilPitchScale: 0.00008,
    // 玩家受击时的水平视角扰动。
    damageRecoilYaw: 0.012,
    // 玩家受击时的横滚视角扰动。
    damageRecoilRoll: 0.01,
    // 玩家死亡后进入部署界面的等待时间。
    deathTimer: 3,
    // 玩家死亡镜头下沉动画时长。
    deathCameraDuration: 1,
    // 玩家死亡镜头下沉距离。
    deathCameraDrop: 0.8,
    // 玩家死亡镜头横滚幅度。
    deathCameraRoll: 0.3,
    // 玩家死亡镜头俯仰幅度。
    deathCameraPitch: 0.2,
    // 玩家死亡时播放痛苦音效的概率。
    deathPainChance: 0.45,
    // 玩家屏幕震动累积强度上限。
    shakeTraumaMax: 1,
    // 玩家屏幕震动强度每秒衰减量。
    shakeRecovery: 1.75,
    // 玩家死亡时的屏幕震动强度。
    deathShake: 0.4,
  },
  // Bot 视野、移动、战术状态和命中体参数。
  bot: {
    // Bot 最大生命值。
    maxHealth: 100,
    // Bot 移动碰撞半径。
    radius: 0.4,
    // Bot 技能值随机范围的下限。
    skillMin: 0.25,
    // Bot 技能值随机范围的宽度。
    skillRange: 0.35,
    // Bot 最大视野距离。
    viewDistance: 70,
    // Bot 发现目标后的反应时间基准。
    reactionTime: 0.5,
    // 视野判定：前方夹角阈值、视线起点高度和最小侧视距离。
    // Bot 视野前方点积阈值。
    viewForwardThreshold: 0.3,
    // Bot 近距离目标允许绕过前方点积限制的距离。
    viewForwardMinDistance: 5,
    // Bot 视线检测起点高度。
    viewOriginHeight: 1.6,
    // Bot 射击时瞄准目标的高度。
    targetHeight: 1.4,
    // Bot 巡逻区域相对地图半径的比例。
    patrolAreaRatio: 0.42,
    // Bot 到达巡逻点的判定距离。
    patrolArrivalDistance: 2,
    // Bot 巡逻速度。
    patrolSpeed: 2.9,
    // Bot 搜索目标时的移动速度。
    alertSpeed: 4.6,
    // Bot 到达搜索点的判定距离。
    alertArrivalDistance: 3,
    // Bot 丢失目标后转入搜索状态的等待时间。
    lostTargetTime: 3,
    // Bot 搜索掩体的最大距离。
    coverSearchDistance: 40,
    // 掩体评分中拉开与敌人距离的权重。
    coverEnemyWeight: 0.5,
    // 掩体评分中自身到掩体距离的权重。
    coverDistanceWeight: 0.3,
    // 掩体距离评分的基础偏移。
    coverDistanceBias: 12,
    // Bot 低于该生命值时优先寻找掩体。
    lowHealthThreshold: 40,
    // Bot 重新评估掩体的时间间隔。
    coverRefreshInterval: 5,
    // Bot 与目标距离超过该值时向目标靠近。
    engageFarDistance: 50,
    // Bot 远距离接敌时的移动速度。
    engageFarSpeed: 5.2,
    // Bot 与目标距离低于该值时后撤。
    engageCloseDistance: 14,
    // Bot 近距离后撤速度。
    engageCloseSpeed: 4.6,
    // Bot 横向走位速度。
    engageStrafeSpeed: 3.5,
    // Bot 横向走位切换频率。
    engageStrafeFrequency: 0.8,
    // Bot 接敌后首次射击的基础延迟。
    engageFireBaseDelay: 0.7,
    // Bot 技能对射击延迟的影响范围。
    engageFireSkillDelay: 0.9,
    // Bot 到达掩体的判定距离。
    seekCoverArrivalDistance: 1.5,
    // Bot 到达掩体后转入侧翼状态的概率。
    seekCoverFlankChance: 0.3,
    // Bot 移动到掩体途中再次射击的间隔。
    seekCoverFireInterval: 1,
    // Bot 侧翼状态的持续时间。
    flankDuration: 6,
    // Bot 侧翼移动速度。
    flankSpeed: 4.6,
    // Bot 侧翼移动时沿目标方向的偏移。
    flankForwardBias: -0.3,
    // Bot 侧翼状态的射击间隔。
    flankFireInterval: 0.85,
    // Bot 的转身、命中体和受伤音效触发概率。
    // Bot 低于该速度时视为静止。
    stationarySpeedThreshold: 0.1,
    // Bot 转向目标的跟随速度。
    turnSpeed: 6,
    // Bot 身体命中体宽度。
    hitboxBodyWidth: 0.77,
    // Bot 身体命中体深度。
    hitboxBodyDepth: 0.56,
    // Bot 身体命中体顶部高度。
    hitboxBodyMaxY: 1.52,
    // Bot 头部命中体宽度。
    hitboxHeadWidth: 0.46,
    // Bot 头部命中体深度。
    hitboxHeadDepth: 0.46,
    // Bot 头部命中体底部高度。
    hitboxHeadMinY: 1.5,
    // Bot 头部命中体顶部高度。
    hitboxHeadMaxY: 1.96,
    // Bot 非致命受击时播放痛苦音效的概率。
    painChance: 0.25,
    // Bot 阵亡时播放痛苦音效的概率。
    deathPainChance: 0.4,
  },
  // 子弹命中、伤害和弹道提示参数。
  combat: {
    // 子弹最大射程。
    bulletRange: 200,
    // 子弹命中身体时的伤害。
    bodyDamage: 35,
    // 子弹命中头部时的伤害。
    headDamage: 100,
    // 子弹曳光线相对枪口的起始偏移。
    tracerOriginOffset: 0.1,
    // 玩家爆头命中时的屏幕震动。
    headshotHitShake: 0.16,
    // 玩家身体命中时的屏幕震动。
    bodyHitShake: 0.1,
    // 玩家击中障碍物时的屏幕震动。
    obstacleHitShake: 0.04,
    // 子弹经过玩家附近时播放掠过音效的最大距离。
    bulletWhizDistance: 30,
    // 子弹掠过判定的最小方向点积。
    bulletWhizAlignmentMin: 0.95,
    // 子弹掠过判定的最大方向点积。
    bulletWhizAlignmentMax: 0.999,
  },
  // 鼠标、触摸摇杆和陀螺仪输入参数。
  input: {
    // 触摸滑动位移转换为视角输入的倍率。
    touchLookScale: 5,
    // 陀螺仪姿态变化转换为视角输入的倍率。
    gyroLookScale: 500,
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
    // 出生动画开始显示落地暗角的时间点。
    landingVignetteStart: 0.86,
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
    firstPersonSmokeCount: 2,
    // Bot 枪口烟雾数量。
    botSmokeCount: 3,
    // 枪口烟雾的基础生命周期。
    smokeLife: 0.4,
    // 每个后续烟雾粒子的生命周期增量。
    smokeLifeStep: 0.09,
    // 玩家枪口烟团的生命周期。
    smokePuffLife: 0.55,
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
  // HUD 阈值、准星尺寸和提示持续时间，时间单位为毫秒。
  hud: {
    // 玩家低于该生命值时显示低血量状态。
    lowHealthThreshold: 30,
    // 玩家弹药不高于该数量时显示低弹量提示。
    lowAmmoThreshold: 2,
    // 准星的基础间距。
    crosshairBaseGap: 4,
    // 射击散布转换为准星间距的倍率。
    crosshairSpreadScale: 520,
    // 准星的基础尺寸。
    crosshairBaseSize: 22,
    // 准星线段长度。
    crosshairLength: 8,
    // 命中标记触发的屏幕震动。
    hitMarkerShake: 0.08,
    // 连杀统计的有效时间窗口。
    killStreakWindow: 3500,
    // 爆头击杀时的屏幕震动。
    hitKillShake: 0.22,
    // 多重击杀时的屏幕震动。
    multiKillShake: 0.22,
    // 普通击杀时的屏幕震动。
    normalKillShake: 0.14,
    // 击杀提示开始淡出的延迟。
    killNotifyOutDelay: 1500,
    // 击杀提示清理样式的延迟。
    killNotifyCleanupDelay: 1900,
    // 受击暗角的显示时长。
    damageVignetteDuration: 400,
    // 方向伤害提示的显示时长。
    directionDamageDuration: 800,
    // 击杀 feed 单条消息的显示时长。
    killFeedItemDuration: 5000,
    // 击杀 feed 同时保留的最大消息数。
    killFeedMaxItems: 6,
    // 中央提示默认显示时长。
    centerMessageDuration: 2000,
    // 道具和补给反馈的显示时长。
    actionMessageDuration: 1600,
  },
  // Web Audio 同时播放的声音数量限制。
  audio: {
    // 达到该数量后降低普通声音的播放优先级。
    maxVoices: 24,
    // 允许超过最大声音数的额外声音数量。
    overflowVoices: 10,
  },
  // 世界生成数量，调整数量会改变战场掩体和景观密度。
  world: {
    // 地形网格的横向和纵向细分数。
    terrainSegments: 64,
    // 地形边缘保留起伏的额外范围。
    terrainEdgeMargin: 8,
    // 泥地斑块数量。
    dirtPatchCount: 36,
    // 弹坑数量。
    craterCount: 32,
    // 木箱数量。
    crateCount: 55,
    // 铁丝网组数量。
    barbedWireCount: 14,
    // 树木数量。
    treeCount: 90,
    // 碎片组数量。
    debrisCount: 40,
    // 远景烟柱数量。
    smokeColumnCount: 12,
    // 每根烟柱包含的烟团数量。
    smokePuffsPerColumn: 7,
    // 木箱生成时避开地图中心的半径。
    centerExclusionRadius: 8,
    // 烟柱生成时避开地图中心的半径。
    smokeCenterExclusionRadius: 35,
  },
  // 相机、雾效、像素比和阴影的运行时渲染参数。
  render: {
    // 相机近裁剪面距离。
    cameraNear: 0.04,
    // 相机远裁剪面距离。
    cameraFar: 1200,
    // 雾效开始出现的距离。
    fogNear: 155,
    // 雾效完全覆盖的距离。
    fogFar: 470,
    // 桌面设备的像素比上限。
    desktopPixelRatio: 1.25,
    // 触摸设备的像素比上限。
    touchPixelRatio: 2,
    // 纹理各向异性过滤等级上限。
    maxAnisotropy: 4,
    // 主光源阴影贴图尺寸。
    shadowMapSize: 2048,
    // 主光源阴影视锥的水平边界。
    shadowCameraBound: 120,
    // 主光源阴影视锥的近裁剪面。
    shadowCameraNear: 10,
    // 主光源阴影视锥的远裁剪面。
    shadowCameraFar: 300,
  },
  // 启动加载进度和各阶段等待时间，时间单位为毫秒。
  boot: {
    // 加载界面初始进度。
    initialProgress: 4,
    // 世界生成完成时的加载进度。
    worldProgress: 18,
    // 掩体阶段的加载进度。
    coverProgress: 28,
    // 部署单位阶段的加载进度。
    botProgress: 36,
    // AI 初始化阶段的加载进度。
    aiProgress: 42,
    // 音频加载开始时的进度。
    audioProgress: 45,
    // 音频加载占用的进度区间。
    audioProgressRange: 51,
    // 世界阶段后的等待时间。
    initialDelay: 40,
    // 中间加载阶段的等待时间。
    coverDelay: 20,
    // 加载完成后显示菜单前的等待时间。
    readyDelay: 200,
    // 加载界面淡出后显示菜单的延迟。
    menuFadeDelay: 600,
  },
}

// 两个阵营可选择的出生点坐标和界面名称。
export const SPAWN_POINTS = {
  // 我方出生点。
  allies: [
    // A 点：南侧主阵地。
    { x: 0, z: 100, name: '南侧主阵地', id: 'A' },
    // B 点：西南农场。
    { x: -55, z: 90, name: '西南农场', id: 'B' },
    // C 点：东南路口。
    { x: 55, z: 95, name: '东南路口', id: 'C' },
    // D 点：西南林地。
    { x: -95, z: 70, name: '西南林地', id: 'D' },
    // E 点：东南废墟。
    { x: 95, z: 70, name: '东南废墟', id: 'E' },
  ],
  // 敌方出生点。
  axis: [
    // F 点：北侧据点。
    { x: 0, z: -100, name: '北侧据点', id: 'F' },
    // G 点：西北树林。
    { x: -55, z: -90, name: '西北树林', id: 'G' },
    // H 点：东北废墟。
    { x: 55, z: -95, name: '东北废墟', id: 'H' },
    // I 点：西北高地。
    { x: -95, z: -70, name: '西北高地', id: 'I' },
    // J 点：东北公路。
    { x: 95, z: -70, name: '东北公路', id: 'J' },
  ],
}

// 启动加载界面按顺序显示的阶段文案。
export const LOAD_STEPS = [
  // 武器装配阶段。
  '正在装配武器...',
  // 地形生成阶段。
  '生成战场地形...',
  // 掩体构筑阶段。
  '构筑防御工事...',
  // 单位部署阶段。
  '部署作战单位...',
  // AI 初始化阶段。
  '初始化AI系统...',
  // 战斗音效加载阶段。
  '加载战斗音效...',
  // 加载结束阶段。
  '准备就绪...',
]

const audioModules = import.meta.glob('./audio/*.ogg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const AUDIO_FILES = Object.fromEntries(
  Object.entries(audioModules).map(([path, url]) => [
    path.split('/').pop().replace('.ogg', ''),
    url,
  ])
)
