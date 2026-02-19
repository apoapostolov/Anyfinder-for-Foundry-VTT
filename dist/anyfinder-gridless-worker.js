const NODE_BUDGET = 20000;
const MAX_STEP = 320;
const sceneStepCache = new Map();

function d2(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return dx * dx + dy * dy;
}
function pointInside(p, r) {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}
function pointToSegD2(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return d2(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return d2(p, { x: a.x + t * dx, y: a.y + t * dy });
}
function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function segIntersect(a, b, c, d) {
  const eps = 1e-9;
  const o1 = cross(a, b, c);
  const o2 = cross(a, b, d);
  const o3 = cross(c, d, a);
  const o4 = cross(c, d, b);
  const between = (x, y, z) => Math.min(x, y) - eps <= z && z <= Math.max(x, y) + eps;
  if (Math.abs(o1) < eps && Math.abs(o2) < eps && Math.abs(o3) < eps && Math.abs(o4) < eps) {
    return (between(a.x, b.x, c.x) && between(a.y, b.y, c.y)) ||
      (between(a.x, b.x, d.x) && between(a.y, b.y, d.y)) ||
      (between(c.x, d.x, a.x) && between(c.y, d.y, a.y)) ||
      (between(c.x, d.x, b.x) && between(c.y, d.y, b.y));
  }
  return o1 * o2 <= eps && o3 * o4 <= eps;
}
function segSegD2(a, b, c, d) {
  if (segIntersect(a, b, c, d)) return 0;
  return Math.min(pointToSegD2(a, c, d), pointToSegD2(b, c, d), pointToSegD2(c, a, b), pointToSegD2(d, a, b));
}
function pointBlocked(p, walls, clearance, rect, guard, tol) {
  if (!pointInside(p, rect)) return true;
  const c = Math.max(0, clearance - tol);
  if (c <= 0) return false;
  const cd2 = c * c;
  const eg = Math.max(0, c + guard);
  const egd2 = eg * eg;
  for (const w of walls) {
    if (pointToSegD2(p, w.a, w.b) <= cd2) return true;
    if (guard > 0 && (d2(p, w.a) <= egd2 || d2(p, w.b) <= egd2)) return true;
  }
  return false;
}
function edgeBlocked(a, b, edgeCache, clearance, walls, rect, guard, tol) {
  if (!pointInside(a, rect) || !pointInside(b, rect)) return true;
  const c = Math.max(0, clearance - tol);
  if (c <= 0) return false;
  const key = `${a.x.toFixed(2)},${a.y.toFixed(2)}|${b.x.toFixed(2)},${b.y.toFixed(2)}|${c.toFixed(2)}|${guard.toFixed(2)}`;
  if (edgeCache.has(key)) return edgeCache.get(key);
  const c2 = c * c;
  const eg = Math.max(0, c + guard);
  const eg2 = eg * eg;
  for (const w of walls) {
    const s2 = segSegD2(a, b, w.a, w.b);
    if (s2 <= c2 || (guard > 0 && (pointToSegD2(w.a, a, b) <= eg2 || pointToSegD2(w.b, a, b) <= eg2))) {
      edgeCache.set(key, true);
      return true;
    }
  }
  edgeCache.set(key, false);
  return false;
}
function getSceneStepData(payload, stepRequested) {
  const scene = payload.scene;
  const keyBase = `${scene.sceneId}|${scene.wallRevision}|${scene.rect.x}:${scene.rect.y}:${scene.rect.width}:${scene.rect.height}`;
  let step = stepRequested;
  let cols;
  let rows;
  while (true) {
    cols = Math.floor(scene.rect.width / step) + 1;
    rows = Math.floor(scene.rect.height / step) + 1;
    if (cols * rows <= NODE_BUDGET || step >= MAX_STEP) break;
    step = Math.min(MAX_STEP, step + 16);
  }
  const key = `${keyBase}|${step}`;
  if (sceneStepCache.has(key)) return sceneStepCache.get(key);
  const nodes = new Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      nodes[idx] = {
        x: scene.rect.x + x * step,
        y: scene.rect.y + y * step
      };
    }
  }
  const data = {
    sceneRect: scene.rect,
    walls: scene.walls,
    cols,
    rows,
    step,
    nodes,
    walkMaskByKey: new Map(),
    walkGraphByKey: new Map(),
    segmentPathCache: new Map()
  };
  sceneStepCache.set(key, data);
  return data;
}
function getWalkMask(data, clearance, guard, tol) {
  const key = `${clearance.toFixed(2)}|${guard.toFixed(2)}|${tol.toFixed(2)}`;
  if (data.walkMaskByKey.has(key)) return data.walkMaskByKey.get(key);
  const mask = new Uint8Array(data.nodes.length);
  for (let i = 0; i < data.nodes.length; i++) {
    mask[i] = pointBlocked(data.nodes[i], data.walls, clearance, data.sceneRect, guard, tol) ? 0 : 1;
  }
  data.walkMaskByKey.set(key, mask);
  return mask;
}
function getWalkGraph(data, clearance, guard, tol) {
  const key = `${clearance.toFixed(2)}|${guard.toFixed(2)}|${tol.toFixed(2)}`;
  if (data.walkGraphByKey.has(key)) return data.walkGraphByKey.get(key);
  const mask = getWalkMask(data, clearance, 0, tol);
  const edgeBits = new Uint8Array(data.nodes.length);
  const dirs = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const ec = new Map();
  for (let idx = 0; idx < data.nodes.length; idx++) {
    if (!mask[idx]) continue;
    const x = idx % data.cols;
    const y = Math.floor(idx / data.cols);
    let bits = 0;
    for (let d = 0; d < dirs.length; d++) {
      const dx = dirs[d][0];
      const dy = dirs[d][1];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= data.cols || ny >= data.rows) continue;
      const nidx = ny * data.cols + nx;
      if (!mask[nidx]) continue;
      // Prevent diagonal corner-cutting through tight/curved wall pinch points.
      if (dx !== 0 && dy !== 0) {
        const ix1 = x + dx;
        const iy1 = y;
        const ix2 = x;
        const iy2 = y + dy;
        if (ix1 < 0 || iy1 < 0 || ix1 >= data.cols || iy1 >= data.rows) continue;
        if (ix2 < 0 || iy2 < 0 || ix2 >= data.cols || iy2 >= data.rows) continue;
        const i1 = iy1 * data.cols + ix1;
        const i2 = iy2 * data.cols + ix2;
        if (!mask[i1] || !mask[i2]) continue;
      }
      if (!edgeBlocked(data.nodes[idx], data.nodes[nidx], ec, clearance, data.walls, data.sceneRect, guard, tol)) bits |= 1 << d;
    }
    edgeBits[idx] = bits;
  }
  const g = { mask, edgeBits };
  data.walkGraphByKey.set(key, g);
  return g;
}
function nearestNodeIdx(mask, point, nodes) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (!mask[i]) continue;
    const v = d2(point, nodes[i]);
    if (v < bestD) {
      bestD = v;
      best = i;
    }
  }
  return best;
}
function nearestCandidates(mask, point, nodes, blockFn, cols, rows, step, rect) {
  const r = Math.max(2, Math.ceil(step / 14));
  const cx = Math.round((point.x - rect.x) / step);
  const cy = Math.round((point.y - rect.y) / step);
  const out = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const idx = y * cols + x;
      if (!mask[idx]) continue;
      if (!blockFn(nodes[idx])) out.push(idx);
    }
  }
  if (out.length) return out;
  const all = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!mask[i]) continue;
    all.push({ i, d: d2(point, nodes[i]) });
  }
  all.sort((a, b) => a.d - b.d);
  const fb = [];
  for (const it of all) {
    if (!blockFn(nodes[it.i])) fb.push(it.i);
    if (fb.length >= 24) break;
  }
  return fb;
}
function simplifyPath(path, edgeCache, clearance, ctx, guard, tol) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && edgeBlocked(path[i], path[j], edgeCache, clearance, ctx.walls, ctx.sceneRect, guard, tol)) j--;
    out.push(path[j]);
    i = j;
  }
  return out;
}
function segmentKey(data, a, b, clearance, graphGuard) {
  const q = Math.max(4, Math.min(24, data.step * 0.2));
  const ax = Math.round(a.x / q), ay = Math.round(a.y / q), bx = Math.round(b.x / q), by = Math.round(b.y / q);
  return `${data.step}|${data.cols}x${data.rows}|c:${clearance.toFixed(2)}|g:${graphGuard.toFixed(2)}|${ax},${ay}->${bx},${by}`;
}
function solveSegment(payload, data, from0, to0, opt) {
  const settings = payload.settings;
  const allowSqueeze = !!settings.gridlessAllowSqueeze;
  const leeway = Number(settings.gridlessSqueezeLeewayPx) || 0;
  const minClear = Number(settings.gridlessMinCenterClearancePx) || 0;
  const exactTol = Number(settings.gridlessExactFitTolerancePx) || 0;
  const tokenRadius = Number(payload.token.radiusPx) || 0;
  const cornerExtra = Number(payload.token.cornerExtraPx) || 0;
  const clearance = Math.max(minClear, tokenRadius - (allowSqueeze ? leeway : 0));
  const endpointGuard = Math.max(0, Math.min(cornerExtra, clearance * 0.35));
  const graphGuard = 0;
  const graph = getWalkGraph(data, clearance, graphGuard, exactTol);
  const ec = new Map();
  const ctx = { walls: data.walls, sceneRect: data.sceneRect };
  let from = from0;
  let to = to0;
  const startBlocked = pointBlocked(from, data.walls, clearance, data.sceneRect, endpointGuard, exactTol);
  const goalBlocked = pointBlocked(to, data.walls, clearance, data.sceneRect, endpointGuard, exactTol);
  if (startBlocked) {
    const idx = nearestNodeIdx(graph.mask, from, data.nodes);
    if (idx < 0) return { path: null, reason: "start_blocked_no_node" };
    from = data.nodes[idx];
  }
  if (goalBlocked) {
    const idx = nearestNodeIdx(graph.mask, to, data.nodes);
    if (idx < 0) return { path: null, reason: "goal_blocked_no_node" };
    to = data.nodes[idx];
  }
  if (!startBlocked && !goalBlocked && !edgeBlocked(from0, to0, ec, clearance, data.walls, data.sceneRect, endpointGuard, exactTol)) {
    return { path: [from0, to0], reason: null };
  }
  const ck = segmentKey(data, from, to, clearance, graphGuard);
  const cached = data.segmentPathCache.get(ck);
  if (cached && Array.isArray(cached) && cached.length >= 2) {
    const copy = cached.map((p) => ({ x: p.x, y: p.y }));
    copy[0] = { x: from0.x, y: from0.y };
    copy[copy.length - 1] = { x: to0.x, y: to0.y };
    return { path: copy, reason: null };
  }
  const startAttach = nearestCandidates(graph.mask, from, data.nodes, (p) => edgeBlocked(from, p, ec, clearance, data.walls, data.sceneRect, endpointGuard, exactTol), data.cols, data.rows, data.step, data.sceneRect);
  const goalAttach = nearestCandidates(graph.mask, to, data.nodes, (p) => edgeBlocked(to, p, ec, clearance, data.walls, data.sceneRect, endpointGuard, exactTol), data.cols, data.rows, data.step, data.sceneRect);
  if (!startAttach.length || !goalAttach.length) return { path: null, reason: !startAttach.length ? "no_attach_start" : "no_attach_goal" };

  const n = data.cols * data.rows;
  const START = n;
  const GOAL = n + 1;
  const N = n + 2;
  const gScore = new Float64Array(N);
  const fScore = new Float64Array(N);
  const came = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    gScore[i] = Infinity;
    fScore[i] = Infinity;
    came[i] = -1;
  }
  const open = new Set([START]);
  const goalAttachSet = new Set(goalAttach);
  const node = (i) => i === START ? from : i === GOAL ? to : data.nodes[i];
  const cost = (a, b) => Math.sqrt(d2(node(a), node(b)));
  const heuristic = (i) => Math.sqrt(d2(node(i), to));
  gScore[START] = 0;
  fScore[START] = heuristic(START);
  const dirs = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const iterCap = Math.max(15000, Math.min(250000, data.nodes.length * (Number(opt.iterScale) || 8)));
  let iter = 0;
  while (open.size && iter < iterCap) {
    iter++;
    let curr = -1;
    let best = Infinity;
    for (const i of open) {
      if (fScore[i] < best) {
        best = fScore[i];
        curr = i;
      }
    }
    if (curr === -1 || curr === GOAL) break;
    open.delete(curr);
    const neigh = [];
    if (curr === START) {
      neigh.push(...startAttach);
      if (!edgeBlocked(from, to, ec, clearance, data.walls, data.sceneRect, endpointGuard, exactTol)) neigh.push(GOAL);
    } else {
      const x = curr % data.cols;
      const y = Math.floor(curr / data.cols);
      const bits = graph.edgeBits[curr] || 0;
      for (let d = 0; d < dirs.length; d++) {
        if (!(bits & (1 << d))) continue;
        const nx = x + dirs[d][0];
        const ny = y + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= data.cols || ny >= data.rows) continue;
        neigh.push(ny * data.cols + nx);
      }
      if (goalAttachSet.has(curr) && !edgeBlocked(node(curr), to, ec, clearance, data.walls, data.sceneRect, endpointGuard, exactTol)) neigh.push(GOAL);
    }
    for (const nidx of neigh) {
      if ((curr === START || nidx === GOAL) && edgeBlocked(node(curr), node(nidx), ec, clearance, data.walls, data.sceneRect, endpointGuard, exactTol)) continue;
      const tentative = gScore[curr] + cost(curr, nidx);
      if (tentative < gScore[nidx]) {
        came[nidx] = curr;
        gScore[nidx] = tentative;
        fScore[nidx] = tentative + heuristic(nidx);
        open.add(nidx);
      }
    }
  }
  if (!Number.isFinite(gScore[GOAL])) return { path: null, reason: iter >= iterCap ? "iter_cap_hit" : "no_route" };
  const raw = [];
  let c = GOAL;
  while (c !== -1) {
    raw.push(node(c));
    c = came[c];
  }
  raw.reverse();
  let out = simplifyPath(raw, ec, clearance, ctx, endpointGuard, exactTol);
  const same = (a, b) => Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;
  if (!same(out[0], from0)) out.unshift({ x: from0.x, y: from0.y });
  if (!same(out[out.length - 1], to0)) out.push({ x: to0.x, y: to0.y });
  data.segmentPathCache.set(ck, out.map((p) => ({ x: p.x, y: p.y })));
  if (data.segmentPathCache.size > 2000) {
    const k = data.segmentPathCache.keys().next();
    if (!k.done) data.segmentPathCache.delete(k.value);
  }
  return { path: out, reason: null };
}
function solve(payload) {
  const waypoints = Array.isArray(payload.waypoints) ? payload.waypoints : [];
  if (!waypoints.length) return { path: [], reason: null };
  const baseStep = Number(payload.settings.gridlessNodeStepPx) || 40;
  const attempts = [
    { step: baseStep, cornerScale: 0.75, iterScale: 8, maxTimeMs: 90 },
    { step: Math.min(160, baseStep + 12), cornerScale: 0.6, iterScale: 10, maxTimeMs: 110 },
    { step: Math.min(160, baseStep + 24), cornerScale: 0.45, iterScale: 12, maxTimeMs: 130 },
    { step: Math.min(160, baseStep + 36), cornerScale: 0.35, iterScale: 14, maxTimeMs: 150 }
  ];
  const interactiveFast = payload.interactiveFast === true;
  let ladder = attempts;
  if (interactiveFast) {
    ladder = ladder.slice(0, 2).map((a) => ({ ...a, iterScale: Math.min(9, a.iterScale), maxTimeMs: Math.min(80, a.maxTimeMs) }));
  }
  const full = [];
  for (const opt of ladder) {
    const data = getSceneStepData(payload, opt.step);
    if (!data) continue;
    let from = { x: Number(payload.start.x) || 0, y: Number(payload.start.y) || 0 };
    full.length = 0;
    let ok = true;
    let failReason = "unknown";
    for (const wp of waypoints) {
      const to = { x: Number(wp.x) || 0, y: Number(wp.y) || 0 };
      const seg = solveSegment(payload, data, from, to, opt);
      if (!seg.path || seg.path.length < 2) {
        ok = false;
        failReason = seg.reason || "segment_failed";
        break;
      }
      for (let i = 1; i < seg.path.length; i++) {
        full.push({ x: seg.path[i].x, y: seg.path[i].y });
      }
      from = to;
    }
    if (ok) return { path: full, reason: null, step: data.step };
    if (interactiveFast && failReason === "no_route") break;
  }
  return { path: null, reason: "no_route", step: baseStep };
}

self.onmessage = (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "solve") return;
  const requestId = msg.requestId;
  const tokenId = String(msg.tokenId || "");
  const payload = msg.payload;
  let result;
  try {
    result = solve(payload);
  } catch (err) {
    self.postMessage({
      type: "solve_result",
      requestId,
      tokenId,
      path: null,
      reason: "worker_error",
      error: String(err)
    });
    return;
  }
  const waypoints = Array.isArray(payload.waypoints) ? payload.waypoints : [];
  const target = waypoints.length ? waypoints[waypoints.length - 1] : payload.start;
  self.postMessage({
    type: "solve_result",
    requestId,
    tokenId,
    start: payload.start,
    target,
    step: result.step,
    path: result.path,
    reason: result.reason
  });
};
