/**
 * The cars the board can draw (components/CarArt.tsx), as numbers: every model
 * is its length, height, wheelbase and a dozen points of its roofline, in
 * millimetres from the front bumper and from the ground, and `carShape` turns
 * those into the paths of a flat side view (facing left, all models to one
 * scale: 1 unit = 10 mm). Adding a car is adding an entry here and a name
 * pattern in `lib/carModels.ts`; nothing is traced or borrowed, so the
 * drawings carry no licence. The dimensions are approximate: the proportions
 * are meant to be right, the details are not there on purpose.
 */

/** A point of a profile: mm from the front, mm from the ground, and how round the curve is there (0 = a corner). */
type Node = [x: number, h: number, k?: number]

interface Spec {
  /** The paint a car of this model wears when its name says no colour. */
  paint: string
  L: number
  H: number
  WB: number
  /** The front overhang: bumper to front axle. */
  FO: number
  /** The tyre's diameter, and how high the sill sits. */
  tire: number
  sill: number
  /** An SUV's black cladding: how far it comes up from the sill. */
  cladding?: number
  /** The pillar behind the rear door, where there is a third side window. */
  xC?: number
  /** How far the last side window tapers behind the rear door's edge. */
  cTaper?: number
  /** A three-door: no rear door. */
  rearDoor?: false
  xB?: number
  /** The upper profile, front bumper to rear bumper. */
  top: Node[]
  /** The side glass, from the base of the windscreen pillar round to the last pillar. */
  glass: Node[]
}

export type CarModelKey = keyof typeof SPECS

