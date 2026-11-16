class GameEngine3D {
	constructor(canvasId) {
		this.canvas = document.getElementById(canvasId);
		this.level = null;
		this.grid = [];
		this.cores = [];
		this.batteries = [];
		this.particles = [];
		this.tilesGroup = new THREE.Group();
		this.itemsGroup = new THREE.Group();
		this.particlesGroup = new THREE.Group();

		this.bot3D = new Bit3D();
		this.bot = {
			x: 0,
			y: 0,
			dir: 0,
			renderX: 0,
			renderY: 0,
			renderAngle: 0,
			jumpHeight: 0,
			memory: 0
		};

		this.animating = false;
		this.animationStart = 0;
		this.animationDuration = 260;
		this.animationResolve = null;
		this.animFrom = null;
		this.laserState = true;
		this.laserTimer = 0;
		this.laserMeshes = [];
		this.gateMeshes = [];

		this.zoomMultiplier = 1.0;
		this.focusOnBot = false;
		this.currentLookAtX = 0;
		this.currentLookAtZ = 0;

		this.onHighlightBlock = null;

		this.initThree();
		this.bindEvents();
		this.boundLoop = this.loop.bind(this);
		requestAnimationFrame(this.boundLoop);
	}

	initThree() {
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance'
		});
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.15;
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

		this.scene = new THREE.Scene();

		const aspect = this.canvas.clientWidth / this.canvas.clientHeight || 1;
		const d = 6.5;
		this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 100);
		this.camera.position.set(12, 22, 12);
		this.camera.lookAt(0, 0, 0);

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
		this.scene.add(ambientLight);

		const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0xe2e8f0, 0.55);
		hemiLight.position.set(0, 20, 0);
		this.scene.add(hemiLight);

		this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
		this.sunLight.position.set(12, 22, 10);
		this.sunLight.castShadow = true;
		this.sunLight.shadow.mapSize.width = 2048;
		this.sunLight.shadow.mapSize.height = 2048;
		this.sunLight.shadow.camera.near = 0.5;
		this.sunLight.shadow.camera.far = 50;
		const sRange = 9;
		this.sunLight.shadow.camera.left = -sRange;
		this.sunLight.shadow.camera.right = sRange;
		this.sunLight.shadow.camera.top = sRange;
		this.sunLight.shadow.camera.bottom = -sRange;
		this.sunLight.shadow.bias = -0.0005;
		this.scene.add(this.sunLight);

		this.scene.add(this.tilesGroup);
		this.scene.add(this.itemsGroup);
		this.scene.add(this.bot3D.group);
		this.scene.add(this.particlesGroup);

		this.computeLayout();
	}

	bindEvents() {
		this.canvas.addEventListener('mousemove', (e) => {
			const rect = this.canvas.getBoundingClientRect();
			const nx = (e.clientX - rect.left) / rect.width - 0.5;
			const ny = (e.clientY - rect.top) / rect.height - 0.5;
			this.targetCamOffsetX = nx * 0.6;
			this.targetCamOffsetZ = ny * 0.6;
		});

		this.canvas.addEventListener('mouseleave', () => {
			this.targetCamOffsetX = 0;
			this.targetCamOffsetZ = 0;
		});

		this.canvas.addEventListener('wheel', (e) => {
			e.preventDefault();
			const delta = Math.sign(e.deltaY) * 0.08;
			this.zoomMultiplier = Math.max(0.48, Math.min(1.35, this.zoomMultiplier + delta));
			this.computeLayout();
		}, { passive: false });

		this.targetCamOffsetX = 0;
		this.targetCamOffsetZ = 0;
		this.camOffsetX = 0;
		this.camOffsetZ = 0;
	}

	zoomIn() {
		this.zoomMultiplier = Math.max(0.48, this.zoomMultiplier - 0.12);
		this.computeLayout();
	}

	zoomOut() {
		this.zoomMultiplier = Math.min(1.35, this.zoomMultiplier + 0.12);
		this.computeLayout();
	}

	toggleFocus() {
		this.focusOnBot = !this.focusOnBot;
		if (this.focusOnBot) {
			this.zoomMultiplier = 0.72;
		} else {
			this.zoomMultiplier = 1.0;
		}
		this.computeLayout();
		return this.focusOnBot;
	}

	computeLayout() {
		const w = this.canvas.clientWidth || 600;
		const h = this.canvas.clientHeight || 500;
		this.renderer.setSize(w, h, false);

		const aspect = w / h;
		const rows = this.grid.length || 6;
		const cols = (this.grid[0] && this.grid[0].length) || 6;

		const platW = cols + 1.2;
		const platD = rows + 1.2;
		const screenW = (platW + platD) * 0.707;
		const screenH = (platW + platD) * 0.38 + 2.4;

		const fitH = (screenH / 1.82) * this.zoomMultiplier;
		const fitW = (screenW / (1.82 * aspect)) * this.zoomMultiplier;
		const d = Math.max(fitH, fitW, 3.2);

		this.camera.left = -d * aspect;
		this.camera.right = d * aspect;
		this.camera.top = d;
		this.camera.bottom = -d;
		this.camera.updateProjectionMatrix();
	}

	loadLevel(levelData) {
		this.level = levelData;
		this.grid = levelData.grid.map(row => [...row]);
		this.cores = [];
		this.batteries = [];
		this.laserMeshes = [];
		this.gateMeshes = [];

		while (this.tilesGroup.children.length > 0) {
			const obj = this.tilesGroup.children[0];
			this.tilesGroup.remove(obj);
			if (obj.geometry) obj.geometry.dispose();
		}
		while (this.itemsGroup.children.length > 0) {
			const obj = this.itemsGroup.children[0];
			this.itemsGroup.remove(obj);
			if (obj.geometry) obj.geometry.dispose();
		}

		const rows = this.grid.length;
		const cols = this.grid[0].length;
		const originX = -(cols - 1) / 2;
		const originZ = -(rows - 1) / 2;

		const platW = cols + 1.2;
		const platD = rows + 1.2;
		const platH = 0.55;

		const slabGeo = new THREE.BoxGeometry(platW, platH, platD);
		const slabMat = new THREE.MeshStandardMaterial({
			color: 0xf8fafc,
			roughness: 0.22,
			metalness: 0.08
		});
		const slabMesh = new THREE.Mesh(slabGeo, slabMat);
		slabMesh.position.set(0, -platH / 2 - 0.22, 0);
		slabMesh.receiveShadow = true;
		slabMesh.castShadow = true;

		const baseGeo = new THREE.BoxGeometry(platW + 0.45, 0.22, platD + 0.45);
		const baseMat = new THREE.MeshStandardMaterial({
			color: 0xe2e8f0,
			roughness: 0.35,
			metalness: 0.15
		});
		const baseMesh = new THREE.Mesh(baseGeo, baseMat);
		baseMesh.position.set(0, -platH - 0.22 - 0.11, 0);
		baseMesh.receiveShadow = true;

		const trimGeo = new THREE.BoxGeometry(platW + 0.06, 0.04, platD + 0.06);
		const trimMat = new THREE.MeshStandardMaterial({
			color: 0x38bdf8,
			emissive: 0x0284c7,
			emissiveIntensity: 0.5,
			roughness: 0.2
		});
		const trimMesh = new THREE.Mesh(trimGeo, trimMat);
		trimMesh.position.set(0, -0.22, 0);

		const shadowGeo = new THREE.PlaneGeometry(platW + 3.0, platD + 3.0);
		const shadowCanvas = document.createElement('canvas');
		shadowCanvas.width = 128;
		shadowCanvas.height = 128;
		const sCtx = shadowCanvas.getContext('2d');
		const grad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 64);
		grad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
		grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.08)');
		grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
		sCtx.fillStyle = grad;
		sCtx.fillRect(0, 0, 128, 128);

		const shadowTex = new THREE.CanvasTexture(shadowCanvas);
		const shadowMat = new THREE.MeshBasicMaterial({
			map: shadowTex,
			transparent: true,
			depthWrite: false
		});
		const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
		shadowMesh.rotation.x = -Math.PI / 2;
		shadowMesh.position.set(0, -platH - 0.36, 0);

		this.tilesGroup.add(shadowMesh, baseMesh, slabMesh, trimMesh);

		const floorGeo = new THREE.BoxGeometry(0.96, 0.22, 0.96);
		const floorMat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 0.25,
			metalness: 0.05
		});
		const wallMat = new THREE.MeshStandardMaterial({
			color: 0x475569,
			roughness: 0.35,
			metalness: 0.25
		});
		const pitMat = new THREE.MeshStandardMaterial({
			color: 0x0f172a,
			roughness: 0.8
		});

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const tileType = this.grid[r][c];
				const posX = originX + c;
				const posZ = originZ + r;

				if (tileType === 1) {
					const wallH = 0.38;
					const wallGeo = new THREE.BoxGeometry(0.96, wallH, 0.96);
					const wallMesh = new THREE.Mesh(wallGeo, wallMat);
					wallMesh.position.set(posX, wallH / 2 - 0.02, posZ);
					wallMesh.castShadow = true;
					wallMesh.receiveShadow = true;

					const capGeo = new THREE.BoxGeometry(0.84, 0.04, 0.84);
					const capMat = new THREE.MeshStandardMaterial({
						color: 0x64748b,
						roughness: 0.25,
						metalness: 0.2
					});
					const capMesh = new THREE.Mesh(capGeo, capMat);
					capMesh.position.set(posX, wallH - 0.01, posZ);
					capMesh.castShadow = true;

					this.tilesGroup.add(wallMesh, capMesh);
				} else if (tileType === 3) {
					const pitGeo = new THREE.BoxGeometry(0.96, 0.6, 0.96);
					const pitMesh = new THREE.Mesh(pitGeo, pitMat);
					pitMesh.position.set(posX, -0.4, posZ);
					this.tilesGroup.add(pitMesh);
				} else {
					const floorMesh = new THREE.Mesh(floorGeo, floorMat);
					floorMesh.position.set(posX, -0.11, posZ);
					floorMesh.receiveShadow = true;
					this.tilesGroup.add(floorMesh);

					if (tileType === 2) {
						this.spawnCore(posX, posZ, c, r);
					} else if (tileType === 4) {
						this.spawnBattery(posX, posZ, c, r);
					} else if (tileType === 5) {
						this.spawnGate(posX, posZ, c, r);
					} else if (tileType === 6) {
						this.spawnLaser(posX, posZ, c, r);
					}
				}
			}
		}

		this.bot.x = levelData.start.x;
		this.bot.y = levelData.start.y;
		this.bot.dir = levelData.start.dir;
		this.bot.renderX = this.bot.x;
		this.bot.renderY = this.bot.y;
		this.bot.renderAngle = this.getAngleFromDir(this.bot.dir);
		this.bot.jumpHeight = 0;
		this.bot.memory = 0;

		this.updateBot3DPosition();
		this.bot3D.setMood('normal');
		this.currentLookAtX = 0;
		this.currentLookAtZ = 0;
		this.focusOnBot = false;
		this.zoomMultiplier = 1.0;
		this.animating = false;
		this.laserState = true;
		this.laserTimer = 0;
		this.computeLayout();
	}

	spawnCore(wx, wz, c, r) {
		const group = new THREE.Group();
		group.position.set(wx, 0.55, wz);

		const ringGeo = new THREE.TorusGeometry(0.38, 0.04, 16, 32);
		const ringMat = new THREE.MeshStandardMaterial({
			color: 0x10b981,
			emissive: 0x059669,
			emissiveIntensity: 0.6,
			roughness: 0.15
		});
		const ringMesh = new THREE.Mesh(ringGeo, ringMat);
		ringMesh.rotation.x = Math.PI / 2;
		ringMesh.position.y = -0.4;
		ringMesh.receiveShadow = true;
		group.add(ringMesh);

		const crystalGeo = new THREE.OctahedronGeometry(0.28, 0);
		const crystalMat = new THREE.MeshStandardMaterial({
			color: 0x10b981,
			emissive: 0x059669,
			emissiveIntensity: 0.4,
			roughness: 0.1,
			metalness: 0.2
		});
		const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
		crystalMesh.castShadow = true;
		group.add(crystalMesh);

		const light = new THREE.PointLight(0x10b981, 0.8, 2.5);
		light.position.set(0, 0.2, 0);
		group.add(light);

		this.itemsGroup.add(group);
		this.cores.push({
			x: c,
			y: r,
			active: false,
			group: group,
			crystalMesh: crystalMesh,
			light: light
		});
	}

	spawnBattery(wx, wz, c, r) {
		const group = new THREE.Group();
		group.position.set(wx, 0.45, wz);

		const geo = new THREE.ConeGeometry(0.2, 0.42, 6);
		const mat = new THREE.MeshStandardMaterial({
			color: 0x38bdf8,
			emissive: 0x0284c7,
			emissiveIntensity: 0.8,
			roughness: 0.1,
			metalness: 0.3
		});
		const topCone = new THREE.Mesh(geo, mat);
		topCone.castShadow = true;
		const botCone = new THREE.Mesh(geo, mat);
		botCone.rotation.z = Math.PI;
		botCone.position.y = -0.22;
		botCone.castShadow = true;

		group.add(topCone, botCone);

		const light = new THREE.PointLight(0x38bdf8, 0.6, 2.0);
		group.add(light);

		this.itemsGroup.add(group);
		this.batteries.push({
			x: c,
			y: r,
			collected: false,
			group: group
		});
	}

	spawnGate(wx, wz, c, r) {
		const rows = this.grid.length;
		const cols = this.grid[0].length;
		const wallN = r === 0 || this.grid[r - 1][c] === 1;
		const wallS = r === rows - 1 || this.grid[r + 1][c] === 1;
		const wallW = c === 0 || this.grid[r][c - 1] === 1;
		const wallE = c === cols - 1 || this.grid[r][c + 1] === 1;

		let isAcrossZ = false;
		if (wallN && wallS) {
			isAcrossZ = true;
		} else if (wallW && wallE) {
			isAcrossZ = false;
		} else if (wallN || wallS) {
			isAcrossZ = true;
		} else {
			isAcrossZ = false;
		}

		const group = new THREE.Group();
		group.position.set(wx, 0, wz);

		const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.85, 12);
		const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
		const p1 = new THREE.Mesh(postGeo, postMat);
		const p2 = new THREE.Mesh(postGeo, postMat);
		p1.castShadow = true;
		p2.castShadow = true;

		let barrierGeo;
		if (isAcrossZ) {
			p1.position.set(0, 0.42, -0.42);
			p2.position.set(0, 0.42, 0.42);
			barrierGeo = new THREE.BoxGeometry(0.04, 0.6, 0.82);
		} else {
			p1.position.set(-0.42, 0.42, 0);
			p2.position.set(0.42, 0.42, 0);
			barrierGeo = new THREE.BoxGeometry(0.82, 0.6, 0.04);
		}
		group.add(p1, p2);

		const barrierMat = new THREE.MeshStandardMaterial({
			color: 0xdb2777,
			emissive: 0xdb2777,
			emissiveIntensity: 0.7,
			transparent: true,
			opacity: 0.65
		});
		const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
		barrierMesh.position.set(0, 0.35, 0);
		group.add(barrierMesh);

		this.itemsGroup.add(group);
		this.gateMeshes.push({ mesh: barrierMesh, x: c, y: r, open: false });
	}

	spawnLaser(wx, wz, c, r) {
		const rows = this.grid.length;
		const cols = this.grid[0].length;
		const wallN = r === 0 || this.grid[r - 1][c] === 1;
		const wallS = r === rows - 1 || this.grid[r + 1][c] === 1;
		const wallW = c === 0 || this.grid[r][c - 1] === 1;
		const wallE = c === cols - 1 || this.grid[r][c + 1] === 1;

		let isAcrossZ = false;
		if (wallN && wallS) {
			isAcrossZ = true;
		} else if (wallW && wallE) {
			isAcrossZ = false;
		} else if (wallN || wallS) {
			isAcrossZ = true;
		} else {
			isAcrossZ = false;
		}

		const group = new THREE.Group();
		group.position.set(wx, 0, wz);

		const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 12);
		const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
		const leftPost = new THREE.Mesh(postGeo, postMat);
		const rightPost = new THREE.Mesh(postGeo, postMat);
		leftPost.castShadow = true;
		rightPost.castShadow = true;

		if (isAcrossZ) {
			leftPost.position.set(0, 0.25, -0.44);
			rightPost.position.set(0, 0.25, 0.44);
		} else {
			leftPost.position.set(-0.44, 0.25, 0);
			rightPost.position.set(0.44, 0.25, 0);
		}
		group.add(leftPost, rightPost);

		const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.86, 12);
		const beamMat = new THREE.MeshStandardMaterial({
			color: 0xef4444,
			emissive: 0xef4444,
			emissiveIntensity: 1.2,
			transparent: true,
			opacity: 0.85
		});
		const beamMesh = new THREE.Mesh(beamGeo, beamMat);
		if (isAcrossZ) {
			beamMesh.rotation.x = Math.PI / 2;
			beamMesh.rotation.z = 0;
		} else {
			beamMesh.rotation.z = Math.PI / 2;
			beamMesh.rotation.x = 0;
		}
		beamMesh.position.set(0, 0.25, 0);
		group.add(beamMesh);

		const light = new THREE.PointLight(0xef4444, 0.8, 2);
		light.position.set(0, 0.28, 0);
		group.add(light);

		this.itemsGroup.add(group);
		this.laserMeshes.push({ beam: beamMesh, light: light, x: c, y: r });
	}

	getAngleFromDir(dir) {
		switch (dir) {
			case 0: return Math.PI;
			case 1: return Math.PI / 2;
			case 2: return 0;
			case 3: return -Math.PI / 2;
			default: return 0;
		}
	}

	updateBot3DPosition() {
		if (!this.grid || !this.grid[0]) return;
		const cols = this.grid[0].length;
		const rows = this.grid.length;
		const originX = -(cols - 1) / 2;
		const originZ = -(rows - 1) / 2;

		const wx = originX + this.bot.renderX;
		const wz = originZ + this.bot.renderY;
		this.bot3D.group.position.set(wx, this.bot.jumpHeight, wz);
		this.bot3D.group.rotation.y = this.bot.renderAngle;
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
		this.bot.renderAngle = this.getAngleFromDir(this.bot.dir);
		this.bot.jumpHeight = 0;
		this.updateBot3DPosition();
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
		if (!this.grid || !this.grid[0]) return true;
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

	isAtGoal() {
		return this.cores.some(c => c.x === this.bot.x && c.y === this.bot.y);
	}

	areAllCoresActive() {
		if (this.cores.length === 0) return true;
		return this.cores.every(c => c.active);
	}

	async step(action, blockId, arg) {
		if (this.onHighlightBlock && blockId) {
			this.onHighlightBlock(blockId);
		}
		switch (action) {
			case 'avanzar':
				return this.performMove();
			case 'saltar':
				return this.performJump();
			case 'girar_izq':
				return this.performTurn(1);
			case 'girar_der':
				return this.performTurn(-1);
			case 'encender':
				return this.performTurnOn();
			case 'recoger':
				return this.performCollect();
			case 'sumar_memoria':
				return this.performAddMemory(arg || 1);
			case 'esperar':
				return this.performWait();
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
		if (window.SoundFX) window.SoundFX.playStep();

		return this.startAnimation({
			fromX: fromX,
			fromY: fromY,
			toX: ahead.x,
			toY: ahead.y,
			fromAngle: this.bot.renderAngle,
			toAngle: this.getAngleFromDir(this.bot.dir),
			jump: false
		}).then(() => {
			if (tile === 3) {
				if (window.SoundFX) window.SoundFX.playError();
				throw new Error("¡Cuidado! BIT cayó en una baldosa rota. Usa el sensor para saltar.");
			}
		});
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
			toAngle: this.getAngleFromDir(this.bot.dir),
			jump: true
		});
	}

	performTurn(delta) {
		const newDir = (this.bot.dir - delta + 4) % 4;
		this.bot.dir = newDir;
		const targetAngle = this.getAngleFromDir(newDir);
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
		const currentCore = this.cores.find(c => c.x === this.bot.x && c.y === this.bot.y);
		if (!currentCore) {
			this.bot3D.setMood('error');
			if (window.SoundFX) window.SoundFX.playError();
			throw new Error("BIT intentó encender un núcleo, pero no está sobre ninguna casilla de energía.");
		}
		currentCore.active = true;
		this.bot3D.setMood('happy');
		currentCore.crystalMesh.material.emissiveIntensity = 1.4;
		currentCore.crystalMesh.material.color.setHex(0x34d399);
		currentCore.light.intensity = 1.6;

		this.spawnCoreParticles3D(currentCore.group.position.x, currentCore.group.position.z);
		if (window.SoundFX) window.SoundFX.playAction();
		return new Promise(r => setTimeout(r, 240));
	}

	performCollect() {
		const b = this.batteries.find(item => item.x === this.bot.x && item.y === this.bot.y && !item.collected);
		if (!b) {
			if (window.SoundFX) window.SoundFX.playError();
			throw new Error("No hay batería disponible en esta casilla para recoger.");
		}
		b.collected = true;
		b.group.visible = false;
		this.bot.memory = 1;
		if (window.SoundFX) window.SoundFX.playAction();
		return new Promise(r => setTimeout(r, 200));
	}

	performAddMemory(amt) {
		const b = this.batteries.find(item => item.x === this.bot.x && item.y === this.bot.y && !item.collected);
		if (b) {
			b.collected = true;
			b.group.visible = false;
		}
		this.bot.memory += amt;
		this.checkGates();
		if (window.SoundFX) window.SoundFX.playAction();
		return new Promise(r => setTimeout(r, 200));
	}

	checkGates() {
		for (const g of this.gateMeshes) {
			if (this.bot.memory >= (this.level.requiredMemory || 1) && !g.open) {
				g.open = true;
				g.mesh.position.y = -0.3;
				g.mesh.material.opacity = 0.2;
			}
		}
	}

	updateLaserVisuals() {
		for (const l of this.laserMeshes) {
			l.beam.material.color.setHex(this.laserState ? 0xef4444 : 0x10b981);
			l.beam.material.emissive.setHex(this.laserState ? 0xef4444 : 0x10b981);
			l.light.color.setHex(this.laserState ? 0xef4444 : 0x10b981);
		}
	}

	performWait() {
		this.laserState = !this.laserState;
		this.laserTimer = this.laserState ? 0 : 45;
		this.updateLaserVisuals();
		if (window.SoundFX) window.SoundFX.playTurn();
		return new Promise(r => setTimeout(r, 250));
	}

	startAnimation(anim) {
		return new Promise((resolve) => {
			this.animating = true;
			this.animationStart = performance.now();
			this.animationResolve = resolve;
			this.animFrom = anim;
		});
	}

	spawnCoreParticles3D(wx, wz) {
		for (let i = 0; i < 24; i++) {
			const geo = new THREE.SphereGeometry(0.045, 8, 8);
			const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0x10b981 : 0x38bdf8 });
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.set(wx, 0.5, wz);
			this.particlesGroup.add(mesh);

			const angle = (Math.PI * 2 * i) / 24;
			const speed = 0.04 + Math.random() * 0.06;
			this.particles.push({
				mesh: mesh,
				vx: Math.cos(angle) * speed,
				vy: 0.05 + Math.random() * 0.06,
				vz: Math.sin(angle) * speed,
				life: 30
			});
		}
	}

	loop(timestamp) {
		this.update(timestamp);
		this.render(timestamp);
		requestAnimationFrame(this.boundLoop);
	}

	update(timestamp) {
		this.laserTimer += 1;
		if (this.laserTimer % 90 === 0) {
			this.laserState = !this.laserState;
			this.updateLaserVisuals();
		}

		for (const c of this.cores) {
			c.crystalMesh.rotation.y += 0.025;
			c.crystalMesh.position.y = Math.sin(timestamp / 300) * 0.06;
		}

		for (const b of this.batteries) {
			if (!b.collected) {
				b.group.rotation.y += 0.03;
				b.group.position.y = 0.45 + Math.sin(timestamp / 250) * 0.05;
			}
		}

		let isWalking = false;
		let walkProgress = 0;
		let isTurning = false;
		let jumpHeight = 0;

		if (this.animating && this.animFrom) {
			const elapsed = timestamp - this.animationStart;
			const progress = Math.min(elapsed / this.animationDuration, 1);
			const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

			this.bot.renderX = this.animFrom.fromX + (this.animFrom.toX - this.animFrom.fromX) * ease;
			this.bot.renderY = this.animFrom.fromY + (this.animFrom.toY - this.animFrom.fromY) * ease;

			let angleDiff = this.animFrom.toAngle - this.animFrom.fromAngle;
			while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
			while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
			this.bot.renderAngle = this.animFrom.fromAngle + angleDiff * ease;

			if (this.animFrom.jump) {
				jumpHeight = Math.sin(progress * Math.PI) * 1.35;
				this.bot.jumpHeight = jumpHeight;
			} else {
				this.bot.jumpHeight = 0;
			}

			if (this.animFrom.fromX !== this.animFrom.toX || this.animFrom.fromY !== this.animFrom.toY) {
				isWalking = true;
				walkProgress = progress;
			} else if (this.animFrom.fromAngle !== this.animFrom.toAngle) {
				isTurning = true;
			}

			if (progress >= 1) {
				this.animating = false;
				this.bot.renderX = this.animFrom.toX;
				this.bot.renderY = this.animFrom.toY;
				this.bot.renderAngle = this.animFrom.toAngle;
				this.bot.jumpHeight = 0;
				if (this.animationResolve) {
					const res = this.animationResolve;
					this.animationResolve = null;
					res();
				}
			}
		}

		this.updateBot3DPosition();
		this.bot3D.animate(timestamp, isWalking, walkProgress, isTurning, jumpHeight);

		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.mesh.position.x += p.vx;
			p.mesh.position.y += p.vy;
			p.mesh.position.z += p.vz;
			p.vy -= 0.003;
			p.life -= 1;
			if (p.life <= 0) {
				this.particlesGroup.remove(p.mesh);
				p.mesh.geometry.dispose();
				this.particles.splice(i, 1);
			}
		}

		if (this.focusOnBot) {
			const originX = -(this.grid[0].length - 1) / 2;
			const originZ = -(this.grid.length - 1) / 2;
			const targetX = (originX + this.bot.renderX) * 0.65;
			const targetZ = (originZ + this.bot.renderY) * 0.65;
			this.currentLookAtX += (targetX - this.currentLookAtX) * 0.08;
			this.currentLookAtZ += (targetZ - this.currentLookAtZ) * 0.08;
		} else {
			this.currentLookAtX += (0 - this.currentLookAtX) * 0.08;
			this.currentLookAtZ += (0 - this.currentLookAtZ) * 0.08;
		}

		this.camOffsetX += (this.targetCamOffsetX - this.camOffsetX) * 0.08;
		this.camOffsetZ += (this.targetCamOffsetZ - this.camOffsetZ) * 0.08;
		this.camera.position.x = this.currentLookAtX + 12 + this.camOffsetX;
		this.camera.position.y = 20;
		this.camera.position.z = this.currentLookAtZ + 12 + this.camOffsetZ;
		this.camera.lookAt(this.currentLookAtX, this.bot.jumpHeight * 0.35, this.currentLookAtZ);
	}

	render() {
		this.renderer.render(this.scene, this.camera);
	}
}

