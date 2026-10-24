import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

W, H = 2400, 1500
OUT = sys.argv[1]
rng = np.random.default_rng(7)

# --- type -------------------------------------------------------------
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Black.ttf", 430)
im = Image.new("L", (W, H), 0)
dr = ImageDraw.Draw(im)
lines = ["Idan", "Segev"]
lh = 400
y0 = H / 2 - lh
for i, t in enumerate(lines):
    bb = dr.textbbox((0, 0), t, font=font)
    x = (W - (bb[2] - bb[0])) / 2 - bb[0]
    dr.text((x, y0 + i * lh - bb[1] + 20), t, font=font, fill=255)
ink0 = np.asarray(im, np.float32) / 255.0

YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def noise(sigma, amp=1.0):
    n = nd.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), sigma)
    return n / (n.std() + 1e-6) * amp


def fbm():
    return noise(40, 0.5) + noise(14, 0.3) + noise(4, 0.2)


def curve(ctrl, n=600):
    # Catmull-Rom through control points
    P = np.array(ctrl, np.float32)
    P = np.vstack([P[0], P, P[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n // (len(P) - 3), endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.array(out)


def field(pts):
    """distance to the centreline, arc-length at the nearest point, unit direction away from it"""
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    L = s[-1]
    # dense raster of the centreline
    dense = []
    dens = []
    for i in range(len(pts) - 1):
        k = max(2, int(seg[i] * 2))
        for t in np.linspace(0, 1, k, endpoint=False):
            dense.append(pts[i] * (1 - t) + pts[i + 1] * t)
            dens.append(s[i] + seg[i] * t)
    dense = np.array(dense)
    dens = np.array(dens)
    xi = np.clip(np.round(dense[:, 0]).astype(int), 0, W - 1)
    yi = np.clip(np.round(dense[:, 1]).astype(int), 0, H - 1)
    occ = np.ones((H, W), bool)
    occ[yi, xi] = False
    simg = np.zeros((H, W), np.float32)
    simg[yi, xi] = dens / L
    d, (iy, ix) = nd.distance_transform_edt(occ, return_indices=True)
    u = simg[iy, ix]
    dx = XX - ix
    dy = YY - iy
    dd = np.maximum(d, 1e-3)
    return d.astype(np.float32), u, dx / dd, dy / dd, ix, iy, L


def width(u, base, tip_end=1.0):
    taper = np.clip(u / 0.06, 0, 1) ** 0.5 * np.clip((1 - u) / 0.04, 0, 1) ** 0.4
    taper = 0.35 + 0.65 * taper
    swell = 1 + 0.18 * np.sin(u * 17.0) + 0.1 * np.sin(u * 41.0 + 1.3)
    return base * taper * swell * (1 + (tip_end - 1) * u ** 6)


blur_ink = nd.gaussian_filter(ink0, 14)


def dried(img_ink, pts, base, reach=0.22, seed=0):
    """water laid along pts, now dry: ink lifted inside, pushed to a dark rim"""
    d, u, nx, ny, ix, iy, L = field(pts)
    w = width(u, base) * (1 + 0.09 * fbm())
    inside = d < w
    # ink carried along the stroke (drag): running max with decay over arc length
    m = 900
    us = np.linspace(0, 1, m)
    cp = np.stack([np.interp(us, np.linspace(0, 1, len(pts)), pts[:, 0]), np.interp(us, np.linspace(0, 1, len(pts)), pts[:, 1])], 1)
    local = nd.map_coordinates(nd.gaussian_filter(img_ink, base * 0.5), [cp[:, 1], cp[:, 0]], order=1)
    carried = np.zeros(m)
    c = 0.0
    decay = np.exp(-(1.0 / m) / reach)
    for i in range(m):
        c = max(c * decay, local[i])
        carried[i] = c
    car = np.interp(u, us, carried).astype(np.float32)
    here = nd.gaussian_filter(img_ink, 6)
    lifted = np.clip(np.maximum(here, car * 0.75), 0, 1)
    # rim: thin dark line at the inner edge, softer inner gradient
    e = np.clip(w - d, 0, None)
    rim = np.exp(-(e / 3.2) ** 2) * 1.0 + np.exp(-(e / 9.0) ** 2) * 0.35
    rim_ink = np.clip(lifted * 2.2, 0, 1) * rim
    tide = 0.07 * np.exp(-(e / 2.0) ** 2)  # faint line even on bare paper
    gran = 1 + noise(2.5, 0.12) + noise(18, 0.15)
    wash = (img_ink * 0.26 + lifted * 0.08 + car * 0.05) * gran
    new = np.maximum(wash, np.maximum(rim_ink, tide))
    # feather: pigment creeping a few px past the edge where there was ink
    out_e = np.clip(d - w, 0, None)
    feather = lifted * 0.35 * np.exp(-out_e / 3.0) * (out_e > 0) * (d < w + 14)
    res = img_ink.copy()
    res[inside] = new[inside]
    res = np.maximum(res, feather * (~inside))
    return res


def wet(img_ink, pts, base, drop=1.9, K=1.25):
    """a bead of clear water with a pooled drop at the tip: a height field that refracts what is under it"""
    d, u, nx, ny, ix, iy, L = field(pts)
    w = base * (0.55 + 0.45 * np.clip(u / 0.12, 0, 1)) * (1 + 0.08 * np.sin(u * 13.0))
    hb = 0.42 * w * np.sqrt(np.clip(1 - (d / w) ** 2, 0, 1))
    tx, ty = pts[-1]
    R = base * drop
    dt = np.hypot(XX - tx, YY - ty)
    hd = R * 0.55 * np.sqrt(np.clip(1 - (dt / R) ** 2, 0, 1))
    Hh = nd.gaussian_filter(np.maximum(hb, hd), 1.5)  # smooth union of bead and drop
    gy, gx = np.gradient(Hh)
    g = np.hypot(gx, gy)
    cap = np.minimum(g, 1.6) / np.maximum(g, 1e-6)
    gx, gy = gx * cap, gy * cap
    # magnify: sample uphill, toward the middle of the water
    ox, oy = gx * Hh * K, gy * Hh * K
    under = 1 - img_ink
    ref = nd.map_coordinates(under, [YY + oy, XX + ox], order=1, mode="nearest")
    # shading from the surface normal, light from top-left
    nz = 1 / np.sqrt(1 + gx ** 2 + gy ** 2)
    Nx, Ny = -gx * nz, -gy * nz
    lx, ly, lz = -0.45, -0.6, 0.66
    hx, hy, hz = lx, ly, lz + 1
    hn = np.sqrt(hx * hx + hy * hy + hz * hz)
    spec = np.clip((Nx * hx + Ny * hy + nz * hz) / hn, 0, 1) ** 90
    edge = np.exp(-(Hh / 2.5) ** 2)  # thin dark meniscus where the water is shallow
    tilt = 1 - nz
    a = np.clip(Hh / 1.2, 0, 1)  # antialiased coverage
    wetc = ref * 0.99 * (1 - 0.55 * edge * a) * (1 - 0.12 * tilt)
    wetc = wetc + (1 - wetc) * spec * 0.95
    out = under * (1 - a) + wetc * a
    # soft shadow beside the water, away from the light
    sh = nd.shift(nd.gaussian_filter(np.clip(Hh, 0, 1), 6), (8, 6), order=1)
    out = out * (1 - 0.06 * sh * (1 - a))
    return 1 - out


S = 1.0
loop1 = curve([(380, 560), (620, 300), (980, 250), (1200, 470), (1080, 700), (820, 660), (760, 470), (960, 380), (1360, 520), (1700, 380), (1950, 300)])
swoosh = curve([(260, 1260), (620, 1090), (1040, 1010), (1500, 960), (1900, 880), (2180, 700)])
wetline = curve([(2080, 1340), (1760, 1200), (1540, 1010), (1440, 830), (1380, 660)])

ink = ink0.copy()
ink = dried(ink, loop1, 22, reach=0.3)
ink = dried(ink, swoosh, 28, reach=0.18)
ink = wet(ink, wetline, 50)

img = np.clip(1 - ink, 0, 1)
Image.fromarray((img * 255).astype(np.uint8), "L").save(OUT)
print("ok", OUT)
