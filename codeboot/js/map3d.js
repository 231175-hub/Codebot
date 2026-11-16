const ProgressMap3D = {
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
	virtualWidth: 680,
	virtualHeight: 1680,
	nodeRadius: 30,

	biomes: [
		{ id: 1, name: "Secuencias", color: "#2563eb", darkColor: "#1d4ed8", lightColor: "#eff6ff", bgGradient: "rgba(37, 99, 235, 0.06)", levels: [0, 1, 2, 3], iconType: "crystal" },
		{ id: 2, name: "Bucles", color: "#d97706", darkColor: "#b45309", lightColor: "#fffbeb", bgGradient: "rgba(217, 119, 6, 0.06)", levels: [4, 5, 6, 7], iconType: "gear" },
		{ id: 3, name: "Condicionales", color: "#7c3aed", darkColor: "#6d28d9", lightColor: "#f5f3ff", bgGradient: "rgba(124, 58, 237, 0.06)", levels: [8, 9, 10, 11], iconType: "prism" },
		{ id: 4, name: "Variables", color: "#db2777", darkColor: "#be185d", lightColor: "#fdf2f8", bgGradient: "rgba(219, 39, 119, 0.06)", levels: [12, 13, 14, 15], iconType: "memory" },
		{ id: 5, name: "Funciones", color: "#059669", darkColor: "#047857", lightColor: "#ecfdf5", bgGradient: "rgba(5, 150, 105, 0.06)", levels: [16, 17, 18, 19], iconType: "citadel" }
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
		const containerH = this.container ? this.container.clientHeight : 560;
		this.virtualHeight = Math.max(containerH - 40, 520);

		const biomeW = 760;
		const totalBiomes = this.biomes.length;
		this.virtualWidth = totalBiomes * biomeW + 120;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

		this.draw3DIslands(timestamp);
		this.draw3DRibbonRoad(timestamp);
		this.draw3DNodes(timestamp);
		this.drawBitAvatar(timestamp);
		this.drawParticles();
	},

	draw3DIslands(timestamp) {
		for (const biome of this.biomes) {
			const firstNode = this.nodes[biome.levels[0]];
			const lastNode = this.nodes[biome.levels[biome.levels.length - 1]];
			if (!firstNode || !lastNode) continue;

			const leftX = firstNode.x - 100;
			const rightX = lastNode.x + 100;
			const w = rightX - leftX;
			const topY = 24;
			const h = this.virtualHeight - 48;
			const x = leftX;

			this.ctx.save();

			this.ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
			if (this.ctx.roundRect) {
				this.ctx.beginPath();
				this.ctx.roundRect(x, topY + 10, w, h, 28);
				this.ctx.fill();
			}

			this.ctx.fillStyle = '#ffffff';
			this.ctx.strokeStyle = '#e2e8f0';
			this.ctx.lineWidth = 1.5;
			if (this.ctx.roundRect) {
				this.ctx.beginPath();
				this.ctx.roundRect(x, topY, w, h, 28);
				this.ctx.fill();
				this.ctx.stroke();
			}

			const bgGrad = this.ctx.createLinearGradient(x, topY, x + w, topY + h);
			bgGrad.addColorStop(0, biome.bgGradient);
			bgGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
			bgGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
			this.ctx.fillStyle = bgGrad;
			if (this.ctx.roundRect) {
				this.ctx.beginPath();
				this.ctx.roundRect(x, topY, w, h, 28);
				this.ctx.fill();
			}

			this.ctx.save();
			if (this.ctx.roundRect) {
				this.ctx.beginPath();
				this.ctx.roundRect(x, topY, w, h, 28);
				this.ctx.clip();
			}

			this.drawBiomeLandscape(biome, x, topY, w, h, timestamp);
			this.ctx.restore();

			this.drawBiomeHeaderBadge(biome, x + 20, topY + 18, w - 40);

			this.ctx.restore();
		}
	},

	drawBiomeHeaderBadge(biome, x, y, maxW) {
		this.ctx.save();
		const badgeH = 34;
		const badgeW = 260;

		this.ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
		this.ctx.strokeStyle = '#e2e8f0';
		this.ctx.lineWidth = 1;
		if (this.ctx.roundRect) {
			this.ctx.beginPath();
			this.ctx.roundRect(x, y, badgeW, badgeH, 17);
			this.ctx.fill();
			this.ctx.stroke();
		}

		this.ctx.fillStyle = biome.color;
		this.ctx.beginPath();
		this.ctx.arc(x + 18, y + 17, 8, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = '#ffffff';
		this.ctx.beginPath();
		this.ctx.arc(x + 18, y + 17, 3, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = '#0f172a';
		this.ctx.font = '800 12px Inter, sans-serif';
		this.ctx.textAlign = 'left';
		this.ctx.textBaseline = 'middle';
		this.ctx.fillText(`BIOMA ${biome.id} • ${biome.name.toUpperCase()}`, x + 34, y + 17);

		const firstLvl = biome.levels[0];
		const lastLvl = biome.levels[biome.levels.length - 1];
		const spanText = `${LEVELS[firstLvl].id} - ${LEVELS[lastLvl].id}`;
		this.ctx.fillStyle = '#64748b';
		this.ctx.font = '600 10px Inter, sans-serif';
		this.ctx.textAlign = 'right';
		this.ctx.fillText(spanText, x + badgeW - 14, y + 17);

		this.ctx.restore();
	},

	drawBiomeLandscape(biome, x, y, w, h, time) {
		switch (biome.id) {
			case 1:
				this.drawSecuenciasLandscape(x, y, w, h, time);
				break;
			case 2:
				this.drawBuclesLandscape(x, y, w, h, time);
				break;
			case 3:
				this.drawCondicionalesLandscape(x, y, w, h, time);
				break;
			case 4:
				this.drawVariablesLandscape(x, y, w, h, time);
				break;
			case 5:
				this.drawFuncionesLandscape(x, y, w, h, time);
				break;
		}
	},

	drawSecuenciasLandscape(x, y, w, h, time) {
		this.ctx.save();

		this.ctx.fillStyle = 'rgba(219, 234, 254, 0.45)';
		this.ctx.beginPath();
		this.ctx.moveTo(x, y + h);
		this.ctx.bezierCurveTo(x + w * 0.25, y + h - 80, x + w * 0.45, y + h - 40, x + w, y + h - 70);
		this.ctx.lineTo(x + w, y + h);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.fillStyle = 'rgba(191, 219, 254, 0.35)';
		this.ctx.beginPath();
		this.ctx.moveTo(x, y + h);
		this.ctx.bezierCurveTo(x + w * 0.35, y + h - 45, x + w * 0.7, y + h - 90, x + w, y + h - 35);
		this.ctx.lineTo(x + w, y + h);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.18)';
		this.ctx.lineWidth = 1.5;
		this.ctx.beginPath();
		this.ctx.moveTo(x + 40, y + h - 50);
		this.ctx.lineTo(x + 140, y + h - 50);
		this.ctx.lineTo(x + 190, y + h - 85);
		this.ctx.lineTo(x + 280, y + h - 85);
		this.ctx.stroke();

		this.ctx.fillStyle = '#3b82f6';
		this.ctx.beginPath();
		this.ctx.arc(x + 140, y + h - 50, 3.5, 0, Math.PI * 2);
		this.ctx.arc(x + 280, y + h - 85, 3.5, 0, Math.PI * 2);
		this.ctx.fill();

		const bob1 = Math.sin(time / 320) * 5;
		this.drawCrystalCluster(x + 60, y + h * 0.55 + bob1, 26, '#2563eb', '#60a5fa');

		const bob2 = Math.sin(time / 280 + 1.5) * 6;
		this.drawCrystalCluster(x + w - 75, y + h * 0.6 + bob2, 32, '#0284c7', '#38bdf8');

		this.drawAntennaTower(x + w - 45, y + 60, time);

		this.ctx.restore();
	},

	drawBuclesLandscape(x, y, w, h, time) {
		this.ctx.save();

		this.ctx.fillStyle = 'rgba(254, 243, 199, 0.45)';
		this.ctx.beginPath();
		this.ctx.moveTo(x, y + h);
		this.ctx.lineTo(x + 160, y + h);
		this.ctx.lineTo(x + 160, y + h - 70);
		this.ctx.lineTo(x + 90, y + h - 70);
		this.ctx.lineTo(x + 90, y + h - 110);
		this.ctx.lineTo(x, y + h - 110);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.fillStyle = 'rgba(253, 230, 138, 0.35)';
		this.ctx.beginPath();
		this.ctx.moveTo(x + w, y + h);
		this.ctx.lineTo(x + w - 180, y + h);
		this.ctx.lineTo(x + w - 180, y + h - 65);
		this.ctx.lineTo(x + w - 110, y + h - 65);
		this.ctx.lineTo(x + w - 110, y + h - 120);
		this.ctx.lineTo(x + w, y + h - 120);
		this.ctx.closePath();
		this.ctx.fill();

		this.drawMechanicalGear(x + 65, y + h * 0.45, 26, 8, time / 700, '#d97706');
		this.drawMechanicalGear(x + 105, y + h * 0.45 - 24, 16, 6, -time / 430, '#b45309');

		this.drawMechanicalGear(x + w - 70, y + h * 0.55, 34, 10, time / 900, '#f59e0b');

		this.drawLoopInfinityTrack(x + w - 90, y + 65, 45, 20, time);

		this.ctx.restore();
	},

	drawCondicionalesLandscape(x, y, w, h, time) {
		this.ctx.save();

		this.ctx.fillStyle = 'rgba(243, 232, 255, 0.45)';
		this.ctx.beginPath();
		this.ctx.moveTo(x, y + h);
		this.ctx.bezierCurveTo(x + 120, y + h - 60, x + 180, y + h - 100, x + 300, y + h);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.fillStyle = 'rgba(233, 213, 255, 0.35)';
		this.ctx.beginPath();
		this.ctx.moveTo(x + w, y + h);
		this.ctx.bezierCurveTo(x + w - 140, y + h - 70, x + w - 220, y + h - 110, x + w - 320, y + h);
		this.ctx.closePath();
		this.ctx.fill();

		const bob = Math.sin(time / 350) * 4;
		this.drawOpticalPrism(x + w - 85, y + h * 0.5 + bob, 38, time);

		this.drawDecisionTreeBranches(x + 55, y + h * 0.6, time);

		this.ctx.restore();
	},

	drawVariablesLandscape(x, y, w, h, time) {
		this.ctx.save();

		this.ctx.strokeStyle = 'rgba(219, 39, 119, 0.2)';
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.moveTo(x + 30, y + h - 30);
		this.ctx.lineTo(x + 90, y + h - 30);
		this.ctx.lineTo(x + 130, y + h - 70);
		this.ctx.lineTo(x + 200, y + h - 70);

		this.ctx.moveTo(x + w - 30, y + h - 40);
		this.ctx.lineTo(x + w - 100, y + h - 40);
		this.ctx.lineTo(x + w - 140, y + h - 80);
		this.ctx.lineTo(x + w - 210, y + h - 80);
		this.ctx.stroke();

		this.ctx.fillStyle = '#db2777';
		for (const pt of [[x + 90, y + h - 30], [x + 200, y + h - 70], [x + w - 100, y + h - 40], [x + w - 210, y + h - 80]]) {
			this.ctx.beginPath();
			this.ctx.arc(pt[0], pt[1], 3.5, 0, Math.PI * 2);
			this.ctx.fill();
		}

		this.drawMicrochipModule(x + w - 85, y + h * 0.45, 54, 42, time);

		const bob = Math.sin(time / 290) * 5;
		this.drawIsometricDataCube(x + 60, y + h * 0.6 + bob, 22, time);

		this.ctx.restore();
	},

	drawFuncionesLandscape(x, y, w, h, time) {
		this.ctx.save();

		this.ctx.fillStyle = 'rgba(209, 250, 229, 0.45)';
		this.ctx.beginPath();
		this.ctx.rect(x + 30, y + h - 85, 30, 85);
		this.ctx.rect(x + 68, y + h - 120, 36, 120);
		this.ctx.rect(x + 112, y + h - 70, 26, 70);
		this.ctx.fill();

		this.ctx.fillStyle = 'rgba(167, 243, 208, 0.4)';
		this.ctx.beginPath();
		this.ctx.rect(x + w - 60, y + h - 90, 32, 90);
		this.ctx.rect(x + w - 105, y + h - 130, 38, 130);
		this.ctx.rect(x + w - 145, y + h - 75, 30, 75);
		this.ctx.fill();

		this.drawCentralIonBeacon(x + w - 86, y + h * 0.5, time);

		this.drawSubroutineOrbit(x + 85, y + h * 0.5, time);

		this.ctx.restore();
	},

	drawCrystalCluster(cx, cy, size, col1, col2) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		this.ctx.fillStyle = col1;
		this.ctx.beginPath();
		this.ctx.moveTo(0, -size);
		this.ctx.lineTo(size * 0.4, 0);
		this.ctx.lineTo(0, size * 0.5);
		this.ctx.lineTo(-size * 0.4, 0);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.fillStyle = col2;
		this.ctx.beginPath();
		this.ctx.moveTo(0, -size);
		this.ctx.lineTo(size * 0.4, 0);
		this.ctx.lineTo(0, size * 0.5);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.fillStyle = col1;
		this.ctx.beginPath();
		this.ctx.moveTo(size * 0.45, -size * 0.3);
		this.ctx.lineTo(size * 0.75, size * 0.2);
		this.ctx.lineTo(size * 0.45, size * 0.6);
		this.ctx.lineTo(size * 0.2, size * 0.2);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.fillStyle = col2;
		this.ctx.beginPath();
		this.ctx.moveTo(-size * 0.45, -size * 0.25);
		this.ctx.lineTo(-size * 0.2, size * 0.2);
		this.ctx.lineTo(-size * 0.45, size * 0.55);
		this.ctx.lineTo(-size * 0.7, size * 0.2);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.restore();
	},

	drawAntennaTower(cx, cy, time) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		this.ctx.strokeStyle = '#94a3b8';
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.moveTo(0, 0);
		this.ctx.lineTo(0, 45);
		this.ctx.moveTo(-10, 45);
		this.ctx.lineTo(0, 20);
		this.ctx.lineTo(10, 45);
		this.ctx.stroke();

		this.ctx.fillStyle = '#2563eb';
		this.ctx.beginPath();
		this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
		this.ctx.fill();

		const wave = (time / 400) % 3;
		for (let i = 0; i < 3; i++) {
			const rad = 8 + (wave + i) * 6;
			const alpha = Math.max(0, 1 - rad / 28);
			this.ctx.strokeStyle = `rgba(37, 99, 235, ${alpha * 0.7})`;
			this.ctx.lineWidth = 1.5;
			this.ctx.beginPath();
			this.ctx.arc(0, 0, rad, -Math.PI * 0.8, -Math.PI * 0.2);
			this.ctx.stroke();
		}

		this.ctx.restore();
	},

	drawMechanicalGear(cx, cy, radius, teeth, rot, color) {
		this.ctx.save();
		this.ctx.translate(cx, cy);
		this.ctx.rotate(rot);

		this.ctx.fillStyle = color;
		this.ctx.beginPath();
		this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
		this.ctx.fill();

		for (let i = 0; i < teeth; i++) {
			const angle = (i * Math.PI * 2) / teeth;
			this.ctx.save();
			this.ctx.rotate(angle);
			this.ctx.fillRect(-radius * 0.16, -radius - radius * 0.2, radius * 0.32, radius * 0.3);
			this.ctx.restore();
		}

		this.ctx.fillStyle = '#ffffff';
		this.ctx.beginPath();
		this.ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = color;
		this.ctx.beginPath();
		this.ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.restore();
	},

	drawLoopInfinityTrack(cx, cy, width, height, time) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		this.ctx.strokeStyle = 'rgba(217, 119, 6, 0.3)';
		this.ctx.lineWidth = 3;
		this.ctx.beginPath();
		this.ctx.moveTo(-width / 2, 0);
		this.ctx.bezierCurveTo(-width / 2, -height, width / 2, height, width / 2, 0);
		this.ctx.bezierCurveTo(width / 2, -height, -width / 2, height, -width / 2, 0);
		this.ctx.stroke();

		const t = (time / 1000) % (Math.PI * 2);
		const px = Math.cos(t) * (width * 0.4);
		const py = Math.sin(t * 2) * (height * 0.45);
		this.ctx.fillStyle = '#f59e0b';
		this.ctx.beginPath();
		this.ctx.arc(px, py, 4, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.restore();
	},

	drawOpticalPrism(cx, cy, size, time) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
		this.ctx.lineWidth = 3;
		this.ctx.beginPath();
		this.ctx.moveTo(-45, -25);
		this.ctx.lineTo(0, 0);
		this.ctx.stroke();

		this.ctx.fillStyle = 'rgba(124, 58, 237, 0.7)';
		this.ctx.strokeStyle = '#7c3aed';
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.moveTo(0, -size * 0.6);
		this.ctx.lineTo(size * 0.55, size * 0.45);
		this.ctx.lineTo(-size * 0.55, size * 0.45);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.stroke();

		this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
		this.ctx.beginPath();
		this.ctx.moveTo(0, -size * 0.6);
		this.ctx.lineTo(size * 0.55, size * 0.45);
		this.ctx.lineTo(0, size * 0.45);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.strokeStyle = '#10b981';
		this.ctx.lineWidth = 2.5;
		this.ctx.beginPath();
		this.ctx.moveTo(size * 0.25, 0);
		this.ctx.lineTo(size * 0.9, -15);
		this.ctx.stroke();

		this.ctx.strokeStyle = '#ef4444';
		this.ctx.lineWidth = 2.5;
		this.ctx.beginPath();
		this.ctx.moveTo(size * 0.25, 5);
		this.ctx.lineTo(size * 0.9, 20);
		this.ctx.stroke();

		this.ctx.restore();
	},

	drawDecisionTreeBranches(cx, cy, time) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		this.ctx.strokeStyle = 'rgba(124, 58, 237, 0.35)';
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.moveTo(-25, 0);
		this.ctx.lineTo(0, 0);
		this.ctx.lineTo(25, -20);
		this.ctx.moveTo(0, 0);
		this.ctx.lineTo(25, 20);
		this.ctx.stroke();

		this.ctx.fillStyle = '#7c3aed';
		this.ctx.beginPath();
		this.ctx.arc(-25, 0, 4, 0, Math.PI * 2);
		this.ctx.arc(25, -20, 4, 0, Math.PI * 2);
		this.ctx.arc(25, 20, 4, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.restore();
	},

	drawMicrochipModule(cx, cy, w, h, time) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		this.ctx.fillStyle = '#475569';
		for (let i = -2; i <= 2; i++) {
			this.ctx.fillRect(-w / 2 - 6, i * 7 - 2, 6, 4);
			this.ctx.fillRect(w / 2, i * 7 - 2, 6, 4);
		}

		this.ctx.fillStyle = '#1e293b';
		this.ctx.strokeStyle = '#db2777';
		this.ctx.lineWidth = 2;
		if (this.ctx.roundRect) {
			this.ctx.beginPath();
			this.ctx.roundRect(-w / 2, -h / 2, w, h, 6);
			this.ctx.fill();
			this.ctx.stroke();
		}

		this.ctx.fillStyle = '#ffffff';
		this.ctx.font = '700 9px monospace';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';
		const hex = (Math.floor(time / 500) % 2 === 0) ? '0xFA' : '0x3C';
		this.ctx.fillText(hex, 0, -3);

		this.ctx.fillStyle = '#db2777';
		this.ctx.fillRect(-w * 0.35, h * 0.22, w * 0.7, 3);

		this.ctx.restore();
	},

	drawIsometricDataCube(cx, cy, size, time) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		const h = size * 0.58;

		this.ctx.fillStyle = '#f43f5e';
		this.ctx.beginPath();
		this.ctx.moveTo(0, 0);
		this.ctx.lineTo(-size, -h * 0.5);
		this.ctx.lineTo(-size, h * 0.5);
		this.ctx.lineTo(0, h);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.fillStyle = '#be123c';
		this.ctx.beginPath();
		this.ctx.moveTo(0, 0);
		this.ctx.lineTo(size, -h * 0.5);
		this.ctx.lineTo(size, h * 0.5);
		this.ctx.lineTo(0, h);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.fillStyle = '#fda4af';
		this.ctx.beginPath();
		this.ctx.moveTo(0, -h);
		this.ctx.lineTo(size, -h * 0.5);
		this.ctx.lineTo(0, 0);
		this.ctx.lineTo(-size, -h * 0.5);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.restore();
	},

	drawCentralIonBeacon(cx, cy, time) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		const beamGrad = this.ctx.createLinearGradient(0, 40, 0, -60);
		beamGrad.addColorStop(0, 'rgba(16, 185, 129, 0.7)');
		beamGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
		this.ctx.fillStyle = beamGrad;
		this.ctx.fillRect(-8, -60, 16, 100);

		for (let i = 0; i < 3; i++) {
			const yOffset = ((time / 30 + i * 25) % 80) - 50;
			const scale = Math.max(0.2, 1 - Math.abs(yOffset) / 50);
			this.ctx.strokeStyle = `rgba(52, 211, 153, ${scale * 0.8})`;
			this.ctx.lineWidth = 2;
			this.ctx.beginPath();
			this.ctx.ellipse(0, yOffset, 16 * scale, 5 * scale, 0, 0, Math.PI * 2);
			this.ctx.stroke();
		}

		this.ctx.fillStyle = '#059669';
		this.ctx.beginPath();
		this.ctx.moveTo(-16, 40);
		this.ctx.lineTo(16, 40);
		this.ctx.lineTo(8, 25);
		this.ctx.lineTo(-8, 25);
		this.ctx.closePath();
		this.ctx.fill();

		this.ctx.restore();
	},

	drawSubroutineOrbit(cx, cy, time) {
		this.ctx.save();
		this.ctx.translate(cx, cy);

		this.ctx.strokeStyle = 'rgba(5, 150, 105, 0.25)';
		this.ctx.lineWidth = 1.5;
		this.ctx.beginPath();
		this.ctx.ellipse(0, 0, 36, 14, Math.PI / 6, 0, Math.PI * 2);
		this.ctx.stroke();

		const t = time / 600;
		const px = Math.cos(t) * 36;
		const py = Math.sin(t) * 14;
		this.ctx.fillStyle = '#10b981';
		this.ctx.beginPath();
		this.ctx.arc(px, py, 4.5, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.fillStyle = '#059669';
		this.ctx.beginPath();
		this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
		this.ctx.fill();

		this.ctx.restore();
	},

	draw3DRibbonRoad(timestamp) {
		if (this.splines.length === 0) return;

		this.ctx.save();
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		this.ctx.beginPath();
		this.ctx.moveTo(this.splines[0].p1.x, this.splines[0].p1.y + 6);
		for (const s of this.splines) {
			this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y + 6, s.cp2.x, s.cp2.y + 6, s.p2.x, s.p2.y + 6);
		}
		this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
		this.ctx.lineWidth = 20;
		this.ctx.stroke();

		this.ctx.beginPath();
		this.ctx.moveTo(this.splines[0].p1.x, this.splines[0].p1.y);
		for (const s of this.splines) {
			this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p2.x, s.p2.y);
		}
		this.ctx.strokeStyle = '#e2e8f0';
		this.ctx.lineWidth = 16;
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

				this.ctx.beginPath();
				this.ctx.moveTo(s.p1.x, s.p1.y);
				this.ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p2.x, s.p2.y);
				this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
				this.ctx.lineWidth = 2;
				this.ctx.setLineDash([6, 14]);
				this.ctx.lineDashOffset = -((timestamp || 0) / 35);
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
			const r = this.nodeRadius + (isHovered ? 3 : 0);

			this.ctx.save();

			this.ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
			this.ctx.beginPath();
			this.ctx.ellipse(n.x, n.y + 4, r + 2, r * 0.7, 0, 0, Math.PI * 2);
			this.ctx.fill();

			if (isCurrent && !this.isMigrating) {
				const pulse = (Math.sin(timestamp / 300) + 1) / 2;
				const pulseR = r + 10 + pulse * 8;
				this.ctx.beginPath();
				this.ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
				this.ctx.fillStyle = `${n.biome.color}22`;
				this.ctx.fill();
				this.ctx.strokeStyle = `${n.biome.color}66`;
				this.ctx.lineWidth = 2;
				this.ctx.stroke();
			}

			this.ctx.beginPath();
			this.ctx.arc(n.x, n.y, r, 0, Math.PI * 2);

			if (isUnlocked) {
				this.ctx.fillStyle = '#ffffff';
				this.ctx.fill();

				this.ctx.strokeStyle = n.biome.color;
				this.ctx.lineWidth = isCurrent ? 4.5 : 3.5;
				this.ctx.stroke();

				this.ctx.fillStyle = '#0f172a';
				this.ctx.font = '800 14px Inter, sans-serif';
				this.ctx.textAlign = 'center';
				this.ctx.textBaseline = 'middle';
				this.ctx.fillText(n.level.id, n.x, n.y - 1);

				this.drawNodeStars3D(n.x, n.y + r + 12, starsCount);
			} else {
				this.ctx.fillStyle = '#f1f5f9';
				this.ctx.fill();
				this.ctx.strokeStyle = '#cbd5e1';
				this.ctx.lineWidth = 2.5;
				this.ctx.stroke();

				this.drawPadlock3D(n.x, n.y, 16, '#94a3b8');
			}

			this.ctx.restore();
		}
	},

	drawNodeStars3D(cx, cy, count) {
		const size = 11;
		const spacing = 13;
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

		this.ctx.lineWidth = 2.5;
		this.ctx.beginPath();
		this.ctx.arc(cx, bodyY, bodyW * 0.34, Math.PI, 0);
		this.ctx.stroke();
		this.ctx.restore();
	},

	drawBitAvatar(timestamp) {
		const walkFrame = this.isMigrating ? Math.floor((timestamp / 120) % 4) : 0;
		BitRenderer.draw(this.ctx, this.bitPos.x, this.bitPos.y - 12, this.bitAngle, {
			size: 28,
			walkFrame: walkFrame,
			isWalking: this.isMigrating,
			jumpHeight: 0,
			isTurning: false,
			time: timestamp
		});

		if (!this.isMigrating) {
			const bounce = Math.sin(timestamp / 250) * 2;
			const tagY = this.bitPos.y - 52 + bounce;

			this.ctx.save();
			this.ctx.fillStyle = '#2563eb';
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

