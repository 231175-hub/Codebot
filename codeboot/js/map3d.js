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
	nodeRadius: 36,
	planetRadius: 151,
	worlds: [[0], [1], [2], [3], [4], [5, 6]],
	activeBiomeIndex: 0,
	lastSectorIndex: 5,
	worldControls: null,
	levelControls: null,
	levelButtons: [],
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
	atmos: [[124, 196, 255], [255, 138, 61], [143, 214, 255], [95, 224, 255], [191, 243, 255], [255, 126, 155], [52, 211, 153]],
	LIGHT: (() => { const l = [-0.52, 0.46, 0.72]; const m = Math.hypot(l[0], l[1], l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })(),
	TW: 384,
	TH: 192,

	biomes: [
		{ id: 1, name: "Secuencias", title: "Estación Orbital", subtitle: "Nave Espacial", color: "#38bdf8", darkColor: "#0284c7", lightColor: "#e0f2fe", bgGradient: "rgba(56, 189, 248, 0.15)", moonColor: "#94a3b8", levels: [0, 1, 2, 3], planetType: "nave", orbitTilt: 0.26, speed: 1 },
		{ id: 2, name: "Bucles", title: "Mundo Engranaje", subtitle: "Fábrica de Máquinas", color: "#f59e0b", darkColor: "#b45309", lightColor: "#fffbeb", bgGradient: "rgba(245, 158, 11, 0.15)", moonColor: "#c27a4a", levels: [4, 5, 6, 7], planetType: "fabrica", orbitTilt: -0.2, speed: 0.9 },
		{ id: 3, name: "Condicionales", title: "Bosque Esmeralda", subtitle: "Selva Viva", color: "#22c55e", darkColor: "#15803d", lightColor: "#f0fdf4", bgGradient: "rgba(34, 197, 94, 0.15)", moonColor: "#7cc45f", levels: [8, 9, 10, 11], planetType: "bosque", orbitTilt: 0.18, speed: 1.1 },
		{ id: 4, name: "Variables", title: "Abismo Coral", subtitle: "Océano Profundo", color: "#14b8a6", darkColor: "#0f766e", lightColor: "#f0fdfa", bgGradient: "rgba(20, 184, 166, 0.15)", moonColor: "#3cc9c0", levels: [12, 13, 14, 15], planetType: "oceano", orbitTilt: -0.28, speed: 0.95 },
		{ id: 5, name: "Funciones", title: "Glaciar Aurora", subtitle: "Estación Polar", color: "#a78bfa", darkColor: "#6d28d9", lightColor: "#f5f3ff", bgGradient: "rgba(167, 139, 250, 0.15)", moonColor: "#d4e8ff", levels: [16, 17, 18, 19], planetType: "glaciar", orbitTilt: 0.22, speed: 1.05 },
		{ id: 6, name: "Matrices", title: "Nexo Matricial", subtitle: "Estación de Datos", color: "#fb7185", darkColor: "#be355d", lightColor: "#fff1f2", bgGradient: "rgba(251, 113, 133, 0.16)", moonColor: "#d789a2", levels: [20, 21, 22, 23], planetType: "matriz", orbitTilt: -0.24, speed: 1 },
		{ id: 7, name: "Microprocesador", title: "Microprocesador Profundo", subtitle: "Circuito Supaplex", color: "#10b981", darkColor: "#047857", lightColor: "#ecfdf5", bgGradient: "rgba(16, 185, 129, 0.16)", moonColor: "#34d399", levels: [24, 25, 26, 27, 28], planetType: "fabrica", orbitTilt: 0.28, speed: 1.0 }
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

	init(canvasId, containerId, tooltipId, onSelectLevel, isLevelAllowed) {
		this.canvas = document.getElementById(canvasId);
		this.ctx = this.canvas.getContext('2d');
		this.container = document.getElementById(containerId);
		this.tooltip = document.getElementById(tooltipId);
		this.onSelectLevel = onSelectLevel;
		this.isLevelAllowed = isLevelAllowed;

		this.computeLayout();
		this.bindWorldControls();
		this.bindEvents();
		this.renderFrame = this.renderLoop.bind(this);
		requestAnimationFrame(this.renderFrame);
	},

	updateState(state) {
		this.state = state;
		this.bitNodeIndex = Math.min(state.unlockedLevel, LEVELS.length - 1);
		if (!this.isMigrating && this.nodes[this.bitNodeIndex]) {
			this.bitPos.x = this.nodes[this.bitNodeIndex].x;
			this.bitPos.y = this.nodes[this.bitNodeIndex].y;
		}
		this.updateWorldControls();
	},

	computeLayout(recenter = true) {
		const height = this.container.clientHeight;
		const width = this.container.clientWidth;
		if (!width || !height || (width === this.layoutWidth && height === this.layoutHeight && this.layoutDpr === window.devicePixelRatio)) return;
		const previousStep = this.planets.length > 1 ? (this.planets[1].x - this.planets[0].x) * this.viewScale : 0;
		const previousScroll = this.container.scrollLeft;
		this.layoutWidth = width;
		this.layoutHeight = height;
		this.layoutDpr = window.devicePixelRatio;
		const previousWidth = this.virtualWidth;
		const previousHeight = this.virtualHeight;
		this.viewScale = Math.min(height / 450, width / 460, 2.4);
		const viewWidth = width / this.viewScale;
		const biomeW = Math.max(620, viewWidth * 0.78);
		this.virtualHeight = height / this.viewScale;
		this.virtualWidth = viewWidth + (this.biomes.length - 1) * biomeW;

		const pixelScale = Math.min(this.viewScale * (this.layoutDpr || 1), 2.4, 8192 / this.virtualWidth);
		this.canvas.width = Math.round(this.virtualWidth * pixelScale);
		this.canvas.height = Math.round(this.virtualHeight * pixelScale);
		this.canvas.style.width = `${this.virtualWidth * this.viewScale}px`;
		this.canvas.style.height = `${height}px`;
		this.ctx.scale(this.canvas.width / this.virtualWidth, this.canvas.height / this.virtualHeight);
		this.dpr = pixelScale;

		if (this.stars.length === 0) {
			for (let s = 0; s < 460; s++) {
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
		} else {
			for (const star of this.stars) {
				star.x *= this.virtualWidth / previousWidth;
				star.y *= this.virtualHeight / previousHeight;
			}
		}

		const oldPlanets = this.planets;
		this.nodes = [];
		this.planets = [];
		const cy = this.virtualHeight / 2;
		const orbitRx = Math.max(155, Math.min(305, viewWidth * 0.24));

		for (let b = 0; b < this.biomes.length; b++) {
			const biome = this.biomes[b];
			const old = oldPlanets[b];

			this.planets.push({
				biome: biome,
				index: b,
				x: viewWidth / 2 + b * biomeW,
				y: cy,
				radius: this.planetRadius,
				orbitRx,
				orbitRy: 151,
				tilt: b === 4 ? 0 : biome.orbitTilt * 0.25,
				angle: old?.angle ?? 0,
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

		if (this.isMigrating) this.migrationPath = this.createMigrationPath(this.migrationFrom, this.migrationTo);
		else if (this.nodes[this.bitNodeIndex]) {
			this.bitPos.x = this.nodes[this.bitNodeIndex].x;
			this.bitPos.y = this.nodes[this.bitNodeIndex].y;
		}
		if (previousStep && (!recenter || this.panMode !== 'idle')) {
			const ratio = biomeW * this.viewScale / previousStep;
			this.container.scrollLeft = this.clampPanValue(previousScroll * ratio);
			this.panTarget = this.clampPanValue(this.panTarget * ratio);
			this.panVelocity *= ratio;
			if (this.panPointerId !== null) {
				this.panStartScrollLeft = this.panTarget;
				this.panStartClientX = this.panLastClientX;
			}
		} else {
			this.setScrollTarget(this.getBiomeScrollLeft(this.activeBiomeIndex), 110, true);
		}
		this.positionLevelControls();
	},

	positionNodes() {
		const fourMoons = [Math.PI, Math.PI / 2, 0, -1];
		const fiveMoons = [Math.PI, 1.9, 0.64, -0.38, -1.42];
		for (const n of this.nodes) {
			const p = this.planets[n.planetIndex];
			const slots = p.biome.levels.length === fourMoons.length ? fourMoons : fiveMoons;
			const a = p.angle + slots[n.orbitSlot];
			const point = MapMotion.orbitPoint(p, a);
			n.x = point.x;
			n.y = point.y;
			n.orbitAngle = a;
			n.depth = point.depth;
			n.scale = 0.94 + 0.10 * n.depth;
			n.inFront = true;
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

	getFlightRoute(fromPlanet, toPlanet) {
		const route = MapMotion.connectorBetween(fromPlanet, toPlanet);
		const lift = Math.min(135, (route.p2.x - route.p1.x) * 0.26);
		route.cp1.y += lift;
		route.cp2.y -= lift;
		return route;
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
			this.appendPathPoints(points, this.sampleOrbitPath(this.planets[fromPlanetIndex], fromNode.orbitAngle, toNode.orbitAngle, 36));
		} else {
			this.appendPathPoints(points, [fromNode]);
			for (let b = fromPlanetIndex; b < toPlanetIndex; b++) {
				const route = this.getFlightRoute(this.planets[b], this.planets[b + 1]);
				for (let step = 0; step <= 30; step++) {
					this.appendPathPoints(points, [MapMotion.cubicPoint(route, step / 30)]);
				}
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
		if (path.points.length === 1 || path.totalLength === 0) return path.points[0];

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
		return { x, y };
	},

	/* Devuelve el índice de la luna bajo el cursor (las de delante primero; las ocultas tras el planeta no cuentan) */
	hitNode(mouseX, mouseY) {
		let best = -1;
		let bestDepth = -Infinity;
		for (let i = 0; i < this.nodes.length; i++) {
			const n = this.nodes[i];
			const r = this.nodeRadius * n.scale + 8;
			if (Math.hypot(n.x - mouseX, n.y - mouseY) > r) continue;
			if (!n.inFront && n.depth < 0) {
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
		if (this.state && this.isLevelAllowed) return this.isLevelAllowed(index);
		const level = this.nodes[index]?.level;
		return Boolean(level && (level.id === '7.1' || index <= (this.state?.unlockedLevel ?? 0) || Number(this.state?.stars?.[level.id]) > 0));
	},

	getLockRequirement(index) {
		return this.isLevelAvailable(index) ? null : this.nodes[index - 1]?.level.id;
	},

	bindWorldControls() {
		const panel = document.getElementById('progress-map-panel');
		const indicators = document.getElementById('map-world-indicators');
		const prev = document.getElementById('btn-map-prev-world');
		const next = document.getElementById('btn-map-next-world');
		const sectors = document.getElementById('map-world-sectors');
		const sectorButtons = [
			document.getElementById('btn-map-matrix-world'),
			document.getElementById('btn-map-processor-world')
		];
		const worldButtons = this.worlds.map(([biomeIndex], worldIndex) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.setAttribute('aria-label', `Mundo ${worldIndex + 1} · ${this.biomes[biomeIndex].title}`);
			button.addEventListener('click', () => this.goToWorld(worldIndex));
			return button;
		});
		indicators.replaceChildren(...worldButtons);
		this.levelControls = document.getElementById('map-level-controls');
		this.worldControls = {
			panel, worldButtons, prev, next, sectors, sectorButtons,
			moduleTitle: document.getElementById('map-module-title'),
			worldTitle: document.getElementById('map-world-title'),
			stars: document.getElementById('map-world-stars')
		};
		prev.addEventListener('click', () => this.goToWorld(this.activeWorldIndex - 1));
		next.addEventListener('click', () => this.goToWorld(this.activeWorldIndex + 1));
		sectorButtons.forEach((button, index) => {
			button.addEventListener('click', () => this.navigateToBiome(this.worlds.at(-1)[index]));
		});
		this.updateWorldControls();
	},

	goToWorld(worldIndex) {
		const world = this.worlds[worldIndex];
		if (!world) return;
		const biomeIndex = world.includes(this.lastSectorIndex) ? this.lastSectorIndex : world[0];
		this.navigateToBiome(biomeIndex);
	},

	navigateToBiome(biomeIndex) {
		if (this.isMigrating || this.panPointerId !== null) return;
		this.hoveredNodeIndex = -1;
		this.hideTooltip();
		this.scrollToBiome(biomeIndex);
	},

	setActiveBiome(biomeIndex) {
		if (this.activeBiomeIndex === biomeIndex) return;
		this.activeBiomeIndex = biomeIndex;
		if (this.worlds.at(-1).includes(biomeIndex)) this.lastSectorIndex = biomeIndex;
		this.updateWorldControls();
	},

	updateWorldControls() {
		if (!this.worldControls) return;
		const { panel, worldButtons, prev, next, sectors, sectorButtons, moduleTitle, worldTitle, stars } = this.worldControls;
		const biome = this.biomes[this.activeBiomeIndex];
		this.activeWorldIndex = this.worlds.findIndex(world => world.includes(this.activeBiomeIndex));
		const worldStars = biome.levels.reduce((total, index) => total + (Number(this.state?.stars?.[LEVELS[index].id]) || 0), 0);
		stars.textContent = `${worldStars} / ${biome.levels.length * 3} ${this.activeWorldIndex === this.worlds.length - 1 ? 'en este sector' : 'en este mundo'}`;
		moduleTitle.textContent = `Módulo ${biome.id} · ${biome.name}`;
		worldTitle.textContent = biome.title;
		panel.style.setProperty('--map-accent', biome.color);
		prev.disabled = this.activeWorldIndex === 0;
		next.disabled = this.activeWorldIndex === this.worlds.length - 1;
		worldButtons.forEach((button, index) => {
			if (index === this.activeWorldIndex) button.setAttribute('aria-current', 'true');
			else button.removeAttribute('aria-current');
		});
		sectors.hidden = this.activeWorldIndex !== this.worlds.length - 1;
		sectorButtons.forEach((button, index) => {
			button.setAttribute('aria-pressed', String(this.activeBiomeIndex === this.worlds.at(-1)[index]));
		});
		this.updateLevelControls(biome);
	},

	updateLevelControls(biome) {
		if (this.renderedBiomeIndex !== this.activeBiomeIndex) {
			this.renderedBiomeIndex = this.activeBiomeIndex;
			this.levelButtons = biome.levels.map(index => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'map-level-control';
				button.addEventListener('focus', () => { this.focusedNodeIndex = index; });
				button.addEventListener('blur', () => { this.focusedNodeIndex = -1; });
				button.addEventListener('click', () => {
					if (!this.isMigrating && this.isLevelAvailable(index)) this.onSelectLevel?.(index);
				});
				return button;
			});
			this.levelControls.replaceChildren(...this.levelButtons);
		}
		this.levelButtons.forEach((button, offset) => {
			const index = biome.levels[offset];
			const level = LEVELS[index];
			const stars = Number(this.state?.stars?.[level.id]) || 0;
			const requirement = this.getLockRequirement(index);
			const status = stars > 0
				? `Completado, ${stars} de 3 estrellas`
				: requirement ? `Bloqueado, completa ${requirement}` : index === this.bitNodeIndex ? 'Nivel actual' : 'Disponible';
			button.setAttribute('aria-label', `Nivel ${level.id} · ${level.title} · ${status}`);
			button.setAttribute('aria-disabled', String(Boolean(requirement)));
		});
		this.positionLevelControls();
	},

	positionLevelControls() {
		if (!this.levelButtons.length) return;
		const indices = this.biomes[this.activeBiomeIndex].levels;
		for (const [offset, button] of this.levelButtons.entries()) {
			const node = this.nodes[indices[offset]];
			const radius = Math.max(22, this.nodeRadius * node.scale * this.viewScale);
			const x = node.x * this.viewScale - this.container.scrollLeft - radius;
			const y = node.y * this.viewScale - radius;
			const diameter = `${radius * 2}px`;
			button.style.width = diameter;
			button.style.height = diameter;
			button.style.transform = `translate(${x}px, ${y}px)`;
			button.style.visibility = x >= 0 && x + radius * 2 <= this.container.clientWidth ? '' : 'hidden';
		}
	},

	syncWorldFromPan() {
		const center = (this.container.scrollLeft + this.container.clientWidth / 2) / this.viewScale;
		const separation = this.planets[1].x - this.planets[0].x;
		const nearest = Math.round((center - this.planets[0].x) / separation);
		this.setActiveBiome(Math.max(0, Math.min(this.planets.length - 1, nearest)));
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

	setScrollTarget(left, easeMs = 110, immediate = false) {
		if (!this.container) return;
		this.panTarget = this.clampPanValue(left);
		this.panVelocity = 0;
		this.panEaseMs = Math.max(1, easeMs);
		if (immediate || this.reducedMotion) {
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
			const distance = Math.abs(difference);
			const step = Math.min(distance, Math.max(1, distance * factor));
			this.container.scrollLeft = this.clampPanValue(current + Math.sign(difference) * step);
			if (this.panMode !== 'drag' && Math.abs(this.panTarget - this.container.scrollLeft) <= 0.5) {
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

		if (moved && this.reducedMotion && this.worldControls) this.syncWorldFromPan();
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
				if (this.worldControls) this.computeLayout();
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
						if (this.worldControls) this.syncWorldFromPan();
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
			if (this.reducedMotion) {
				this.finishMigration(false);
				this.particles.length = 0;
				this.scrollToBiome(this.activeBiomeIndex, true);
			}
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
		const status = starsCount > 0 ? 'Completado · Repetir'
			: isUnlocked ? (index === this.bitNodeIndex ? 'Nivel actual' : 'Disponible')
				: `Completa ${this.getLockRequirement(index)}`;

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

	scrollToNode(index, immediate = false) {
		if (this.nodes[index]) this.scrollToBiome(this.nodes[index].planetIndex, immediate);
	},

	getBiomeScrollLeft(biomeIndex) {
		return this.planets[biomeIndex].x * this.viewScale - this.container.clientWidth / 2;
	},

	scrollToBiome(biomeIndex, immediate = false) {
		if (!this.container || !this.planets[biomeIndex]) return;
		this.setActiveBiome(biomeIndex);
		this.computeLayout(false);
		this.setScrollTarget(this.getBiomeScrollLeft(biomeIndex), 110, immediate);
		this.positionLevelControls();
	},

	animateTransition(fromIndex, toIndex) {
		if (fromIndex >= toIndex || !this.nodes[fromIndex] || !this.nodes[toIndex]) {
			return Promise.resolve();
		}

		const fromNode = this.nodes[fromIndex];
		const toNode = this.nodes[toIndex];
		this.finishMigration(false);
		if (this.reducedMotion) {
			this.scrollToNode(toIndex, true);
			return Promise.resolve();
		}
		if (fromNode.planetIndex !== toNode.planetIndex) this.scrollToNode(fromIndex, true);
		this.scrollToNode(toIndex);
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
		if (this.container.clientWidth) {
			this.update(timestamp);
			this.draw(timestamp);
		} else {
			this.finishMigration(false);
		}
		requestAnimationFrame(this.renderFrame);
	},

	finishMigration(celebrate) {
		if (!this.isMigrating) return;
		this.isMigrating = false;
		const targetNode = this.nodes[this.migrationTo];
		this.bitPos.x = targetNode.x;
		this.bitPos.y = targetNode.y;
		this.migrationPath = null;
		this.migrationFrozenPlanets = [];
		if (celebrate) {
			this.spawnCelebration(targetNode.x, targetNode.y, targetNode.biome.color);
			if (typeof SoundFX !== 'undefined') SoundFX.playUnlock();
		}
		const resolve = this.migrationResolve;
		this.migrationResolve = null;
		resolve?.();
	},

	update(timestamp) {
		const dt = this.lastTimestamp ? Math.min(timestamp - this.lastTimestamp, 100) : 16;
		this.lastTimestamp = timestamp;
		const wasPanning = ['drag', 'inertia', 'wheel'].includes(this.panMode);
		this.updatePan(dt);
		if (wasPanning) this.syncWorldFromPan();

		const hoveredPlanet = this.nodes[this.hoveredNodeIndex]?.planetIndex;
		const pressedPlanet = this.nodes[this.pressedNodeIndex]?.planetIndex;
		for (let b = 0; b < this.planets.length; b++) {
			const p = this.planets[b];
			if (b !== hoveredPlanet && b !== pressedPlanet && !this.migrationFrozenPlanets.includes(b)) {
				p.angle = this.reducedMotion ? 0 : Math.sin(timestamp * 0.00055 * p.biome.speed + b) * 0.025;
			}
		}
		this.positionNodes();
		this.positionLevelControls();

		if (this.isMigrating) {
			const elapsed = timestamp - this.migrationStart;
			const progress = Math.min(elapsed / this.migrationDuration, 1);
			const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

			const pos = this.evalMigrationPath(ease);
			if (pos) {
				this.bitPos.x = pos.x;
				this.bitPos.y = pos.y;
			}

			if (timestamp - this.migrationLastStepTime > 160) {
				this.migrationLastStepTime = timestamp;
				if (typeof SoundFX !== 'undefined') SoundFX.playStep();
			}

			if (progress >= 1) this.finishMigration(true);
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
		const atm = (this.atmos && this.atmos[p.index]) || [52, 211, 153];
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
		this.drawSpaceBackground(time);
		this.drawCosmicFlightPath();
		this.drawPlanetSystems(time);

		const bitNode = this.nodes[this.bitNodeIndex];
		if (this.isMigrating || (bitNode && this.isPlanetVisible(this.planets[bitNode.planetIndex]))) {
			this.drawBitAvatar(time);
		}
		if (!this.reducedMotion) this.drawParticles();
	},

	drawSpaceBackground(timestamp) {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

		for (const planet of this.planets) {
			if (!this.isPlanetVisible(planet)) continue;
			const glowRadius = Math.max(planet.orbitRx * 1.7, planet.radius * 2.7);
			const glow = ctx.createRadialGradient(planet.x, planet.y, 0, planet.x, planet.y, glowRadius);
			glow.addColorStop(0, `${planet.biome.color}32`);
			glow.addColorStop(0.6, `${planet.biome.color}0c`);
			glow.addColorStop(1, 'transparent');
			ctx.fillStyle = glow;
			ctx.fillRect(planet.x - glowRadius, planet.y - glowRadius, glowRadius * 2, glowRadius * 2);
		}

		ctx.save();
		for (const star of this.stars) {
			const shimmer = this.reducedMotion ? 0.85 : 0.82 + 0.18 * Math.sin(timestamp * 0.001 * star.speed + star.phase);
			ctx.fillStyle = star.color;
			ctx.globalAlpha = star.alpha * shimmer;
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.r * 0.8, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	},

	drawCosmicFlightPath() {
		const ctx = this.ctx;
		for (let index = 0; index < this.planets.length - 1; index++) {
			const fromPlanet = this.planets[index];
			const toPlanet = this.planets[index + 1];
			if (!this.isPlanetVisible(fromPlanet) && !this.isPlanetVisible(toPlanet)) continue;

			const { p1, cp1, cp2, p2 } = this.getFlightRoute(fromPlanet, toPlanet);
			const reached = this.hasTraveledRoute(fromPlanet.biome.levels.at(-1), toPlanet.biome.levels[0]);
			ctx.beginPath();
			ctx.moveTo(p1.x, p1.y);
			ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
			this.strokeDottedRoute(reached, 3.9, 11);
		}
	},

	hasTraveledRoute(fromIndex, toIndex) {
		const fromLevel = this.nodes[fromIndex].level;
		return Number(this.state?.stars?.[fromLevel.id]) > 0 && this.isLevelAvailable(toIndex);
	},

	strokeDottedRoute(reached, width, spacing) {
		const ctx = this.ctx;
		ctx.save();
		ctx.lineCap = 'round';
		ctx.setLineDash([0.7, spacing]);
		ctx.lineWidth = width;
		ctx.strokeStyle = reached ? '#6bf6ff' : '#776f9f';
		if (reached) {
			ctx.shadowColor = '#42e2fa';
			ctx.shadowBlur = 8;
		}
		ctx.stroke();
		ctx.restore();
	},

	drawPlanetSystems(timestamp) {
		const ctx = this.ctx;
		for (const planet of this.planets) {
			if (!this.isPlanetVisible(planet)) continue;
			const { x, y, radius, biome } = planet;
			const [red, green, blue] = this.atmos[planet.index];
			const halo = ctx.createRadialGradient(x, y, radius * 0.96, x, y, radius * 1.27);
			halo.addColorStop(0, `rgba(${red},${green},${blue},0.27)`);
			halo.addColorStop(0.48, `rgba(${red},${green},${blue},0.08)`);
			halo.addColorStop(1, 'transparent');
			ctx.fillStyle = halo;
			ctx.beginPath();
			ctx.arc(x, y, radius * 1.27, 0, Math.PI * 2);
			ctx.fill();

			this.drawOrbitRail(planet, Math.PI, Math.PI * 2);
			if (biome.planetType === 'nave') this.drawRing(planet, Math.PI, Math.PI * 2);
			this.drawPlanetSurface(planet, timestamp);
			if (biome.planetType === 'glaciar') this.drawAurora(planet, timestamp);
			MapLife.drawWalker(ctx, planet, timestamp, this.reducedMotion);
			if (biome.planetType === 'nave') this.drawRing(planet, 0, Math.PI);
			this.drawOrbitRail(planet, 0, Math.PI);
			this.drawLocalTraffic(planet, timestamp);

			for (const index of biome.levels) this.drawMoon(index, timestamp);
		}
	},

	drawPlanetSurface(planet, timestamp) {
		const ctx = this.ctx;
		const { x, y, radius, biome } = planet;
		if (planet.tex) {
			if (!planet.surface || timestamp < planet.lastRender || timestamp - planet.lastRender > 90) {
				this.renderPlanetSurface(planet, timestamp);
			}
			ctx.drawImage(planet.surface.canvas, x - radius, y - radius, radius * 2, radius * 2);
		} else {
			const fallback = ctx.createRadialGradient(x - radius * 0.34, y - radius * 0.36, 0, x, y, radius);
			const color = biome.planetType === 'glaciar' ? '#8fcef2' : biome.color;
			fallback.addColorStop(0, this.tint(color, 0.42));
			fallback.addColorStop(1, this.tint(color, -0.72));
			ctx.fillStyle = fallback;
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.strokeStyle = `${biome.color}38`;
		ctx.lineWidth = 1.5;
		ctx.stroke();
	},

	drawAurora(planet, timestamp) {
		const ctx = this.ctx;
		const phase = timestamp / 2400;
		const sway = Math.sin(phase) * 0.055;
		const ripple = Math.sin(phase * 1.3 + 0.7) * 0.06;
		ctx.save();
		ctx.translate(planet.x, planet.y);
		ctx.scale(planet.radius, planet.radius);
		const color = ctx.createLinearGradient(-1.18, 0, 1.14, 0);
		color.addColorStop(0, 'rgba(49, 255, 179, 0)');
		color.addColorStop(0.26, 'rgba(59, 255, 173, 0.70)');
		color.addColorStop(0.53, 'rgba(98, 242, 221, 0.78)');
		color.addColorStop(0.76, 'rgba(173, 130, 255, 0.82)');
		color.addColorStop(1, 'rgba(153, 104, 247, 0)');
		ctx.fillStyle = color;

		for (const [height, opacity] of [[0.32, 0.2], [0.22, 0.32], [0.12, 0.54]]) {
			ctx.globalAlpha = opacity;
			ctx.beginPath();
			ctx.moveTo(-1.18, -0.43);
			ctx.bezierCurveTo(-0.85, -0.87, -0.42, -0.55 + sway, -0.08, -0.76 + sway);
			ctx.bezierCurveTo(0.30, -1.04 + ripple, 0.65, -1.48 + ripple, 1.14, -0.61);
			ctx.bezierCurveTo(0.63, -1.39 + ripple + height, 0.35, -0.93 + ripple + height, -0.06, -0.70 + sway + height);
			ctx.bezierCurveTo(-0.43, -0.52 + sway + height, -0.84, -0.78 + height, -1.18, -0.43);
			ctx.fill();
		}
		ctx.restore();
	},

	drawOrbitRail(planet, from, to) {
		const ctx = this.ctx;
		const { x, y, orbitRx, orbitRy, tilt, biome } = planet;
		ctx.beginPath();
		ctx.ellipse(x, y, orbitRx, orbitRy, tilt, from, to);
		this.strokeDottedRoute(false, 2.1, 7.8);

		if (from !== 0) return;
		for (let i = 0; i < biome.levels.length - 1; i++) {
			const index = biome.levels[i];
			const nextIndex = biome.levels[i + 1];
			if (!this.hasTraveledRoute(index, nextIndex)) continue;

			const angle = this.nodes[index].orbitAngle;
			const angleGap = this.nodes[nextIndex].orbitAngle - angle;
			const span = Math.atan2(Math.sin(angleGap), Math.cos(angleGap));
			ctx.beginPath();
			ctx.ellipse(x, y, orbitRx, orbitRy, tilt, angle, angle + span, span < 0);
			this.strokeDottedRoute(true, 4, 9.6);
		}
	},

	drawRing(planet, from, to) {
		const ctx = this.ctx;
		ctx.save();
		for (const [radius, width, color] of [[1.34, 3, '#cbd5e177'], [1.44, 7, '#94a3b84a'], [1.54, 2, '#e2e8f085']]) {
			ctx.strokeStyle = color;
			ctx.lineWidth = width;
			ctx.beginPath();
			ctx.ellipse(planet.x, planet.y, planet.radius * radius, planet.radius * radius * 0.2, -0.25, from, to);
			ctx.stroke();
		}
		ctx.restore();
	},

	drawLocalTraffic(planet, timestamp) {
		const ctx = this.ctx;
		const lane = (planet.index % 2 === 0 ? -1 : 1) * (65 + planet.index * 7);
		ctx.save();
		ctx.translate(planet.x - planet.orbitRx * 0.72, planet.y - planet.orbitRy * 0.7);
		ctx.scale(0.72, 0.72);
		MapLife.drawTraffic(ctx, {
			p1: { x: -67, y: -lane + 13 },
			cp1: { x: -22, y: -lane - 8 },
			cp2: { x: 23, y: -lane - 14 },
			p2: { x: 67, y: -lane + 2 }
		}, planet.index, timestamp);
		ctx.restore();
	},

	drawMoon(index, timestamp) {
		const ctx = this.ctx;
		const node = this.nodes[index];
		const { x, y, scale, level, biome } = node;
		const stars = Number(this.state?.stars?.[level.id]) || 0;
		const available = this.isLevelAvailable(index);
		const current = available && !stars && index === this.bitNodeIndex;
		const highlighted = index === this.hoveredNodeIndex || index === this.focusedNodeIndex;
		const radius = this.nodeRadius * scale + (highlighted ? 2 : 0);
		const edge = stars > 0 ? '#37e2a0' : current ? '#ffc953' : available ? '#9ca6ff' : '#72779e';
		const bright = current ? '#fff6cb' : available ? '#ecf5ff' : '#494e73';
		const base = current ? '#f7d783' : available ? '#accbee' : '#2d3252';

		ctx.save();
		if (current && !this.isMigrating) {
			const pulse = this.reducedMotion ? 0.45 : (Math.sin(timestamp / 510) + 1) / 2;
			ctx.beginPath();
			ctx.arc(x, y, radius + 6 + pulse * 6, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255, 195, 59, ${0.15 + pulse * 0.07})`;
			ctx.fill();
		}

		const fill = ctx.createRadialGradient(x - radius * 0.34, y - radius * 0.36, 0, x, y, radius * 1.32);
		fill.addColorStop(0, bright);
		fill.addColorStop(1, base);
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.strokeStyle = edge;
		ctx.lineWidth = current || stars > 0 ? 4.5 : 3;
		ctx.stroke();

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		if (available) {
			ctx.font = `800 ${Math.round(Math.max(radius * 0.87, 10 / this.viewScale))}px "Baloo 2", sans-serif`;
			ctx.fillStyle = current ? '#382500' : '#182753';
			ctx.fillText(level.id, x, y + 1);
			if (stars > 0) this.drawNodeStars(x, y + radius + 14, stars, radius);
		} else {
			this.drawPadlock(x, y, radius * 0.87);
			const firstLocked = biome.levels.find(levelIndex => !this.isLevelAvailable(levelIndex));
			const required = index === firstLocked ? this.getLockRequirement(index) : null;
			const labelY = y + radius + Math.max(12, 8 / this.viewScale);
			ctx.shadowColor = '#090c21';
			ctx.shadowBlur = 3;
			ctx.fillStyle = '#e0e3f9';
			ctx.font = `800 ${Math.max(17, 11 / this.viewScale)}px "Baloo 2", sans-serif`;
			const compact = this.planets[node.planetIndex].orbitRx < 200 || this.viewScale < 0.5;
			ctx.fillText(required && !compact ? `${level.id} · Completa ${required}` : level.id, x, labelY);
			if (required && compact) {
				ctx.font = `700 ${Math.max(15, 10 / this.viewScale)}px "Baloo 2", sans-serif`;
				ctx.fillText(`Completa ${required}`, x, labelY + Math.max(15, 11 / this.viewScale));
			}
		}
		ctx.restore();
	},

	drawNodeStars(x, y, count, radius) {
		const ctx = this.ctx;
		const spacing = Math.max(12, radius * 0.44, 6 / this.viewScale);
		const starRadius = spacing * 0.48;
		for (let star = 0; star < 3; star++) {
			const center = x + (star - 1) * spacing;
			ctx.beginPath();
			for (let point = 0; point < 10; point++) {
				const angle = point * Math.PI / 5 - Math.PI / 2;
				const length = point % 2 === 0 ? starRadius : starRadius * 0.43;
				ctx.lineTo(center + Math.cos(angle) * length, y + Math.sin(angle) * length);
			}
			ctx.closePath();
			ctx.fillStyle = star < count ? '#ffcf5a' : '#384269';
			ctx.fill();
			if (star >= count) {
				ctx.strokeStyle = '#9297b7';
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}
	},

	drawPadlock(x, y, size) {
		const ctx = this.ctx;
		const top = y - size * 0.04;
		ctx.fillStyle = '#e1e4ff';
		ctx.strokeStyle = ctx.fillStyle;
		ctx.lineWidth = size * 0.12;
		ctx.beginPath();
		ctx.arc(x, top - size * 0.1, size * 0.22, Math.PI, 0);
		ctx.lineTo(x + size * 0.22, top + size * 0.12);
		ctx.moveTo(x - size * 0.22, top - size * 0.1);
		ctx.lineTo(x - size * 0.22, top + size * 0.12);
		ctx.stroke();
		ctx.beginPath();
		ctx.roundRect(x - size * 0.34, top, size * 0.68, size * 0.51, size * 0.10);
		ctx.fill();
	},

	drawBitAvatar(timestamp) {
		const ctx = this.ctx;
		const { x, y } = this.bitPos;
		const radius = this.isMigrating ? 0 : this.nodeRadius * this.nodes[this.bitNodeIndex].scale;
		const markerY = y - radius - 9;
		const size = Math.min(1, Math.max(0.36, (markerY - 5) / 69));
		const bounce = this.reducedMotion ? 0 : 2.5 + Math.sin(timestamp / 380 - 0.6) * 2.5;

		ctx.save();
		ctx.translate(x, markerY - size * 26 - bounce);
		ctx.scale(size, size);
		ctx.lineWidth = 3;
		ctx.strokeStyle = '#9dd3ff';
		ctx.beginPath();
		ctx.moveTo(0, -18);
		ctx.lineTo(0, -34);
		ctx.stroke();
		ctx.fillStyle = '#ffd05b';
		ctx.beginPath();
		ctx.arc(0, -35, 4.7, 0, Math.PI * 2);
		ctx.fill();

		const shell = ctx.createLinearGradient(0, -23, 0, 16);
		shell.addColorStop(0, '#5185ff');
		shell.addColorStop(1, '#2258e4');
		ctx.fillStyle = shell;
		ctx.lineWidth = 2.8;
		ctx.strokeStyle = '#b1ddff';
		ctx.beginPath();
		ctx.roundRect(-25, -22, 50, 41, 13);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = '#10153e';
		ctx.beginPath();
		ctx.roundRect(-18, -13, 36, 21, 9);
		ctx.fill();

		ctx.fillStyle = '#62f5ff';
		ctx.shadowColor = '#39cffe';
		ctx.shadowBlur = 7;
		for (const side of [-1, 1]) {
			ctx.beginPath();
			ctx.arc(side * 7.3, -2.5, 3.5, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.shadowBlur = 0;

		ctx.fillStyle = '#ffbc49';
		ctx.beginPath();
		ctx.moveTo(-8, 21);
		ctx.lineTo(8, 21);
		ctx.lineTo(0, 30);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	},

	drawParticles() {
		const ctx = this.ctx;
		ctx.save();
		for (const particle of this.particles) {
			ctx.globalAlpha = Math.max(0, particle.alpha);
			ctx.fillStyle = particle.color;
			ctx.beginPath();
			ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}
};