const SPECS = {
  mazda6e: { paint: '#ffffff', L: 4921, H: 1491, WB: 2895, FO: 945, tire: 700, sill: 185, xC: 3560, cTaper: 420,
    top: [[45, 225, 0.6], [0, 430], [30, 640], [200, 745], [1330, 1005, 0.8], [2130, 1440], [2650, 1491], [3500, 1400], [4250, 1150], [4700, 1045, 0.7], [4885, 1010, 0.5], [4921, 820], [4900, 470], [4855, 255, 0.6]],
    glass: [[1500, 1010, 0.25], [2200, 1385, 0.6], [2700, 1432], [3420, 1350], [4130, 1110, 0.2]] },
  skodaOctavia: { paint: '#62666e', L: 4689, H: 1470, WB: 2686, FO: 905, tire: 650, sill: 185, xC: 3440, cTaper: 330,
    top: [[45, 230, 0.6], [0, 440], [30, 655], [170, 745], [1200, 990, 0.8], [1960, 1420], [2480, 1470], [3320, 1410], [4080, 1150], [4470, 1065, 0.7], [4655, 1035, 0.5], [4689, 830], [4670, 480], [4630, 260, 0.6]],
    glass: [[1370, 995, 0.25], [2030, 1365, 0.6], [2500, 1412], [3280, 1355], [3880, 1085, 0.2]] },
  skodaSuperb: { paint: '#3b4252', L: 4869, H: 1469, WB: 2841, FO: 900, tire: 660, sill: 185, xC: 3560, cTaper: 330,
    top: [[45, 230, 0.6], [0, 440], [30, 655], [170, 745], [1230, 990, 0.8], [2010, 1420], [2560, 1469], [3440, 1408], [4230, 1150], [4640, 1065, 0.7], [4835, 1035, 0.5], [4869, 830], [4850, 480], [4810, 260, 0.6]],
    glass: [[1400, 995, 0.25], [2080, 1365, 0.6], [2580, 1411], [3400, 1352], [4020, 1085, 0.2]] },
  skodaFabia: { paint: '#86b9e6', L: 4108, H: 1459, WB: 2564, FO: 840, tire: 621, sill: 185, cTaper: 170,
    top: [[45, 230, 0.6], [0, 440], [30, 665], [160, 760], [1090, 1005, 0.8], [1800, 1415], [2360, 1459], [3200, 1435], [3740, 1345, 0.6], [3975, 1050, 0.7], [4078, 955, 0.6], [4108, 755], [4092, 460], [4055, 260, 0.6]],
    glass: [[1260, 1008, 0.25], [1870, 1358, 0.6], [2390, 1401], [3120, 1370, 0.6], [3380, 1050, 0.2]] },
  skodaKodiaq: { paint: '#9a7b5f', L: 4697, H: 1676, WB: 2791, FO: 900, tire: 716, sill: 240, cladding: 110, xC: 3640, cTaper: 300,
    top: [[55, 285, 0.6], [0, 505], [25, 760], [160, 875], [1230, 1100, 0.8], [1900, 1590], [2500, 1676], [3650, 1655], [4220, 1560, 0.6], [4520, 1200, 0.7], [4658, 1095, 0.6], [4697, 850], [4680, 505], [4635, 310, 0.6]],
    glass: [[1400, 1108, 0.25], [1970, 1535, 0.6], [2530, 1616], [3640, 1580, 0.5], [4080, 1185, 0.2]] },
  vwGolf: { paint: '#4a7fe0', L: 4284, H: 1456, WB: 2630, FO: 880, tire: 632, sill: 185, cTaper: 150,
    top: [[45, 230, 0.6], [0, 440], [30, 665], [160, 755], [1140, 1000, 0.8], [1860, 1408], [2420, 1456], [3350, 1432], [3910, 1345, 0.6], [4140, 1050, 0.7], [4255, 960, 0.6], [4284, 760], [4268, 460], [4228, 260, 0.6]],
    glass: [[1310, 1000, 0.25], [1930, 1352, 0.6], [2450, 1398], [3260, 1368, 0.6], [3470, 1040, 0.2]] },
  vwTouareg: { paint: '#2c2d31', L: 4878, H: 1702, WB: 2904, FO: 930, tire: 763, sill: 235, cladding: 80, xC: 3760, cTaper: 350,
    top: [[55, 280, 0.6], [0, 500], [25, 760], [170, 880], [1280, 1100, 0.8], [1980, 1615], [2600, 1702], [3750, 1675], [4350, 1570, 0.6], [4680, 1210, 0.7], [4835, 1110, 0.6], [4878, 860], [4860, 510], [4815, 310, 0.6]],
    glass: [[1450, 1108, 0.25], [2050, 1560, 0.6], [2630, 1642], [3720, 1598, 0.6], [4250, 1195, 0.2]] },
  toyotaCorolla: { paint: '#c9cbd3', L: 4370, H: 1435, WB: 2640, FO: 935, tire: 632, sill: 180, cTaper: 240,
    top: [[45, 220, 0.6], [0, 415], [40, 615], [200, 705], [1210, 965, 0.8], [1960, 1388], [2500, 1435], [3350, 1400], [3860, 1290, 0.7], [4190, 1040, 0.7], [4335, 950, 0.6], [4370, 745], [4352, 450], [4310, 250, 0.6]],
    glass: [[1390, 975, 0.25], [2030, 1332, 0.6], [2520, 1378], [3260, 1335, 0.6], [3650, 1045, 0.2]] },
  toyotaRav4: { paint: '#b4b0a6', L: 4600, H: 1685, WB: 2690, FO: 925, tire: 724, sill: 245, cladding: 150, xC: 3560, cTaper: 260,
    top: [[55, 290, 0.6], [0, 520], [20, 790], [140, 900], [1200, 1110, 0.8], [1850, 1600], [2450, 1685], [3600, 1665], [4150, 1590, 0.6], [4420, 1230, 0.7], [4560, 1120, 0.6], [4600, 860], [4585, 520], [4540, 320, 0.6]],
    glass: [[1370, 1120, 0.25], [1920, 1545, 0.6], [2480, 1625], [3600, 1590, 0.5], [3980, 1200, 0.2]] },
  renaultClio: { paint: '#e8703a', L: 4050, H: 1440, WB: 2583, FO: 830, tire: 616, sill: 185, cTaper: 200,
    top: [[45, 230, 0.6], [0, 440], [30, 665], [160, 765], [1090, 1010, 0.8], [1790, 1398], [2330, 1440], [3150, 1412], [3690, 1320, 0.7], [3925, 1045, 0.7], [4022, 950, 0.6], [4050, 750], [4035, 460], [3998, 260, 0.6]],
    glass: [[1260, 1015, 0.25], [1860, 1342, 0.6], [2350, 1383], [3060, 1348, 0.6], [3360, 1075, 0.2]] },
  renaultKadjar: { paint: '#2f4f8f', L: 4449, H: 1613, WB: 2646, FO: 915, tire: 690, sill: 230, cladding: 120, xC: 3470, cTaper: 330,
    top: [[55, 275, 0.6], [0, 490], [30, 730], [170, 845], [1190, 1070, 0.8], [1870, 1540], [2450, 1613], [3450, 1585], [4020, 1480, 0.6], [4290, 1160, 0.7], [4415, 1060, 0.6], [4449, 825], [4432, 495], [4390, 305, 0.6]],
    glass: [[1360, 1080, 0.25], [1940, 1485, 0.6], [2480, 1554], [3430, 1508, 0.6], [3890, 1150, 0.2]] },
  daciaDuster: { paint: '#8a9070', L: 4343, H: 1656, WB: 2657, FO: 830, tire: 690, sill: 250, cladding: 150, xC: 3420, cTaper: 150,
    top: [[55, 300, 0.6], [0, 520], [20, 790], [130, 905], [1110, 1125, 0.8], [1720, 1582], [2300, 1640], [3500, 1632], [4010, 1575, 0.6], [4235, 1200, 0.7], [4320, 1095, 0.6], [4343, 850], [4330, 520], [4288, 330, 0.6]],
    glass: [[1270, 1130, 0.25], [1790, 1528, 0.6], [2330, 1580], [3560, 1560, 0.5], [3790, 1175, 0.2]] },
  hyundaiTucson: { paint: '#3f7f84', L: 4500, H: 1650, WB: 2680, FO: 905, tire: 725, sill: 235, cladding: 120, xC: 3520, cTaper: 330,
    top: [[55, 285, 0.6], [0, 500], [25, 745], [160, 860], [1190, 1090, 0.8], [1860, 1572], [2450, 1650], [3500, 1622], [4060, 1520, 0.6], [4335, 1180, 0.7], [4465, 1080, 0.6], [4500, 840], [4482, 500], [4438, 310, 0.6]],
    glass: [[1360, 1098, 0.25], [1930, 1515, 0.6], [2480, 1590], [3480, 1545, 0.6], [3950, 1165, 0.2]] },
  teslaModel3: { paint: '#d64545', L: 4720, H: 1441, WB: 2875, FO: 870, tire: 668, sill: 180, xC: 3470, cTaper: 400,
    top: [[45, 220, 0.6], [0, 400], [40, 585], [230, 680], [1160, 940, 0.8], [2060, 1400], [2600, 1441], [3420, 1368], [4080, 1130], [4480, 1042, 0.7], [4685, 1012, 0.5], [4720, 800], [4700, 470], [4658, 250, 0.6]],
    glass: [[1350, 950, 0.25], [2120, 1345, 0.6], [2620, 1384], [3360, 1318], [3990, 1080, 0.2]] },
  fiat500: { paint: '#a8dcc4', L: 3571, H: 1488, WB: 2300, FO: 700, tire: 585, sill: 195, rearDoor: false, xB: 1440,
    top: [[45, 240, 0.6], [0, 480], [25, 725], [105, 855], [700, 1050, 0.8], [1210, 1408], [1780, 1488], [2640, 1458], [3170, 1345, 0.8], [3440, 1060, 0.8], [3535, 930, 0.7], [3571, 740], [3556, 450], [3520, 270, 0.6]],
    glass: [[860, 1062, 0.25], [1280, 1350, 0.6], [1800, 1428], [2580, 1395, 0.7], [2810, 1092, 0.25]] },
  peugeot308: { paint: '#4f8f6c', L: 4367, H: 1441, WB: 2675, FO: 890, tire: 634, sill: 180, cTaper: 250,
    top: [[45, 220, 0.6], [0, 420], [35, 620], [200, 715], [1290, 975, 0.8], [2020, 1392], [2540, 1441], [3380, 1400], [3880, 1290, 0.7], [4190, 1040, 0.7], [4332, 950, 0.6], [4367, 745], [4350, 450], [4308, 250, 0.6]],
    glass: [[1460, 985, 0.25], [2090, 1338, 0.6], [2560, 1384], [3290, 1338, 0.6], [3680, 1050, 0.2]] },
  peugeot3008: { paint: '#d9d4c7', L: 4447, H: 1624, WB: 2675, FO: 920, tire: 700, sill: 230, cladding: 120, xC: 3480, cTaper: 330,
    top: [[55, 280, 0.6], [0, 495], [25, 740], [160, 855], [1200, 1085, 0.8], [1870, 1550], [2460, 1624], [3470, 1595], [4030, 1490, 0.6], [4290, 1165, 0.7], [4412, 1065, 0.6], [4447, 830], [4430, 495], [4388, 305, 0.6]],
    glass: [[1370, 1093, 0.25], [1940, 1495, 0.6], [2490, 1565], [3450, 1520, 0.6], [3900, 1155, 0.2]] },
} satisfies Record<string, Spec>

