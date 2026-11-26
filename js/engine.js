class GameEngine {
	constructor(canvasId) {
		this.canvas = document.getElementById(canvasId);
		this.ctx = this.canvas.getContext('2d');
		this.level = null;
		this.grid = [];
		this.cores = [];
		this.batteries = [];
		this.particles = [];
		this.bot = {
			x: 0,
			y: 0,
			dir: 0,
			renderX: 0,
			renderY: 0,
			renderAngle: 0,
			jumpHeight: 0,
			memory: 0,
			walkFrame: 0,
			isWalking: false
		};
		this.animating = false;
		this.animationStart = 0;
		this.animationDuration = 260;
		this.animationResolve = null;
		this.animFrom = null;
		this.animTo = null;
		this.currentBlockId = null;
		this.onHighlightBlock = null;
		this.laserState = true;
		this.laserTimer = 0;
		this.cellSize = 60;
		this.offsetX = 0;
		this.offsetY = 0;
		this.boundLoop = this.loop.bind(this);
		requestAnimationFrame(this.boundLoop);
	}

	loadLevel(levelData) {
		this.level = levelData;
		this.grid = levelData.grid.map(row => [...row]);
		this.cores = [];
		this.batteries = [];
		this.particles = [];
		this.infotronsCollected = 0;
		this.infotronsRequired = levelData.infotronsRequired || 0;
		this.exitUnlocked = this.infotronsRequired === 0;
		for (let r = 0; r < this.grid.length; r++) {
			for (let c = 0; c < this.grid[r].length; c++) {
				const tile = this.grid[r][c];
				if (tile === 2) {
					this.cores.push({ x: c, y: r, active: false });
				} else if (tile === 4) {
					this.batteries.push({ x: c, y: r, value: 1, collected: false });
				}
			}
		}
		this.bot.x = levelData.start.x;
		this.bot.y = levelData.start.y;
		this.bot.dir = levelData.start.dir;
		this.bot.renderX = this.bot.x;
		this.bot.renderY = this.bot.y;
		this.bot.renderAngle = this.bot.dir * (Math.PI / 2);
		this.bot.jumpHeight = 0;
		this.bot.memory = 0;
		this.animating = false;
		this.laserState = true;
		this.laserTimer = 0;
		this.computeLayout();
	}

	computeLayout() {
		if (!this.level) return;
		const rows = this.grid.length;
		const cols = this.grid[0].length;
		const padding = 30;
		const availW = this.canvas.width - padding * 2;
		const availH = this.canvas.height - padding * 2;
		this.cellSize = Math.min(availW / cols, availH / rows, 72);
		this.offsetX = (this.canvas.width - cols * this.cellSize) / 2;
		this.offsetY = (this.canvas.height - rows * this.cellSize) / 2;
	}

	reset() {
		this.cancelAnimation();
		if (this.level) {
			this.loadLevel(this.level);
		}
	}

	cancelAnimation() {
		this.animating = false;
		this.bot.renderX = this.bot.x;
		this.bot.renderY = this.bot.y;
		this.bot.renderAngle = this.bot.dir * (Math.PI / 2);
		this.bot.jumpHeight = 0;
		this.bot.isWalking = false;
		this.bot.walkFrame = 0;
		if (this.animationResolve) {
			const res = this.animationResolve;
			this.animationResolve = null;
			res();
		}
	}

	getAheadCoordinates() {
		const deltas = [
			{ dx: 0, dy: -1 },
			{ dx: 1, dy: 0 },
			{ dx: 0, dy: 1 },
			{ dx: -1, dy: 0 }
		];
		const d = deltas[this.bot.dir];
		return { x: this.bot.x + d.dx, y: this.bot.y + d.dy };
	}

	isOutOfBounds(x, y) {
		return y < 0 || y >= this.grid.length || x < 0 || x >= this.grid[0].length;
	}

	checkPitAhead() {
		const target = this.getAheadCoordinates();
		if (this.isOutOfBounds(target.x, target.y)) return false;
		return this.grid[target.y][target.x] === 3;
	}

	checkWallAhead() {
		const target = this.getAheadCoordinates();
		if (this.isOutOfBounds(target.x, target.y)) return true;
		return this.grid[target.y][target.x] === 1;
	}

	checkLaserAhead() {
		const target = this.getAheadCoordinates();
		if (this.isOutOfBounds(target.x, target.y)) return false;
		return this.grid[target.y][target.x] === 6 && this.laserState;
	}

	checkDangerAbove() {
		if (this.bot.y <= 0) return false;
		const directlyAbove = this.grid[this.bot.y - 1][this.bot.x];
		if (directlyAbove === 8 || directlyAbove === 9 || directlyAbove === 13) return true;
		if (this.bot.x > 0) {
			const leftAbove = this.grid[this.bot.y - 1][this.bot.x - 1];
			if ((leftAbove === 8 || leftAbove === 9) && this.grid[this.bot.y][this.bot.x - 1] !== 0) return true;
		}
		if (this.bot.x < this.grid[0].length - 1) {
			const rightAbove = this.grid[this.bot.y - 1][this.bot.x + 1];
			if ((rightAbove === 8 || rightAbove === 9) && this.grid[this.bot.y][this.bot.x + 1] !== 0) return true;
		}
		return false;
	}

	checkAheadType(expectedType) {
		const ahead = this.getAheadCoordinates();
		if (this.isOutOfBounds(ahead.x, ahead.y)) {
			return expectedType === 'muro';
		}
		const tile = this.grid[ahead.y][ahead.x];
		const typeNames = {
			0: 'vacio',
			1: 'muro',
			7: 'pista',
			8: 'zonk',
			9: 'infotron',
			10: 'salida',
			13: 'disco',
			15: 'enemigo',
			16: 'enemigo'
		};
		const currentType = typeNames[tile] || 'otro';
		return currentType === expectedType;
	}

	isAtGoal() {
		if (this.level && this.level.infotronsRequired > 0) {
			const onExit = this.grid[this.bot.y][this.bot.x] === 10 || (this.level.exit && this.bot.x === this.level.exit.x && this.bot.y === this.level.exit.y);
			return onExit && (this.infotronsCollected >= this.infotronsRequired);
		}
		if (this.grid[this.bot.y][this.bot.x] === 10) {
			return true;
		}
		if (this.cores.length > 0 && this.areAllCoresActive()) {
			return true;
		}
		return this.cores.some(c => c.x === this.bot.x && c.y === this.bot.y);
	}

	areAllCoresActive() {
		if (this.level && this.level.infotronsRequired > 0) {
			return this.infotronsCollected >= this.infotronsRequired;
		}
		if (this.cores.length === 0) return true;
		return this.cores.every(c => c.active);
	}

	async step(action, blockId, arg) {
		this.currentBlockId = blockId;
		if (this.onHighlightBlock && blockId) {
			this.onHighlightBlock(blockId);
		}
		switch (action) {
			case 'avanzar':
				return this.performMove();
			case 'saltar':
				return this.performJump();
			case 'girar_izq':
				return this.performTurn(-1);
			case 'girar_der':
				return this.performTurn(1);
			case 'encender':
				return this.performTurnOn();
			case 'recoger':
				return this.performCollect();
			case 'sumar_memoria':
				return this.performAddMemory(arg || 1);
			case 'esperar':
				return this.performWait();
			case 'despejar':
				return this.performClear();
			case 'empujar':
				return this.performPush();
			default:
				return Promise.resolve();
		}
	}

	performMove() {
		const ahead = this.getAheadCoordinates();
		if (this.isOutOfBounds(ahead.x, ahead.y)) {
			throw new Error("¡Ouch! BIT intentó salirse del mapa de navegación.");
		}
		const tile = this.grid[ahead.y][ahead.x];
		if (tile === 1) {
			throw new Error("¡Ouch! BIT intentó avanzar, pero había un muro frente a él.");
		}
		if (tile === 8) {
			throw new Error("¡Bloqueado! Un componente pesado bloquea el paso. Usa empujar si hay espacio libre detrás.");
		}
		if (tile === 13) {
			throw new Error("¡Peligro! Un disco de impacto bloquea el paso.");
		}
		if (tile === 15 || tile === 16) {
			throw new Error("¡Alerta! BIT colisionó contra una entidad enemiga.");
		}
		if (tile === 6 && this.laserState) {
			throw new Error("¡Alerta! BIT intentó cruzar una barrera láser activa.");
		}
		if (tile === 5) {
			if (this.bot.memory < (this.level.requiredMemory || 1)) {
				throw new Error("¡Acceso denegado! La compuerta requiere un valor de memoria superior.");
			}
		}
		const fromX = this.bot.x;
		const fromY = this.bot.y;
		this.bot.x = ahead.x;
		this.bot.y = ahead.y;
		if (tile === 7) {
			this.grid[ahead.y][ahead.x] = 0;
			if (window.SoundFX) window.SoundFX.playMunch();
			this.spawnCircuitParticles(ahead.x, ahead.y);
		} else if (tile === 9) {
			this.grid[ahead.y][ahead.x] = 0;
			this.infotronsCollected += 1;
			if (window.SoundFX) window.SoundFX.playInfotron();
			this.spawnCoreParticles(ahead.x, ahead.y);
			if (this.infotronsRequired > 0 && this.infotronsCollected >= this.infotronsRequired && !this.exitUnlocked) {
				this.exitUnlocked = true;
				if (window.SoundFX) window.SoundFX.playExitReady();
			}
		} else {
			if (window.SoundFX) window.SoundFX.playStep();
		}
		return this.startAnimation({
			fromX: fromX,
			fromY: fromY,
			toX: ahead.x,
			toY: ahead.y,
			fromAngle: this.bot.renderAngle,
			toAngle: this.bot.dir * (Math.PI / 2),
			jump: false
		}).then(async () => {
			if (tile === 3) {
				if (window.SoundFX) window.SoundFX.playError();
				throw new Error("¡Cuidado! BIT cayó en una baldosa rota. Usa el sensor para saltar.");
			}
			await this.tickPhysics();
		});
	}

	performClear() {
		const ahead = this.getAheadCoordinates();
		if (this.isOutOfBounds(ahead.x, ahead.y)) {
			throw new Error("¡Ouch! BIT intentó despejar fuera de los límites del mapa.");
		}
		const tile = this.grid[ahead.y][ahead.x];
		if (tile === 7) {
			this.grid[ahead.y][ahead.x] = 0;
			if (window.SoundFX) window.SoundFX.playMunch();
			this.spawnCircuitParticles(ahead.x, ahead.y);
		} else if (tile === 9) {
			this.grid[ahead.y][ahead.x] = 0;
			this.infotronsCollected += 1;
			if (window.SoundFX) window.SoundFX.playInfotron();
			this.spawnCoreParticles(ahead.x, ahead.y);
			if (this.infotronsRequired > 0 && this.infotronsCollected >= this.infotronsRequired && !this.exitUnlocked) {
				this.exitUnlocked = true;
				if (window.SoundFX) window.SoundFX.playExitReady();
			}
		} else {
			throw new Error("¡Nada que despejar! La casilla frente a BIT no contiene una pista ni un infotrón.");
		}
		if (window.SoundFX) window.SoundFX.playAction();
		return new Promise(resolve => setTimeout(resolve, 150)).then(() => this.tickPhysics());
	}

	performPush() {
		const ahead = this.getAheadCoordinates();
		if (this.isOutOfBounds(ahead.x, ahead.y)) {
			throw new Error("¡Ouch! BIT intentó empujar fuera del mapa.");
		}
		const tile = this.grid[ahead.y][ahead.x];
		if (tile !== 8 && tile !== 13) {
			throw new Error("¡Nada que empujar! Solo se pueden empujar componentes pesados o discos.");
		}
		const dx = ahead.x - this.bot.x;
		const dy = ahead.y - this.bot.y;
		const behindX = ahead.x + dx;
		const behindY = ahead.y + dy;
		if (this.isOutOfBounds(behindX, behindY) || this.grid[behindY][behindX] !== 0) {
			throw new Error("¡Espacio bloqueado! No hay espacio libre detrás del objeto para empujarlo.");
		}
		this.grid[ahead.y][ahead.x] = 0;
		this.grid[behindY][behindX] = tile;
		if (window.SoundFX) window.SoundFX.playStep();
		return new Promise(resolve => setTimeout(resolve, 180)).then(() => this.tickPhysics());
	}

	performJump() {
		const deltas = [
			{ dx: 0, dy: -1 },
			{ dx: 1, dy: 0 },
			{ dx: 0, dy: 1 },
			{ dx: -1, dy: 0 }
		];
		const d = deltas[this.bot.dir];
		const target = { x: this.bot.x + d.dx * 2, y: this.bot.y + d.dy * 2 };
		if (this.isOutOfBounds(target.x, target.y)) {
			throw new Error("¡Ouch! El salto excedió los límites del mapa.");
		}
		if (this.grid[target.y][target.x] === 1) {
			throw new Error("¡Impacto! BIT intentó saltar directo contra un muro.");
		}
		const fromX = this.bot.x;
		const fromY = this.bot.y;
		this.bot.x = target.x;
		this.bot.y = target.y;
		if (window.SoundFX) window.SoundFX.playAction();
		return this.startAnimation({
			fromX: fromX,
			fromY: fromY,
			toX: target.x,
			toY: target.y,
			fromAngle: this.bot.renderAngle,
			toAngle: this.bot.dir * (Math.PI / 2),
			jump: true
		});
	}

	performTurn(delta) {
		const oldDir = this.bot.dir;
		this.bot.dir = (this.bot.dir + delta + 4) % 4;
		const targetAngle = this.bot.renderAngle + delta * (Math.PI / 2);
		if (window.SoundFX) window.SoundFX.playTurn();
		return this.startAnimation({
			fromX: this.bot.x,
			fromY: this.bot.y,
			toX: this.bot.x,
			toY: this.bot.y,
			fromAngle: this.bot.renderAngle,
			toAngle: targetAngle,
			jump: false
		});
	}

	performTurnOn() {
		const core = this.cores.find(c => c.x === this.bot.x && c.y === this.bot.y);
		if (!core) {
			throw new Error("¡Sin núcleo! No hay ningún núcleo de energía en esta casilla para encender.");
		}
		core.active = true;
		this.spawnCoreParticles(this.bot.x, this.bot.y);
		if (window.SoundFX) window.SoundFX.playAction();
		return new Promise(resolve => setTimeout(resolve, 200));
	}

	performCollect() {
		const battery = this.batteries.find(b => b.x === this.bot.x && b.y === this.bot.y && !b.collected);
		if (!battery) {
			throw new Error("¡Nada que recoger! No hay baterías ni cristales disponibles en esta posición.");
		}
		battery.collected = true;
		this.bot.memory = battery.value;
		this.spawnCoreParticles(this.bot.x, this.bot.y);
		if (window.SoundFX) window.SoundFX.playAction();
		return new Promise(resolve => setTimeout(resolve, 180));
	}

	performAddMemory(amount) {
		const battery = this.batteries.find(b => b.x === this.bot.x && b.y === this.bot.y && !b.collected);
		if (battery) {
			battery.collected = true;
		}
		this.bot.memory += amount;
		this.spawnCoreParticles(this.bot.x, this.bot.y);
		if (window.SoundFX) window.SoundFX.playAction();
		return new Promise(resolve => setTimeout(resolve, 180));
	}

	performWait() {
		this.laserState = !this.laserState;
		this.laserTimer = this.laserState ? 0 : 45;
		if (window.SoundFX) window.SoundFX.playTurn();
		return new Promise(resolve => setTimeout(resolve, 220)).then(() => this.tickPhysics());
	}

	async tickPhysics() {
		const rows = this.grid.length;
		const cols = this.grid[0].length;
		let stateChanged = false;

		for (let r = rows - 2; r >= 0; r--) {
			for (let c = 0; c < cols; c++) {
				const tile = this.grid[r][c];
				if (tile === 8 || tile === 9 || tile === 13) {
					const below = this.grid[r + 1][c];
					if (below === 0) {
						if (this.bot.x === c && this.bot.y === r + 1) {
							if (window.SoundFX) window.SoundFX.playError();
							throw new Error("¡Aplastado! Un componente pesado cayó sobre BIT.");
						}
						this.grid[r][c] = 0;
						this.grid[r + 1][c] = tile;
						stateChanged = true;
						if (tile === 13 && r + 2 < rows && this.grid[r + 2][c] !== 0) {
							this.triggerExplosion(c, r + 1);
						}
					} else if (below === 8 || below === 9) {
						if (c > 0 && this.grid[r][c - 1] === 0 && this.grid[r + 1][c - 1] === 0 && !(this.bot.x === c - 1 && this.bot.y === r)) {
							this.grid[r][c] = 0;
							this.grid[r][c - 1] = tile;
							stateChanged = true;
						} else if (c < cols - 1 && this.grid[r][c + 1] === 0 && this.grid[r + 1][c + 1] === 0 && !(this.bot.x === c + 1 && this.bot.y === r)) {
							this.grid[r][c] = 0;
							this.grid[r][c + 1] = tile;
							stateChanged = true;
						}
					} else if (below === 15) {
						this.grid[r][c] = 0;
						this.triggerExplosion(c, r + 1);
						stateChanged = true;
					} else if (below === 16) {
						this.grid[r][c] = 0;
						this.transmuteElectron(c, r + 1);
						stateChanged = true;
					}
				}
			}
		}

		if (stateChanged && window.SoundFX) {
			window.SoundFX.playZonkImpact();
		}
		if (this.infotronsRequired > 0 && this.infotronsCollected >= this.infotronsRequired && !this.exitUnlocked) {
			this.exitUnlocked = true;
			if (window.SoundFX) window.SoundFX.playExitReady();
		}
	}

	triggerExplosion(centerX, centerY) {
		if (window.SoundFX) window.SoundFX.playExplosion();
		this.spawnExplosionParticles(centerX, centerY);
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const tx = centerX + dx;
				const ty = centerY + dy;
				if (!this.isOutOfBounds(tx, ty)) {
					if (this.grid[ty][tx] !== 1 && this.grid[ty][tx] !== 10) {
						this.grid[ty][tx] = 0;
					}
					if (this.bot.x === tx && this.bot.y === ty) {
						throw new Error("¡Explosión! BIT fue alcanzado por la detonación.");
					}
				}
			}
		}
	}

	transmuteElectron(centerX, centerY) {
		if (window.SoundFX) window.SoundFX.playInfotron();
		this.spawnCoreParticles(centerX, centerY);
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const tx = centerX + dx;
				const ty = centerY + dy;
				if (!this.isOutOfBounds(tx, ty)) {
					if (this.grid[ty][tx] !== 1 && this.grid[ty][tx] !== 10) {
						this.grid[ty][tx] = 9;
					}
				}
			}
		}
	}

	spawnCircuitParticles(gridX, gridY) {
		const px = this.offsetX + (gridX + 0.5) * this.cellSize;
		const py = this.offsetY + (gridY + 0.5) * this.cellSize;
		for (let i = 0; i < 16; i++) {
			const angle = (Math.PI * 2 * i) / 16;
			const speed = 1.0 + Math.random() * 2.0;
			this.particles.push({
				x: px,
				y: py,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				radius: 1.5 + Math.random() * 2,
				color: Math.random() > 0.5 ? '#10b981' : '#34d399',
				alpha: 1,
				life: 20 + Math.random() * 10
			});
		}
	}

	spawnExplosionParticles(gridX, gridY) {
		const px = this.offsetX + (gridX + 0.5) * this.cellSize;
		const py = this.offsetY + (gridY + 0.5) * this.cellSize;
		for (let i = 0; i < 32; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 2.0 + Math.random() * 4.0;
			this.particles.push({
				x: px,
				y: py,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				radius: 2.5 + Math.random() * 3.5,
				color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
				alpha: 1,
				life: 25 + Math.random() * 15
			});
		}
	}

	startAnimation(animData) {
		return new Promise(resolve => {
			this.animating = true;
			this.animationStart = performance.now();
			this.animFrom = animData;
			this.animationResolve = resolve;
		});
	}

	spawnCoreParticles(gridX, gridY) {
		const px = this.offsetX + (gridX + 0.5) * this.cellSize;
		const py = this.offsetY + (gridY + 0.5) * this.cellSize;
		for (let i = 0; i < 24; i++) {
			const angle = (Math.PI * 2 * i) / 24;
			const speed = 1.5 + Math.random() * 2.5;
			this.particles.push({
				x: px,
				y: py,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				radius: 2 + Math.random() * 3,
				color: Math.random() > 0.5 ? '#10b981' : '#0284c7',
				alpha: 1,
				life: 30 + Math.random() * 15
			});
		}
	}

	loop(timestamp) {
		if (!this.canvas.hidden) {
			this.update(timestamp);
			this.draw();
		}
		requestAnimationFrame(this.boundLoop);
	}

	update(timestamp) {
		this.laserTimer += 1;
		if (this.laserTimer % 90 === 0) {
			this.laserState = !this.laserState;
		}

		if (this.animating && this.animFrom) {
			const elapsed = timestamp - this.animationStart;
			const progress = Math.min(elapsed / this.animationDuration, 1);
			const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
			this.bot.renderX = this.animFrom.fromX + (this.animFrom.toX - this.animFrom.fromX) * ease;
			this.bot.renderY = this.animFrom.fromY + (this.animFrom.toY - this.animFrom.fromY) * ease;
			this.bot.renderAngle = this.animFrom.fromAngle + (this.animFrom.toAngle - this.animFrom.fromAngle) * ease;
			if (this.animFrom.jump) {
				this.bot.jumpHeight = Math.sin(progress * Math.PI) * 22;
				this.bot.isWalking = false;
				this.bot.walkFrame = 0;
			} else if (this.animFrom.fromX !== this.animFrom.toX || this.animFrom.fromY !== this.animFrom.toY) {
				this.bot.jumpHeight = 0;
				this.bot.isWalking = true;
				this.bot.walkFrame = Math.min(Math.floor(progress * 4), 3);
			} else {
				this.bot.jumpHeight = 0;
				this.bot.isWalking = false;
				this.bot.walkFrame = 0;
			}
			if (progress >= 1) {
				this.animating = false;
				this.bot.renderX = this.animFrom.toX;
				this.bot.renderY = this.animFrom.toY;
				this.bot.renderAngle = this.animFrom.toAngle;
				this.bot.jumpHeight = 0;
				this.bot.isWalking = false;
				this.bot.walkFrame = 0;
				if (this.animationResolve) {
					const res = this.animationResolve;
					this.animationResolve = null;
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
	}

	draw() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		if (!this.level) return;

		const rows = this.grid.length;
		const cols = this.grid[0].length;
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				this.drawTile(c, r, this.grid[r][c]);
			}
		}

		for (const core of this.cores) {
			this.drawCore(core);
		}

		for (const battery of this.batteries) {
			if (!battery.collected) {
				this.drawBattery(battery);
			}
		}

		this.drawBot();

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

	drawTile(c, r, type) {
		const x = this.offsetX + c * this.cellSize;
		const y = this.offsetY + r * this.cellSize;
		const s = this.cellSize;
		this.ctx.save();
		if (type === 1) {
			this.ctx.fillStyle = '#334155';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			this.ctx.strokeStyle = '#1e293b';
			this.ctx.lineWidth = 2;
			this.ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
			this.ctx.fillStyle = '#475569';
			this.ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
		} else if (type === 3) {
			this.ctx.fillStyle = '#f1f5f9';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			this.ctx.strokeStyle = '#ef4444';
			this.ctx.lineWidth = 1.5;
			this.ctx.setLineDash([4, 4]);
			this.ctx.strokeRect(x + 4, y + 4, s - 8, s - 8);
		} else if (type === 5) {
			this.ctx.fillStyle = '#fdf2f8';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			this.ctx.strokeStyle = '#db2777';
			this.ctx.lineWidth = 2;
			this.ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);

			const pw = s * 0.32;
			const ph = s * 0.26;
			const px = x + (s - pw) / 2;
			const py = y + s * 0.5;
			this.ctx.fillStyle = '#db2777';
			this.ctx.fillRect(px, py, pw, ph);

			this.ctx.strokeStyle = '#db2777';
			this.ctx.lineWidth = 2.5;
			this.ctx.beginPath();
			this.ctx.arc(x + s / 2, py, pw * 0.32, Math.PI, 0);
			this.ctx.stroke();
		} else if (type === 6) {
			this.ctx.fillStyle = '#f8fafc';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			this.ctx.strokeStyle = this.laserState ? '#ef4444' : '#10b981';
			this.ctx.lineWidth = 2;
			this.ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
			this.ctx.beginPath();
			const isHorizontal = (c > 0 && this.grid[r][c - 1] !== 1) || (c < this.grid[0].length - 1 && this.grid[r][c + 1] !== 1);
			if (isHorizontal) {
				this.ctx.moveTo(x + s / 2, y + 6);
				this.ctx.lineTo(x + s / 2, y + s - 6);
			} else {
				this.ctx.moveTo(x + 6, y + s / 2);
				this.ctx.lineTo(x + s - 6, y + s / 2);
			}
			this.ctx.strokeStyle = this.laserState ? '#ef4444' : '#10b981';
			this.ctx.lineWidth = 4;
			this.ctx.stroke();
		} else if (type === 7) {
			this.ctx.fillStyle = '#064e3b';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			this.ctx.strokeStyle = '#059669';
			this.ctx.lineWidth = 1;
			this.ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
			this.ctx.strokeStyle = '#34d399';
			this.ctx.lineWidth = 2;
			this.ctx.beginPath();
			this.ctx.moveTo(x + 4, y + s / 2);
			this.ctx.lineTo(x + s / 2, y + s / 2);
			this.ctx.lineTo(x + s / 2, y + s - 4);
			this.ctx.stroke();
			this.ctx.fillStyle = '#fbbf24';
			this.ctx.beginPath();
			this.ctx.arc(x + s / 2, y + s / 2, 3, 0, Math.PI * 2);
			this.ctx.fill();
		} else if (type === 8) {
			this.ctx.fillStyle = '#f8fafc';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			const cx = x + s / 2;
			const cy = y + s / 2;
			const r = s * 0.36;
			const grad = this.ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
			grad.addColorStop(0, '#cbd5e1');
			grad.addColorStop(0.7, '#64748b');
			grad.addColorStop(1, '#334155');
			this.ctx.fillStyle = grad;
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
			this.ctx.fill();
			this.ctx.strokeStyle = '#1e293b';
			this.ctx.lineWidth = 1.5;
			this.ctx.stroke();
			this.ctx.fillStyle = '#475569';
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
			this.ctx.fill();
		} else if (type === 9) {
			this.ctx.fillStyle = '#f8fafc';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			const cx = x + s / 2;
			const cy = y + s / 2;
			this.ctx.strokeStyle = '#06b6d4';
			this.ctx.lineWidth = 1.5;
			this.ctx.beginPath();
			this.ctx.ellipse(cx, cy, s * 0.38, s * 0.18, Math.PI / 4, 0, Math.PI * 2);
			this.ctx.stroke();
			this.ctx.beginPath();
			this.ctx.ellipse(cx, cy, s * 0.38, s * 0.18, -Math.PI / 4, 0, Math.PI * 2);
			this.ctx.stroke();
			this.ctx.fillStyle = '#0891b2';
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, s * 0.18, 0, Math.PI * 2);
			this.ctx.fill();
			this.ctx.fillStyle = '#ffffff';
			this.ctx.beginPath();
			this.ctx.arc(cx - 2, cy - 2, s * 0.07, 0, Math.PI * 2);
			this.ctx.fill();
		} else if (type === 10) {
			this.ctx.fillStyle = '#0f172a';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			this.ctx.strokeStyle = this.exitUnlocked ? '#10b981' : '#ef4444';
			this.ctx.lineWidth = 2.5;
			this.ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
			const cx = x + s / 2;
			const cy = y + s / 2;
			if (this.exitUnlocked) {
				this.ctx.fillStyle = '#10b981';
				this.ctx.beginPath();
				this.ctx.arc(cx, cy, s * 0.28, 0, Math.PI * 2);
				this.ctx.fill();
				this.ctx.fillStyle = '#ecfdf5';
				this.ctx.beginPath();
				this.ctx.arc(cx, cy, s * 0.14, 0, Math.PI * 2);
				this.ctx.fill();
			} else {
				this.ctx.fillStyle = '#ef4444';
				this.ctx.beginPath();
				this.ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
				this.ctx.fill();
			}
		} else if (type === 13) {
			this.ctx.fillStyle = '#f8fafc';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			const cx = x + s / 2;
			const cy = y + s / 2;
			const r = s * 0.34;
			this.ctx.fillStyle = '#ea580c';
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
			this.ctx.fill();
			this.ctx.strokeStyle = '#c2410c';
			this.ctx.lineWidth = 2;
			this.ctx.stroke();
			this.ctx.fillStyle = '#fed7aa';
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
			this.ctx.fill();
		} else if (type === 15) {
			this.ctx.fillStyle = '#f8fafc';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			const cx = x + s / 2;
			const cy = y + s / 2;
			this.ctx.strokeStyle = '#ef4444';
			this.ctx.lineWidth = 2.5;
			this.ctx.beginPath();
			this.ctx.moveTo(cx - 10, cy - 10);
			this.ctx.lineTo(cx + 10, cy + 10);
			this.ctx.moveTo(cx + 10, cy - 10);
			this.ctx.lineTo(cx - 10, cy + 10);
			this.ctx.stroke();
			this.ctx.fillStyle = '#7f1d1d';
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, 4, 0, Math.PI * 2);
			this.ctx.fill();
		} else if (type === 16) {
			this.ctx.fillStyle = '#f8fafc';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			const cx = x + s / 2;
			const cy = y + s / 2;
			this.ctx.fillStyle = '#06b6d4';
			this.ctx.beginPath();
			for (let i = 0; i < 8; i++) {
				const a = (Math.PI / 4) * i;
				const rad = (i % 2 === 0) ? s * 0.36 : s * 0.16;
				const px = cx + Math.cos(a) * rad;
				const py = cy + Math.sin(a) * rad;
				if (i === 0) this.ctx.moveTo(px, py);
				else this.ctx.lineTo(px, py);
			}
			this.ctx.closePath();
			this.ctx.fill();
			this.ctx.fillStyle = '#ffffff';
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, 4, 0, Math.PI * 2);
			this.ctx.fill();
		} else {
			this.ctx.fillStyle = '#ffffff';
			this.ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			this.ctx.strokeStyle = '#e2e8f0';
			this.ctx.lineWidth = 1;
			this.ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
		}
		this.ctx.restore();
	}

	drawCore(core) {
		const cx = this.offsetX + (core.x + 0.5) * this.cellSize;
		const cy = this.offsetY + (core.y + 0.5) * this.cellSize;
		const r = this.cellSize * 0.28;
		this.ctx.save();
		if (core.active) {
			this.ctx.shadowColor = '#10b981';
			this.ctx.shadowBlur = 12;
			this.ctx.fillStyle = '#10b981';
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
			this.ctx.fill();
			this.ctx.fillStyle = '#ffffff';
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
			this.ctx.fill();
		} else {
			this.ctx.strokeStyle = '#d97706';
			this.ctx.lineWidth = 3;
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
			this.ctx.stroke();
			this.ctx.fillStyle = 'rgba(217, 119, 6, 0.12)';
			this.ctx.fill();
		}
		this.ctx.restore();
	}

	drawBattery(battery) {
		const cx = this.offsetX + (battery.x + 0.5) * this.cellSize;
		const cy = this.offsetY + (battery.y + 0.5) * this.cellSize;
		this.ctx.save();
		this.ctx.fillStyle = '#0284c7';
		this.ctx.beginPath();
		this.ctx.moveTo(cx, cy - 14);
		this.ctx.lineTo(cx + 10, cy);
		this.ctx.lineTo(cx, cy + 14);
		this.ctx.lineTo(cx - 10, cy);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.restore();
	}

	drawBot() {
		const cx = this.offsetX + (this.bot.renderX + 0.5) * this.cellSize;
		const cy = this.offsetY + (this.bot.renderY + 0.5) * this.cellSize;
		BitRenderer.draw(this.ctx, cx, cy, this.bot.renderAngle, {
			size: this.cellSize * 0.38,
			walkFrame: this.bot.walkFrame,
			isWalking: this.bot.isWalking,
			jumpHeight: this.bot.jumpHeight,
			isTurning: this.animating && this.animFrom && (this.animFrom.fromAngle !== this.animFrom.toAngle),
			time: performance.now()
		});
	}
}
