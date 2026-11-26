/* ProgressMap3D — mapa de progreso con planetas realistas (esferas texturizadas
 * con iluminación, nubes y atmósfera, renderizadas por CPU sobre un canvas
 * auxiliar) y niveles que orbitan cada planeta como lunas.
 * API pública: init, updateState, computeLayout, scrollToNode, scrollToBiome, animateTransition. */

const PlanetNoise = {
	wf1: 0,
	wid: 0,
	h(x, y, z, s) {
		let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, -1640531535);
		h = Math.imul(h ^ (h >>> 13), 1274126177);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	},
	v(x, y, z, s) {
		const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
		let fx = x - xi, fy = y - yi, fz = z - zi;
		fx = fx * fx * (3 - 2 * fx);
		fy = fy * fy * (3 - 2 * fy);
		fz = fz * fz * (3 - 2 * fz);
		const h = this.h.bind(this);
		const a = h(xi, yi, zi, s), b = h(xi + 1, yi, zi, s);
		const c = h(xi, yi + 1, zi, s), d = h(xi + 1, yi + 1, zi, s);
		const e = h(xi, yi, zi + 1, s), f = h(xi + 1, yi, zi + 1, s);
		const g = h(xi, yi + 1, zi + 1, s), k = h(xi + 1, yi + 1, zi + 1, s);
		const x1 = a + (b - a) * fx, x2 = c + (d - c) * fx;
		const x3 = e + (f - e) * fx, x4 = g + (k - g) * fx;
		const y1 = x1 + (x2 - x1) * fy, y2 = x3 + (x4 - x3) * fy;
		return y1 + (y2 - y1) * fz;
	},
	fbm(x, y, z, s, oct) {
		let amp = 0.5, f = 1, sum = 0, norm = 0;
		for (let o = 0; o < oct; o++) {
			sum += amp * this.v(x * f, y * f, z * f, s + o * 7);
			norm += amp;
			amp *= 0.5;
			f *= 2.03;
		}
		return sum / norm;
	},
	worley(x, y, z, s) {
		const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
		let best = 9, id = 0;
		for (let i = -1; i <= 1; i++) {
			for (let j = -1; j <= 1; j++) {
				for (let k = -1; k <= 1; k++) {
					const cx = xi + i, cy = yi + j, cz = zi + k;
					const px = cx + this.h(cx, cy, cz, s) - x;
					const py = cy + this.h(cx, cy, cz, s + 1) - y;
					const pz = cz + this.h(cx, cy, cz, s + 2) - z;
					const d = px * px + py * py + pz * pz;
					if (d < best) {
						best = d;
						id = this.h(cx, cy, cz, s + 3);
					}
				}
			}
		}
		this.wf1 = Math.sqrt(best);
		this.wid = id;
	}
};