/** The box every car is drawn in: room for the longest, the ground near the foot. */
export const CAR_BOX = { width: 540, height: 200 } as const
const SCALE = 0.1
const GROUND = 176

const f = (n: number) => (Math.round(n * 10) / 10).toString()

/** A cardinal spline through the points; a point's `k` scales its handles (0 = a corner). */
function spline(pts: Node[], closed = false, tension = 0.19): string {
  const n = pts.length
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const k1 = p1[2] ?? 1, k2 = p2[2] ?? 1
    d += `C${f(p1[0] + (p2[0] - p0[0]) * tension * k1)} ${f(p1[1] + (p2[1] - p0[1]) * tension * k1)} ${f(p2[0] - (p3[0] - p1[0]) * tension * k2)} ${f(p2[1] - (p3[1] - p1[1]) * tension * k2)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + (closed ? 'Z' : '')
}

/** Everything CarArt needs to draw one car, in the box's own units. */
export interface CarShape {
  paint: string
  /** The body's outline, wheel arches cut out. */
  body: string
  glass: string
  /** The pillars, as lines across the glass. */
  pillars: string[]
  /** The door cuts. */
  doors: string[]
  head: string
  tail: string
  /** Where the darker lower band (or an SUV's cladding) starts, and whether it is cladding. */
  bandY: number
  cladding: boolean
  wheels: { cx: number; cy: number; r: number; arch: number }[]
  /** Half the car's length, for the shadow under it. */
  halfLength: number
}

const cache = new Map<CarModelKey, CarShape>()

export function carShape(key: CarModelKey): CarShape {
  const hit = cache.get(key)
  if (hit) return hit
  const c: Spec = SPECS[key]
  const ox = (CAR_BOX.width - c.L * SCALE) / 2
  const X = (x: number) => ox + x * SCALE
  const Y = (h: number) => GROUND - h * SCALE
  const P = ([x, h, k]: Node): Node => [X(x), Y(h), k]
  const r = c.tire / 2
  const ra = r + 48
  const sill = c.sill
  const fw = c.FO
  const rw = c.FO + c.WB
  const dx = Math.sqrt(ra * ra - (r - sill) * (r - sill))

  // The upper profile, then the underside with an arch over each wheel.
  let body = spline(c.top.map(P))
  body += `L${f(X(c.top[c.top.length - 1][0] - 40))} ${f(Y(sill))}`
  for (const w of [rw, fw]) body += `L${f(X(w + dx))} ${f(Y(sill))}A${f(ra * SCALE)} ${f(ra * SCALE)} 0 1 0 ${f(X(w - dx))} ${f(Y(sill))}`
  body += `L${f(X(c.top[0][0] + 40))} ${f(Y(sill))}Z`

  const first = c.glass[0]
  const last = c.glass[c.glass.length - 1]
  const belt = first[1]
  const beltRear = last[1]
  const xB = c.xB ?? fw + c.WB * 0.47
  const threeDoor = c.rearDoor === false
  const doors: Node[][] = [
    [[first[0] - 20, belt, 0], [first[0] - 40, belt - 260], [fw + ra + 60, sill + 190], [fw + ra + 95, sill + 30, 0]],
    threeDoor ? [[xB + 330, belt + 10, 0], [xB + 320, sill + 220], [rw - ra - 60, sill + 60, 0]] : [[xB, belt + 10, 0], [xB - 14, sill + 30, 0]],
  ]
  if (!threeDoor) {
    const xr = rw - ra * 0.55
    doors.push([[last[0] - (c.cTaper ?? 80), beltRear, 0], [xr + 50, beltRear - 220], [xr - 30, r + ra * 0.72], [rw - ra - 70, sill + 40, 0]])
  }
  const pillarAt = threeDoor ? [xB + 330] : [xB, ...(c.xC ? [c.xC] : [])]
  const hf = c.top[3]
  const tl = c.top[c.top.length - 4]
  const shape: CarShape = {
    paint: c.paint,
    body,
    glass: spline(c.glass.map(P), true, 0.17),
    pillars: pillarAt.map((x) => `M${f(X(x + 18))} ${f(Y(c.H))}L${f(X(x - 12))} ${f(Y(belt - 40))}`),
    doors: doors.map((d) => spline(d.map(P), false, 0.2)),
    head: spline(([[hf[0] - 105, hf[1] - 95, 0.6], [hf[0] + 150, hf[1] + 15, 0.4], [hf[0] + 110, hf[1] - 50, 0.6], [hf[0] - 90, hf[1] - 150, 0.6]] as Node[]).map(P), true, 0.16),
    tail: spline(([[tl[0] + 20, tl[1] - 25, 0.5], [tl[0] - 230, tl[1] - 10, 0.4], [tl[0] - 200, tl[1] - 75, 0.5], [tl[0] + 40, tl[1] - 120, 0.5]] as Node[]).map(P), true, 0.16),
    bandY: Y(sill + (c.cladding ?? 110)),
    cladding: c.cladding !== undefined,
    wheels: [fw, rw].map((w) => ({ cx: X(w), cy: Y(r), r: r * SCALE, arch: ra * SCALE })),
    halfLength: (c.L * SCALE) / 2,
  }
  cache.set(key, shape)
  return shape
}

export const CAR_MODEL_KEYS = Object.keys(SPECS) as CarModelKey[]
