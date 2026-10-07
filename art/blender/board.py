"""Board scenery: island terrain, roads and props around a board layout.

  node scripts/test-loader.cjs scripts/export-boards.ts          # layouts → art/boards/*.json
  C:\\Tools\\Blender\\blender.exe --background --factory-startup --python art/blender/board.py -- crown

Writes public/models/board-<id>.glb (+ art/renders/board-<id>-*.png).
Board space: three.js x/z from the layout; Blender (x, -z, height).
Tiles, characters and effects stay code-driven; this file builds everything
else: a heightfield island that rises around the roads, stone roads along
every route, scanned-material terrain, and instanced props kept clear of play.
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

sys.path.insert(0, os.path.dirname(__file__))
import kit  # noqa: E402

BOARD = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'crown'
LAYOUT = json.load(open(os.path.join(kit.ROOT, 'art', 'boards', BOARD + '.json')))
random.seed(7)
kit.reset()

PATH_Y = 0.6  # road surface; code tiles sit on top at 0.81


def B(x, z, y=0.0):
    return Vector((x, -z, y))


# ── Theme recipes ───────────────────────────────────────────────────────────
# surface: 'sea' (island in water), 'lava' (island in a lava sea),
# 'clouds' (floating island over a cloud sea), 'ground' (open moon plain).
THEMES = {
    'crown': dict(
        land=('Grass', ('sparse_grass', '#2d6e25', '#b2e366', 0.9)), beach=('Sand', 'coast_sand_01'), rock=('Rock', 'coast_land_rocks_01'),
        road=('Road', 'large_sandstone_blocks'), branch=('Boardwalk', 'brown_planks_05'),
        hills=1.5, island=7.5, sea_level=0.0, seabed=-1.6, water='#2bb6c4', surface='sea', shelf=2.5,
        landmark='volcano', props='tropical', canopy=('#f25265', '#fff4dc'), fallback='#6fae4f'),
    'crater': dict(
        land=('Regolith', ('moon_dusted_02', '#5b6274', '#d3d8e3', 1.0)), beach=('Maria', ('moon_dusted_02', '#4f566b', '#98a0b4', 1.0)), rock=('MoonRock', 'moon_meteor_01'),
        road=('Road', 'concrete_panels'), branch=('Catwalk', 'metal_plate'),
        hills=1.1, island=11.0, sea_level=-0.2, seabed=-2.0, water='#24365e', surface='ground', shelf=3.0,
        landmark='impact', props='lunar', canopy=('#8a7cff', '#e9ecff'), fallback='#9aa1b0'),
    'fissure': dict(
        land=('Ash', ('rocky_terrain_02', '#2a2226', '#8a756d', 1.0)), beach=('Basalt', ('dark_rock', '#121014', '#4d4247', 1.0)), rock=('Obsidian', 'dark_rock'),
        road=('Road', 'volcanic_rock_tiles'), branch=('Bridge', 'metal_plate'),
        hills=1.8, island=7.0, sea_level=-0.15, seabed=-2.2, water='#ff5a14', surface='lava', shelf=1.2,
        landmark='volcano', props='volcanic', canopy=('#ff7a2e', '#2b2328'), fallback='#4a3f42'),
    'coral': dict(
        land=('Reef', ('coral_ground_02', '#6cb7a6', '#d6f6e6', 1.4)), beach=('Shell', ('coast_sand_01', '#d8b9cb', '#fff5f8', 1.0)), rock=('CoralStone', 'coral_stone_wall'),
        road=('Road', 'white_sandstone_bricks'), branch=('Cloudway', 'brown_planks_05'),
        hills=1.3, island=7.0, sea_level=-2.6, seabed=-10.0, water='#f3f0ff', surface='clouds', shelf=1.0,
        landmark='anemone', props='reef', canopy=('#ff8fc8', '#e8fbff'), fallback='#7fcfba'),
}
TH = THEMES.get(BOARD, THEMES['crown'])
random.seed(sum(map(ord, BOARD)))

# ── Layout geometry helpers ─────────────────────────────────────────────────
segments = []
for road in LAYOUT['roads']:
    pts = road['points']
    for a, b in zip(pts, pts[1:]):
        segments.append((a, b))
spaces = LAYOUT['spaces']
radius = LAYOUT['radius']


def seg_dist(px, pz, a, b):
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    t = max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz + 1e-9)))
    return math.hypot(px - ax - t * dx, pz - az - t * dz)


def path_dist(x, z):
    return min(seg_dist(x, z, a, b) for a, b in segments)


def smoothstep(e0, e1, v):
    t = max(0.0, min(1.0, (v - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def fbm(x, z, scale, octaves=4):
    return noise.fractal(Vector((x * scale, z * scale, 0.37)), 0.5, 2.0, octaves, noise_basis='PERLIN_ORIGINAL')


landmark = LAYOUT['landmark']
districts = LAYOUT['districts']
lagoons = LAYOUT['water']


def in_lagoon(x, z, pad=0.0):
    for w in lagoons:
        c, s = math.cos(-w['angle']), math.sin(-w['angle'])
        dx, dz = x - w['x'], z - w['z']
        rx, rz = dx * c - dz * s, dx * s + dz * c
        if (rx / (w['rx'] + pad)) ** 2 + (rz / (w['rz'] + pad)) ** 2 < 1:
            return True
    return False


def lagoon_depth(x, z):
    best = 0.0
    for w in lagoons:
        c, s = math.cos(-w['angle']), math.sin(-w['angle'])
        dx, dz = x - w['x'], z - w['z']
        rx, rz = dx * c - dz * s, dx * s + dz * c
        e = (rx / (w['rx'] + 1.2)) ** 2 + (rz / (w['rz'] + 1.2)) ** 2
        best = max(best, 1 - min(1.0, e))
    return best


# Impact craters for the moon, kept off the roads.
craters = []
if TH['surface'] == 'ground':
    rnd = random.Random(11)
    for k in range(400):
        x, z = rnd.uniform(-radius * 1.3, radius * 1.3), rnd.uniform(-radius * 1.3, radius * 1.3)
        r = rnd.uniform(1.6, 4.5)
        if path_dist(x, z) > r + 2.4 and all(math.hypot(x - cx, z - cz) > r + cr for cx, cz, cr in craters):
            craters.append((x, z, r))
        if len(craters) > 34:
            break


def crater_shape(x, z):
    h = 0.0
    for cx, cz, r in craters:
        t = math.hypot(x - cx, z - cz) / r
        if t < 1.6:
            # Bowl inside, raised rim around the edge.
            h += -0.55 * r * 0.35 * max(0.0, 1 - t * t) + 0.22 * r * 0.35 * math.exp(-((t - 1.0) / 0.22) ** 2)
    return h


# Reef terraces stay off the set-piece footprints: shops, bank, lottery,
# district centres, the landing site and the palace plaza.
FLAT_ZONES = []
if TH['props'] == 'reef':
    FLAT_ZONES += [(s['x'], s['z'], 9.5) for s in spaces if s['type'] in ('shop', 'bank', 'lottery')]
    FLAT_ZONES += [(q['x'], q['z'], 9.5 if q['kind'] == 'heart' else 6.5) for q in districts]
    FLAT_ZONES.append((spaces[0]['x'], spaces[0]['z'], 9.0))
PLAZAS = [(landmark[0], landmark[1], 8.4)] + [(q['x'], q['z'], 4.6) for q in districts if q['kind'] == 'village']


def closest_on_roads(x, z):
    best = (1e9, x, z)
    for (ax, az), (bx, bz) in segments:
        dx, dz = bx - ax, bz - az
        t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz + 1e-9)))
        px, pz = ax + t * dx, az + t * dz
        d = math.hypot(x - px, z - pz)
        if d < best[0]:
            best = (d, px, pz)
    return best[1], best[2]


# Sand footpaths from set-piece doors to the road (reef).
FOOTPATHS = []
if TH['props'] == 'reef':
    gate = (landmark[0], landmark[1] + 7.0)
    FOOTPATHS.append((gate, closest_on_roads(*gate)))


def terrace(x, z, d):
    """Stepped grassy plateaus with steep risers (the risers splat to rock strata)."""
    mask = smoothstep(3.6, 7.5, d) * max(0.0, fbm(x + 11, z - 7, 0.05, 3) + 0.42) * 1.25
    for fx, fz, fr in FLAT_ZONES:
        mask *= smoothstep(fr - 2.0, fr + 1.5, math.hypot(x - fx, z - fz))
    t = mask * 2.6 / 0.9
    f = math.floor(t)
    return (f + smoothstep(0.8, 0.98, t - f)) * 0.9


def height(x, z):
    d = path_dist(x, z)
    dl = math.hypot(x - landmark[0], z - landmark[1])
    dd = min([math.hypot(x - q['x'], z - q['z']) for q in districts] + [99])
    # Signed distance to the coast: land hugs the roads and bulges around
    # districts and the landmark; positive inland, negative out to sea.
    shore = TH['island'] + fbm(x, z, 0.09) * 3.2
    cd = max(shore - d, 9 - dd, 12 - dl)
    if TH['surface'] == 'ground':
        # The lunar plain runs past the frame edge instead of ending in a lip.
        cd = radius * 3.2 - math.hypot(x, z)
    hills = max(0.0, fbm(x + 40, z - 15, 0.07, 5)) * TH['hills'] * smoothstep(2.2, 8, d)
    if TH['props'] == 'reef':
        hills = terrace(x, z, d) + max(0.0, fbm(x + 40, z - 15, 0.11, 3)) * 0.12
    inland = PATH_Y - 0.05 + hills * smoothstep(2.0, 5.0, cd)
    if TH['landmark'] == 'volcano':
        # A steep cone with a lava crater at the landmark.
        tall = 8.5 if BOARD == 'crown' else 11.0
        cone = max(0.0, 1 - dl / (11.0 if BOARD == 'crown' else 13.0))
        crater = max(0.0, 1 - dl / 2.6)
        inland += tall * cone ** 1.6 * smoothstep(1.6, 4.0, d) - 2.2 * crater ** 2
    elif TH['landmark'] == 'impact':
        inland += crater_shape(x, z) * smoothstep(1.4, 2.6, d)
        basin = dl / 8.5
        inland += (-1.1 * max(0.0, 1 - basin * basin) + 0.9 * math.exp(-((basin - 1.0) / 0.18) ** 2)) * smoothstep(1.4, 3.0, d)
    shelf = TH['shelf']
    if cd >= shelf:
        h = inland
    elif cd >= 0:
        # Beach (or ash/cliff-top) shelf sloping to the waterline.
        h = TH['sea_level'] + 0.06 + (inland - TH['sea_level'] - 0.06) * smoothstep(0, shelf, cd)
    elif TH['props'] == 'reef':
        # A pale beach ledge at the cliff foot, then a shelving drop to deep water.
        sea = TH['sea_level']
        h = sea + 0.16 - 0.4 * smoothstep(0.8, 3.0, -cd) + (TH['seabed'] - sea) * smoothstep(3.0, 7.0, -cd)
    else:
        drop = 2.0 if TH['surface'] == 'clouds' else 5.5
        h = TH['sea_level'] + 0.06 + (TH['seabed'] - TH['sea_level'] - 0.06) * smoothstep(0, drop, -cd)
    # Roads stay flat and dry.
    h = h + (PATH_Y - 0.02 - h) * (1 - smoothstep(1.2, 2.3, d))
    # Lagoons: carved basins (only away from the roads).
    deep = lagoon_depth(x, z) * smoothstep(1.6, 3.0, d)
    h -= deep * 1.6
    if MESAS:
        h += mesa_lift(x, z)
    # Little sandbar islets out in the sea frame the main island.
    for ix, iz, ir in ISLETS:
        t = math.hypot(x - ix, z - iz) / ir
        if t < 1.8:
            h = max(h, TH['sea_level'] - 0.6 + 1.9 * max(0.0, 1 - t * t) ** 0.6 + fbm(x, z, 0.5, 2) * 0.15)
    return h


ISLETS = []
if TH['props'] == 'reef':
    for k, (ang, dist, r) in enumerate(((-0.35, 1.32, 3.2), (0.55, 1.36, 2.4), (1.25, 1.3, 2.8), (2.3, 1.34, 3.4),
                                         (2.95, 1.3, 2.2), (3.75, 1.36, 3.0), (4.6, 1.33, 2.6), (5.4, 1.3, 2.9))):
        ISLETS.append((math.cos(ang) * radius * dist, math.sin(ang) * radius * dist * 0.92, r))


def mesa_lift(x, z):
    lift = 0.0
    for mx, mz, mr, lv, tiered in MESAS:
        dist = math.hypot(x - mx, z - mz)
        if dist > mr + 1.0:
            continue
        wob = fbm(x, z, 0.45, 2) * 0.45
        lift += lv * (1 - smoothstep(-0.22, 0.22, dist - mr + wob))
        if tiered:
            lift += lv * 0.75 * (1 - smoothstep(-0.2, 0.2, dist - mr * 0.52 + wob * 0.6))
    return lift


# Tiered mesas on the open reef lawns: grassy tops, rock-strata cliffs, some
# with a second tier. Sites are picked on flat ground well clear of the roads,
# the set-piece footprints and the sea pits.
MESAS = []
if TH['props'] == 'reef':
    mrnd = random.Random(77)
    for k in range(3000):
        x, z = mrnd.uniform(-radius, radius), mrnd.uniform(-radius, radius)
        r = mrnd.uniform(1.9, 3.1)
        if path_dist(x, z) < r + 2.5:
            continue
        if any(math.hypot(x - fx, z - fz) < fr + r - 2.5 for fx, fz, fr in FLAT_ZONES):
            continue
        if any(math.hypot(x - mx, z - mz) < r + mr + 3.0 for mx, mz, mr, _, _ in MESAS):
            continue
        ring_ok = all(height(x + math.cos(a) * (r + 0.9), z + math.sin(a) * (r + 0.9)) > PATH_Y - 0.6
                      for a in [i * math.tau / 10 for i in range(10)])
        if not ring_ok or abs(height(x, z) - (PATH_Y - 0.05)) > 0.5:
            continue
        MESAS.append((x, z, r, mrnd.uniform(0.95, 1.35), mrnd.random() < 0.5))
        if len(MESAS) >= 6:
            break
    print('MESAS', [(round(m[0], 1), round(m[1], 1), round(m[2], 1)) for m in MESAS])


# ── Terrain heightfield ─────────────────────────────────────────────────────
size = radius * (3.1 if ISLETS else 4.2 if TH['surface'] == 'ground' else 2.5)
step = 0.65
n = int(size / step)
mesh = bpy.data.meshes.new('Terrain')
bm = bmesh.new()
grid = []
for i in range(n + 1):
    row = []
    for j in range(n + 1):
        x = -size / 2 + j * step
        z = -size / 2 + i * step
        row.append(bm.verts.new(B(x, z, height(x, z))))
    grid.append(row)
for i in range(n):
    for j in range(n):
        bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# An open sheet has no "outside": make every face point up.
for f in bm.faces:
    if f.normal.z < 0:
        f.normal_flip()
# Drop deep seabed faces the camera never sees.
far = [f for f in bm.faces if all(v.co.z < TH['seabed'] + 0.05 for v in f.verts)
       and f.calc_center_median().length > radius * 1.15]
bmesh.ops.delete(bm, geom=far, context='FACES')
bm.to_mesh(mesh)
bm.free()
terrain = bpy.data.objects.new('Terrain', mesh)
bpy.context.scene.collection.objects.link(terrain)
for p in mesh.polygons:
    p.use_smooth = True
mats = {}
layer_assets = {}
for key in ('land', 'beach', 'rock'):
    name, asset = TH[key]
    if isinstance(asset, tuple):  # (scan, dark, light, gamma) → recolored set
        # One output per layer: two layers may recolour the same scan.
        asset = kit.recolor(asset[0], asset[1], asset[2], asset[3], tag=f'{BOARD}_{key}')
    layer_assets[key] = asset
    mats[key] = kit.scanned(name, asset, metal=0.0)
# Splat terrain: per-vertex weights (R sand, G grass, B rock) blended per pixel
# in three.js (game/TerrainMaterial.ts). Noise breaks up every boundary.
terrain.data.materials.append(kit.flat('Terrain', TH['fallback'], rough=0.9))
splat = mesh.color_attributes.new('Splat', 'FLOAT_COLOR', 'POINT')
mesh.color_attributes.active_color = splat
for v in mesh.vertices:
    x, z = v.co.x, -v.co.y
    wobble = fbm(x, z, 0.35, 3) * 0.12
    sand = 1 - smoothstep(TH['sea_level'] + 0.34, TH['sea_level'] + 0.52, v.co.z + wobble)
    if TH['surface'] == 'ground':
        # Dark maria fill crater bowls and the impact basin floor.
        sand = 1 - smoothstep(PATH_Y - 0.55, PATH_Y - 0.2, v.co.z + wobble)
    rock = max(smoothstep(0.86, 0.66, v.normal.z + wobble * 0.5), smoothstep(2.3, 3.0, v.co.z + wobble * 4))
    if TH['props'] == 'reef':
        # Plateau tops stay grassy; only the risers and sea cliffs show rock.
        rock = smoothstep(0.84, 0.62, v.normal.z + wobble * 0.5)
        # Pale sand plazas around the palace and the conch village.
        for (ax, az), (bx, bz) in FOOTPATHS:
            sand = max(sand, 1 - smoothstep(0.75, 1.25, seg_dist(x, z, (ax, az), (bx, bz)) + wobble * 3))
        for px, pz, pr in PLAZAS:
            sand = max(sand, 1 - smoothstep(pr - 1.2, pr + 0.6, math.hypot(x - px, z - pz) + wobble * 6))
        sand *= 1 - rock
    grass = max(0.0, 1 - sand - rock)
    total = sand + grass + rock or 1
    splat.data[v.index].color = (sand / total, grass / total, rock / total, 1.0)
# Export the three layers' maps for the shader (1K WebP).
tex_dir = os.path.join(kit.ROOT, 'public', 'textures', 'terrain', BOARD)
os.makedirs(tex_dir, exist_ok=True)
for key, layer in (('beach', 'sand'), ('land', 'grass'), ('rock', 'rock')):
    asset = layer_assets[key]
    for kind, out in (('Diffuse', 'color'), ('nor_gl', 'normal'), ('arm', 'arm')):
        for res in ('1k', '2k', '4k'):
            src = os.path.join(kit.SOURCE, asset, f'{asset}_{kind}_{res}.jpg')
            if os.path.exists(src):
                break
        img = bpy.data.images.load(src)
        if img.size[0] > 1024:
            img.scale(1024, 1024)
        img.filepath_raw = os.path.join(tex_dir, f'{layer}-{out}.webp')
        img.file_format = 'WEBP'
        bpy.context.scene.render.image_settings.quality = 82
        img.save()
        bpy.data.images.remove(img)
# Lava pool in the volcano's crater (emissive; three.js adds flicker).
if TH['landmark'] == 'volcano':
    lx, lz = landmark
    top = height(lx, lz)
    bpy.ops.mesh.primitive_circle_add(vertices=40, radius=2.1, fill_type='NGON', location=B(lx, lz, top + 0.35))
    lava = bpy.context.active_object
    lava.name = 'LavaPool'
    lava.data.materials.append(kit.flat('Lava', '#ff6a1a', rough=0.4, emit=4.0))
kit.world_uvs(terrain, 3.0)

# Sea plane: water, glowing lava or a soft cloud layer (three.js animates it
# by material name). The open moon plain has none.
if TH['surface'] != 'ground':
    bpy.ops.mesh.primitive_plane_add(size=size * 2.2, location=(0, 0, TH['sea_level']))
    sea = bpy.context.active_object
    sea.name = 'Sea'
    if TH['surface'] == 'lava':
        sea.data.materials.append(kit.flat('LavaSea', TH['water'], rough=0.5, emit=2.4))
    elif TH['surface'] == 'clouds':
        sea.data.materials.append(kit.flat('CloudSea', TH['water'], rough=1.0, alpha=0.92))
    else:
        sea.data.materials.append(kit.flat('Water', TH['water'], rough=0.08, alpha=0.82))
# Crater pools on the moon are frozen ice; elsewhere lagoons share the sea.
if TH['surface'] == 'ground':
    for w in lagoons:
        bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1, fill_type='NGON', location=B(w['x'], w['z'], PATH_Y - 0.55))
        ice = bpy.context.active_object
        ice.name = 'IcePool'
        ice.scale = (w['rx'] + 0.6, w['rz'] + 0.6, 1)
        ice.rotation_euler = (0, 0, w['angle'])
        ice.data.materials.append(kit.flat('Ice', TH['water'], rough=0.05, metal=0.2))

# ── Roads: smooth stone ribbons; gimmick branches use boardwalk planks ──────
def catmull(points, per=6):
    out = []
    pts = [points[0]] + points + [points[-1]]
    for k in range(1, len(pts) - 2):
        p0, p1, p2, p3 = [Vector((q[0], q[1])) for q in pts[k - 1:k + 3]]
        for s in range(per):
            t = s / per
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(Vector(points[-1]))
    return out


def ribbon(name, points, width, y, mat, uv_len=2.2):
    curve = catmull(points)
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    left, right, dist = [], [], 0.0
    for k, p in enumerate(curve):
        a = curve[max(0, k - 1)]
        b = curve[min(len(curve) - 1, k + 1)]
        t = (b - a).normalized()
        nrm = Vector((-t.y, t.x))
        if k:
            dist += (p - curve[k - 1]).length
        left.append((bm.verts.new(B(*(p + nrm * width / 2), y)), dist))
        right.append((bm.verts.new(B(*(p - nrm * width / 2), y)), dist))
    for k in range(len(curve) - 1):
        f = bm.faces.new((left[k][0], right[k][0], right[k + 1][0], left[k + 1][0]))
        for loop, (u, v) in zip(f.loops, ((0, left[k][1]), (1, right[k][1]), (1, right[k + 1][1]), (0, left[k + 1][1]))):
            loop[uv_layer].uv = (u, v / uv_len)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


road_mat = kit.scanned(TH['road'][0], TH['road'][1], metal=0.0)
branch_mat = kit.scanned(TH['branch'][0], TH['branch'][1], metal=0.0)
curb = kit.flat('Curb', '#8f8068', rough=0.9)
roads = []
for road in LAYOUT['roads']:
    pts = [tuple(q) for q in road['points']]
    roads.append(ribbon('Curb', pts, 2.35, PATH_Y - 0.005, curb))
    roads.append(ribbon('Road', pts, 1.95, PATH_Y + 0.012, branch_mat if road['branch'] else road_mat))
road_mesh = kit.join(roads, 'Roads')

# ── Props ───────────────────────────────────────────────────────────────────
props = bpy.data.collections.new('Props')
bpy.context.scene.collection.children.link(props)
occupied = []  # (x, z, r) footprints already used


start = spaces[0]


def clear(x, z, r):
    # Roads are drawn in three.js as raised ribbons ~1.6 either side of the line.
    if path_dist(x, z) < r + 1.9:
        return False
    # Keep the UFO landing site open.
    if math.hypot(x - start['x'], z - start['z']) < 9:
        return False
    if in_lagoon(x, z, 0.6):
        return False
    if height(x, z) < PATH_Y - 0.2:
        return False
    return all(math.hypot(x - ox, z - oz) > r + orr for ox, oz, orr in occupied)


def model_palm():
    bark = kit.scanned('PalmBark', 'palm_bark', metal=0.0)
    leaf = kit.flat('PalmLeaf', '#3f8f3a', rough=0.6)
    leaf_dark = kit.flat('PalmLeafDark', '#2f6f2e', rough=0.6)
    nut = kit.flat('Coconut', '#6b4a2b', rough=0.7)
    parts = []
    # Curved, tapering trunk built from rings.
    pts, radii = [], []
    for k in range(9):
        t = k / 8
        pts.append(Vector((0.55 * t * t, 0, 4.2 * t)))
        radii.append(0.2 - 0.07 * t)
    m = bpy.data.meshes.new('Trunk')
    m.from_pydata(pts, [(k, k + 1) for k in range(8)], [])
    trunk = bpy.data.objects.new('Trunk', m)
    bpy.context.scene.collection.objects.link(trunk)
    trunk.modifiers.new('Skin', 'SKIN')
    for k, r in enumerate(radii):
        trunk.data.skin_vertices[0].data[k].radius = (r, r)
    trunk.data.skin_vertices[0].data[0].use_root = True
    sub = trunk.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 1
    trunk.data.materials.append(bark)
    kit.apply_all(trunk)
    for poly in trunk.data.polygons:
        poly.use_smooth = True
    trunk.data.uv_layers.new(name='UVMap')
    kit.world_uvs(trunk, 0.8)
    parts.append(trunk)
    top = pts[-1]
    # Fronds: an arched rib carrying pairs of drooping leaflets.
    for f in range(9):
        ang = f * math.tau / 9 + random.uniform(-0.15, 0.15)
        lift = random.uniform(-0.25, 0.35)
        bm = bmesh.new()
        dirv = Vector((math.cos(ang), math.sin(ang), 0))
        side = Vector((-math.sin(ang), math.cos(ang), 0))

        def rib(t):
            return top + dirv * (2.8 * t) + Vector((0, 0, (0.9 + lift) * t - 2.0 * t * t))

        steps = 14
        for s in range(steps + 1):
            t = s / steps
            c = rib(t)
            if s < steps:
                c2 = rib((s + 1) / steps)
                for sgn in (-1, 1):
                    # Leaflet: a thin blade angled out and down from the rib.
                    length = 0.85 * math.sin(math.pi * min(1.0, 0.15 + t)) + 0.15
                    tip = c + side * sgn * length + dirv * 0.25 + Vector((0, 0, -0.35 * length))
                    w = (c2 - c) * 0.45
                    v = [bm.verts.new(c), bm.verts.new(c + w), bm.verts.new(tip + w * 0.3), bm.verts.new(tip)]
                    bm.faces.new(v)
        me = bpy.data.meshes.new('Frond')
        bm.to_mesh(me)
        bm.free()
        frond = bpy.data.objects.new('Frond', me)
        bpy.context.scene.collection.objects.link(frond)
        frond.data.materials.append(leaf if f % 2 else leaf_dark)
        for poly in frond.data.polygons:
            poly.use_smooth = True
        parts.append(frond)
    for k in range(3):
        a = k * math.tau / 3
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.17, location=top + Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, -0.25)))
        o = bpy.context.active_object
        o.data.materials.append(nut)
        parts.append(o)
    palm = kit.join(parts, 'Palm')
    return palm


def model_rock(seed):
    rock_mat = mats['rock']
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    rock = bpy.context.active_object
    rock.name = f'Rock{seed}'
    for v in rock.data.vertices:
        d = noise.fractal(v.co * 1.4 + Vector((seed, seed * 2, 0)), 0.5, 2.0, 4)
        v.co *= 1 + 0.35 * d
        v.co.z *= 0.62
    rock.data.materials.append(rock_mat)
    for p in rock.data.polygons:
        p.use_smooth = True
    kit.world_uvs(rock, 1.5)
    return rock


def model_bush():
    leaf = kit.flat('Bush', '#4f9a45', rough=0.75)
    flower = kit.flat('Hibiscus', '#ff5f7a', rough=0.5)
    parts = []
    for k in range(5):
        a = k * 1.3
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.45 + (k % 2) * 0.15, location=(math.cos(a) * 0.4, math.sin(a) * 0.4, 0.35 + (k % 3) * 0.1))
        o = bpy.context.active_object
        o.data.materials.append(leaf)
        parts.append(o)
    for k in range(4):
        a = k * 1.7 + 0.4
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=0.09, location=(math.cos(a) * 0.62, math.sin(a) * 0.62, 0.6))
        o = bpy.context.active_object
        o.data.materials.append(flower)
        parts.append(o)
    bush = kit.join(parts, 'Bush')
    for p in bush.data.polygons:
        p.use_smooth = True
    return bush


# glTF GPU instancing only applies to copies parented to one Empty, so each
# prototype gets a holder; three.js then draws every copy in one call.
holders = {}


def instance(proto, x, z, scale=1.0, rot=None, sink=0.05):
    holder = holders.get(proto.name)
    if holder is None:
        holder = holders[proto.name] = bpy.data.objects.new(proto.name + 'Set', None)
        props.objects.link(holder)
    obj = bpy.data.objects.new(proto.name + 'I', proto.data)
    props.objects.link(obj)
    obj.parent = holder
    obj.location = B(x, z, height(x, z) - sink)
    obj.rotation_euler = (0, 0, random.uniform(0, math.tau) if rot is None else rot)
    obj.scale = (scale,) * 3
    return obj


protos = bpy.data.collections.new('Prototypes')
bpy.context.scene.collection.children.link(protos)


def stash(obj):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    protos.objects.link(obj)
    return obj


def join_parts(parts, name):
    obj = kit.join(parts, name)
    for p in obj.data.polygons:
        p.use_smooth = True
    # The joined mesh lives in the first part's space; bake that transform so
    # the model's origin is its true base (otherwise placing it sinks it by
    # the first part's offset).
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def skin_branches(name, edges, points, radii, mat, subdiv=1):
    """Organic branching shape (coral, dead trees, kelp) from a stick skeleton."""
    m = bpy.data.meshes.new(name)
    m.from_pydata(points, edges, [])
    obj = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(obj)
    obj.modifiers.new('Skin', 'SKIN')
    for k, r in enumerate(radii):
        obj.data.skin_vertices[0].data[k].radius = (r, r)
    obj.data.skin_vertices[0].data[0].use_root = True
    sub = obj.modifiers.new('Sub', 'SUBSURF')
    sub.levels = subdiv
    obj.data.materials.append(mat)
    kit.apply_all(obj)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def branch_tree(name, mat, height_, spread, depth, seed, base_r=0.18):
    """Recursive branching skeleton (coral fronds, charred trees)."""
    rnd = random.Random(seed)
    pts, edges, radii = [Vector((0, 0, 0))], [], [base_r]

    def grow(parent, direction, length, r, level):
        tip = pts[parent] + direction * length
        pts.append(tip)
        radii.append(r)
        idx = len(pts) - 1
        edges.append((parent, idx))
        if level < depth:
            for k in range(2 if level else 3):
                a = rnd.uniform(0, math.tau)
                d = (direction + Vector((math.cos(a), math.sin(a), 0)) * spread).normalized()
                grow(idx, d, length * rnd.uniform(0.6, 0.8), r * 0.68, level + 1)

    grow(0, Vector((0, 0, 1)), height_ * 0.45, base_r * 0.8, 0)
    return skin_branches(name, edges, pts, radii, mat)


def model_crystal(color, emit):
    mat = kit.flat('Crystal', color, rough=0.08, metal=0.1, emit=emit)
    parts = []
    for k in range(5):
        a = k * 1.3
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.22, radius2=0.0, depth=1.0 + (k % 3) * 0.5,
                                        location=(math.cos(a) * 0.25, math.sin(a) * 0.25, 0.4 + (k % 3) * 0.2))
        c = bpy.context.active_object
        c.rotation_euler = (math.cos(a) * 0.4, math.sin(a) * 0.4, a)
        c.data.materials.append(mat)
        parts.append(c)
    return kit.join(parts, 'Crystals')


def model_spire():
    mat = kit.flat('ObsidianGlass', '#1a1520', rough=0.12, metal=0.3)
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=0.7, radius2=0.05, depth=4.2, location=(0, 0, 2.1))
    s = bpy.context.active_object
    s.name = 'Spire'
    for v in s.data.vertices:
        v.co.x += noise.noise(v.co * 2.1) * 0.18
        v.co.y += noise.noise(v.co * 2.3 + Vector((5, 0, 0))) * 0.18
    s.data.materials.append(mat)
    return s


def model_basalt():
    rock_mat = mats['rock']
    parts = []
    for k in range(7):
        a = k * 2.4
        r = 0.0 if k == 0 else 0.62
        h = 1.6 - k * 0.12 + (k % 2) * 0.3
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.34, depth=h, location=(math.cos(a) * r, math.sin(a) * r, h / 2))
        c = bpy.context.active_object
        c.data.materials.append(rock_mat)
        kit.world_uvs(c, 1.0)
        parts.append(c)
    return kit.join(parts, 'Basalt')


def model_vent():
    metal = kit.scanned('VentMetal', 'metal_plate', metal=0.7)
    glow = kit.flat('VentGlow', '#ff7a2e', rough=0.3, emit=4.0)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.38, depth=2.4, location=(0, 0, 1.2))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(metal)
    kit.world_uvs(parts[-1], 0.8)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.4, minor_radius=0.07, location=(0, 0, 2.4))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(glow)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.06, location=(0, 0, 0.9))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(metal)
    return kit.join(parts, 'Vent')


def model_mast():
    metal = kit.scanned('MastMetal', 'metal_plate', metal=0.8)
    beacon = kit.flat('MastBeacon', '#ff4d4d', rough=0.3, emit=5.0)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.07, depth=4.5, location=(0, 0, 2.25))
    parts.append(bpy.context.active_object)
    for k in range(3):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.5 + k * 1.1))
        bar = bpy.context.active_object
        bar.scale = (1.1 - k * 0.25, 0.05, 0.05)
        bar.rotation_euler = (0, 0, k * 0.9)
        parts.append(bar)
    for o in parts:
        o.data.materials.append(metal)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.13, location=(0, 0, 4.55))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(beacon)
    return kit.join(parts, 'Mast')


def model_dish():
    metal = kit.flat('DishWhite', '#e8edf3', rough=0.35, metal=0.3)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.12, depth=1.8, location=(0, 0, 0.9))
    parts.append(bpy.context.active_object)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.4, location=(0, 0, 2.0))
    bowl = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(bowl.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > -0.55], context='VERTS')
    bm.to_mesh(bowl.data)
    bm.free()
    bowl.location = (0, 0, 2.6)
    bowl.rotation_euler = (math.radians(130), 0, 0)
    parts.append(bowl)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.05, depth=1.2, location=(0, -0.5, 2.6))
    parts.append(bpy.context.active_object)
    for o in parts:
        o.data.materials.append(metal)
    return kit.join(parts, 'Dish')


def model_shell(color, name='Shell'):
    mat = kit.flat(name + 'Mat', color, rough=0.35)
    lip = kit.flat('ShellLip', '#fff3f6', rough=0.3)
    parts = []
    for k in range(9):
        t = k / 8
        a = t * math.tau * 1.6
        r = 0.75 * (1 - t) + 0.08
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=r,
                                              location=(math.cos(a) * (1 - t) * 0.5, math.sin(a) * (1 - t) * 0.5, 0.5 + t * 1.6))
        parts.append(bpy.context.active_object)
        parts[-1].data.materials.append(mat if k else lip)
    return join_parts(parts, name)


def model_kelp():
    mat = kit.flat('Kelp', '#3fa58a', rough=0.6)
    pts = [Vector((math.sin(k * 0.9) * 0.25, math.cos(k * 0.7) * 0.15, k * 0.55)) for k in range(10)]
    return skin_branches('Kelp', [(k, k + 1) for k in range(9)], pts, [0.12 - k * 0.008 for k in range(10)], mat)


def model_windmill():
    wood_m = kit.scanned('MillWood', 'brown_planks_05', metal=0.0)
    sail = kit.flat('MillSail', '#fff5f8', rough=0.8)
    parts = []
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=1.0, radius2=0.6, depth=4.0, location=(0, 0, 2.0))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(wood_m)
    kit.world_uvs(parts[-1], 0.8)
    for k in range(4):
        a = k * math.pi / 2 + 0.3
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 1.3, -0.75, 3.9 + math.sin(a) * 1.3))
        blade = bpy.context.active_object
        blade.scale = (2.4, 0.04, 0.5)
        blade.rotation_euler = (0, -a, 0)
        blade.data.materials.append(sail)
        parts.append(blade)
    return kit.join(parts, 'Windmill')


def model_dome():
    shell = kit.scanned('DomePanel', 'metal_plate', metal=0.6)
    glass = kit.flat('DomeWindow', '#9fe6ff', rough=0.1, emit=1.2)
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=1.7, location=(0, 0, 0))
    dome = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.05], context='VERTS')
    bm.to_mesh(dome.data)
    bm.free()
    dome.data.materials.append(shell)
    kit.world_uvs(dome, 0.9)
    parts.append(dome)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.55, minor_radius=0.08, location=(0, 0, 0.75))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(glass)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1.55, 0.5))
    door = bpy.context.active_object
    door.scale = (0.7, 0.5, 1.0)
    door.data.materials.append(shell)
    parts.append(door)
    return join_parts(parts, 'Dome')


def model_anemone():
    body = kit.flat('AnemoneBody', '#c86fd6', rough=0.4)
    tip = kit.flat('AnemoneTip', '#ffd1f0', rough=0.3, emit=1.6)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=2.2, depth=1.6, location=(0, 0, 0.8))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(body)
    for k in range(18):
        a = k * math.tau / 18
        r0 = 1.4 + (k % 3) * 0.3
        pts = [Vector((math.cos(a) * r0, math.sin(a) * r0, 1.4))]
        for s in range(1, 6):
            pts.append(pts[0] + Vector((math.cos(a) * s * 0.35, math.sin(a) * s * 0.35, s * 0.8 - (s * s) * 0.05)))
        t = skin_branches('Tentacle', [(s, s + 1) for s in range(5)], pts, [0.32, 0.28, 0.24, 0.2, 0.16, 0.13], body)
        parts.append(t)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.2, location=pts[-1])
        parts.append(bpy.context.active_object)
        parts[-1].data.materials.append(tip)
    return join_parts(parts, 'Anemone')


def model_lighthouse():
    white = kit.flat('LighthouseWhite', '#f6f3ec', rough=0.6)
    red = kit.flat('LighthouseRed', '#d8404a', rough=0.6)
    lamp = kit.flat('LighthouseLamp', '#fff3b0', rough=0.2, emit=6.0)
    parts = []
    for k in range(5):
        bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=1.1 - k * 0.12, radius2=1.0 - (k + 1) * 0.12, depth=1.4, location=(0, 0, 0.7 + k * 1.4))
        parts.append(bpy.context.active_object)
        parts[-1].data.materials.append(red if k % 2 else white)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.55, depth=0.9, location=(0, 0, 7.45))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(lamp)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.75, radius2=0.0, depth=0.8, location=(0, 0, 8.3))
    parts.append(bpy.context.active_object)
    parts[-1].data.materials.append(red)
    return join_parts(parts, 'Lighthouse')


# ── Reef set-pieces (Nimbus Reef) ───────────────────────────────────────────
# Each landmark has its own silhouette and colour so the board's places read
# at a glance from the overview camera: conch cottages, a stranded treasure
# ship (bank), a giant clam (lottery), a scallop-fan shop, a jellyfish
# lighthouse, a coral arch, a windmill and kites over the kelp beds.


def active():
    return bpy.context.active_object


def subsurf(obj, levels=2):
    mod = obj.modifiers.new('Sub', 'SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    kit.apply_all(obj)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def solidify(obj, thickness, inner_mat=None):
    mod = obj.modifiers.new('Solid', 'SOLIDIFY')
    mod.thickness = thickness
    if inner_mat is not None:
        obj.data.materials.append(inner_mat)
        mod.material_offset = 1
    kit.apply_all(obj)
    return obj


def cyl(r, depth, loc, mat, rot=(0, 0, 0), verts=24, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = active()
    o.data.materials.append(mat)
    return o


def ball(r, loc, mat, scale=(1, 1, 1), seg=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    o = active()
    o.scale = scale
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def box(size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = active()
    o.scale = size
    o.data.materials.append(mat)
    return o


def ring(major, minor, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=32, minor_segments=8)
    o = active()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def text_mesh(body, size, mat, extrude=0.06):
    bpy.ops.object.text_add()
    t = active()
    t.data.body = body
    t.data.size = size
    t.data.extrude = extrude
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    t.data.space_character = 1.05
    t.data.materials.append(mat)
    bpy.ops.object.convert(target='MESH')
    return active()


def apply_xform(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def model_conch(name, body_hex, lip_hex):
    body = kit.flat(name + 'Body', body_hex, rough=0.38)
    lip = kit.flat(name + 'Lip', lip_hex, rough=0.32)
    door_m = kit.flat('ConchDoor', '#4a2d3a', rough=0.7)
    glow = kit.flat('ConchWindow', '#ffe6a0', rough=0.3, emit=2.2)
    parts = []
    n, turns = 40, 2.6
    pts, radii = [], []
    for k in range(n):
        t = k / (n - 1)
        a = t * turns * math.tau
        rc = 0.55 * (1 - t) ** 1.1
        pts.append(Vector((math.cos(a) * rc, math.sin(a) * rc, 0.7 + 2.9 * t ** 0.85)))
        radii.append(1.15 * (1 - t) ** 0.95 + 0.07)
    parts.append(skin_branches(name, [(k, k + 1) for k in range(n - 1)], pts, radii, body, subdiv=2))
    parts.append(ball(1.38, (0, 0, 0.55), body, scale=(1, 1, 0.62), seg=32, rings=16))
    parts.append(ring(1.32, 0.13, (0, 0, 0.32), lip))
    # Round door and porthole windows on the front (-Y faces the camera).
    parts.append(cyl(0.44, 0.3, (0, -1.22, 0.62), door_m, rot=(math.pi / 2, 0, 0), verts=24))
    parts.append(ring(0.47, 0.08, (0, -1.32, 0.62), lip, rot=(math.pi / 2, 0, 0)))
    for s in (-1, 1):
        parts.append(cyl(0.17, 0.2, (s * 0.72, -1.02, 1.35), glow, rot=(math.pi / 2, 0, s * 0.55), verts=16))
        parts.append(ring(0.2, 0.05, (s * 0.76, -1.1, 1.35), lip, rot=(math.pi / 2, 0, s * 0.55)))
    # Pennant on the tip.
    parts.append(cyl(0.04, 1.0, (0, 0, 3.95), lip, verts=8))
    m = bpy.data.meshes.new('Pennant')
    m.from_pydata([(0, 0, 4.4), (0.75, 0, 4.22), (0, 0, 4.02)], [], [(0, 1, 2)])
    pen = bpy.data.objects.new('Pennant', m)
    bpy.context.scene.collection.objects.link(pen)
    pen.data.materials.append(kit.flat('PennantPink', '#ff5fa2', rough=0.6))
    parts.append(pen)
    return join_parts(parts, name)


def model_shipbank():
    wood = kit.scanned('ShipWood', 'brown_planks_05', metal=0.0)
    hullm = kit.flat('ShipHull', '#7a4a33', rough=0.65)
    trim = kit.flat('ShipTrim', '#2f5f86', rough=0.5)
    sail = kit.flat('Sail', '#fff4e6', rough=0.85)
    stripe = kit.flat('SailStripe', '#ff5f8f', rough=0.8)
    glow = kit.flat('ShipWindow', '#ffe6a0', rough=0.3, emit=2.0)
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=1)
    hull = active()
    bm = bmesh.new()
    bm.from_mesh(hull.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.3], context='VERTS')
    for v in bm.verts:
        v.co.x *= 3.3
        v.co.y *= 1.3
        v.co.z *= 1.15
        v.co.z += max(0.0, -v.co.x - 1.6) * 0.22 + max(0.0, v.co.x - 2.2) * 0.25  # sheer
    bm.to_mesh(hull.data)
    bm.free()
    hull.data.materials.append(hullm)
    solidify(hull, 0.12, trim)
    for p in hull.data.polygons:
        p.use_smooth = True
    parts.append(hull)
    deck = box((6.3, 2.35, 0.1), (0, 0, 0.26), wood)
    kit.world_uvs(deck, 1.0)
    parts.append(deck)
    cabin = box((1.5, 2.0, 1.25), (-2.05, 0, 0.9), wood)
    kit.world_uvs(cabin, 1.0)
    parts.append(cabin)
    parts.append(box((1.7, 2.2, 0.14), (-2.05, 0, 1.56), trim))
    for k in (-0.45, 0.0, 0.45):
        parts.append(box((0.26, 0.06, 0.3), (-2.05 + k, -1.02, 1.0), glow))
    parts.append(box((0.3, 0.3, 0.3), (-2.05, 0, 1.78), gold))
    # Mast, yard and a bellied sail with a pink band.
    parts.append(cyl(0.11, 5.0, (0.4, 0, 2.7), hullm, verts=12))
    parts.append(cyl(0.07, 3.0, (0.55, 0, 4.4), hullm, rot=(math.pi / 2, 0, 0), verts=8))
    verts, faces, mats = [], [], []
    W, H = 8, 8
    for j in range(H + 1):
        for i in range(W + 1):
            u, v = i / W, j / H
            verts.append((0.62 + 0.45 * math.sin(math.pi * u) * math.sin(math.pi * (0.2 + 0.8 * v)),
                          (u - 0.5) * 2.7, 1.55 + 2.75 * v))
    for j in range(H):
        for i in range(W):
            a = j * (W + 1) + i
            faces.append((a, a + 1, a + W + 2, a + W + 1))
            mats.append(1 if j in (3, 4) else 0)
    me = bpy.data.meshes.new('Sail')
    me.from_pydata(verts, [], faces)
    sail_obj = bpy.data.objects.new('Sail', me)
    bpy.context.scene.collection.objects.link(sail_obj)
    sail_obj.data.materials.append(sail)
    sail_obj.data.materials.append(stripe)
    for p, mi in zip(sail_obj.data.polygons, mats):
        p.material_index = mi
        p.use_smooth = True
    solidify(sail_obj, 0.03)
    parts.append(sail_obj)
    m = bpy.data.meshes.new('ShipFlag')
    m.from_pydata([(0.4, 0, 5.2), (0.4, -1.0, 4.95), (0.4, 0, 4.7)], [], [(0, 1, 2)])
    flag = bpy.data.objects.new('ShipFlag', m)
    bpy.context.scene.collection.objects.link(flag)
    flag.data.materials.append(stripe)
    parts.append(flag)
    parts.append(kit.strut('Bowsprit', (3.1, 0, 0.6), (4.4, 0, 1.25), 0.08, hullm, 8))
    ship = join_parts(parts, 'ShipHullSet')
    ship.rotation_euler = (0.16, 0.05, 0.0)
    ship.location = (0, 0.2, -0.32)
    apply_xform(ship)
    # Treasure spilling onto the sand in front.
    loot = []
    loot.append(box((1.0, 0.65, 0.55), (1.0, -1.95, 0.27), hullm))
    loot.append(cyl(0.33, 1.0, (1.0, -1.95, 0.55), gold, rot=(0, math.pi / 2, 0), verts=16))
    loot.append(cyl(0.85, 0.5, (-0.5, -2.0, 0.25), gold, verts=24, r2=0.15))
    rnd = random.Random(3)
    for k in range(9):
        a = rnd.uniform(0, math.tau)
        r = rnd.uniform(0.9, 1.7)
        loot.append(cyl(0.2, 0.06, (-0.3 + math.cos(a) * r, -2.0 + math.sin(a) * r * 0.6, 0.04), gold,
                        rot=(rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 0), verts=14))
    return join_parts([ship] + loot, 'ShipBank')


def clam_half(name, outer, inner, upper):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=16, radius=1)
    o = active()
    o.name = name
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.02], context='VERTS')
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        rim = 1 - min(1.0, -v.co.z / 0.9)
        flute = 1 + 0.07 * math.cos(a * 16) * (0.35 + 0.65 * rim)
        v.co.x *= 1.95 * flute
        v.co.y *= 1.65 * flute
        v.co.z *= 0.78
        v.co.z += 0.09 * math.cos(a * 16) * rim
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.append(outer)
    solidify(o, 0.13, inner)
    if upper:
        # Mirror into a lid hinged at the back (+Y), swung open toward the camera.
        hinge = Vector((0, 1.62, 0.0))
        rot = Matrix.Rotation(math.radians(-104), 4, 'X')
        for v in o.data.vertices:
            p = Vector((v.co.x, v.co.y, -v.co.z))
            v.co = (rot @ (p - hinge).to_4d()).to_3d() + hinge
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(o.data)
        bm.free()
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def model_clam():
    outer = kit.flat('ClamOuter', '#8f5cff', rough=0.35)
    inner = kit.flat('ClamInner', '#ffc9ea', rough=0.25)
    pearl = kit.flat('ClamPearl', '#fff2fb', rough=0.08, metal=0.2, emit=1.4)
    sand = kit.flat('ClamSand', '#f6dcc8', rough=0.9)
    parts = [clam_half('ClamLow', outer, inner, False), clam_half('ClamLid', outer, inner, True)]
    for o in parts:
        o.location.z += 0.95
    parts.append(ball(0.72, (0, 0.1, 1.15), pearl, seg=32, rings=16))
    parts.append(ball(2.6, (0, 0, -0.1), sand, scale=(1, 0.95, 0.2), seg=32, rings=12))
    return join_parts(parts, 'GiantClam')


def model_scallop_shop():
    wood = kit.scanned('Wood', 'brown_planks_05', metal=0.0)
    fan = kit.flat('ShopFan', '#ff7fa8', rough=0.35)
    fan_in = kit.flat('ShopFanInner', '#ffd6e4', rough=0.35)
    top = kit.flat('ShopCounterTop', '#2fd3a6', rough=0.4)
    jar_a = kit.flat('ShopJarA', '#7cf3ff', rough=0.1, emit=1.4)
    jar_b = kit.flat('ShopJarB', '#ffd23f', rough=0.1, emit=1.4)
    parts = []
    # Scallop fan backdrop: radial ribs from a hinge at the counter.
    rings_, segs = 6, 40
    verts, faces = [], []
    for j in range(rings_ + 1):
        r = 0.25 + 2.35 * j / rings_
        for i in range(segs + 1):
            a = math.pi * (0.05 + 0.9 * i / segs)
            corr = 0.13 * math.cos(a * 15) * (j / rings_)
            verts.append((math.cos(a) * r * (1 + 0.04 * math.cos(a * 15)), 0.75 + corr, 0.8 + math.sin(a) * r))
    for j in range(rings_):
        for i in range(segs):
            a = j * (segs + 1) + i
            faces.append((a, a + 1, a + segs + 2, a + segs + 1))
    me = bpy.data.meshes.new('ShopFan')
    me.from_pydata(verts, [], faces)
    fo = bpy.data.objects.new('ShopFan', me)
    bpy.context.scene.collection.objects.link(fo)
    fo.data.materials.append(fan)
    solidify(fo, 0.14, fan_in)
    for p in fo.data.polygons:
        p.use_smooth = True
    parts.append(fo)
    c = box((2.6, 1.0, 0.95), (0, -0.25, 0.47), wood)
    kit.world_uvs(c, 0.8)
    parts.append(c)
    parts.append(box((2.8, 1.15, 0.12), (0, -0.25, 1.0), top))
    for k, (x, mat) in enumerate(((-0.8, jar_a), (0.0, jar_b), (0.8, jar_a))):
        parts.append(cyl(0.22, 0.5, (x, -0.35, 1.31), mat, verts=16))
        parts.append(cyl(0.24, 0.08, (x, -0.35, 1.6), wood, verts=16))
    # Striped awning on two posts.
    for x in (-1.3, 1.3):
        parts.append(cyl(0.07, 2.4, (x, -0.85, 1.2), wood, verts=8))
    for k in range(7):
        s = box((0.4, 1.0, 0.07), (-1.2 + k * 0.4, -0.95, 2.35 - 0.02 * abs(k - 3)), cloth_a if k % 2 else cloth_b,
                rot=(-0.32, 0, 0))
        parts.append(s)
    return join_parts(parts, 'ScallopShop')


def model_jelly_lighthouse():
    stone = mats['rock']
    white = kit.flat('JellyTowerWhite', '#fff6f0', rough=0.5)
    pink = kit.flat('JellyTowerPink', '#ff6f9f', rough=0.5)
    rail = kit.flat('JellyRail', '#2f5f86', rough=0.4, metal=0.3)
    lamp = kit.flat('JellyLamp', '#fff1b8', rough=0.2, emit=5.0)
    bell = kit.flat('JellyBell', '#ff9ee4', rough=0.25, emit=1.6)
    tent = kit.flat('JellyTentacle', '#ffc6f1', rough=0.3, emit=1.0)
    parts = []
    base = ball(2.1, (0, 0, 0.1), stone, scale=(1, 1, 0.45), seg=24, rings=12)
    kit.world_uvs(base, 1.2)
    parts.append(base)
    z = 0.7
    for k in range(4):
        r1, r2 = 1.1 - k * 0.12, 1.1 - (k + 1) * 0.12
        parts.append(cyl(r1, 1.35, (0, 0, z + 0.675), white if k % 2 == 0 else pink, verts=28, r2=r2))
        z += 1.35
    parts.append(cyl(1.1, 0.16, (0, 0, z + 0.08), rail, verts=32))
    parts.append(ring(1.02, 0.05, (0, 0, z + 0.55), rail))
    for k in range(10):
        a = k * math.tau / 10
        parts.append(cyl(0.035, 0.5, (math.cos(a) * 1.02, math.sin(a) * 1.02, z + 0.4), rail, verts=6))
    parts.append(cyl(0.52, 0.8, (0, 0, z + 0.55), lamp, verts=20))
    # Jellyfish bell lamp with scalloped rim and drifting tentacles.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=14, radius=1.15, location=(0, 0, z + 0.95))
    b = active()
    bm = bmesh.new()
    bm.from_mesh(b.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.05], context='VERTS')
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        if v.co.z < 0.15:
            v.co.z -= 0.12 * (1 + math.cos(a * 10)) * 0.5
        v.co.z *= 0.8
    bm.to_mesh(b.data)
    bm.free()
    b.data.materials.append(bell)
    solidify(b, 0.08)
    for p in b.data.polygons:
        p.use_smooth = True
    parts.append(b)
    for k in range(8):
        a = k * math.tau / 8 + 0.2
        pts = []
        for s in range(6):
            rr = 0.85 + 0.12 * math.sin(s * 1.3 + k)
            pts.append(Vector((math.cos(a) * rr + math.sin(s * 1.1 + k) * 0.12,
                               math.sin(a) * rr + math.cos(s * 0.9 + k) * 0.12, z + 0.85 - s * 0.32)))
        parts.append(skin_branches('Tentacle', [(s, s + 1) for s in range(5)], pts,
                                   [0.09, 0.08, 0.07, 0.06, 0.05, 0.04], tent))
    parts.append(ball(0.18, (0, 0, z + 2.05), lamp))
    return join_parts(parts, 'JellyLighthouse')


def model_coral_arch(span=2.9, tall=3.1, thick=1.0):
    coral = kit.flat('ArchCoral', '#ff7a52', rough=0.5)
    polyp = kit.flat('ArchPolyp', '#ffd3a8', rough=0.4, emit=0.4)
    n = 22
    pts, radii = [], []
    for k in range(n):
        a = math.pi * k / (n - 1)
        pts.append(Vector((math.cos(a) * span, 0.25 * math.sin(a * 3), -0.2 + math.sin(a) * tall)))
        radii.append((0.62 + 0.25 * abs(math.cos(a)) + 0.08 * math.sin(k * 2.3)) * thick)
    arch = skin_branches('Arch', [(k, k + 1) for k in range(n - 1)], pts, radii, coral, subdiv=2)
    for v in arch.data.vertices:
        v.co += v.normal * noise.noise(v.co * 1.7) * 0.18
    parts = [arch]
    rnd = random.Random(19)
    for k in range(18):
        p = pts[rnd.randrange(3, n - 3)]
        parts.append(ball(rnd.uniform(0.12, 0.22), p + Vector((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.35, 0.35), radii[0] * 0.75)), polyp))
    return join_parts(parts, 'CoralArch')


def model_windmill2():
    white = kit.flat('MillWhite', '#fff4ec', rough=0.55)
    pink = kit.flat('MillPink', '#ff7fa8', rough=0.45)
    wood_m = kit.scanned('MillWood', 'brown_planks_05', metal=0.0)
    sail_m = kit.flat('MillSail', '#ffffff', rough=0.8)
    parts = []
    tower = kit.lathe('MillTower', [(1.2, 0), (1.15, 0.6), (0.95, 2.6), (0.78, 4.0), (0.0, 4.0)], steps=32)
    tower.data.materials.append(white)
    for p in tower.data.polygons:
        p.use_smooth = True
    parts.append(tower)
    for zz in (1.2, 2.7):
        parts.append(cyl(1.13 - zz * 0.07, 0.18, (0, 0, zz), pink, verts=32))
    parts.append(ball(0.95, (0, 0, 4.0), pink, scale=(1, 1, 0.75), seg=24, rings=12))
    parts.append(cyl(0.4, 0.1, (0, -1.13, 0.55), kit.flat('ConchDoor', '#4a2d3a', rough=0.7), rot=(math.pi / 2, 0, 0), verts=16))
    hub = (0, -1.0, 3.75)
    parts.append(cyl(0.2, 0.5, hub, wood_m, rot=(math.pi / 2, 0, 0), verts=12))
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        d = Vector((math.cos(a), 0, math.sin(a)))
        tip = Vector(hub) + d * 2.6 + Vector((0, -0.1, 0))
        parts.append(kit.strut('MillArm', hub, tip, 0.06, wood_m, 6))
        side = Vector((-d.z, 0, d.x))
        c = Vector(hub) + d * 1.65 + side * 0.3 + Vector((0, -0.12, 0))
        s = box((0.55, 0.03, 1.8), c, sail_m, rot=(0, -a + math.pi / 2, 0))
        parts.append(s)
    return join_parts(parts, 'Windmill')


def model_kite(color, tail_color, seed):
    rnd = random.Random(seed)
    kite_m = kit.flat(f'Kite{seed}', color, rough=0.6)
    tail_m = kit.flat(f'KiteTail{seed}', tail_color, rough=0.6)
    pole_m = kit.flat('KitePole', '#3fa58a', rough=0.6)
    string_m = kit.flat('KiteString', '#fff6e8', rough=0.8)
    parts = []
    top = Vector((0, 0, 2.6))
    parts.append(cyl(0.09, 2.6, (0, 0, 1.3), pole_m, verts=8))
    kite = Vector((rnd.uniform(-1.2, 1.2), rnd.uniform(0.5, 1.5), rnd.uniform(5.6, 7.0)))
    me = bpy.data.meshes.new('KiteSail')
    me.from_pydata([(0, 0, 1.2), (0.9, 0, 0.1), (0, 0, -1.35), (-0.9, 0, 0.1)], [], [(0, 1, 2, 3)])
    ko = bpy.data.objects.new('KiteSail', me)
    bpy.context.scene.collection.objects.link(ko)
    ko.data.materials.append(kite_m)
    ko.location = kite
    ko.rotation_euler = (0.5, 0, rnd.uniform(-0.3, 0.3))
    solidify(ko, 0.04)
    apply_xform(ko)
    parts.append(ko)
    parts.append(kit.strut('KiteLine', top, kite + Vector((0, -0.2, -0.6)), 0.018, string_m, 4))
    for k in range(5):
        parts.append(box((0.32, 0.05, 0.18), kite + Vector((math.sin(k * 1.4) * 0.3, 0.1 * k, -1.55 - k * 0.45)),
                         tail_m, rot=(0, 0, k * 0.7)))
    return join_parts(parts, f'Kite{seed}')


def coral_tree(name, color, tip_color, height_, seed, depth=3, base_r=0.3, spread=0.8):
    rnd = random.Random(seed)
    mat = kit.flat(name, color, rough=0.45)
    tip_m = kit.flat(name + 'Tip', tip_color, rough=0.35, emit=0.35)
    pts, edges, radii, tips = [Vector((0, 0, 0))], [], [base_r], []

    def grow(parent, direction, length, r, level):
        tip = pts[parent] + direction * length
        pts.append(tip)
        radii.append(r)
        idx = len(pts) - 1
        edges.append((parent, idx))
        if level < depth:
            for k in range(2 if level else 3):
                a = rnd.uniform(0, math.tau)
                d = (direction + Vector((math.cos(a), math.sin(a), 0)) * spread).normalized()
                d.z = max(d.z, 0.35)
                grow(idx, d.normalized(), length * rnd.uniform(0.62, 0.8), r * 0.7, level + 1)
        else:
            tips.append((tip, r))

    grow(0, Vector((0, 0, 1)), height_ * 0.36, base_r * 0.85, 0)
    parts = [skin_branches(name, edges, pts, radii, mat)]
    for p, r in tips:
        parts.append(ball(r * 1.9 + 0.05, p, tip_m, seg=10, rings=6))
    return join_parts(parts, name)


def model_brain(color):
    mat = kit.flat('BrainCoral', color, rough=0.55)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=0.95)
    o = active()
    for v in o.data.vertices:
        c = v.co
        v.co = c * (1 + 0.07 * math.sin(c.x * 9 + math.sin(c.y * 7) * 2) * math.cos(c.y * 8 + c.z * 3))
        v.co.z = max(v.co.z * 0.72, -0.1)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    o.name = 'Brain'
    return o


def model_tubes(color, lip_color):
    mat = kit.flat('TubeSponge', color, rough=0.5)
    lip = kit.flat('TubeLip', lip_color, rough=0.4)
    inner = kit.flat('TubeInner', '#3b2257', rough=0.8)
    parts = []
    for k, (x, y, h, r) in enumerate(((0, 0, 1.9, 0.3), (0.5, 0.2, 1.3, 0.24), (-0.42, 0.28, 1.05, 0.22), (0.12, -0.45, 0.8, 0.2), (-0.35, -0.3, 1.45, 0.23))):
        parts.append(cyl(r, h, (x, y, h / 2), mat, verts=16, r2=r * 1.15))
        parts.append(ring(r * 1.12, 0.06, (x, y, h), lip))
        parts.append(cyl(r * 1.0, 0.02, (x, y, h - 0.02), inner, verts=16))
    return join_parts(parts, 'Tubes')


def fluted(name, profile, mat, flutes=12, depth=0.07, loc=(0, 0, 0), steps=48):
    """Lathe with scalloped flutes (shell roofs, palace walls)."""
    o = kit.lathe(name, profile, steps=steps)
    for v in o.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        k = 1 + depth * math.cos(a * flutes)
        v.co.x *= k
        v.co.y *= k
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    o.location = loc
    return o


def spiral_spire(name, base_r, height_, turns, mat, loc):
    """Conch-shell spire: a tapering skin tube wound around the axis."""
    n = 44
    pts, radii = [], []
    for k in range(n):
        t = k / (n - 1)
        a = t * turns * math.tau
        rc = base_r * 0.42 * (1 - t) ** 1.1
        pts.append(Vector((math.cos(a) * rc, math.sin(a) * rc, height_ * t ** 0.9)))
        radii.append(base_r * (1 - t) ** 0.95 + 0.06)
    o = skin_branches(name, [(k, k + 1) for k in range(n - 1)], pts, radii, mat, subdiv=2)
    o.location = loc
    return o


def model_coral_palace():
    """Tide Heart: the reef's hero landmark, a tiered shell palace crowned by a
    conch spire and a glowing pearl, ringed by fluted turrets."""
    plinth_m = kit.flat('PalacePlinth', '#ff7f86', rough=0.6)
    wall_m = kit.flat('PalaceWall', '#ffe3ea', rough=0.5)
    trim_m = kit.flat('PalaceTrim', '#fffaf4', rough=0.35)
    spire_m = kit.flat('PalaceSpire', '#ff7fae', rough=0.35)
    roofs = [kit.flat('PalaceRoofTeal', '#1fc2c2', rough=0.35), kit.flat('PalaceRoofViolet', '#8a63ff', rough=0.35),
             kit.flat('PalaceRoofCoral', '#ff5f7e', rough=0.35)]
    door_m = kit.flat('PalaceDoor', '#5a2a4a', rough=0.7)
    glow = kit.flat('PalaceWindow', '#ffe6a0', rough=0.3, emit=2.4)
    pearl = kit.flat('PalacePearl', '#fff4fd', rough=0.06, metal=0.15, emit=1.6)
    banner = kit.flat('PalaceBanner', '#ff4f9a', rough=0.7)
    parts = []
    # Two-step coral plinth with a front stair.
    parts.append(fluted('PalaceBase', [(5.4, 0.0), (5.45, 0.25), (5.15, 0.5), (0.0, 0.5)], plinth_m, flutes=18, depth=0.03))
    for k in range(3):
        parts.append(box((2.6 - k * 0.25, 0.7, 0.22), (0, -5.55 + k * 0.45 + 0.35, 0.11 + k * 0.17), trim_m))
    # Fluted curtain wall with scalloped battlements.
    parts.append(fluted('PalaceWall', [(3.75, 0.5), (3.6, 1.9), (3.85, 2.05), (3.85, 2.3), (0.0, 2.3)], wall_m, flutes=20, depth=0.025))
    for k in range(22):
        a = k * math.tau / 22
        parts.append(ball(0.36, (math.cos(a) * 3.72, math.sin(a) * 3.72, 2.32), trim_m, scale=(1, 0.55, 0.9), seg=12, rings=8))
        parts[-1].rotation_euler = (0, 0, a + math.pi / 2)
    # Gate with a gold shell arch, banners either side.
    parts.append(box((1.5, 0.5, 1.45), (0, -3.6, 1.2), door_m))
    parts.append(ball(0.75, (0, -3.62, 1.92), door_m, scale=(1, 0.33, 0.85), seg=20, rings=10))
    parts.append(ring(0.98, 0.13, (0, -3.78, 1.55), gold, rot=(math.pi / 2, 0, 0)))
    for s in (-1, 1):
        parts.append(box((0.62, 0.08, 1.15), (s * 1.75, -3.7, 1.35), banner, rot=(0, 0, s * 0.12)))
        parts.append(ball(0.16, (s * 1.75, -3.78, 1.85), gold))
    # Central keep and its conch spire, crowned with the pearl.
    parts.append(fluted('PalaceKeep', [(2.25, 2.3), (2.05, 3.0), (1.8, 5.2), (2.1, 5.35), (2.1, 5.65), (0.0, 5.65)], wall_m, flutes=14, depth=0.03))
    parts.append(ring(2.12, 0.1, (0, 0, 5.62), gold))
    for k in range(6):
        a = math.pi * 1.5 + (k - 2.5) * 0.42
        parts.append(box((0.38, 0.18, 0.62), (math.cos(a) * 1.93, math.sin(a) * 1.93, 4.15 - (k % 2) * 0.9), glow, rot=(0, 0, a + math.pi / 2)))
    parts.append(spiral_spire('PalaceSpire', 1.75, 3.9, 3.2, spire_m, (0, 0, 5.6)))
    parts.append(ring(0.55, 0.09, (0, 0, 9.55), gold))
    for k in range(6):
        a = k * math.tau / 6
        parts.append(cyl(0.09, 0.5, (math.cos(a) * 0.52, math.sin(a) * 0.52, 9.85), gold, verts=6, r2=0.0))
    parts.append(ball(0.62, (0, 0, 10.2), pearl, seg=32, rings=16))
    # Four fluted turrets on the wall, each with a coloured shell roof and pennant.
    for k, a in enumerate((math.radians(-130), math.radians(-50), math.radians(40), math.radians(140))):
        x, y = math.cos(a) * 3.75, math.sin(a) * 3.75
        tall = 3.9 + (k % 2) * 0.7
        parts.append(fluted(f'Turret{k}', [(0.95, 0.5), (0.85, 0.8), (0.8, tall), (1.02, tall + 0.12), (1.02, tall + 0.35), (0.0, tall + 0.35)],
                            wall_m, flutes=10, depth=0.04, loc=(x, y, 0)))
        roof_m = roofs[k % 3]
        parts.append(fluted(f'TurretRoof{k}', [(1.25, 0.0), (0.95, 0.35), (0.6, 0.9), (0.25, 1.55), (0.0, 2.05)],
                            roof_m, flutes=10, depth=0.09, loc=(x, y, tall + 0.3)))
        parts.append(box((0.3, 0.12, 0.45), (x * 1.205, y * 1.205, tall - 0.6), glow, rot=(0, 0, a + math.pi / 2)))
        parts.append(cyl(0.04, 0.9, (x, y, tall + 2.7), trim_m, verts=6))
        m = bpy.data.meshes.new('PalacePennant')
        m.from_pydata([(x, y, tall + 3.12), (x + 0.85, y, tall + 2.95), (x, y, tall + 2.75)], [], [(0, 1, 2)])
        pen = bpy.data.objects.new('PalacePennant', m)
        bpy.context.scene.collection.objects.link(pen)
        pen.data.materials.append(banner)
        solidify(pen, 0.03)
        parts.append(pen)
    # Coral growing up the plinth at the back corners.
    for k, (a, col, tip, h) in enumerate(((2.3, '#ff8f2e', '#fff0b3', 3.0), (0.9, '#16bfb8', '#c9fff7', 2.7),
                                          (3.5, '#b48cff', '#efe6ff', 2.4))):
        c = coral_tree(f'PalaceCoral{k}', col, tip, h, 70 + k, depth=3, base_r=0.26)
        c.location = (math.cos(a) * 4.7, math.sin(a) * 4.7, 0.3)
        parts.append(c)
    return join_parts(parts, 'CoralPalace')


# ── Theme prop sets ─────────────────────────────────────────────────────────
rocks = [stash(model_rock(s)) for s in range(3)]
# (prototype, clearance, max count, scale range, sink)
flora = []
if TH['props'] == 'tropical':
    flora = [(stash(model_palm()), 2.9, 110, (0.8, 1.15), 0.1), (stash(model_bush()), 0.8, 140, (0.7, 1.1), 0.05)]
elif TH['props'] == 'lunar':
    flora = [(stash(model_crystal('#7cf3ff', 1.4)), 1.0, 40, (0.6, 1.3), 0.1)]
elif TH['props'] == 'volcanic':
    dead = kit.flat('Charred', '#231c1e', rough=0.9)
    flora = [(stash(model_spire()), 1.5, 28, (0.6, 1.4), 0.2),
             (stash(model_basalt()), 1.2, 30, (0.7, 1.3), 0.15),
             (stash(branch_tree('DeadTree', dead, 3.2, 0.7, 2, 3, 0.16)), 1.6, 34, (0.8, 1.2), 0.05),
             (stash(model_crystal('#ff8a3d', 2.2)), 1.0, 26, (0.5, 1.0), 0.1)]
elif TH['props'] == 'reef':
    coral_colors = ['#ff8fb8', '#b48cff', '#6fd3e6', '#ffb35c']
    corals = [stash(branch_tree(f'Coral{k}', kit.flat(f'Coral{k}', c, rough=0.45), 2.6, 0.9, 2, 10 + k, 0.2))
              for k, c in enumerate(coral_colors)]
    flora = [(c, 1.3, 26, (0.7, 1.3), 0.05) for c in corals]
    flora += [(stash(model_shell('#f7c6dd')), 1.2, 18, (0.6, 1.1), 0.1), (stash(model_kelp()), 0.8, 36, (0.8, 1.4), 0.05)]

# Landmark first so scatter keeps clear of it.
occupied.append((landmark[0], landmark[1], 9.0))
for q in districts:
    occupied.append((q['x'], q['z'], 2.5))

# Buildings beside special spaces, set back from the road and facing it.
wood = kit.scanned('Wood', 'brown_planks_05', metal=0.0)
roof = kit.scanned('RoofTiles', 'clay_roof_tiles_02', metal=0.0)
cloth_a = kit.flat('CanopyA', TH['canopy'][0], rough=0.85)
cloth_b = kit.flat('CanopyB', TH['canopy'][1], rough=0.85)
gold = kit.flat('GoldTrim', '#f2c14e', rough=0.3, metal=1.0)
stone = kit.scanned('Stone', TH['road'][1], metal=0.0)
buildings = []


def beside(space, back=3.4, r=2.2, inward=False):
    """Find a clear spot next to a space, preferring the outside of the board."""
    sx, sz = space['x'], space['z']
    base = math.atan2(-sz, -sx) if inward else math.atan2(sz, sx)
    for k in range(24):
        a = base + (k % 2 * 2 - 1) * (k // 2) * 0.35
        for dist in (back, back + 1.2, back + 2.4):
            x, z = sx + math.cos(a) * dist, sz + math.sin(a) * dist
            if clear(x, z, r):
                return x, z, math.atan2(sx - x, sz - z)
    return None


def place_obj(obj, x, z, face, scale=1.0):
    obj.location = B(x, z, height(x, z))
    obj.rotation_euler = (0, 0, face)
    obj.scale = (scale,) * 3
    return obj


def stall(x, z, face):
    parts = []
    for dx in (-0.9, 0.9):
        for dz in (-0.6, 0.6):
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.06, depth=1.8, location=(dx, dz, 0.9))
            parts.append(bpy.context.active_object)
            parts[-1].data.materials.append(wood)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.35, 0.55))
    counter = bpy.context.active_object
    counter.scale = (1.9, 0.5, 0.9)
    counter.data.materials.append(wood)
    kit.world_uvs(counter, 0.8)
    parts.append(counter)
    for k in range(6):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.8 + k * 0.32, 0, 1.95 - abs(k - 2.5) * 0.02))
        stripe = bpy.context.active_object
        stripe.scale = (0.32, 1.5, 0.06)
        stripe.rotation_euler = (0.18, 0, 0)
        stripe.data.materials.append(cloth_a if k % 2 else cloth_b)
        parts.append(stripe)
    return place_obj(kit.join(parts, 'Stall'), x, z, face)


def hut(x, z, face, scale=1.0):
    if TH['props'] == 'lunar':
        return place_obj(model_dome(), x, z, face, scale)
    if TH['props'] == 'reef':
        return place_obj(model_shell('#ffd9e8', 'ShellHouse'), x, z, face, scale * 1.6)
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.75))
    body = bpy.context.active_object
    body.scale = (2.0, 1.6, 1.5)
    body.data.materials.append(stone if TH['props'] == 'volcanic' else wood)
    kit.world_uvs(body, 1.0)
    parts.append(body)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.9, radius2=0.05, depth=1.4, location=(0, 0, 2.15))
    rf = bpy.context.active_object
    rf.rotation_euler = (0, 0, math.pi / 4)
    rf.scale = (1.15, 0.95, 1)
    rf.data.materials.append(roof)
    kit.world_uvs(rf, 1.2)
    parts.append(rf)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.81, 0.55))
    door = bpy.context.active_object
    door.scale = (0.5, 0.04, 0.9)
    door.data.materials.append(kit.flat('Door', '#4b2f22', rough=0.8))
    parts.append(door)
    return place_obj(kit.join(parts, 'Hut'), x, z, face, scale)


def bank(x, z, face):
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.9))
    body = bpy.context.active_object
    body.scale = (2.2, 1.8, 1.8)
    body.data.materials.append(stone)
    kit.world_uvs(body, 1.2)
    parts.append(body)
    for dx in (-0.8, -0.27, 0.27, 0.8):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.12, depth=1.7, location=(dx, -1.0, 0.85))
        parts.append(bpy.context.active_object)
        parts[-1].data.materials.append(cloth_b)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.75, radius2=0.0, depth=0.8, location=(0, 0, 2.2))
    tri = bpy.context.active_object
    tri.rotation_euler = (0, 0, math.pi / 4)
    tri.scale = (1.0, 0.8, 1)
    tri.data.materials.append(gold)
    parts.append(tri)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.35, depth=0.08, location=(0, -1.02, 2.0), rotation=(math.pi / 2, 0, 0))
    coin = bpy.context.active_object
    coin.data.materials.append(gold)
    parts.append(coin)
    return place_obj(kit.join(parts, 'Bank'), x, z, face)


def spot_near(x, z, r, reach=12.0):
    """Nearest clear spot to (x, z), searching outward in rings."""
    for ring_i in range(int(reach / 0.7) + 1):
        d = ring_i * 0.7
        count = max(1, ring_i * 7)
        for k in range(count):
            a = k / count * math.tau + ring_i * 0.37
            px, pz = x + math.cos(a) * d, z + math.sin(a) * d
            if clear(px, pz, r):
                return px, pz
    return None


# Blender Z-rotation that turns a front (-Y) toward the overview camera.
FACE_CAMERA = 0.1


def sign(text, x, z, plank_hex, width=3.4):
    """A tilted plank sign facing the overview camera."""
    plank = kit.flat('Sign' + text, plank_hex, rough=0.45)
    letters = kit.flat('SignLetters', '#ffffff', rough=0.35, emit=0.25)
    post = kit.flat('SignPost', '#5a3a2a', rough=0.7)
    tilt = math.radians(55)
    h = 1.5
    normal = Vector((0, -math.cos(tilt), math.sin(tilt)))
    parts = [box((width, 0.14, 1.15), (0, 0, h), plank, rot=(-tilt, 0, 0))]
    edge = kit.flat('SignEdge', '#173a63', rough=0.5)
    parts.append(box((width + 0.22, 0.1, 1.37), Vector((0, 0, h)) - normal * 0.04, edge, rot=(-tilt, 0, 0)))
    t = text_mesh(text, 0.82, letters, extrude=0.03)
    t.rotation_euler = (math.pi / 2 - tilt, 0, 0)
    t.location = Vector((0, 0, h)) + normal * 0.09
    apply_xform(t)
    parts.append(t)
    for sx in (-width * 0.36, width * 0.36):
        parts.append(cyl(0.07, h, (sx, 0.1, h / 2), post, verts=8))
    obj = join_parts(parts, 'Sign' + text)
    place_obj(obj, x, z, FACE_CAMERA)
    return obj


# ── Set dressing shared by the island boards ────────────────────────────────
# Small cottages in clusters, lamps along the roads, flower beds by the road
# edges and boats out at sea: instanced, so each adds only a few draw calls.


def cottage_clusters(protos, hubs, scale=(0.6, 0.78), per=2, seed=31):
    crnd = random.Random(seed)
    count = 0
    for hx, hz in hubs:
        placed = 0
        for k in range(60):
            a, r = crnd.uniform(0, math.tau), crnd.uniform(3.5, 9.0)
            x, z = hx + math.cos(a) * r, hz + math.sin(a) * r
            h = height(x, z)
            level = max(abs(height(x + 0.9, z) - h), abs(height(x - 0.9, z) - h), abs(height(x, z + 0.9) - h), abs(height(x, z - 0.9) - h))
            if h > PATH_Y - 0.1 and level < 0.25 and clear(x, z, 1.4):
                instance(protos[count % len(protos)], x, z, crnd.uniform(*scale), rot=FACE_CAMERA + crnd.uniform(-0.6, 0.6), sink=0.05)
                occupied.append((x, z, 1.4))
                count += 1
                placed += 1
                if placed >= per:
                    break
    print('COTTAGES', count)


def road_lamps(proto, offset=2.05):
    lamps = 0
    for road in LAYOUT['roads']:
        pts = road['points']
        for k in range(1, len(pts) - 1, 2):
            (ax, az), (bx, bz) = pts[k], pts[k + 1]
            dx, dz = bx - ax, bz - az
            ln = math.hypot(dx, dz) or 1
            side = 1 if (k // 2) % 2 else -1
            x = (ax + bx) / 2 + (-dz / ln) * offset * side
            z = (az + bz) / 2 + (dx / ln) * offset * side
            if path_dist(x, z) < 1.85 or height(x, z) < PATH_Y - 0.15 or math.hypot(x - start['x'], z - start['z']) < 6:
                continue
            if any(math.hypot(x - ox, z - oz) < orr + 0.3 for ox, oz, orr in occupied):
                continue
            instance(proto, x, z, 1.0, sink=0.02)
            occupied.append((x, z, 0.4))
            lamps += 1
    print('LAMPS', lamps)


def flower_beds(leaf_hex, petals, count=46, seed=57):
    bed_leaf = kit.flat('BedLeaf', leaf_hex, rough=0.8)
    beds = []
    for k, petal_hex in enumerate(petals):
        petal = kit.flat(f'BedPetal{k}', petal_hex, rough=0.5)
        frnd = random.Random(90 + k)
        parts = [ball(0.95, (0, 0, 0), bed_leaf, scale=(1, 0.75, 0.34), seg=16, rings=8)]
        for j in range(11):
            a, r = frnd.uniform(0, math.tau), frnd.uniform(0.0, 0.72)
            parts.append(ball(0.16, (math.cos(a) * r, math.sin(a) * r * 0.75, 0.25 + frnd.uniform(0, 0.06)), petal,
                              scale=(1, 1, 0.6), seg=8, rings=5))
        beds.append(stash(join_parts(parts, f'FlowerBed{k}')))
    brnd = random.Random(seed)
    placed = 0
    for k in range(4000):
        x, z = brnd.uniform(-radius * 1.1, radius * 1.1), brnd.uniform(-radius * 1.1, radius * 1.1)
        pd = path_dist(x, z)
        if not 2.5 < pd < 4.2 or height(x, z) < PATH_Y - 0.1 or in_lagoon(x, z, 0.5):
            continue
        if math.hypot(x - start['x'], z - start['z']) < 7:
            continue
        if any(math.hypot(x - ox, z - oz) < orr + 0.9 for ox, oz, orr in occupied):
            continue
        instance(beds[placed % len(beds)], x, z, brnd.uniform(0.8, 1.15), sink=0.08)
        occupied.append((x, z, 0.9))
        placed += 1
        if placed >= count:
            break
    print('BEDS', placed)


def sailboats(spots):
    boat_hull = kit.flat('BoatHull', '#ff5f6e', rough=0.45)
    boat_trim = kit.flat('BoatTrim', '#fff4ea', rough=0.4)
    boat_sail = kit.flat('BoatSail', '#ffffff', rough=0.8)
    boat_flag = kit.flat('BoatFlag', '#ffd23f', rough=0.6)
    parts = [ball(1.0, (0, 0, 0), boat_hull, scale=(2.1, 0.85, 0.62), seg=24, rings=12),
             ring(0.98, 0.07, (0, 0, 0.42), boat_trim),
             cyl(0.06, 3.6, (0.2, 0, 2.2), boat_trim, verts=8)]
    parts[1].scale = (1.6, 0.66, 1)
    for verts_, mat_ in ((((0.32, 0, 0.8), (0.32, 0, 3.9), (1.9, 0, 0.8)), boat_sail),
                         (((0.08, 0, 0.9), (0.08, 0, 3.3), (-1.4, 0, 0.9)), boat_sail),
                         (((0.2, 0, 4.0), (0.2, 0.0, 3.6), (-0.6, 0, 3.8)), boat_flag)):
        me = bpy.data.meshes.new('BoatSailMesh')
        me.from_pydata(list(verts_), [], [(0, 1, 2)])
        so = bpy.data.objects.new('BoatSailPart', me)
        bpy.context.scene.collection.objects.link(so)
        so.data.materials.append(mat_)
        solidify(so, 0.04)
        parts.append(so)
    boat = stash(join_parts(parts, 'Sailboat'))
    for ang, dist, yaw in spots:
        bx_, bz_ = math.cos(ang) * radius * dist, math.sin(ang) * radius * dist * 0.92
        b_ = instance(boat, bx_, bz_, 1.25, rot=yaw)
        b_.location.z = TH['sea_level'] - 0.18


if TH['props'] == 'reef':
    # District centres are free for the set-pieces; each claims its own footprint.
    occupied[:] = [o for o in occupied if o[2] != 2.5]

    def put(obj, x, z, r, face=FACE_CAMERA, scale=1.0):
        place_obj(obj, x, z, face, scale)
        buildings.append(obj)
        occupied.append((x, z, r))
        return obj

    for space in spaces:
        kind = space['type']
        if kind not in ('shop', 'bank', 'lottery'):
            continue
        r = {'bank': 5.0, 'lottery': 3.7, 'shop': 2.8}[kind]
        # The bank ship sits inland of its space so the overview sees it whole.
        spot = beside(space, back=r + 2.0, r=r, inward=kind == 'bank') or beside(space, back=r + 2.0, r=r)
        if not spot:
            print('NO ROOM for', kind, space['id'])
            continue
        x, z, _ = spot
        if kind == 'bank':
            # Turned three-quarters to the camera so hull, deck and sail all show.
            obj = put(model_shipbank(), x, z, r, face=FACE_CAMERA + 0.7, scale=1.65)
            label, hue = 'BANK', '#f2a91e'
        elif kind == 'lottery':
            obj = put(model_clam(), x, z, r, scale=1.6)
            label, hue = 'LOTTO', '#e04fb4'
        else:
            obj = put(model_scallop_shop(), x, z, r, scale=1.3)
            label, hue = 'SHOP', '#14b386'
        obj.name = {'bank': 'Bank', 'lottery': 'Lottery', 'shop': 'Shop'}[kind]
        # Sign in front (toward the camera), else to either side; only the
        # road and other buildings block it.
        for ox, oz in ((0.3, r + 0.5), (r + 0.9, 0.6), (-r - 0.9, 0.6), (0.3, -r - 0.6)):
            px, pz = x + ox, z + oz
            if path_dist(px, pz) > 2.3 and height(px, pz) > PATH_Y - 0.15 and \
                    all(math.hypot(px - a, pz - b) > c + 0.6 for a, b, c in occupied[:-1]):
                buildings.append(sign(label, px, pz, hue))
                occupied.append((px, pz, 1.0))
                break
        else:
            print('NO SIGN for', kind)

    conch_colors = [('#ffb3c7', '#fff1e6', 1.15), ('#ffd08a', '#fff6e0', 1.0), ('#c9b3ff', '#f6f0ff', 1.25)]
    kite_colors = [('#ffd23f', '#ff5f8f'), ('#38d6ff', '#ffd23f'), ('#ff6f9f', '#8f6bff')]
    for q in districts:
        kind, qx, qz = q['kind'], q['x'], q['z']
        if kind == 'heart':
            put(model_coral_palace(), qx, qz, 7.6, face=FACE_CAMERA, scale=1.32)
        elif kind == 'village':
            for k, (body_hex, lip_hex, sc) in enumerate(conch_colors):
                sc *= 1.3
                a = k * 2.1 + 0.4
                s = spot_near(qx + math.cos(a) * 2.6, qz + math.sin(a) * 2.6, 1.6 * sc)
                if s:
                    put(model_conch(f'Conch{k}', body_hex, lip_hex), s[0], s[1], 1.7 * sc,
                        face=FACE_CAMERA + random.uniform(-0.4, 0.4), scale=sc)
        elif kind == 'mist':
            s = spot_near(qx, qz, 2.8)
            if s:
                put(model_jelly_lighthouse(), s[0], s[1], 3.0, scale=1.4)
        elif kind == 'arch':
            s = spot_near(qx, qz, 4.2)
            if s:
                put(model_coral_arch(span=2.9, tall=4.0, thick=0.75), s[0], s[1], 4.4, face=FACE_CAMERA + 0.35, scale=1.4)
        elif kind == 'windmill':
            s = spot_near(qx, qz, 3.2)
            if s:
                put(model_windmill2(), s[0], s[1], 3.4, scale=1.65)
        elif kind == 'kelp':
            for k, (kc, tc) in enumerate(kite_colors):
                s = spot_near(qx + math.cos(k * 2.1) * 3.0, qz + math.sin(k * 2.1) * 3.0, 0.8)
                if s:
                    put(model_kite(kc, tc, 50 + k), s[0], s[1], 1.0, face=FACE_CAMERA + random.uniform(-0.5, 0.5),
                        scale=1.9)
    # Shell cottages: little clusters of conch homes around the districts and
    # shops, so every corner of the reef reads as lived-in.
    cottage_clusters([stash(model_conch('Cottage0', '#ffc2d4', '#fff4ea')), stash(model_conch('Cottage1', '#ffe2a6', '#fff8ea'))],
                     [(q['x'], q['z']) for q in districts if q['kind'] in ('village', 'mist', 'windmill', 'arch', 'kelp')] +
                     [(s['x'], s['z']) for s in spaces if s['type'] in ('shop', 'lottery')])

for space in (spaces if TH['props'] != 'reef' else []):
    kind = space['type']
    if kind not in ('shop', 'bank', 'lottery'):
        continue
    spot = beside(space)
    if not spot:
        continue
    x, z, face = spot
    blender_face = -face  # three Y-rotation → Blender Z-rotation
    if kind == 'bank':
        buildings.append(bank(x, z, blender_face))
    else:
        b = stall(x, z, blender_face)
        b.name = 'Lottery' if kind == 'lottery' else 'Shop'
        buildings.append(b)
    occupied.append((x, z, 2.4))

# District landmarks and village buildings.
for q in (districts if TH['props'] != 'reef' else []):
    kind = q['kind']
    special = {'lighthouse': model_lighthouse, 'observatory': model_dome, 'windmill': model_windmill,
               'vents': model_vent, 'heart': model_anemone}.get(kind)
    if special and (kind == 'heart' or clear(q['x'], q['z'], 1.5)):
        obj = special()
        place_obj(obj, q['x'], q['z'], random.uniform(0, math.tau), 2.2 if kind == 'observatory' else 1.0)
        buildings.append(obj)
    for k in range(2):
        a = random.uniform(0, math.tau)
        x, z = q['x'] + math.cos(a) * 4.5, q['z'] + math.sin(a) * 4.5
        if clear(x, z, 2.0):
            buildings.append(hut(x, z, -math.atan2(q['x'] - x, q['z'] - z), random.uniform(0.85, 1.1)))
            occupied.append((x, z, 2.2))
if TH['props'] == 'tropical':
    hut_proto = stash(hut(0.0, 0.0, 0.0))
    hut_proto.name = 'CottageHut'
    cottage_clusters([hut_proto], [(q['x'], q['z']) for q in districts if q['kind'] != 'volcano'] +
                     [(s['x'], s['z']) for s in spaces if s['type'] in ('shop', 'lottery')], scale=(0.62, 0.8))
    torch_pole = kit.flat('TorchPole', '#7a4a2b', rough=0.7)
    torch_wrap = kit.flat('TorchWrap', '#e8c27a', rough=0.8)
    torch_flame = kit.flat('TorchFlame', '#ffb02e', rough=0.3, emit=4.0)
    road_lamps(stash(join_parts([cyl(0.07, 1.7, (0, 0, 0.85), torch_pole, verts=8),
                                 cyl(0.15, 0.32, (0, 0, 1.78), torch_wrap, verts=10, r2=0.19),
                                 cyl(0.15, 0.42, (0, 0, 2.15), torch_flame, verts=10, r2=0.0)], 'TikiTorch')))
    flower_beds('#3f8f3a', ('#ff5f7a', '#ffd23f', '#ffffff'), count=40)
    sailboats(((0.15, 1.3, 0.6), (3.3, 1.28, -0.4), (4.1, 1.3, 1.9)))

# Theme set-pieces: moon masts and a dish; volcano vents; harbor-side huts.
if TH['props'] == 'lunar':
    mast, dish = stash(model_mast()), stash(model_dish())
    for k in range(10):
        q = random.choice(districts)
        a = random.uniform(0, math.tau)
        x, z = q['x'] + math.cos(a) * 6, q['z'] + math.sin(a) * 6
        if clear(x, z, 1.0):
            instance(dish if k % 4 == 0 else mast, x, z, random.uniform(0.9, 1.2), sink=0.0)
            occupied.append((x, z, 1.2))
if TH['props'] == 'volcanic':
    vent = stash(model_vent())
    for k in range(14):
        x, z = random.uniform(-radius, radius), random.uniform(-radius, radius)
        if clear(x, z, 1.2):
            instance(vent, x, z, random.uniform(0.8, 1.2), sink=0.1)
            occupied.append((x, z, 1.2))

# Reef: deliberate clumps instead of an even sprinkle. Each clump has one hero
# (big branching coral, brain coral or tube sponges) ringed by small accents;
# a few low accents line the road edges like flower beds.
if TH['props'] == 'reef':
    heroes = [stash(coral_tree('HeroCoral0', '#ff4f9a', '#ffd1e6', 3.8, 41)),
              stash(coral_tree('HeroCoral1', '#8a5cff', '#e6dbff', 3.4, 42)),
              stash(coral_tree('HeroCoral2', '#ff8f2e', '#fff0b3', 3.6, 43)),
              stash(coral_tree('HeroCoral3', '#16bfb8', '#c9fff7', 3.2, 44)),
              stash(model_brain('#ffb347')),
              stash(model_tubes('#a46bff', '#ffd1f0'))]
    shell_proto = stash(model_shell('#f7c6dd'))
    kelp_proto = stash(model_kelp())
    accents = corals + corals + [shell_proto, kelp_proto] + rocks
    rnd = random.Random(23)
    # Palace gardens: big hero corals framing the plaza's back and sides.
    lx, lz = landmark
    for k, a in enumerate((-2.6, -2.0, -1.35, -0.6, 0.1, 2.75, 3.4)):
        x, z = lx + math.cos(a) * 9.6, lz + math.sin(a) * 9.6
        if path_dist(x, z) > 3.0 and not in_lagoon(x, z, 0.8) and height(x, z) > PATH_Y - 0.12:
            instance(heroes[k % len(heroes)], x, z, rnd.uniform(1.3, 1.6), sink=0.05)
            occupied.append((x, z, 1.6))
    centres = []
    anchors = [(q['x'], q['z']) for q in districts] + [(s['x'], s['z']) for s in spaces if s['type'] in ('shop', 'bank', 'lottery')]
    for k in range(6000):
        x, z = rnd.uniform(-radius * 1.1, radius * 1.1), rnd.uniform(-radius * 1.1, radius * 1.1)
        h = height(x, z)
        if h < PATH_Y - 0.12 or path_dist(x, z) < 3.4:
            continue
        # Clumps gather around the districts; open lawns stay open between them.
        if min(math.hypot(x - ax, z - az) for ax, az in anchors) > 12 and rnd.random() < 0.75:
            continue
        if any(math.hypot(x - cx, z - cz) < 5.2 for cx, cz in centres) or not clear(x, z, 1.4):
            continue
        centres.append((x, z))
        if len(centres) >= 32:
            break
    for i, (cx, cz) in enumerate(centres):
        hero = heroes[i % len(heroes)]
        instance(hero, cx, cz, rnd.uniform(0.9, 1.3), sink=0.05)
        occupied.append((cx, cz, 1.4))
        for j in range(rnd.randint(3, 5)):
            a, r = rnd.uniform(0, math.tau), rnd.uniform(1.4, 2.6)
            x, z = cx + math.cos(a) * r, cz + math.sin(a) * r
            if height(x, z) < PATH_Y - 0.12 or not clear(x, z, 0.45):
                continue
            proto = rnd.choice(accents)
            small = proto in rocks
            instance(proto, x, z, rnd.uniform(0.45, 0.8) if small else rnd.uniform(0.8, 1.15), sink=0.2 if small else 0.05)
            occupied.append((x, z, 0.7))
    for road in LAYOUT['roads']:
        pts = road['points']
        for k in range(2, len(pts) - 2, 4):
            if rnd.random() > 0.35:
                continue
            (ax, az), (bx, bz) = pts[k], pts[k + 1]
            dx, dz = bx - ax, bz - az
            ln = math.hypot(dx, dz) or 1
            side = rnd.choice((-1, 1))
            for m_ in range(2):
                off = 2.45 + m_ * 0.55
                x = ax + (-dz / ln) * off * side + (dx / ln) * m_ * 0.6
                z = az + (dx / ln) * off * side + (dz / ln) * m_ * 0.6
                if height(x, z) > PATH_Y - 0.12 and clear(x, z, 0.3):
                    instance(rnd.choice(corals + [shell_proto]), x, z, rnd.uniform(0.45, 0.7), sink=0.05)
                    occupied.append((x, z, 0.5))
    for k, (ix, iz, ir) in enumerate(ISLETS):
        instance(heroes[k % 4], ix, iz, rnd.uniform(0.75, 1.0), sink=0.1)
        for j in range(3):
            a = rnd.uniform(0, math.tau)
            x, z = ix + math.cos(a) * ir * 0.5, iz + math.sin(a) * ir * 0.5
            instance(rnd.choice(corals + rocks), x, z, rnd.uniform(0.4, 0.7), sink=0.15)
    # A coral arch the left-hand road runs through (decor only; it spans the
    # widest gap between two spaces so no space sits under it).
    sa, sb = spaces[19], spaces[20]
    ax_, az_ = sa['x'] + (sb['x'] - sa['x']) * 0.42, sa['z'] + (sb['z'] - sa['z']) * 0.42
    rdx, rdz = sb['x'] - sa['x'], sb['z'] - sa['z']
    rl = math.hypot(rdx, rdz) or 1
    road_arch = model_coral_arch(span=2.75, tall=4.3, thick=0.62)
    road_arch.name = 'RoadArch'
    place_obj(road_arch, ax_, az_, math.atan2(-rdx, -rdz), 1.0)
    buildings.append(road_arch)
    for s_ in (-1, 1):
        occupied.append((ax_ - rdz / rl * 2.67 * s_, az_ + rdx / rl * 2.67 * s_, 1.0))
    for (fax, faz), (fbx, fbz) in FOOTPATHS:
        steps_ = int(math.hypot(fbx - fax, fbz - faz)) + 1
        for k in range(steps_ + 1):
            occupied.append((fax + (fbx - fax) * k / steps_, faz + (fbz - faz) * k / steps_, 0.9))
    # Pearl lamp posts line the roads, alternating sides.
    lamp_post = kit.flat('LampPost', '#fff4ea', rough=0.4)
    lamp_cup = kit.flat('LampCup', '#ff7fae', rough=0.35)
    lamp_light = kit.flat('LampPearl', '#fff1c4', rough=0.2, emit=3.0)
    road_lamps(stash(join_parts([cyl(0.2, 0.18, (0, 0, 0.09), lamp_cup, verts=12),
                                 cyl(0.06, 1.55, (0, 0, 0.85), lamp_post, verts=8),
                                 cyl(0.08, 0.26, (0, 0, 1.68), lamp_cup, verts=12, r2=0.24),
                                 ball(0.17, (0, 0, 1.9), lamp_light, seg=12, rings=8)], 'PearlLamp')))
    flower_beds('#2f9a5a', ('#ff5fa2', '#ffd23f', '#ffffff'))
    sailboats(((0.15, 1.38, 0.6), (3.35, 1.36, -0.4), (4.15, 1.34, 1.9)))
    flora = []

# Scatter flora and rocks.
counts = [0] * len(flora)
boulders = 0 if TH['props'] != 'reef' else 999
for k in range(3000):
    x = random.uniform(-radius * 1.15, radius * 1.15)
    z = random.uniform(-radius * 1.15, radius * 1.15)
    h = height(x, z)
    if h < PATH_Y - 0.15 or h > 3.0:
        continue
    roll = random.random()
    if flora and roll < 0.7:
        i = random.randrange(len(flora))
        proto, clearance, limit, (lo, hi), sink = flora[i]
        if counts[i] < limit and clear(x, z, clearance):
            instance(proto, x, z, random.uniform(lo, hi), sink=sink)
            occupied.append((x, z, max(0.8, clearance * 0.5)))
            counts[i] += 1
    elif roll < 0.82 and boulders < (90 if TH['props'] == 'lunar' else 45) and clear(x, z, 1.0):
        instance(random.choice(rocks), x, z, random.uniform(0.45, 1.2), sink=0.25)
        occupied.append((x, z, 1.0))
        boulders += 1
# Shoreline boulders (or floating islets under a sky island).
for k in range(500):
    a = random.uniform(0, math.tau)
    r = random.uniform(radius * 0.4, radius * 1.15)
    x, z = math.cos(a) * r, math.sin(a) * r
    h = height(x, z)
    near_shore = TH['sea_level'] - 0.6 < h < TH['sea_level'] + 0.1
    if near_shore and path_dist(x, z) > 3 and not in_lagoon(x, z) and random.random() < (0.12 if TH['surface'] == 'clouds' else 0.35):
        islet = instance(random.choice(rocks), x, z, random.uniform(0.35, 0.8), sink=0.35)
        if TH['surface'] == 'clouds':
            # Sea stacks at the cliff foot (three.js draws an ocean here).
            islet.location.z = TH['sea_level'] - 0.3
            islet.scale = (random.uniform(0.8, 1.8),) * 3


# Hide prototypes from export.
bpy.context.scene.collection.children.unlink(protos)

for obj in list(bpy.context.scene.collection.all_objects):
    obj.select_set(True)
# 1K textures keep each board download to a few MB.
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
os.makedirs(kit.MODELS, exist_ok=True)
path = os.path.join(kit.MODELS, f'board-{BOARD}.glb')
bpy.ops.export_scene.gltf(
    filepath=path,
    export_format='GLB',
    export_apply=True,
    export_image_format='WEBP',
    export_image_quality=80,
    export_vertex_color='ACTIVE',
    export_gpu_instances=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
)
print('EXPORTED', path, os.path.getsize(path), 'bytes')

# Overview render.
kit.preview(f'board-{BOARD}', [('overview', (0, -radius * 1.55, radius * 1.25), 32)], target=(0, 0, 0), size=1100, ground=False)