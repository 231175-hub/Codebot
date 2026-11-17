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
	splines: [],
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
	particles: [],
	virtualWidth: 680,
	virtualHeight: 1680,
	nodeRadius: 28,

	biomes: [
		{ id: 1, name: "Secuencias", title: "Órbita Estelar", subtitle: "Mundo de Cristal", color: "#38bdf8", darkColor: "#0284c7", lightColor: "#e0f2fe", bgGradient: "rgba(56, 189, 248, 0.15)", levels: [0, 1, 2, 3], planetType: "espacio" },
		{ id: 2, name: "Bucles", title: "Mundo Engranaje", subtitle: "Fábrica a Vapor", color: "#f59e0b", darkColor: "#b45309", lightColor: "#fffbeb", bgGradient: "rgba(245, 158, 11, 0.15)", levels: [4, 5, 6, 7], planetType: "maquinas" },
		{ id: 3, name: "Condicionales", title: "Planeta Jardín", subtitle: "Pradera Viva", color: "#22c55e", darkColor: "#15803d", lightColor: "#f0fdf4", bgGradient: "rgba(34, 197, 94, 0.15)", levels: [8, 9, 10, 11], planetType: "campo" },
		{ id: 4, name: "Variables", title: "Matriz Neón", subtitle: "Laboratorio Ciber", color: "#ec4899", darkColor: "#be185d", lightColor: "#fdf2f8", bgGradient: "rgba(236, 72, 153, 0.15)", levels: [12, 13, 14, 15], planetType: "ciberespacio" },
		{ id: 5, name: "Funciones", title: "Templo Cósmico", subtitle: "Ciudadela de Jade", color: "#10b981", darkColor: "#047857", lightColor: "#ecfdf5", bgGradient: "rgba(16, 185, 129, 0.15)", levels: [16, 17, 18, 19], planetType: "cristal" }
	],

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
		const containerH = this.container ? this.container.clientHeight : 580;
		this.virtualHeight = Math.max(containerH - 40, 560);

		const biomeW = 820;
		const totalBiomes = this.biomes.length;
		this.virtualWidth = totalBiomes * biomeW + 160;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.canvas.width = this.virtualWidth * dpr;
		this.canvas.height = this.virtualHeight * dpr;
		this.canvas.style.width = `${this.virtualWidth}px`;
		this.canvas.style.height = `${this.virtualHeight}px`;
		this.ctx.scale(dpr, dpr);

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

		this.nodes = [];
		this.planets = [];
		const cy = this.virtualHeight / 2;

		for (let b = 0; b < this.biomes.length; b++) {
			const biome = this.biomes[b];
			const biomeStartX = 80 + b * biomeW;
			const planetX = biomeStartX + biomeW / 2;
			const planetY = cy - 35;
			const planetR = 108;

			this.planets.push({
				biome: biome,
				x: planetX,
				y: planetY,
				radius: planetR
			});

			const offsets = [
				{ dx: -180, dy: 75 },
				{ dx: -60, dy: 140 },
				{ dx: 60, dy: 140 },
				{ dx: 180, dy: 75 }
			];

			for (let n = 0; n < biome.levels.length; n++) {
				const lvlIdx = biome.levels[n];
				const off = offsets[n] || { dx: 0, dy: 100 };
				this.nodes.push({
					index: lvlIdx,
					x: planetX + off.dx,
					y: planetY + off.dy,
					level: LEVELS[lvlIdx],
					biome: biome
				});
			}
		}

		this.computeSplines();

		if (!this.isMigrating && this.nodes[this.bitNodeIndex]) {
			this.bitPos.x = this.nodes[this.bitNodeIndex].x;
			this.bitPos.y = this.nodes[this.bitNodeIndex].y;
		}
	},

	computeSplines() {
		this.splines = [];
		for (let i = 0; i < this.nodes.length - 1; i++) {
			const p0 = i > 0 ? this.nodes[i - 1] : this.nodes[i];
			const p1 = this.nodes[i];
			const p2 = this.nodes[i + 1];
			const p3 = i + 2 < this.nodes.length ? this.nodes[i + 2] : p2;

			const cp1 = {
				x: p1.x + (p2.x - p0.x) / 6,
				y: p1.y + (p2.y - p0.y) / 6
			};
			const cp2 = {
				x: p2.x - (p3.x - p1.x) / 6,
				y: p2.y - (p3.y - p1.y) / 6
			};

			this.splines.push({ p1, cp1, cp2, p2 });
		}
	},

	evalSpline(segmentIndex, t) {
		const seg = this.splines[segmentIndex];
		if (!seg) return { x: 0, y: 0, angle: 0 };
		const p1 = seg.p1;
		const cp1 = seg.cp1;
		const cp2 = seg.cp2;
		const p2 = seg.p2;

		const mt = 1 - t;
		const mt2 = mt * mt;
		const t2 = t * t;

		const x = mt2 * mt * p1.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t2 * t * p2.x;
		const y = mt2 * mt * p1.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t2 * t * p2.y;

		const dx = 3 * mt2 * (cp1.x - p1.x) + 6 * mt * t * (cp2.x - cp1.x) + 3 * t2 * (p2.x - cp2.x);
		const dy = 3 * mt2 * (cp1.y - p1.y) + 6 * mt * t * (cp2.y - cp1.y) + 3 * t2 * (p2.y - cp2.y);
		const angle = Math.atan2(dy, dx) + Math.PI / 2;

		return { x, y, angle };
	},

	bindEvents() {
		let isDown = false;
		let startX = 0;
		let scrollLeft = 0;
		let hasMoved = false;

		if (this.container) {
			this.container.addEventListener('mousedown', (e) => {
				isDown = true;
				hasMoved = false;
				startX = e.pageX - this.container.offsetLeft;
				scrollLeft = this.container.scrollLeft;
				this.container.classList.add('is-dragging');
			});

			window.addEventListener('mouseup', () => {
				isDown = false;
				if (this.container) {
					this.container.classList.remove('is-dragging');
				}
			});

			this.container.addEventListener('mousemove', (e) => {
				if (!isDown) return;
				e.preventDefault();
				const currentX = e.pageX - this.container.offsetLeft;
				const walk = currentX - startX;
				if (Math.abs(walk) > 4) {
					hasMoved = true;
				}
				this.container.scrollLeft = scrollLeft - walk;
			});

			this.container.addEventListener('wheel', (e) => {
				if (e.deltaY !== 0) {
					this.container.scrollLeft += e.deltaY;
					e.preventDefault();
				}
			}, { passive: false });
		}

		this.canvas.addEventListener('mousemove', (e) => {
			const rect = this.canvas.getBoundingClientRect();
			const scaleX = this.virtualWidth / rect.width;
			const scaleY = this.virtualHeight / rect.height;
			const mouseX = (e.clientX - rect.left) * scaleX;
			const mouseY = (e.clientY - rect.top) * scaleY;

			let found = -1;
			for (let i = 0; i < this.nodes.length; i++) {
				const n = this.nodes[i];
				const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
				if (dist <= this.nodeRadius + 8) {
					found = i;
					break;
				}
			}

			this.hoveredNodeIndex = found;
			this.canvas.style.cursor = found !== -1 ? 'pointer' : 'default';
			this.updateTooltip(found, e.clientX, e.clientY);
		});

		this.canvas.addEventListener('mouseleave', () => {
			this.hoveredNodeIndex = -1;
			this.hideTooltip();
		});

		this.canvas.addEventListener('click', (e) => {
			if (this.isMigrating || hasMoved) return;
			const rect = this.canvas.getBoundingClientRect();
			const scaleX = this.virtualWidth / rect.width;
			const scaleY = this.virtualHeight / rect.height;
			const mouseX = (e.clientX - rect.left) * scaleX;
			const mouseY = (e.clientY - rect.top) * scaleY;

			for (let i = 0; i < this.nodes.length; i++) {
				const n = this.nodes[i];
				const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
				if (dist <= this.nodeRadius + 8) {
					if (i <= this.state.unlockedLevel) {
						if (this.onSelectLevel) {
							this.onSelectLevel(i);
						}
					} else {
						if (window.SoundFX) window.SoundFX.playError();
					}
					break;
				}
			}
		});

		window.addEventListener('resize', () => {
			this.computeLayout();
		});
	},

	updateTooltip(index, clientX, clientY) {
		if (!this.tooltip) return;
		if (index === -1) {
			this.hideTooltip();
			return;
		}

		const node = this.nodes[index];
		const isUnlocked = index <= this.state.unlockedLevel;
		const starsCount = (this.state && this.state.stars[node.level.id]) || 0;

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
				<span class="tooltip-status ${isUnlocked ? 'unlocked' : 'locked'}">${isUnlocked ? 'Disponible' : 'Bloqueado'}</span>
			</div>
		`;

		this.tooltip.style.left = `${clientX + 16}px`;
		this.tooltip.style.top = `${clientY + 12}px`;
		this.tooltip.classList.add('visible');
	},

	hideTooltip() {
		if (this.tooltip) {
			this.tooltip.classList.remove('visible');
		}
	},

	scrollToNode(index) {
		if (!this.container || !this.nodes[index]) return;
		const targetX = this.nodes[index].x;
		const containerW = this.container.clientWidth;
		this.container.scrollTo({
			left: Math.max(0, targetX - containerW / 2),
			behavior: 'smooth'
		});
	},

	scrollToBiome(biomeIndex) {
		if (!this.container || !this.planets[biomeIndex]) return;
		const targetX = this.planets[biomeIndex].x;
		const containerW = this.container.clientWidth;
		this.container.scrollTo({
			left: Math.max(0, targetX - containerW / 2),
			behavior: 'smooth'
		});
	},

	animateTransition(fromIndex, toIndex) {
		if (fromIndex >= toIndex || toIndex >= this.nodes.length) {
			return Promise.resolve();
		}

		this.scrollToNode(toIndex);

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
		if (this.isMigrating) {
			const elapsed = timestamp - this.migrationStart;
			const progress = Math.min(elapsed / this.migrationDuration, 1);
			const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

			const pos = this.evalSpline(this.migrationFrom, ease);
			this.bitPos.x = pos.x;
			this.bitPos.y = pos.y;
			this.bitAngle = pos.angle;

			if (timestamp - this.migrationLastStepTime > 160) {
				this.migrationLastStepTime = timestamp;
				if (window.SoundFX) window.SoundFX.playStep();
			}

			if (progress >= 1) {
				this.isMigrating = false;
				this.bitNodeIndex = this.migrationTo;
				const targetNode = this.nodes[this.migrationTo];
				this.bitPos.x = targetNode.x;
				this.bitPos.y = targetNode.y;
				this.bitAngle = Math.PI / 2;

				this.spawnCelebration(targetNode.x, targetNode.y, targetNode.biome.color);
				if (window.SoundFX) window.SoundFX.playUnlock();

				if (this.migrationResolve) {
					const res = this.migrationResolve;
					this.migrationResolve = null;
					res();
				}
			}
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
	},

	draw(timestamp) {
		this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

		this.drawSpaceBackground(timestamp);
		this.drawPlanets(timestamp);
		this.drawCosmicFlightPath(timestamp);
		this.draw3DNodes(timestamp);
		this.drawBitAvatar(timestamp);
		this.drawParticles();
	},

	drawSpaceBackground(timestamp) {
		const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.virtualHeight);
		bgGrad.addColorStop(0, '#040816');
		bgGrad.addColorStop(0.5, '#0a1432');
		bgGrad.addColorStop(1, '#040714');
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

	drawPlanets(timestamp) {
		for (let b = 0; b < this.planets.length; b++) {
			const p = this.planets[b];
			const biome = p.biome;
			const time = timestamp || 0;

			this.ctx.save();

			const halo = this.ctx.createRadialGradient(p.x, p.y, p.radius * 0.85, p.x, p.y, p.radius * 1.4);
			halo.addColorStop(0, `${biome.color}44`);
			halo.addColorStop(0.6, `${biome.color}15`);
			halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
			this.ctx.fillStyle = halo;
			this.ctx.beginPath();
			this.ctx.arc(p.x, p.y, p.radius * 1.4, 0, Math.PI * 2);
			this.ctx.fill();

			this.ctx.save();
			this.ctx.beginPath();
			this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
			this.ctx.clip();

			switch (biome.planetType) {
				case 'espacio':
					this.drawPlanetSecuencias(p.x, p.y, p.radius, time);
					break;
				case 'maquinas':
					this.drawPlanetBucles(p.x, p.y, p.radius, time);
					break;
				case 'campo':
					this.drawPlanetCampo(p.x, p.y, p.radius, time);
					break;
				case 'ciberespacio':
					this.drawPlanetCiberespacio(p.x, p.y, p.radius, time);
					break;
				case 'cristal':
					this.drawPlanetCiudadela(p.x, p.y, p.radius, time);
					break;
			}

			const rimGrad = this.ctx.createRadialGradient(p.x - p.radius * 0.35, p.y - p.radius * 0.35, p.radius * 0.65, p.x, p.y, p.radius);
			rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
			rimGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.1)');
			rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.45)');
			this.ctx.fillStyle = rimGrad;
			this.ctx.beginPath();
			this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
			this.ctx.fill();

			this.ctx.restore();

			this.ctx.strokeStyle = `${biome.color}88`;
			this.ctx.lineWidth = 3;
			this.ctx.beginPath();
			this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
			this.ctx.stroke();

			this.drawSignboard(biome, p.x, p.y - p.radius - 28, time);
			this.drawPlanetBadge(biome, p.x, p.y + p.radius + 36);

			this.ctx.restore();
		}
	},

	drawPlanetSecuencias(px, py, pr, time) {
		const sph = this.ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
		sph.addColorStop(0, '#60a5fa');
		sph.addColorStop(0.5, '#1d4ed8');
		sph.addColorStop(1, '#0f172a');
		this.ctx.fillStyle = sph;
		this.ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

		const craters = [
			{ dx: -35, dy: -25, r: 18 },
			{ dx: 25, dy: -45, r: 14 },
			{ dx: -15, dy: 30, r: 24 },
			{ dx: 45, dy: 15, r: 16 },
			{ dx: -55, dy: 20, r: 12 }
		];

		for (const c of craters) {
			const cx = px + c.dx;
			const cy = py + c.dy;
			const cGrad = this.ctx.createRadialGradient(cx + 3, cy + 3, 2, cx, cy, c.r);
			cGrad.addColorStop(0, '#0f172a');
			cGrad.addColorStop(0.85, '#1e3a8a');
			cGrad.addColorStop(1, '#93c5fd');
			this.ctx.fillStyle = cGrad;
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
			this.ctx.fill();
		}

		this.ctx.save();
		this.ctx.translate(px, py);
		this.ctx.rotate(-Math.PI / 6);
		this.ctx.strokeStyle = 'rgba(147, 197, 253, 0.65)';
		this.ctx.lineWidth = 4;
		this.ctx.beginPath();
		this.ctx.ellipse(0, 0, pr * 1.35, pr * 0.28, 0, 0, Math.PI * 2);
		this.ctx.stroke();
		this.ctx.restore();

		const satAngle = time * 0.0012;
		const satX = px + Math.cos(satAngle) * (pr * 0.7);
		const satY = py + Math.sin(satAngle) * (pr * 0.4);
		this.ctx.fillStyle = '#38bdf8';
		this.ctx.beginPath();
		this.ctx.arc(satX, satY, 4.5, 0, Math.PI * 2);
		this.ctx.fill();
	},

	drawPlanetBucles(px, py, pr, time) {
		const sph = this.ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
		sph.addColorStop(0, '#f59e0b');
		sph.addColorStop(0.5, '#b45309');
		sph.addColorStop(1, '#451a03');
		this.ctx.fillStyle = sph;
		this.ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

		this.ctx.strokeStyle = 'rgba(254, 215, 170, 0.25)';
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.arc(px, py, pr * 0.7, 0, Math.PI * 2);
		this.ctx.arc(px, py, pr * 0.4, 0, Math.PI * 2);
		this.ctx.stroke();

		this.drawRotatingGear2D(px - 35, py - 30, 32, 8, time * 0.0015, '#d97706', '#fbbf24');
		this.drawRotatingGear2D(px + 30, py + 25, 24, 6, -time * 0.002, '#92400e', '#f59e0b');
		this.drawRotatingGear2D(px + 45, py - 35, 18, 6, time * 0.0025, '#78350f', '#d97706');
	},

	drawRotatingGear2D(cx, cy, r, teeth, angle, bodyCol, toothCol) {
		this.ctx.save();
		this.ctx.translate(cx, cy);
		this.ctx.rotate(angle);

		this.ctx.fillStyle = toothCol;
		for (let i = 0; i < teeth; i++) {
			const a = (Math.PI * 2 * i) / teeth;
			this.ctx.save();
			this.ctx.rotate(a);
			this.ctx.fillRect(-4, -r - 4, 8, 8);
			this.ctx.restore();
		}

		this.ctx.fillStyle = bodyCol;
		this.ctx.beginPath();
		this.ctx.arc(0, 0, r, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = '#451a03';
		this.ctx.beginPath();
		this.ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.restore();
	},

	drawPlanetCampo(px, py, pr, time) {
		const sph = this.ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
		sph.addColorStop(0, '#38bdf8');
		sph.addColorStop(0.65, '#0284c7');
		sph.addColorStop(1, '#0c4a6e');
		this.ctx.fillStyle = sph;
		this.ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

		this.ctx.fillStyle = '#22c55e';
		this.ctx.beginPath();
		this.ctx.arc(px - 25, py - 20, 42, 0, Math.PI * 2);
		this.ctx.arc(px + 35, py + 15, 38, 0, Math.PI * 2);
		this.ctx.arc(px - 10, py + 45, 28, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = '#16a34a';
		this.ctx.beginPath();
		this.ctx.arc(px - 25, py - 20, 26, 0, Math.PI * 2);
		this.ctx.arc(px + 35, py + 15, 22, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
		const cloudOffset = (time * 0.015) % (pr * 2);
		this.ctx.beginPath();
		this.ctx.ellipse(px - pr + cloudOffset, py - 35, 30, 8, 0, 0, Math.PI * 2);
		this.ctx.ellipse(px + pr - cloudOffset, py + 25, 25, 6, 0, 0, Math.PI * 2);
		this.ctx.fill();

		const bFlyAngle = time * 0.002;
		const bFlyX = px + Math.cos(bFlyAngle) * (pr * 0.75);
		const bFlyY = py + Math.sin(bFlyAngle) * (pr * 0.5);
		this.ctx.fillStyle = '#facc15';
		this.ctx.beginPath();
		this.ctx.arc(bFlyX, bFlyY, 3, 0, Math.PI * 2);
		this.ctx.fill();
	},

	drawPlanetCiberespacio(px, py, pr, time) {
		const sph = this.ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
		sph.addColorStop(0, '#f472b6');
		sph.addColorStop(0.5, '#db2777');
		sph.addColorStop(1, '#1e1b4b');
		this.ctx.fillStyle = sph;
		this.ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

		this.ctx.strokeStyle = '#38bdf8';
		this.ctx.lineWidth = 1.8;
		this.ctx.beginPath();
		for (let offset = -pr + 20; offset < pr; offset += 24) {
			this.ctx.moveTo(px + offset, py - pr);
			this.ctx.lineTo(px + offset, py + pr);
			this.ctx.moveTo(px - pr, py + offset);
			this.ctx.lineTo(px + pr, py + offset);
		}
		this.ctx.stroke();

		this.ctx.fillStyle = '#facc15';
		const pulseNodes = [
			{ x: px - 24, y: py - 24 },
			{ x: px + 24, y: py - 24 },
			{ x: px, y: py + 24 },
			{ x: px + 48, y: py + 24 }
		];
		for (const pn of pulseNodes) {
			this.ctx.beginPath();
			this.ctx.arc(pn.x, pn.y, 3.5, 0, Math.PI * 2);
			this.ctx.fill();
		}

		this.ctx.save();
		const cubeAngle = time * 0.0018;
		const cx = px + Math.cos(cubeAngle) * (pr * 0.85);
		const cy = py + Math.sin(cubeAngle) * (pr * 0.45);
		this.ctx.translate(cx, cy);
		this.ctx.rotate(time * 0.003);
		this.ctx.strokeStyle = '#ec4899';
		this.ctx.lineWidth = 2;
		this.ctx.strokeRect(-8, -8, 16, 16);
		this.ctx.restore();
	},

	drawPlanetCiudadela(px, py, pr, time) {
		const sph = this.ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
		sph.addColorStop(0, '#34d399');
		sph.addColorStop(0.5, '#059669');
		sph.addColorStop(1, '#064e3b');
		this.ctx.fillStyle = sph;
		this.ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

		this.ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
		this.ctx.beginPath();
		this.ctx.moveTo(px, py - pr * 0.8);
		this.ctx.lineTo(px + 20, py + pr * 0.6);
		this.ctx.lineTo(px - 20, py + pr * 0.6);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.strokeStyle = '#facc15';
		this.ctx.lineWidth = 2.5;
		this.ctx.beginPath();
		this.ctx.arc(px, py, pr * 0.55, 0, Math.PI * 2);
		this.ctx.stroke();

		const crystalAngle = time * 0.0015;
		const cryX = px + Math.cos(crystalAngle) * (pr * 0.7);
		const cryY = py + Math.sin(crystalAngle) * (pr * 0.4);
		this.ctx.fillStyle = '#a855f7';
		this.ctx.beginPath();
		this.ctx.moveTo(cryX, cryY - 7);
		this.ctx.lineTo(cryX + 5, cryY);
		this.ctx.lineTo(cryX, cryY + 7);
		this.ctx.lineTo(cryX - 5, cryY);
		this.ctx.closePath();
		this.ctx.fill();
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
		if (this.splines.length === 0) return;

		this.ctx.save();
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		this.ctx.beginPath();
		this.ctx.moveTo(this.splines[0].p1.x, this.splines[0].p1.y);
		for (const s of this.splines) {
			this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p2.x, s.p2.y);
		}
		this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
		this.ctx.lineWidth = 12;
		this.ctx.stroke();

		this.ctx.beginPath();
		this.ctx.moveTo(this.splines[0].p1.x, this.splines[0].p1.y);
		for (const s of this.splines) {
			this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p2.x, s.p2.y);
		}
		this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
		this.ctx.lineWidth = 2.5;
		this.ctx.setLineDash([6, 10]);
		this.ctx.stroke();
		this.ctx.setLineDash([]);

		if (this.state) {
			const unlockedSegs = Math.min(this.state.unlockedLevel, this.splines.length);
			for (let i = 0; i < unlockedSegs; i++) {
				const s = this.splines[i];
				this.ctx.beginPath();
				this.ctx.moveTo(s.p1.x, s.p1.y);
				this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p2.x, s.p2.y);
				this.ctx.strokeStyle = this.nodes[i].biome.color;
				this.ctx.lineWidth = 4.5;
				this.ctx.stroke();

				this.ctx.beginPath();
				this.ctx.moveTo(s.p1.x, s.p1.y);
				this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p2.x, s.p2.y);
				this.ctx.strokeStyle = '#ffffff';
				this.ctx.lineWidth = 2;
				this.ctx.setLineDash([6, 12]);
				this.ctx.lineDashOffset = -((timestamp || 0) / 25);
				this.ctx.stroke();
				this.ctx.setLineDash([]);
			}
		}

		this.ctx.restore();
	},

	draw3DNodes(timestamp) {
		for (let i = 0; i < this.nodes.length; i++) {
			const n = this.nodes[i];
			const isUnlocked = this.state ? i <= this.state.unlockedLevel : i === 0;
			const isCurrent = this.state ? i === this.state.unlockedLevel : i === 0;
			const isHovered = i === this.hoveredNodeIndex;
			const starsCount = (this.state && this.state.stars[n.level.id]) || 0;
			const r = this.nodeRadius + (isHovered ? 4 : 0);

			this.ctx.save();

			this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
			this.ctx.beginPath();
			this.ctx.arc(n.x, n.y + 4, r + 2, 0, Math.PI * 2);
			this.ctx.fill();

			if (isCurrent && !this.isMigrating) {
				const pulse = (Math.sin((timestamp || 0) / 280) + 1) / 2;
				const pulseR = r + 8 + pulse * 10;
				this.ctx.beginPath();
				this.ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
				this.ctx.fillStyle = `${n.biome.color}25`;
				this.ctx.fill();
				this.ctx.strokeStyle = `${n.biome.color}88`;
				this.ctx.lineWidth = 2;
				this.ctx.stroke();
			}

			this.ctx.beginPath();
			this.ctx.arc(n.x, n.y, r, 0, Math.PI * 2);

			if (isUnlocked) {
				const nGrad = this.ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, r * 0.1, n.x, n.y, r);
				nGrad.addColorStop(0, '#ffffff');
				nGrad.addColorStop(1, '#e2e8f0');
				this.ctx.fillStyle = nGrad;
				this.ctx.fill();

				this.ctx.strokeStyle = n.biome.color;
				this.ctx.lineWidth = isCurrent ? 4.5 : 3.5;
				this.ctx.stroke();

				this.ctx.fillStyle = '#0f172a';
				this.ctx.font = '800 13px Inter, sans-serif';
				this.ctx.textAlign = 'center';
				this.ctx.textBaseline = 'middle';
				this.ctx.fillText(n.level.id, n.x, n.y);

				this.drawNodeStars3D(n.x, n.y + r + 11, starsCount);
			} else {
				this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
				this.ctx.fill();
				this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
				this.ctx.lineWidth = 2;
				this.ctx.stroke();

				this.drawPadlock3D(n.x, n.y, 14, '#94a3b8');
			}

			this.ctx.restore();
		}
	},

	drawNodeStars3D(cx, cy, count) {
		const size = 10;
		const spacing = 12;
		const startX = cx - spacing;

		for (let s = 0; s < 3; s++) {
			const sx = startX + s * spacing;
			const isWon = s < count;
			this.ctx.save();
			this.ctx.fillStyle = isWon ? '#f59e0b' : 'rgba(148, 163, 184, 0.4)';
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
			time: timestamp || 0
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
