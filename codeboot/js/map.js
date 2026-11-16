const ProgressMap = {
	canvas: null,
	ctx: null,
	container: null,
	tooltip: null,
	state: null,
	onSelectLevel: null,
	nodes: [],
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
	virtualWidth: 640,
	virtualHeight: 1620,
	nodeRadius: 28,

	biomes: [
		{ id: 1, name: "Secuencias", color: "#2563eb", lightColor: "#eff6ff", bgGradient: "rgba(37, 99, 235, 0.05)", levels: [0, 1, 2, 3] },
		{ id: 2, name: "Bucles", color: "#d97706", lightColor: "#fffbeb", bgGradient: "rgba(217, 119, 6, 0.05)", levels: [4, 5, 6, 7] },
		{ id: 3, name: "Condicionales", color: "#7c3aed", lightColor: "#f5f3ff", bgGradient: "rgba(124, 58, 237, 0.05)", levels: [8, 9, 10, 11] },
		{ id: 4, name: "Variables", color: "#db2777", lightColor: "#fdf2f8", bgGradient: "rgba(219, 39, 119, 0.05)", levels: [12, 13, 14, 15] },
		{ id: 5, name: "Funciones", color: "#059669", lightColor: "#ecfdf5", bgGradient: "rgba(5, 150, 105, 0.05)", levels: [16, 17, 18, 19] }
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
			this.bitAngle = Math.PI;
		}
	},

	computeLayout() {
		const containerH = this.container ? this.container.clientHeight : 560;
		this.virtualHeight = Math.max(containerH - 40, 520);

		const biomeW = 760;
		const totalBiomes = this.biomes.length;
		this.virtualWidth = totalBiomes * biomeW + 120;

		const dpr = window.devicePixelRatio || 1;
		this.canvas.width = this.virtualWidth * dpr;
		this.canvas.height = this.virtualHeight * dpr;
		this.canvas.style.width = `${this.virtualWidth}px`;
		this.canvas.style.height = `${this.virtualHeight}px`;
		this.ctx.scale(dpr, dpr);

		this.nodes = [];
		const total = LEVELS.length;
		const cy = this.virtualHeight / 2;
		const amp = Math.min(this.virtualHeight * 0.22, 110);

		for (let i = 0; i < total; i++) {
			const biome = this.biomes.find(b => b.levels.includes(i)) || this.biomes[0];
			const biomeIndex = biome.id - 1;
			const nodeInBiome = biome.levels.indexOf(i);
			const countInBiome = biome.levels.length;
			const biomeStartX = 60 + biomeIndex * biomeW;
			const stepX = (biomeW - 200) / Math.max(1, countInBiome - 1);
			const x = biomeStartX + 100 + nodeInBiome * stepX;
			const y = cy + Math.sin(i * 1.3) * amp;

			this.nodes.push({
				index: i,
				x: x,
				y: y,
				level: LEVELS[i],
				biome: biome
			});
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
		this.canvas.addEventListener('mousemove', (e) => {
			const rect = this.canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			let found = -1;
			for (let i = 0; i < this.nodes.length; i++) {
				const n = this.nodes[i];
				const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
				if (dist <= this.nodeRadius + 6) {
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
			if (this.isMigrating) return;
			const rect = this.canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			for (let i = 0; i < this.nodes.length; i++) {
				const n = this.nodes[i];
				const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
				if (dist <= this.nodeRadius + 6) {
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
		const starsCount = this.state.stars[node.level.id] || 0;

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
				<span>${starsHtml}</span>
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
		for (let i = 0; i < 32; i++) {
			const angle = (Math.PI * 2 * i) / 32;
			const speed = 2 + Math.random() * 3.5;
			this.particles.push({
				x: x,
				y: y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				radius: 2.5 + Math.random() * 3,
				color: Math.random() > 0.4 ? color : '#f59e0b',
				alpha: 1,
				life: 40 + Math.random() * 20
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
				this.bitAngle = Math.PI;

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

		this.drawBiomes();
		this.drawRoad();
		this.drawNodes(timestamp);
		this.drawBitAvatar(timestamp);
		this.drawParticles();
	},

	drawBiomes() {
		for (const biome of this.biomes) {
			const firstNode = this.nodes[biome.levels[0]];
			const lastNode = this.nodes[biome.levels[biome.levels.length - 1]];
			if (!firstNode || !lastNode) continue;

			const leftX = firstNode.x - 100;
			const rightX = lastNode.x + 100;
			const w = rightX - leftX;
			const topY = 24;
			const h = this.virtualHeight - 48;

			this.ctx.save();
			this.ctx.fillStyle = biome.bgGradient;
			if (this.ctx.roundRect) {
				this.ctx.roundRect(leftX, topY, w, h, 20);
			} else {
				this.ctx.rect(leftX, topY, w, h);
			}
			this.ctx.fill();

			this.ctx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
			this.ctx.lineWidth = 1;
			this.ctx.stroke();

			this.ctx.fillStyle = biome.color;
			this.ctx.font = '700 11px Inter, sans-serif';
			this.ctx.fillText(`BIOMA ${biome.id} • ${biome.name.toUpperCase()}`, leftX + 18, topY + 28);
			this.ctx.restore();
		}
	},

	drawRoad() {
		if (this.splines.length === 0) return;

		this.ctx.save();
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		this.ctx.beginPath();
		this.ctx.moveTo(this.splines[0].p1.x, this.splines[0].p1.y);
		for (const s of this.splines) {
			this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p2.x, s.p2.y);
		}
		this.ctx.strokeStyle = '#e2e8f0';
		this.ctx.lineWidth = 14;
		this.ctx.stroke();

		this.ctx.beginPath();
		this.ctx.moveTo(this.splines[0].p1.x, this.splines[0].p1.y);
		for (const s of this.splines) {
			this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p2.x, s.p2.y);
		}
		this.ctx.strokeStyle = '#cbd5e1';
		this.ctx.lineWidth = 2;
		this.ctx.setLineDash([8, 8]);
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
				this.ctx.lineWidth = 6;
				this.ctx.stroke();
			}
		}

		this.ctx.restore();
	},

	drawNodes(timestamp) {
		for (let i = 0; i < this.nodes.length; i++) {
			const n = this.nodes[i];
			const isUnlocked = this.state ? i <= this.state.unlockedLevel : i === 0;
			const isCurrent = this.state ? i === this.state.unlockedLevel : i === 0;
			const isHovered = i === this.hoveredNodeIndex;
			const starsCount = (this.state && this.state.stars[n.level.id]) || 0;
			const r = this.nodeRadius + (isHovered ? 3 : 0);

			this.ctx.save();

			if (isCurrent && !this.isMigrating) {
				const pulse = (Math.sin(timestamp / 300) + 1) / 2;
				const pulseR = r + 8 + pulse * 6;
				this.ctx.beginPath();
				this.ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
				this.ctx.fillStyle = `${n.biome.color}22`;
				this.ctx.fill();
				this.ctx.strokeStyle = `${n.biome.color}66`;
				this.ctx.lineWidth = 1.5;
				this.ctx.stroke();
			}

			this.ctx.beginPath();
			this.ctx.arc(n.x, n.y, r, 0, Math.PI * 2);

			if (isUnlocked) {
				this.ctx.fillStyle = '#ffffff';
				this.ctx.fill();
				this.ctx.strokeStyle = n.biome.color;
				this.ctx.lineWidth = isCurrent ? 4 : 3;
				this.ctx.stroke();

				this.ctx.fillStyle = '#0f172a';
				this.ctx.font = '700 13px Inter, sans-serif';
				this.ctx.textAlign = 'center';
				this.ctx.textBaseline = 'middle';
				this.ctx.fillText(n.level.id, n.x, n.y);

				this.drawNodeStars(n.x, n.y + r + 12, starsCount);
			} else {
				this.ctx.fillStyle = '#f1f5f9';
				this.ctx.fill();
				this.ctx.strokeStyle = '#cbd5e1';
				this.ctx.lineWidth = 2;
				this.ctx.stroke();

				this.drawPadlock(n.x, n.y, 14, '#94a3b8');
			}

			this.ctx.restore();
		}
	},

	drawNodeStars(cx, cy, count) {
		const size = 10;
		const spacing = 12;
		const startX = cx - spacing;

		for (let s = 0; s < 3; s++) {
			const x = startX + s * spacing;
			this.ctx.save();
			this.ctx.fillStyle = s < count ? '#f59e0b' : '#cbd5e1';
			this.ctx.beginPath();
			for (let p = 0; p < 5; p++) {
				const outerAngle = (Math.PI / 2 * 3) + (p * Math.PI * 2 / 5);
				const innerAngle = outerAngle + Math.PI / 5;
				const ox = x + Math.cos(outerAngle) * (size / 2);
				const oy = cy + Math.sin(outerAngle) * (size / 2);
				const ix = x + Math.cos(innerAngle) * (size / 4);
				const iy = cy + Math.sin(innerAngle) * (size / 4);
				if (p === 0) {
					this.ctx.moveTo(ox, oy);
				} else {
					this.ctx.lineTo(ox, oy);
				}
				this.ctx.lineTo(ix, iy);
			}
			this.ctx.closePath();
			this.ctx.fill();
			this.ctx.restore();
		}
	},

	drawPadlock(cx, cy, size, color) {
		this.ctx.save();
		this.ctx.fillStyle = color;
		this.ctx.strokeStyle = color;

		const bodyW = size * 0.8;
		const bodyH = size * 0.6;
		const bodyX = cx - bodyW / 2;
		const bodyY = cy - bodyH / 4;

		if (this.ctx.roundRect) {
			this.ctx.beginPath();
			this.ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 2);
			this.ctx.fill();
		} else {
			this.ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
		}

		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.arc(cx, bodyY, bodyW * 0.32, Math.PI, 0);
		this.ctx.stroke();
		this.ctx.restore();
	},

	drawBitAvatar(timestamp) {
		const walkFrame = this.isMigrating ? Math.floor((timestamp / 120) % 4) : 0;
		BitRenderer.draw(this.ctx, this.bitPos.x, this.bitPos.y - 12, this.bitAngle, {
			size: 26,
			walkFrame: walkFrame,
			isWalking: this.isMigrating,
			jumpHeight: 0,
			isTurning: false,
			time: timestamp
		});

		if (!this.isMigrating) {
			const bounce = Math.sin(timestamp / 250) * 2;
			const tagY = this.bitPos.y - 48 + bounce;

			this.ctx.save();
			this.ctx.fillStyle = '#2563eb';
			this.ctx.font = '700 10px Inter, sans-serif';
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

			this.ctx.fillStyle = '#ffffff';
			this.ctx.fillText(tagText, this.bitPos.x, tagY);
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

