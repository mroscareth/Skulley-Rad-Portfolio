import * as THREE from 'three'

// Poses clave de la PATADA de Skulley Rad.
//
// NO son valores calculados a mano: se posaron a mano en el Pose Studio
// (`?pose=1`) y se exportaron tal cual. Cada entrada es el quaternion LOCAL
// del hueso. Por eso la animación reproduce exactamente lo que se vio en
// pantalla — sin adivinar ejes, signos ni convenciones del rig, que fue lo
// que hizo imposible calibrar esto a ciegas.
//
// `__rootOffset` es el desplazamiento de la cadera respecto a su reposo (en
// unidades del rig): es el PESO del cuerpo, y sin él la pose pierde el
// hundimiento sobre la pierna de apoyo.
//
// Para volver a editarlas: abre `?pose=1`, carga, retoca, exporta y pega aquí.
const RAW = {
  inicial: {
    rootx: [0.0151, 0, 0, 0.9999],
    spine_01x: [0.0365, -0.0033, -0.0001, 0.9993],
    spine_02x: [0.1345, 0.0033, -0.0004, 0.9909],
    spine_03x: [0.1251, 0, -0.0017, 0.9921],
    neckx: [-0.0431, 0.007, 0.0029, 0.999],
    headx: [-0.0853, -0.0066, -0.0021, 0.9963],
    shoulderl: [-0.454, -0.5816, -0.2675, 0.6197],
    arm_stretchl: [-0.6002, -0.334, -0.331, 0.647],
    forearm_stretchl: [-0.2188, 0.049, -0.5623, 0.796],
    handl: [-0.033, 0.1388, 0.0021, 0.9898],
    shoulderr: [-0.4558, 0.5804, 0.2698, 0.6185],
    arm_stretchr: [-0.4436, -0.1885, -0.4218, 0.7679],
    forearm_stretchr: [0.0637, 0.0189, 0.4192, 0.9055],
    handr: [-0.033, -0.1388, -0.0021, 0.9898],
    thigh_stretchl: [-0.5303, 0.5248, -0.5274, 0.4065],
    leg_stretchl: [-0.0177, -0.0055, 0.4627, 0.8863],
    footl: [0.2218, 0.7118, -0.3437, 0.571],
    toes_01l: [-0.0158, 0.9995, -0.0124, 0.0233],
    thigh_stretchr: [-0.6694, 0.2049, 0.6654, -0.2591],
    leg_stretchr: [0.0318, -0.0111, -0.3367, 0.941],
    footr: [0.4723, -0.5244, 0.4583, 0.5403],
    toes_01r: [-0.0158, -0.9995, 0.0124, 0.0233],
    __rootOffset: [-0.2549, -5.3688, 1.6274],
  },
  final: {
    rootx: [-0.22, 0, 0, 0.9755],
    spine_01x: [0.0365, -0.0033, -0.0001, 0.9993],
    spine_02x: [0.1345, 0.0033, -0.0004, 0.9909],
    spine_03x: [0.0616, 0.0005, 0.0672, 0.9958],
    neckx: [0.131, -0.0093, -0.004, 0.9913],
    headx: [-0.0853, -0.0066, -0.0021, 0.9963],
    shoulderl: [-0.454, -0.5816, -0.2675, 0.6197],
    arm_stretchl: [-0.1876, 0.2792, 0.5055, 0.7946],
    forearm_stretchl: [-0.4472, 0.2403, -0.4335, 0.7446],
    handl: [-0.033, 0.1388, 0.0021, 0.9898],
    shoulderr: [-0.4558, 0.5804, 0.2698, 0.6185],
    arm_stretchr: [-0.71, 0.5731, 0.2038, 0.3547],
    forearm_stretchr: [-0.5979, -0.3379, 0.0987, 0.7202],
    handr: [-0.033, -0.1388, -0.0021, 0.9898],
    thigh_stretchl: [-0.6636, -0.3015, -0.4032, -0.5533],
    leg_stretchl: [0.1489, 0.2121, 0.086, 0.962],
    footl: [0.3875, 0.5996, -0.4647, 0.5238],
    toes_01l: [-0.0158, 0.9995, -0.0124, 0.0233],
    thigh_stretchr: [-0.6158, -0.3383, 0.6742, 0.2275],
    leg_stretchr: [0.0554, -0.0249, -0.3195, 0.9456],
    footr: [0.6302, -0.3416, 0.5887, 0.3736],
    toes_01r: [-0.0158, -0.9995, 0.0124, 0.0233],
    __rootOffset: [-0.0895, -6.1566, 2.3148],
  },
}

// Nombres de hueso presentes en AMBAS poses (los que la patada anima).
export const KICK_BONES = Object.keys(RAW.inicial).filter(
  (k) => k !== '__rootOffset' && RAW.final[k],
)

// Quaternions pre-construidos: crear THREE.Quaternion por frame sería basura
// para el GC en un useFrame.
export const KICK_A = {}
export const KICK_B = {}
for (const name of KICK_BONES) {
  KICK_A[name] = new THREE.Quaternion(...RAW.inicial[name])
  KICK_B[name] = new THREE.Quaternion(...RAW.final[name])
  // Hemisferio: si los dos quaternions están en lados opuestos, el slerp toma
  // el camino largo y la pierna da una vuelta completa. Se normaliza el signo.
  if (KICK_A[name].dot(KICK_B[name]) < 0) {
    KICK_B[name].set(-KICK_B[name].x, -KICK_B[name].y, -KICK_B[name].z, -KICK_B[name].w)
  }
}

export const KICK_ROOT_A = new THREE.Vector3(...RAW.inicial.__rootOffset)
export const KICK_ROOT_B = new THREE.Vector3(...RAW.final.__rootOffset)