const ProgressMap3D = {
	canvas: null,
	ctx: null,
	container: null,
	tooltip: null,
	state: null,
	onSelectLevel: null,
	nodes: [],
	planets: [],
	stars: [],
	hoveredNodeIndex: -1,
	bitNodeIndex: 0,
	bitPos: { x: 0, y: 0 },
	bitAngle: Math.PI,
	isMigrating: false,
	migrationStart: 0,
	migrationDuration: 1800,
	migrationFrom: 0,
	migrationTo: 0,
	migrationResolve: null,
	migrationLastStepTime: 0,
	migrationPath: null,
	migrationFrozenPlanets: [],
	particles: [],
	virtualWidth: 680,
	virtualHeight: 1680,
	nodeRadius: 26,
	planetRadius: 108,
	orbitAngles: [],
	lastTimestamp: 0,
	viewScale: 1,
	panPointerId: null,
	panStartClientX: 0,
	panStartClientY: 0,
	pressedNodeIndex: -1,
	panStartScrollLeft: 0,
	panTarget: 0,
	panVelocity: 0,
	panLastClientX: 0,
	panLastSampleTime: 0,
	panHasMoved: false,
	panMode: 'idle',
	panEaseMs: 90,
	reducedMotion: typeof window !== 'undefined' && typeof window.matchMedia === 'function'
		? window.matchMedia('(prefers-reduced-motion: reduce)').matches
		: false,
	geo: null,
	atmos: [[124, 196, 255], [255, 138, 61], [143, 214, 255], [95, 224, 255], [191, 243, 255], [255, 126, 155]],
	LIGHT: (() => { const l = [-0.52, 0.46, 0.72]; const m = Math.hypot(l[0], l[1], l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })(),
	TW: 384,
	TH: 192,

	biomes: [
		{ id: 1, name: "Secuencias", title: "Estación Orbital", subtitle: "Nave Espacial", color: "#38bdf8", darkColor: "#0284c7", lightColor: "#e0f2fe", bgGradient: "rgba(56, 189, 248, 0.15)", moonColor: "#94a3b8", levels: [0, 1, 2, 3], planetType: "nave", orbitTilt: 0.26, speed: 1 },
		{ id: 2, name: "Bucles", title: "Mundo Engranaje", subtitle: "Fábrica de Máquinas", color: "#f59e0b", darkColor: "#b45309", lightColor: "#fffbeb", bgGradient: "rgba(245, 158, 11, 0.15)", moonColor: "#c27a4a", levels: [4, 5, 6, 7], planetType: "fabrica", orbitTilt: -0.2, speed: 0.9 },
		{ id: 3, name: "Condicionales", title: "Bosque Esmeralda", subtitle: "Selva Viva", color: "#22c55e", darkColor: "#15803d", lightColor: "#f0fdf4", bgGradient: "rgba(34, 197, 94, 0.15)", moonColor: "#7cc45f", levels: [8, 9, 10, 11], planetType: "bosque", orbitTilt: 0.18, speed: 1.1 },
		{ id: 4, name: "Variables", title: "Abismo Coral", subtitle: "Océano Profundo", color: "#14b8a6", darkColor: "#0f766e", lightColor: "#f0fdfa", bgGradient: "rgba(20, 184, 166, 0.15)", moonColor: "#3cc9c0", levels: [12, 13, 14, 15], planetType: "oceano", orbitTilt: -0.28, speed: 0.95 },
		{ id: 5, name: "Funciones", title: "Glaciar Aurora", subtitle: "Estación Polar", color: "#a78bfa", darkColor: "#6d28d9", lightColor: "#f5f3ff", bgGradient: "rgba(167, 139, 250, 0.15)", moonColor: "#d4e8ff", levels: [16, 17, 18, 19], planetType: "glaciar", orbitTilt: 0.22, speed: 1.05 },
		{ id: 6, name: "Matrices", title: "Nexo Matricial", subtitle: "Estación de Datos", color: "#fb7185", darkColor: "#be355d", lightColor: "#fff1f2", bgGradient: "rgba(251, 113, 133, 0.16)", moonColor: "#d789a2", levels: [20, 21, 22, 23], planetType: "matriz", orbitTilt: -0.24, speed: 1 }
	],

	/* ---------- utilidades de color ---------- */
	hexToRgb(hex) {
		const h = hex.replace('#', '');
		return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
	},
	tint(hex, amt) {
		const c = this.hexToRgb(hex);
		const t = amt >= 0 ? 255 : 0;
		const a = Math.abs(amt);
		return `rgb(${Math.round(c[0] + (t - c[0]) * a)},${Math.round(c[1] + (t - c[1]) * a)},${Math.round(c[2] + (t - c[2]) * a)})`;
	},

	init(canvasId, containerId, tooltipId, onSelectLevel) {
		this.canvas = document.getElementById(canvasId);
		this.ctx = this.canvas.getContext('2d');
		this.container = document.getElementById(containerId);
		this.tooltip = document.getElementById(tooltipId);
		this.onSelectLevel = onSelectLevel;

		this.computeLayout();
		this.bindEvents();
		requestAnimationFrame(this.renderLoop.bind(this));
	},

	updateState(state) {
		this.state = state;
		this.bitNodeIndex = Math.min(state.unlockedLevel, LEVELS.length - 1);
		if (!this.isMigrating && this.nodes[this.bitNodeIndex]) {
			this.bitPos.x = this.nodes[this.bitNodeIndex].x;
			this.bitPos.y = this.nodes[this.bitNodeIndex].y;
			this.bitAngle = Math.PI / 2;
		}
	},

	computeLayout() {
		const availableHeight = (this.container?.clientHeight || 580) - 32;
		this.virtualHeight = Math.max(availableHeight, 560);

		const biomeW = 820;
		const totalBiomes = this.biomes.length;
		this.virtualWidth = totalBiomes * biomeW + 160;

		const previousScale = this.viewScale;
		this.viewScale = Math.max(0.35, availableHeight / this.virtualHeight);
		const pixelScale = Math.min(this.viewScale * (window.devicePixelRatio || 1), 2, 8192 / this.virtualWidth);
		this.canvas.width = Math.round(this.virtualWidth * pixelScale);
		this.canvas.height = Math.round(this.virtualHeight * pixelScale);
		this.canvas.style.width = `${this.virtualWidth * this.viewScale}px`;
		this.canvas.style.height = `${this.virtualHeight * this.viewScale}px`;
		this.ctx.scale(this.canvas.width / this.virtualWidth, this.canvas.height / this.virtualHeight);
		this.dpr = pixelScale;
		if (this.container && previousScale !== this.viewScale) {
			const resizeFactor = this.viewScale / previousScale;
			this.container.scrollLeft *= resizeFactor;
			this.panTarget *= resizeFactor;
		}

		if (!this.stars || this.stars.length === 0) {
			this.stars = [];
			for (let s = 0; s < 320; s++) {
				this.stars.push({
					x: Math.random() * this.virtualWidth,
					y: Math.random() * this.virtualHeight,
					r: 0.6 + Math.random() * 1.8,
					alpha: 0.35 + Math.random() * 0.65,
					speed: 0.8 + Math.random() * 2.0,
					phase: Math.random() * Math.PI * 2,
					color: Math.random() > 0.85 ? '#38bdf8' : (Math.random() > 0.85 ? '#fde68a' : '#ffffff')
				});
			}
		}

		const oldPlanets = this.planets;
		this.nodes = [];
		this.planets = [];
		const cy = this.virtualHeight / 2;

		for (let b = 0; b < this.biomes.length; b++) {
			const biome = this.biomes[b];
			const biomeStartX = 80 + b * biomeW;
			const old = oldPlanets[b];

			this.planets.push({
				biome: biome,
				index: b,
				x: biomeStartX + biomeW / 2,
				y: cy - 35,
				radius: this.planetRadius,
				orbitRx: 196,
				orbitRy: 116,
				tilt: biome.orbitTilt,
				angle: this.orbitAngles[b] !== undefined ? this.orbitAngles[b] : b * 0.9,
				rotOffset: b * 1.7,
				tex: old ? old.tex : null,
				lastRender: old?.lastRender ?? -Infinity,
				surface: old ? old.surface : null
			});

			for (let n = 0; n < biome.levels.length; n++) {
				const lvlIdx = biome.levels[n];
				this.nodes.push({
					index: lvlIdx,
					x: 0,
					y: 0,
					depth: 0,
					scale: 1,
					orbitSlot: n,
					planetIndex: b,
					level: LEVELS[lvlIdx],
					biome: biome
				});
			}
		}

		this.positionNodes();

		if (!this.isMigrating && this.nodes[this.bitNodeIndex]) {
			this.bitPos.x = this.nodes[this.bitNodeIndex].x;
			this.bitPos.y = this.nodes[this.bitNodeIndex].y;
		}
		this.clampPanBounds();
	},

	/* Coloca cada nivel como una luna sobre la órbita elíptica e inclinada de su planeta */
	positionNodes() {
		for (const n of this.nodes) {
			const p = this.planets[n.planetIndex];
			const a = p.angle + n.orbitSlot * (Math.PI / 2) + 0.6;
			const point = MapMotion.orbitPoint(p, a);
			n.x = point.x;
			n.y = point.y;
			n.orbitAngle = a;
			n.depth = point.depth;
			n.scale = 1 + 0.2 * n.depth;
		}
	},

	sampleOrbitPath(planet, startAngle, endAngle, count = 28) {
		const points = [];
		for (let i = 0; i <= count; i++) {
			const angle = startAngle + (endAngle - startAngle) * (i / count);
			points.push(MapMotion.orbitPoint(planet, angle));
		}
		return points;
	},

	appendPathPoints(target, points) {
		for (const point of points) {
			const last = target[target.length - 1];
			if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.01) {
				target.push({ x: point.x, y: point.y });
			}
		}
	},

	createMigrationPath(fromIndex, toIndex) {
		const fromNode = this.nodes[fromIndex];
		const toNode = this.nodes[toIndex];
		if (!fromNode || !toNode) return null;

		const points = [];
		const fromPlanetIndex = fromNode.planetIndex;
		const toPlanetIndex = toNode.planetIndex;

		if (fromPlanetIndex === toPlanetIndex) {
			let endAngle = toNode.orbitAngle;
			while (endAngle <= fromNode.orbitAngle) endAngle += Math.PI * 2;
			this.appendPathPoints(points, this.sampleOrbitPath(this.planets[fromPlanetIndex], fromNode.orbitAngle, endAngle, 36));
		} else {
			this.appendPathPoints(points, [fromNode]);
			for (let b = fromPlanetIndex; b < toPlanetIndex; b++) {
				const connector = MapMotion.connectorBetween(this.planets[b], this.planets[b + 1]);
				this.appendPathPoints(points, [connector.p1, connector.p2]);
			}
			this.appendPathPoints(points, [toNode]);
		}

		let totalLength = 0;
		const measured = points.map((point, index) => {
			if (index > 0) {
				const previous = points[index - 1];
				totalLength += Math.hypot(point.x - previous.x, point.y - previous.y);
			}
			return { x: point.x, y: point.y, distance: totalLength };
		});

		return { points: measured, totalLength };
	},

	evalMigrationPath(t) {
		const path = this.migrationPath;
		if (!path || path.points.length === 0) return null;
		if (path.points.length === 1 || path.totalLength === 0) {
			const only = path.points[0];
			return { x: only.x, y: only.y, angle: this.bitAngle };
		}

		const targetDistance = path.totalLength * Math.max(0, Math.min(1, t));
		let index = 1;
		while (index < path.points.length && path.points[index].distance < targetDistance) index++;
		index = Math.min(index, path.points.length - 1);

		const previous = path.points[index - 1];
		const next = path.points[index];
		const span = Math.max(next.distance - previous.distance, 0.0001);
		const local = (targetDistance - previous.distance) / span;
		const x = previous.x + (next.x - previous.x) * local;
		const y = previous.y + (next.y - previous.y) * local;
		const angle = Math.atan2(next.y - previous.y, next.x - previous.x) + Math.PI / 2;

		return { x, y, angle };
	},

	/* Devuelve el índice de la luna bajo el cursor (las de delante primero; las ocultas tras el planeta no cuentan) */
	hitNode(mouseX, mouseY) {
		let best = -1;
		let bestDepth = -Infinity;
		for (let i = 0; i < this.nodes.length; i++) {
			const n = this.nodes[i];
			const r = this.nodeRadius * n.scale + 8;
			if (Math.hypot(n.x - mouseX, n.y - mouseY) > r) continue;
			if (n.depth < 0) {
				const p = this.planets[n.planetIndex];
				if (Math.hypot(mouseX - p.x, mouseY - p.y) < p.radius) continue;
			}
			if (n.depth > bestDepth) {
				bestDepth = n.depth;
				best = i;
			}
		}
		return best;
	},

	isLevelAvailable(index) {
		const level = this.nodes[index]?.level;
		return Boolean(level && (index <= (this.state?.unlockedLevel ?? 0) || Number(this.state?.stars?.[level.id]) > 0));
	},

	getPanBounds() {
		if (!this.container) return { min: 0, max: 0 };
		return {
			min: 0,
			max: Math.max(0, this.container.scrollWidth - this.container.clientWidth)
		};
	},

	clampPanValue(value) {
		const bounds = this.getPanBounds();
		const safeValue = Number.isFinite(value) ? value : bounds.min;
		return Math.min(bounds.max, Math.max(bounds.min, safeValue));
	},

	clampPanBounds() {
		if (!this.container) return;
		const current = this.clampPanValue(this.container.scrollLeft);
		this.container.scrollLeft = current;
		this.panTarget = this.clampPanValue(this.panTarget);
		if (this.panMode === 'idle') this.panTarget = current;
		if ((current <= 0 && this.panVelocity < 0) || (current >= this.getPanBounds().max && this.panVelocity > 0)) {
			this.panVelocity = 0;
			if (this.panMode === 'inertia') this.panMode = 'idle';
		}
		if (this.panPointerId !== null) {
			this.panStartScrollLeft = current;
			this.panStartClientX = this.panLastClientX;
		}
	},

	setScrollTarget(left, easeMs = 180) {
		if (!this.container) return;
		this.panTarget = this.clampPanValue(left);
		this.panVelocity = 0;
		this.panEaseMs = Math.max(1, easeMs);
		if (this.reducedMotion) {
			this.container.scrollLeft = this.panTarget;
			this.panMode = 'idle';
			return;
		}
		this.panMode = 'programmatic';
	},

	updatePan(dtMs) {
		if (!this.container) return;
		const bounds = this.getPanBounds();
		const dt = Math.max(0, Math.min(32, Number.isFinite(dtMs) ? dtMs : 16));
		this.panTarget = this.clampPanValue(this.panTarget);

		if (this.reducedMotion) {
			if (this.panMode === 'drag' || this.panMode === 'wheel' || this.panMode === 'programmatic') {
				this.container.scrollLeft = this.panTarget;
			}
			this.panVelocity = 0;
			if (this.panMode !== 'drag') this.panMode = 'idle';
			return;
		}

		if (this.panMode === 'drag' || this.panMode === 'wheel' || this.panMode === 'programmatic') {
			const current = this.clampPanValue(this.container.scrollLeft);
			const difference = this.panTarget - current;
			const factor = 1 - Math.exp(-dt / Math.max(1, this.panEaseMs));
			let next = this.clampPanValue(current + difference * factor);
			if (Math.abs(difference) < 0.35) next = this.panTarget;
			this.container.scrollLeft = next;
			if (this.panMode !== 'drag' && Math.abs(this.panTarget - next) < 0.35) {
				this.panMode = 'idle';
			}
			return;
		}

		if (this.panMode === 'inertia') {
			const next = MapMotion.stepInertia(
				{ position: this.container.scrollLeft, velocity: this.panVelocity },
				dt,
				bounds,
				{ friction: 2.94, epsilon: 14, maxDeltaMs: 32, reducedMotion: this.reducedMotion }
			);
			this.container.scrollLeft = next.position;
			this.panTarget = next.position;
			this.panVelocity = next.velocity;
			if (next.velocity === 0) this.panMode = 'idle';
			return;
		}

		this.container.scrollLeft = this.clampPanValue(this.container.scrollLeft);
		this.panTarget = this.container.scrollLeft;
	},

	finishPanPointer(e, released) {
		if (!this.container || e.pointerId !== this.panPointerId) return;
		const pointerId = this.panPointerId;
		const moved = this.panHasMoved || Math.hypot(e.clientX - this.panStartClientX, e.clientY - this.panStartClientY) > 5;
		const selected = released && !moved ? this.pressedNodeIndex : -1;
		const staleFor = Math.max(0, e.timeStamp - this.panLastSampleTime);
		let velocity = this.panVelocity;
		if (staleFor > 80) velocity *= 0.25;
		velocity += (this.panTarget - this.container.scrollLeft) * 12.5;
		velocity = Math.max(-2600, Math.min(2600, velocity));

		this.panPointerId = null;
		if (this.container.hasPointerCapture(pointerId)) {
			this.container.releasePointerCapture(pointerId);
		}
		this.container.classList.remove('is-dragging');
		this.canvas.style.cursor = this.hoveredNodeIndex !== -1 ? 'pointer' : 'grab';
		this.panTarget = this.clampPanValue(this.container.scrollLeft);
		this.panVelocity = released && moved && !this.reducedMotion && Math.abs(velocity) >= 14 ? velocity : 0;
		this.panMode = this.panVelocity === 0 ? 'idle' : 'inertia';
		this.panHasMoved = false;
		this.pressedNodeIndex = -1;

		if (selected !== -1 && !this.isMigrating) {
			if (this.isLevelAvailable(selected)) {
				this.hoveredNodeIndex = -1;
				this.canvas.style.cursor = 'grab';
				this.hideTooltip();
				this.onSelectLevel?.(selected);
			} else if (typeof SoundFX !== 'undefined') {
				SoundFX.playError();
			}
		}
	},

	bindEvents() {
		const toVirtual = (e) => {
			const rect = this.canvas.getBoundingClientRect();
			return {
				x: (e.clientX - rect.left) * (this.virtualWidth / rect.width),
				y: (e.clientY - rect.top) * (this.virtualHeight / rect.height)
			};
		};

		if (this.container) {
			this.container.style.touchAction = 'pan-y';
			this.container.style.scrollBehavior = 'auto';
			this.container.style.overscrollBehaviorX = 'contain';
			this.canvas.style.cursor = 'grab';

			this.container.addEventListener('pointerdown', (e) => {
				if (!e.isPrimary || this.panPointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
				this.panPointerId = e.pointerId;
				this.panStartClientX = e.clientX;
				this.panStartClientY = e.clientY;
				const point = toVirtual(e);
				this.pressedNodeIndex = this.hitNode(point.x, point.y);
				this.panStartScrollLeft = this.container.scrollLeft;
				this.panTarget = this.container.scrollLeft;
				this.panVelocity = 0;
				this.panLastClientX = e.clientX;
				this.panLastSampleTime = e.timeStamp;
				this.panHasMoved = false;
				this.panMode = 'drag';
				this.panEaseMs = 38;
				this.container.classList.add('is-dragging');
				this.canvas.style.cursor = 'grabbing';
				this.container.setPointerCapture(e.pointerId);
			});

			this.container.addEventListener('pointermove', (e) => {
				if (e.pointerId !== this.panPointerId) return;
				const walk = e.clientX - this.panStartClientX;
				const vertical = e.clientY - this.panStartClientY;
				if (Math.hypot(walk, vertical) > 5) {
					this.panHasMoved = true;
					this.hoveredNodeIndex = -1;
					this.hideTooltip();
				}
				if (!this.panHasMoved || (e.pointerType === 'touch' && Math.abs(vertical) > Math.abs(walk))) return;
				this.panTarget = this.clampPanValue(this.panStartScrollLeft - walk * 1.04);
				const rawSampleDt = Math.max(1, e.timeStamp - this.panLastSampleTime);
				const sampleDt = Math.min(rawSampleDt, 80);
				const instantVelocity = (this.panLastClientX - e.clientX) * 1000 / sampleDt;
				if (rawSampleDt > 80) {
					this.panVelocity = instantVelocity * 0.25;
				} else {
					this.panVelocity = this.panVelocity * 0.65 + instantVelocity * 0.35;
				}
				this.panVelocity = Math.max(-2600, Math.min(2600, this.panVelocity));
				this.panLastClientX = e.clientX;
				this.panLastSampleTime = e.timeStamp;
				if (this.reducedMotion) this.container.scrollLeft = this.panTarget;
			});

			this.container.addEventListener('pointerup', (e) => this.finishPanPointer(e, true));
			this.container.addEventListener('pointercancel', (e) => this.finishPanPointer(e, false));
			this.container.addEventListener('lostpointercapture', (e) => this.finishPanPointer(e, false));

			this.container.addEventListener('wheel', (e) => {
				if (this.panPointerId !== null) return;
				let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
				if (e.deltaMode === 1) delta *= 16;
				if (e.deltaMode === 2) delta *= this.container.clientWidth;
				if (delta !== 0) {
					e.preventDefault();
					this.hoveredNodeIndex = -1;
					this.hideTooltip();
					const base = this.panMode === 'wheel' || this.panMode === 'programmatic'
						? this.panTarget
						: this.container.scrollLeft;
					this.panTarget = this.clampPanValue(base + delta);
					this.panVelocity = 0;
					this.panEaseMs = 90;
					if (this.reducedMotion) {
						this.container.scrollLeft = this.panTarget;
						this.panMode = 'idle';
					} else {
						this.panMode = 'wheel';
					}
				}
			}, { passive: false });
		}

		this.canvas.addEventListener('pointermove', (e) => {
			if (this.panPointerId !== null) return;
			const m = toVirtual(e);
			const found = this.hitNode(m.x, m.y);
			this.hoveredNodeIndex = found;
			this.canvas.style.cursor = found !== -1 ? 'pointer' : 'grab';
			this.updateTooltip(found, e.clientX, e.clientY);
		});

		this.canvas.addEventListener('pointerleave', () => {
			if (this.panPointerId !== null) return;
			this.hoveredNodeIndex = -1;
			this.canvas.style.cursor = 'grab';
			this.hideTooltip();
		});

		const resizeMap = () => {
			if (!this.container?.clientHeight) return;
			this.hideTooltip();
			this.computeLayout();
		};
		if (this.container && typeof ResizeObserver === 'function') {
			new ResizeObserver(resizeMap).observe(this.container);
		} else {
			window.addEventListener('resize', resizeMap);
		}
		window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', (event) => {
			this.reducedMotion = event.matches;
		});
	},

	updateTooltip(index, clientX, clientY) {
		if (!this.tooltip) return;
		if (index === -1) {
			this.hideTooltip();
			return;
		}

		const node = this.nodes[index];
		const isUnlocked = this.isLevelAvailable(index);
		const starsCount = Number(this.state?.stars?.[node.level.id]) || 0;
		const status = starsCount > 0 ? 'Completado · Repetir' : (isUnlocked ? 'Disponible' : 'Bloqueado');

		let starsHtml = '';
		for (let s = 0; s < 3; s++) {
			starsHtml += s < starsCount ? '★' : '☆';
		}

		this.tooltip.innerHTML = `
			<div class="tooltip-header" style="color: ${node.biome.color};">
				<span>Módulo ${node.level.id.split('.')[0]} • ${node.biome.name}</span>
			</div>
			<div class="tooltip-title">Nivel ${node.level.id}: ${node.level.title}</div>
			<div class="tooltip-meta">
				<span style="color: #f59e0b; font-weight: 700;">${starsHtml}</span>
				<span class="tooltip-status ${isUnlocked ? 'unlocked' : 'locked'}">${status}</span>
			</div>
		`;

		this.tooltip.classList.add('visible');
		this.tooltip.style.left = `${Math.min(clientX + 16, window.innerWidth - this.tooltip.offsetWidth - 8)}px`;
		this.tooltip.style.top = `${Math.min(clientY + 12, window.innerHeight - this.tooltip.offsetHeight - 8)}px`;
	},

	hideTooltip() {
		if (this.tooltip) {
			this.tooltip.classList.remove('visible');
		}
	},

	scrollToNode(index) {
		if (this.nodes[index]) this.scrollToBiome(this.nodes[index].planetIndex);
	},

	scrollToBiome(biomeIndex) {
		if (!this.container || !this.planets[biomeIndex]) return;
		const canvasOffset = this.canvas.getBoundingClientRect().left
			- this.container.getBoundingClientRect().left + this.container.scrollLeft;
		const targetX = canvasOffset + this.planets[biomeIndex].x * this.viewScale;
		const containerW = this.container.clientWidth;
		this.setScrollTarget(targetX - containerW / 2, 180);
	},

	animateTransition(fromIndex, toIndex) {
		if (fromIndex >= toIndex || toIndex >= this.nodes.length) {
			return Promise.resolve();
		}

		this.scrollToNode(toIndex);
		if (this.reducedMotion) return Promise.resolve();
		const fromNode = this.nodes[fromIndex];
		const toNode = this.nodes[toIndex];
		this.migrationFrozenPlanets = [];
		for (let b = fromNode.planetIndex; b <= toNode.planetIndex; b++) {
			this.migrationFrozenPlanets.push(b);
		}
		this.migrationPath = this.createMigrationPath(fromIndex, toIndex);

		return new Promise((resolve) => {
			this.isMigrating = true;
			this.migrationFrom = fromIndex;
			this.migrationTo = toIndex;
			this.migrationStart = performance.now();
			this.migrationDuration = 1800;
			this.migrationResolve = resolve;
			this.migrationLastStepTime = 0;
		});
	},

	spawnCelebration(x, y, color) {
		for (let i = 0; i < 36; i++) {
			const angle = (Math.PI * 2 * i) / 36;
			const speed = 2.5 + Math.random() * 4.0;
			this.particles.push({
				x: x,
				y: y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				radius: 3 + Math.random() * 3.5,
				color: Math.random() > 0.35 ? color : '#f59e0b',
				alpha: 1,
				life: 45 + Math.random() * 20
			});
		}
	},

	renderLoop(timestamp) {
		this.update(timestamp);
		this.draw(timestamp);
		requestAnimationFrame(this.renderLoop.bind(this));
	},

	update(timestamp) {
		const dt = this.lastTimestamp ? Math.min(timestamp - this.lastTimestamp, 100) : 16;
		this.lastTimestamp = timestamp;
		this.updatePan(dt);

		const hoveredPlanet = this.nodes[this.hoveredNodeIndex]?.planetIndex;
		const pressedPlanet = this.nodes[this.pressedNodeIndex]?.planetIndex;
		for (let b = 0; b < this.planets.length; b++) {
			const p = this.planets[b];
			if (!this.reducedMotion && b !== hoveredPlanet && b !== pressedPlanet && !this.migrationFrozenPlanets.includes(b)) {
				p.angle = (p.angle + dt * 0.00016 * p.biome.speed) % (Math.PI * 2);
			}
			this.orbitAngles[b] = p.angle;
		}
		this.positionNodes();

		if (this.isMigrating) {
			const elapsed = timestamp - this.migrationStart;
			const progress = Math.min(elapsed / this.migrationDuration, 1);
			const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

			const pos = this.evalMigrationPath(ease);
			if (pos) {
				this.bitPos.x = pos.x;
				this.bitPos.y = pos.y;
				this.bitAngle = pos.angle;
			}

			if (timestamp - this.migrationLastStepTime > 160) {
				this.migrationLastStepTime = timestamp;
				if (typeof SoundFX !== 'undefined') SoundFX.playStep();
			}

			if (progress >= 1) {
				this.isMigrating = false;
				this.bitNodeIndex = this.migrationTo;
				const targetNode = this.nodes[this.migrationTo];
				this.bitPos.x = targetNode.x;
				this.bitPos.y = targetNode.y;
				this.bitAngle = Math.PI / 2;
				this.migrationPath = null;
				this.migrationFrozenPlanets = [];

				this.spawnCelebration(targetNode.x, targetNode.y, targetNode.biome.color);
				if (typeof SoundFX !== 'undefined') SoundFX.playUnlock();

				if (this.migrationResolve) {
					const res = this.migrationResolve;
					this.migrationResolve = null;
					res();
				}
			}
		} else if (this.nodes[this.bitNodeIndex]) {
			const bn = this.nodes[this.bitNodeIndex];
			this.bitPos.x = bn.x;
			this.bitPos.y = bn.y;
		}

		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.x += p.vx;
			p.y += p.vy;
			p.alpha -= 1 / p.life;
			if (p.alpha <= 0) {
				this.particles.splice(i, 1);
			}
		}

		this.buildOneTexture();
	},

	/* ---------- Texturas procedurales de los planetas ---------- */
	isPlanetVisible(p) {
		if (!this.container) return true;
		const left = this.container.scrollLeft / this.viewScale - 300;
		const right = (this.container.scrollLeft + this.container.clientWidth) / this.viewScale + 300;
		return p.x >= left && p.x <= right;
	},

	buildOneTexture() {
		let target = null;
		for (const p of this.planets) {
			if (p.tex) continue;
			if (this.isPlanetVisible(p)) { target = p; break; }
			if (!target) target = p;
		}
		if (target) target.tex = this.generateTexture(target.biome.planetType);
	},

	generateTexture(type) {
		const TW = this.TW, TH = this.TH;
		const N = PlanetNoise;
		const col = new Uint8ClampedArray(TW * TH * 4);
		const emi = new Uint8ClampedArray(TW * TH * 3);
		const cld = new Uint8ClampedArray(TW * TH);
		const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
		const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

		for (let j = 0; j < TH; j++) {
			const lat = (0.5 - (j + 0.5) / TH) * Math.PI;
			const cl = Math.cos(lat), sl = Math.sin(lat);
			for (let i = 0; i < TW; i++) {
				const lon = ((i + 0.5) / TW) * Math.PI * 2 - Math.PI;
				const x = cl * Math.sin(lon), y = sl, z = cl * Math.cos(lon);
				let c = [128, 128, 128], spec = 0, em = null, cloud = 0;

				if (type === 'nave') {
					const n = N.fbm(x * 2.2, y * 2.2, z * 2.2, 1, 5);
					c = mix([62, 76, 102], [172, 188, 212], n);
					N.worley(x * 5, y * 5, z * 5, 20);
					let f = N.wf1;
					if (f < 0.42) {
						const t = f / 0.42;
						if (t < 0.72) c = mix(c, [34, 42, 62], 0.55 * (1 - t / 0.72) + 0.2);
						else c = mix(c, [225, 235, 250], 0.4 * ((t - 0.72) / 0.28) * (1 - (t - 0.72) / 0.28) * 2);
					}
					N.worley(x * 12, y * 12, z * 12, 40);
					f = N.wf1;
					if (f < 0.3) {
						const t = f / 0.3;
						c = t < 0.7 ? mix(c, [40, 50, 74], 0.4) : mix(c, [230, 238, 252], 0.25);
					}
					const panel = Math.abs(N.fbm(x * 7, y * 7, z * 7, 3, 3) - 0.5);
					if (panel < 0.012) c = mix(c, [22, 28, 44], 0.6);
					N.worley(x * 20, y * 20, z * 20, 60);
					if (N.wf1 < 0.1 && N.wid > 0.86) em = [110, 225, 255];
					spec = 0.18;
				} else if (type === 'fabrica') {
					const n = N.fbm(x * 2.6, y * 2.6, z * 2.6, 2, 5);
					const rust = N.fbm(x * 5, y * 5, z * 5, 3, 4);
					c = mix([36, 27, 25], [140, 70, 34], sm(0.3, 0.7, n));
					c = mix(c, [200, 102, 42], sm(0.52, 0.8, rust) * 0.8);
					const rid = 1 - Math.abs(2 * N.fbm(x * 3.4, y * 3.4, z * 3.4, 4, 4) - 1);
					if (rid > 0.88) {
						const t = sm(0.88, 0.97, rid);
						c = mix(c, [255, 150, 40], t);
						em = [255 * t, 105 * t, 18 * t];
					}
					const hz = N.fbm(x * 3, y * 3, z * 3, 9, 4);
					cloud = sm(0.5, 0.75, hz) * 0.4;
					spec = 0.05;
				} else if (type === 'bosque') {
					const h = N.fbm(x * 2.0, y * 2.0, z * 2.0, 5, 6);
					const sea = 0.5;
					if (h < sea) {
						const d = Math.min(1, (sea - h) / sea * 2.4);
						c = mix([34, 118, 176], [8, 38, 96], d);
						if (h > sea - 0.03) c = mix(c, [78, 180, 190], 0.6);
						spec = 0.95;
					} else {
						const e = (h - sea) / (1 - sea);
						const moist = N.fbm(x * 6, y * 6, z * 6, 6, 4);
						c = mix([28, 112, 46], [12, 66, 32], moist);
						if (moist < 0.4) c = mix(c, [86, 150, 52], 0.5);
						if (e < 0.02) c = [214, 200, 150];
						else if (e > 0.32) c = mix(c, [112, 98, 66], Math.min(1, (e - 0.32) * 3));
						if (e > 0.55) c = mix(c, [236, 242, 246], Math.min(1, (e - 0.55) * 4));
						spec = 0.06;
					}
					if (Math.abs(y) > 0.9) c = mix(c, [240, 246, 250], sm(0.9, 0.97, Math.abs(y)));
					cloud = sm(0.5, 0.72, N.fbm(x * 2.6, y * 3.4, z * 2.6, 11, 5)) * 0.92;
				} else if (type === 'oceano') {
					const h = N.fbm(x * 2.4, y * 2.4, z * 2.4, 7, 6);
					if (h < 0.6) {
						c = mix([3, 22, 58], [10, 88, 152], Math.pow(h / 0.6, 1.4));
						spec = 0.97;
						if (h < 0.5 && N.fbm(x * 14, y * 14, z * 14, 21, 3) > 0.68) em = [0, 150, 200];
					} else if (h < 0.665) {
						const t = (h - 0.6) / 0.065;
						c = mix([20, 150, 172], [40, 206, 190], t);
						spec = 0.8;
					} else {
						c = h < 0.69 ? [236, 222, 170] : mix([38, 138, 70], [22, 96, 52], N.fbm(x * 9, y * 9, z * 9, 8, 3));
						spec = 0.05;
					}
					cloud = sm(0.55, 0.75, N.fbm(x * 2.2 + N.fbm(x * 3, y * 3, z * 3, 30, 3), y * 3.4, z * 2.2, 12, 5)) * 0.75;
				} else if (type === 'matriz') {
					const gridX = (i + 0.5) * 24 / TW;
					const gridY = (j + 0.5) * 12 / TH;
					const column = Math.floor(gridX);
					const row = Math.floor(gridY);
					const panel = N.h(column, row, 0, 23);
					const edgeX = Math.abs(gridX - Math.round(gridX));
					const edgeY = Math.abs(gridY - Math.round(gridY));
					const majorLine = (Math.round(gridX) % 4 === 0 && edgeX < 0.1)
						|| (Math.round(gridY) % 4 === 0 && edgeY < 0.1);
					const gridLine = Math.min(edgeX, edgeY) < 0.06;
					c = mix([35, 18, 42], [118, 46, 76], panel);
					if (majorLine) {
						c = [251, 113, 133];
						em = [172, 42, 74];
					} else if (gridLine) {
						c = [153, 56, 95];
						em = [74, 19, 42];
					} else if (panel > 0.77 && Math.max(Math.abs(gridX - column - 0.5), Math.abs(gridY - row - 0.5)) < 0.15) {
						c = [255, 212, 177];
						em = [238, 111, 86];
					}
					spec = 0.24;
				} else {
					const n = N.fbm(x * 3, y * 3, z * 3, 8, 5);
					c = mix([196, 224, 244], [250, 253, 255], n);
					const b = N.fbm(x * 2, y * 2, z * 2, 9, 4);
					c = mix(c, [128, 184, 226], sm(0.45, 0.75, b) * 0.7);
					const cr = Math.abs(N.fbm(x * 5, y * 5, z * 5, 10, 4) - 0.5);
					if (cr < 0.02) c = mix(c, [54, 100, 148], 1 - cr / 0.02);
					if (N.fbm(x * 7, y * 7, z * 7, 11, 3) > 0.8) c = mix(c, [68, 80, 94], 0.8);
					const al = Math.abs(y);
					if (al > 0.55) {
						const a = sm(0.55, 0.95, al);
						const wave = 0.5 + 0.5 * Math.sin(lon * 7 + N.fbm(x * 3, y * 3, z * 3, 13, 3) * 8);
						const k = a * (0.35 + 0.65 * wave) * 0.7;
						em = [70 * k + 60 * a * wave * 0.4, 255 * k, 170 * k + 90 * a * wave * 0.4];
					}
					spec = 0.8;
					cloud = sm(0.58, 0.78, N.fbm(x * 4, y * 4, z * 4, 12, 5)) * 0.5;
				}

				const k = j * TW + i;
				col[k * 4] = c[0];
				col[k * 4 + 1] = c[1];
				col[k * 4 + 2] = c[2];
				col[k * 4 + 3] = spec * 255;
				if (em) {
					emi[k * 3] = em[0];
					emi[k * 3 + 1] = em[1];
					emi[k * 3 + 2] = em[2];
				}
				cld[k] = cloud * 255;
			}
		}
		return { col, emi, cld };
	},

	/* Geometría de esfera precalculada (normales, luz difusa, brillo especular y borde atmosférico) */
	buildGeometry(S) {
		const R = S / 2;
		const L = this.LIGHT;
		const hx = L[0], hy = L[1], hz = L[2] + 1;
		const hm = Math.hypot(hx, hy, hz);
		const cap = S * S;
		const idx = new Int32Array(cap), row = new Int32Array(cap);
		const lon = new Float32Array(cap), lit = new Float32Array(cap), night = new Float32Array(cap);
		const rim = new Float32Array(cap), spec = new Float32Array(cap), alpha = new Uint8Array(cap);
		let cnt = 0;
		const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
		for (let y = 0; y < S; y++) {
			for (let x = 0; x < S; x++) {
				const dx = (x + 0.5 - R) / R;
				const dy = (R - (y + 0.5)) / R;
				const d2 = dx * dx + dy * dy;
				const dist = Math.sqrt(d2);
				const edge = (1 - dist) * R + 0.5;
				if (edge <= 0) continue;
				const nz = Math.sqrt(Math.max(0, 1 - d2));
				const ndx = dist > 1 ? dx / dist : dx, ndy = dist > 1 ? dy / dist : dy;
				const diff = ndx * L[0] + ndy * L[1] + nz * L[2];
				idx[cnt] = (y * S + x) * 4;
				lon[cnt] = Math.atan2(dx, nz);
				row[cnt] = Math.max(0, Math.min(this.TH - 1, Math.floor((0.5 - Math.asin(Math.max(-1, Math.min(1, dy))) / Math.PI) * this.TH)));
				lit[cnt] = 0.05 + 0.95 * sm(-0.1, 1.0, diff);
				night[cnt] = 1 - sm(-0.05, 0.3, diff);
				rim[cnt] = Math.pow(1 - nz, 3);
				const nh = (ndx * hx + ndy * hy + nz * hz) / hm;
				spec[cnt] = Math.pow(Math.max(0, nh), 38);
				alpha[cnt] = Math.max(0, Math.min(1, edge)) * 255;
				cnt++;
			}
		}
		return { S, count: cnt, idx, row, lon, lit, night, rim, spec, alpha };
	},

	ensureSurface(p) {
		if (p.surface) return p.surface;
		const q = this.dpr > 1 ? 1.5 : 1;
		const S = Math.round(this.planetRadius * 2 * q);
		if (!this.geo || this.geo.S !== S) this.geo = this.buildGeometry(S);
		const cv = document.createElement('canvas');
		cv.width = S;
		cv.height = S;
		const cx = cv.getContext('2d');
		p.surface = { canvas: cv, ctx: cx, img: cx.createImageData(S, S) };
		return p.surface;
	},

	renderPlanetSurface(p, t) {
		const surf = this.ensureSurface(p);
		const g = this.geo;
		const tex = p.tex;
		const data = surf.img.data;
		const TW = this.TW;
		const atm = this.atmos[p.index];
		const rotS = (t * 0.00005 * p.biome.speed) + p.rotOffset;
		const rotC = rotS * 1.25 + 0.3;
		const TAU = Math.PI * 2;
		const col = tex.col, emi = tex.emi, cld = tex.cld;
		const icloud = p.index === 0 ? 0 : 1;

		for (let k = 0; k < g.count; k++) {
			let u = (g.lon[k] + rotS + Math.PI) / TAU;
			u -= Math.floor(u);
			const ti = g.row[k] * TW + ((u * TW) | 0);
			const lit = g.lit[k];
			const nightF = g.night[k];

			let r = col[ti * 4] * lit, gg = col[ti * 4 + 1] * lit, b = col[ti * 4 + 2] * lit;
			r += emi[ti * 3] * nightF; gg += emi[ti * 3 + 1] * nightF; b += emi[ti * 3 + 2] * nightF;

			const sp = col[ti * 4 + 3] / 255 * g.spec[k];
			let cc = 0;
			if (icloud || tex.cld[ti] > 0) {
				let uc = (g.lon[k] + rotC + Math.PI) / TAU;
				uc -= Math.floor(uc);
				const ci = g.row[k] * TW + ((uc * TW) | 0);
				cc = cld[ci] / 255;
			}
			if (cc > 0) {
				const cl = 255 * (0.1 + 0.9 * lit);
				r = r * (1 - cc) + cl * cc;
				gg = gg * (1 - cc) + cl * cc;
				b = b * (1 - cc) + cl * cc;
			}
			const sA = sp * (1 - cc) * 255 * 0.9;
			r += sA; gg += sA; b += sA;

			const a = g.rim[k] * (0.2 + 0.8 * (1 - nightF)) * 0.85;
			r = r * (1 - a) + atm[0] * a;
			gg = gg * (1 - a) + atm[1] * a;
			b = b * (1 - a) + atm[2] * a;

			const o = g.idx[k];
			data[o] = r;
			data[o + 1] = gg;
			data[o + 2] = b;
			data[o + 3] = g.alpha[k];
		}
		surf.ctx.putImageData(surf.img, 0, 0);
		p.lastRender = t;
	},

	draw(timestamp) {
		const time = this.reducedMotion ? 0 : timestamp;
		this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

		this.drawSpaceBackground(time);
		this.drawCosmicFlightPath(time);
		this.drawPlanetSystems(time);
		this.drawForegroundPlanetNodes(time);
		this.drawLabels(time);
		if (this.isMigrating) this.drawBitAvatar(time);
		this.drawParticles();
	},

	drawSpaceBackground(timestamp) {
		const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.virtualHeight);
		bgGrad.addColorStop(0, '#03060f');
		bgGrad.addColorStop(0.5, '#091229');
		bgGrad.addColorStop(1, '#03050f');
		this.ctx.fillStyle = bgGrad;
		this.ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

		if (this.planets) {
			for (const p of this.planets) {
				const nebGrad = this.ctx.createRadialGradient(p.x, p.y, p.radius * 0.5, p.x, p.y, p.radius * 3.0);
				nebGrad.addColorStop(0, p.biome.bgGradient);
				nebGrad.addColorStop(0.6, `${p.biome.color}08`);
				nebGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
				this.ctx.fillStyle = nebGrad;
				this.ctx.beginPath();
				this.ctx.arc(p.x, p.y, p.radius * 3.0, 0, Math.PI * 2);
				this.ctx.fill();
			}
		}

		this.ctx.save();
		for (const s of this.stars) {
			const a = s.alpha * (0.6 + 0.4 * Math.sin((timestamp || 0) * 0.002 * s.speed + s.phase));
			this.ctx.fillStyle = s.color;
			this.ctx.globalAlpha = Math.max(0, Math.min(1, a));
			this.ctx.beginPath();
			this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
			this.ctx.fill();
		}
		this.ctx.restore();
	},

	drawPlanetSystems(timestamp) {
		const t = timestamp || 0;
		for (let b = 0; b < this.planets.length; b++) {
			const p = this.planets[b];
			const ctx = this.ctx;
			const biome = p.biome;
			const atm = this.atmos[b];
			const visible = this.isPlanetVisible(p);

			// Halo atmosférico
			ctx.save();
			const halo = ctx.createRadialGradient(p.x, p.y, p.radius * 0.95, p.x, p.y, p.radius * 1.35);
			halo.addColorStop(0, `rgba(${atm[0]},${atm[1]},${atm[2]},0.38)`);
			halo.addColorStop(0.45, `rgba(${atm[0]},${atm[1]},${atm[2]},0.1)`);
			halo.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = halo;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.radius * 1.35, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();

			// Órbita (mitad trasera) y anillo trasero
			this.drawOrbitRail(p, false);
			if (biome.planetType === 'nave') this.drawRing(p, Math.PI, Math.PI * 2);

			// Lunas del fondo
			this.drawMoonsOfPlanet(b, t, false);

			// Esfera
			if (p.tex && visible) {
				if (!p.surface || t < p.lastRender || t - p.lastRender > 90) this.renderPlanetSurface(p, t);
				ctx.drawImage(p.surface.canvas, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
			} else if (p.surface && p.tex) {
				ctx.drawImage(p.surface.canvas, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
			} else {
				const sph = ctx.createRadialGradient(p.x - p.radius * 0.35, p.y - p.radius * 0.35, p.radius * 0.1, p.x, p.y, p.radius);
				sph.addColorStop(0, this.tint(biome.color, 0.2));
				sph.addColorStop(1, this.tint(biome.color, -0.8));
				ctx.fillStyle = sph;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
				ctx.fill();
			}

			if (visible) MapLife.drawWalker(ctx, p, t, this.reducedMotion);

			// Anillo delantero y órbita delantera
			if (biome.planetType === 'nave') this.drawRing(p, 0, Math.PI);
			this.drawOrbitRail(p, true);

		}
	},

	drawForegroundPlanetNodes(timestamp) {
		const t = timestamp || 0;
		for (let b = 0; b < this.planets.length; b++) {
			this.drawMoonsOfPlanet(b, t, true);
		}
	},

	drawOrbitRail(p, front) {
		const ctx = this.ctx;
		const a0 = front ? 0 : Math.PI;
		const a1 = front ? Math.PI : Math.PI * 2;
		ctx.save();
		ctx.strokeStyle = `${p.biome.color}${front ? '70' : '38'}`;
		ctx.lineWidth = front ? 1.7 : 1.2;
		ctx.setLineDash([3, 7]);
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.ellipse(p.x, p.y, p.orbitRx, p.orbitRy, p.tilt, a0, a1);
		ctx.stroke();
		ctx.restore();
	},

	drawRing(p, a0, a1) {
		const ctx = this.ctx;
		const bands = [
			{ k: 1.34, w: 4, c: 'rgba(203,213,225,0.55)' },
			{ k: 1.44, w: 9, c: 'rgba(148,163,184,0.38)' },
			{ k: 1.55, w: 3, c: 'rgba(226,232,240,0.6)' }
		];
		ctx.save();
		for (const bd of bands) {
			ctx.strokeStyle = bd.c;
			ctx.lineWidth = bd.w;
			ctx.beginPath();
			ctx.ellipse(p.x, p.y, p.radius * bd.k, p.radius * bd.k * 0.2, -0.3, a0, a1);
			ctx.stroke();
		}
		ctx.restore();
	},

	drawMoonsOfPlanet(b, t, front) {
		const order = [];
		for (let i = 0; i < this.nodes.length; i++) {
			const n = this.nodes[i];
			if (n.planetIndex !== b) continue;
			if ((n.depth >= 0) === front) order.push(i);
		}
		order.sort((a, c) => this.nodes[a].depth - this.nodes[c].depth);
		for (const i of order) this.drawMoon(i, t);

		if (!this.isMigrating) {
			const bn = this.nodes[this.bitNodeIndex];
			if (bn && bn.planetIndex === b && ((bn.depth >= 0) === front)) this.drawBitAvatar(t);
		}
	},

	drawMoon(i, timestamp) {
		const ctx = this.ctx;
		const n = this.nodes[i];
		const isUnlocked = this.isLevelAvailable(i);
		const isCurrent = this.state ? i === this.state.unlockedLevel : i === 0;
		const isHovered = i === this.hoveredNodeIndex;
		const starsCount = (this.state && this.state.stars[n.level.id]) || 0;
		const r = this.nodeRadius * n.scale + (isHovered ? 3 : 0);
		const base = isUnlocked ? n.biome.moonColor : '#4b5563';

		ctx.save();
		if (n.depth < 0) ctx.globalAlpha = 0.9;

		if (isCurrent && !this.isMigrating) {
			const pulse = (Math.sin((timestamp || 0) / 280) + 1) / 2;
			const pulseR = r + 7 + pulse * 9;
			ctx.beginPath();
			ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
			ctx.fillStyle = `${n.biome.color}25`;
			ctx.fill();
			ctx.strokeStyle = `${n.biome.color}99`;
			ctx.lineWidth = 2;
			ctx.stroke();
		}

		// Cuerpo de la luna
		const body = ctx.createRadialGradient(n.x - r * 0.4, n.y - r * 0.45, r * 0.1, n.x, n.y, r * 1.05);
		body.addColorStop(0, this.tint(base, 0.5));
		body.addColorStop(0.5, this.tint(base, 0));
		body.addColorStop(1, this.tint(base, -0.7));
		ctx.beginPath();
		ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
		ctx.fillStyle = body;
		ctx.fill();

		ctx.save();
		ctx.beginPath();
		ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
		ctx.clip();
		// Cráteres (posiciones fijas por nivel)
		ctx.fillStyle = 'rgba(0,0,20,0.18)';
		for (let c = 0; c < 4; c++) {
			const ang = (i * 2.3 + c * 1.9);
			const dist = r * (0.2 + 0.5 * ((Math.sin(i * 7.1 + c * 3.3) + 1) / 2));
			ctx.beginPath();
			ctx.arc(n.x + Math.cos(ang) * dist, n.y + Math.sin(ang) * dist, r * (0.1 + 0.07 * ((c * 5 + i) % 3)), 0, Math.PI * 2);
			ctx.fill();
		}
		// Sombra del lado opuesto a la luz
		const shade = ctx.createRadialGradient(n.x - r * 0.55, n.y - r * 0.6, r * 0.5, n.x - r * 0.55, n.y - r * 0.6, r * 1.9);
		shade.addColorStop(0, 'rgba(0,0,20,0)');
		shade.addColorStop(1, 'rgba(0,0,20,0.62)');
		ctx.fillStyle = shade;
		ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
		ctx.restore();

		// Borde / atmósfera tenue
		ctx.beginPath();
		ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
		ctx.strokeStyle = isUnlocked ? n.biome.color : 'rgba(148,163,184,0.4)';
		ctx.lineWidth = isCurrent ? 3.5 : 2.4;
		ctx.stroke();

		if (isUnlocked) {
			ctx.fillStyle = '#ffffff';
			ctx.shadowColor = 'rgba(0,0,0,0.85)';
			ctx.shadowBlur = 4;
			ctx.font = `800 ${Math.round(12 + n.scale * 1.5)}px Inter, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(n.level.id, n.x, n.y + 1);
			ctx.shadowBlur = 0;
			this.drawNodeStars3D(n.x, n.y + r + 11, starsCount);
		} else {
			this.drawPadlock3D(n.x, n.y, 14, '#cbd5e1');
		}

		ctx.restore();
	},

	drawLabels(timestamp) {
		const t = timestamp || 0;
		for (const p of this.planets) {
			this.drawSignboard(p.biome, p.x, p.y - p.radius - 64, t);
			this.drawPlanetBadge(p.biome, p.x, p.y + p.radius + 80);
		}
	},

	drawSignboard(biome, px, py, time) {
		this.ctx.save();

		this.ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.moveTo(px - 45, py - 40);
		this.ctx.lineTo(px - 45, py);
		this.ctx.moveTo(px + 45, py - 40);
		this.ctx.lineTo(px + 45, py);
		this.ctx.stroke();

		const sway = Math.sin(time * 0.0015 + biome.id) * 0.025;
		this.ctx.translate(px, py);
		this.ctx.rotate(sway);

		const boardW = 190;
		const boardH = 46;

		this.ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
		this.ctx.strokeStyle = biome.color;
		this.ctx.lineWidth = 2;
		if (this.ctx.roundRect) {
			this.ctx.beginPath();
			this.ctx.roundRect(-boardW / 2, -boardH / 2, boardW, boardH, 10);
			this.ctx.fill();
			this.ctx.stroke();
		} else {
			this.ctx.fillRect(-boardW / 2, -boardH / 2, boardW, boardH);
			this.ctx.strokeRect(-boardW / 2, -boardH / 2, boardW, boardH);
		}

		this.ctx.fillStyle = biome.color;
		this.ctx.font = '700 9.5px Inter, sans-serif';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'top';
		this.ctx.fillText(`MÓDULO ${biome.id} • ${biome.name.toUpperCase()}`, 0, -boardH / 2 + 7);

		this.ctx.fillStyle = '#ffffff';
		this.ctx.font = '800 13px Inter, sans-serif';
		this.ctx.fillText(biome.title.toUpperCase(), 0, -boardH / 2 + 22);

		this.ctx.restore();
	},

	drawPlanetBadge(biome, px, py) {
		this.ctx.save();
		this.ctx.translate(px, py);

		let starsCount = 0;
		if (this.state && this.state.stars) {
			for (const lvlIdx of biome.levels) {
				const lvl = LEVELS[lvlIdx];
				if (lvl && this.state.stars[lvl.id]) {
					starsCount += this.state.stars[lvl.id];
				}
			}
		}

		const badgeW = 160;
		const badgeH = 32;

		this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
		this.ctx.strokeStyle = biome.color;
		this.ctx.lineWidth = 1.5;
		if (this.ctx.roundRect) {
			this.ctx.beginPath();
			this.ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 16);
			this.ctx.fill();
			this.ctx.stroke();
		} else {
			this.ctx.fillRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
			this.ctx.strokeRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
		}

		this.ctx.fillStyle = '#f59e0b';
		this.ctx.font = '800 12px Inter, sans-serif';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';
		this.ctx.fillText(`★ ${starsCount} / 12 ESTRELLAS`, 0, 0);

		this.ctx.restore();
	},

	drawCosmicFlightPath(timestamp) {
		const ctx = this.ctx;
		for (let b = 0; b < this.planets.length - 1; b++) {
			const fromPlanet = this.planets[b];
			const toPlanet = this.planets[b + 1];
			const route = MapMotion.connectorBetween(fromPlanet, toPlanet);
			const { p1, p2 } = route;
			const unlocked = this.isLevelAvailable(toPlanet.biome.levels[0]);
			const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
			gradient.addColorStop(0, fromPlanet.biome.color);
			gradient.addColorStop(1, toPlanet.biome.color);

			ctx.save();
			ctx.beginPath();
			ctx.moveTo(p1.x, p1.y);
			ctx.lineTo(p2.x, p2.y);
			ctx.strokeStyle = gradient;
			ctx.globalAlpha = 0.12;
			ctx.lineWidth = 10;
			ctx.stroke();
			ctx.globalAlpha = unlocked ? 0.9 : 0.4;
			ctx.lineWidth = unlocked ? 3.5 : 2;
			ctx.stroke();

			if (unlocked) {
				ctx.strokeStyle = '#ffffff';
				ctx.globalAlpha = 0.75;
				ctx.lineWidth = 1.3;
				ctx.setLineDash([5, 14]);
				ctx.lineDashOffset = -timestamp / 33;
				ctx.stroke();
			}
			ctx.restore();
			MapLife.drawTraffic(ctx, route, b, timestamp);
		}
	},

	drawNodeStars3D(cx, cy, count) {
		const spacing = 12;
		const startX = cx - spacing;

		for (let s = 0; s < 3; s++) {
			const sx = startX + s * spacing;
			const isWon = s < count;
			this.ctx.save();
			this.ctx.fillStyle = isWon ? '#f59e0b' : 'rgba(148, 163, 184, 0.45)';
			this.ctx.font = '700 11px Inter, sans-serif';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			this.ctx.fillText(isWon ? '★' : '☆', sx, cy);
			this.ctx.restore();
		}
	},

	drawPadlock3D(cx, cy, size, color) {
		this.ctx.save();
		this.ctx.fillStyle = color;
		this.ctx.strokeStyle = color;

		const bodyW = size * 0.85;
		const bodyH = size * 0.65;
		const bodyX = cx - bodyW / 2;
		const bodyY = cy - bodyH / 4;

		if (this.ctx.roundRect) {
			this.ctx.beginPath();
			this.ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 3);
			this.ctx.fill();
		} else {
			this.ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
		}

		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.arc(cx, bodyY, size * 0.32, Math.PI, 0, false);
		this.ctx.stroke();

		this.ctx.fillStyle = '#0f172a';
		this.ctx.beginPath();
		this.ctx.arc(cx, bodyY + bodyH * 0.45, 2, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.restore();
	},

	drawBitAvatar(timestamp) {
		const walkFrame = this.isMigrating ? Math.floor(((timestamp || 0) / 120) % 4) : 0;
		BitRenderer.draw(this.ctx, this.bitPos.x, this.bitPos.y - 10, this.bitAngle, {
			size: 28,
			walkFrame: walkFrame,
			isWalking: this.isMigrating,
			jumpHeight: 0,
			isTurning: false,
			time: timestamp || Number.EPSILON
		});

		if (!this.isMigrating) {
			const bounce = Math.sin((timestamp || 0) / 250) * 2;
			const tagY = this.bitPos.y - 48 + bounce;

			this.ctx.save();
			this.ctx.fillStyle = '#38bdf8';
			this.ctx.font = '800 10px Inter, sans-serif';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';

			const tagText = "BIT";
			const textW = this.ctx.measureText(tagText).width;
			const padX = 8;
			const padY = 4;

			if (this.ctx.roundRect) {
				this.ctx.beginPath();
				this.ctx.roundRect(this.bitPos.x - textW / 2 - padX, tagY - 8 - padY, textW + padX * 2, 16 + padY, 8);
				this.ctx.fill();
			} else {
				this.ctx.fillRect(this.bitPos.x - textW / 2 - padX, tagY - 8 - padY, textW + padX * 2, 16 + padY);
			}

			this.ctx.beginPath();
			this.ctx.moveTo(this.bitPos.x - 4, tagY + 4);
			this.ctx.lineTo(this.bitPos.x + 4, tagY + 4);
			this.ctx.lineTo(this.bitPos.x, tagY + 8);
			this.ctx.closePath();
			this.ctx.fill();

			this.ctx.fillStyle = '#0f172a';
			this.ctx.fillText(tagText, this.bitPos.x, tagY - 1);
			this.ctx.restore();
		}
	},

	drawParticles() {
		for (const p of this.particles) {
			this.ctx.save();
			this.ctx.globalAlpha = Math.max(p.alpha, 0);
			this.ctx.fillStyle = p.color;
			this.ctx.beginPath();
			this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
			this.ctx.fill();
			this.ctx.restore();
		}
	}
};
