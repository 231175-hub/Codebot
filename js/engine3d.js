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
		this.butterflies = [];
		this.animatedBiomeObjects = [];
		this.currentBiome = 'nave';

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

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
		this.scene.add(ambientLight);

		this.hemiLight = new THREE.HemisphereLight(0xf0fdf4, 0xdcfce7, 0.65);
		this.hemiLight.position.set(0, 20, 0);
		this.scene.add(this.hemiLight);

		this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.25);
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
		this.butterflies = [];
		this.animatedBiomeObjects = [];

		const mod = (levelData.id || "1.1").split('.')[0];
		let biomeType = "nave";
		if (mod === "2") biomeType = "fabrica";
		else if (mod === "3") biomeType = "bosque";
		else if (mod === "4") biomeType = "oceano";
		else if (mod === "5") biomeType = "glaciar";
		this.currentBiome = biomeType;
		this.applyBackground(biomeType);
		const cfg = this.getBiomeConfig(biomeType);

		if (this.hemiLight) {
			this.hemiLight.color.setHex(cfg.hemiSky);
			this.hemiLight.groundColor.setHex(cfg.hemiGround);
		}
		if (this.sunLight) {
			this.sunLight.color.setHex(cfg.sunColor);
		}

		this.disposeChildren(this.tilesGroup);
		this.disposeChildren(this.itemsGroup);

		const rows = this.grid.length;
		const cols = this.grid[0].length;
		const originX = -(cols - 1) / 2;
		const originZ = -(rows - 1) / 2;

		const platW = cols + 1.2;
		const platD = rows + 1.2;
		const platH = 0.55;

		const slabGeo = new THREE.BoxGeometry(platW, platH, platD);
		const slabMat = new THREE.MeshStandardMaterial({
			color: cfg.slabColor,
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
			color: cfg.trimColor,
			emissive: cfg.trimEmissive,
			emissiveIntensity: 0.4,
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
		shadowTex.userData.disposable = true;
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
			color: cfg.floorColor,
			map: this.getSurfaceTexture(biomeType, 'floor'),
			roughness: cfg.floorRough,
			metalness: cfg.floorMetal
		});
		const wallMat = new THREE.MeshStandardMaterial({
			color: cfg.wallColor,
			map: this.getSurfaceTexture(biomeType, 'wall'),
			roughness: cfg.wallRough,
			metalness: cfg.wallMetal
		});
		const wallCapMat = new THREE.MeshStandardMaterial({
			color: cfg.wallCapColor,
			roughness: 0.45,
			metalness: 0.05
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

					const capGeo = new THREE.BoxGeometry(0.92, 0.05, 0.92);
					const capMesh = new THREE.Mesh(capGeo, wallCapMat);
					capMesh.position.set(posX, wallH - 0.005, posZ);
					capMesh.castShadow = true;
					capMesh.receiveShadow = true;

					this.tilesGroup.add(wallMesh, capMesh);

					this.decorateWallBlock(c, r, posX, wallH, posZ, biomeType);
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

		this.spawnBiomeAmbient(cols, rows, biomeType);

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

	getBiomeConfig(biomeType) {
		const alias = { espacio: 'nave', maquinas: 'fabrica', campo: 'bosque', ciberespacio: 'oceano', cristal: 'glaciar' };
		biomeType = alias[biomeType] || biomeType;
		switch (biomeType) {
			case 'fabrica':
				return {
					slabColor: 0x1c1917, trimColor: 0xf59e0b, trimEmissive: 0xb45309,
					floorColor: 0xffffff, floorRough: 0.55, floorMetal: 0.45,
					wallColor: 0xffffff, wallCapColor: 0x57534e, wallRough: 0.6, wallMetal: 0.3,
					hemiSky: 0xffedd5, hemiGround: 0x44403c, sunColor: 0xffd9a8
				};
			case 'bosque':
				return {
					slabColor: 0x3f2d1b, trimColor: 0x22c55e, trimEmissive: 0x16a34a,
					floorColor: 0xffffff, floorRough: 0.95, floorMetal: 0.0,
					wallColor: 0xffffff, wallCapColor: 0x2f8f3f, wallRough: 0.9, wallMetal: 0.0,
					hemiSky: 0xe7f8d8, hemiGround: 0x365314, sunColor: 0xfff3c4
				};
			case 'oceano':
				return {
					slabColor: 0x0b3b57, trimColor: 0x14b8a6, trimEmissive: 0x0d9488,
					floorColor: 0xffffff, floorRough: 0.7, floorMetal: 0.0,
					wallColor: 0xffffff, wallCapColor: 0xe879a0, wallRough: 0.8, wallMetal: 0.0,
					hemiSky: 0xa5f3fc, hemiGround: 0x075985, sunColor: 0xcffafe
				};
			case 'glaciar':
				return {
					slabColor: 0x9bc7e0, trimColor: 0xa78bfa, trimEmissive: 0x7c3aed,
					floorColor: 0xffffff, floorRough: 0.12, floorMetal: 0.05,
					wallColor: 0xffffff, wallCapColor: 0xf0f9ff, wallRough: 0.2, wallMetal: 0.05,
					hemiSky: 0xeaf6ff, hemiGround: 0xbfdbfe, sunColor: 0xffffff
				};
			case 'nave':
			default:
				return {
					slabColor: 0x111827, trimColor: 0x38bdf8, trimEmissive: 0x0ea5e9,
					floorColor: 0xffffff, floorRough: 0.35, floorMetal: 0.35,
					wallColor: 0xffffff, wallCapColor: 0x0ea5e9, wallRough: 0.4, wallMetal: 0.4,
					hemiSky: 0xcfe8ff, hemiGround: 0x1e293b, sunColor: 0xe0f2fe
				};
		}
	}

	decorateWallBlock(c, r, posX, wallH, posZ, biomeType) {
		const seed = (c * 23 + r * 37) % 10;
		switch (biomeType) {
			case 'fabrica': {
				const y0 = wallH + 0.02;
				if (seed <= 2) {
					const gear = this.createToothedGear(0.26 - (seed % 2) * 0.04, 10, seed % 2 ? 0xb45309 : 0xd97706);
					gear.position.set(posX, wallH + 0.3, posZ);
					gear.rotation.y = Math.PI / 4;
					this.tilesGroup.add(gear);
					this.animatedBiomeObjects.push({ type: 'gear', mesh: gear, speed: (seed % 2 === 0 ? 1 : -1) * 0.03 });
				} else if (seed <= 4) {
					const piston = this.createPiston();
					piston.position.set(posX, y0, posZ);
					this.tilesGroup.add(piston);
					this.animatedBiomeObjects.push({ type: 'piston', mesh: piston.userData.rod, baseY: 0.18, phase: seed * 1.1 });
				} else if (seed <= 6) {
					const pipes = this.createPipeCluster();
					pipes.position.set(posX, y0, posZ);
					this.tilesGroup.add(pipes);
				} else {
					const vent = this.createSteamVent();
					vent.position.set(posX, y0, posZ);
					this.tilesGroup.add(vent);
					this.addSteam(vent, 0.25, 0.8);
				}
				break;
			}
			case 'oceano': {
				const y0 = wallH + 0.02;
				const cols = [0xf472b6, 0xfb923c, 0xc084fc, 0xfb7185];
				if (seed <= 3) {
					const coral = this.createCoral(0.9 + (seed % 2) * 0.3, cols[seed % cols.length]);
					coral.position.set(posX, y0, posZ);
					this.tilesGroup.add(coral);
				} else if (seed <= 6) {
					const kelp = this.createKelp();
					kelp.position.set(posX, y0, posZ);
					this.tilesGroup.add(kelp);
					this.animatedBiomeObjects.push({ type: 'sway', mesh: kelp, phase: seed * 0.8, amp: 0.14 });
				} else if (seed <= 8) {
					const rock = this.createSeaRock();
					rock.position.set(posX, y0, posZ);
					rock.rotation.y = seed;
					this.tilesGroup.add(rock);
				} else {
					const coral = this.createCoral(1.1, 0x67e8f9);
					coral.position.set(posX, y0, posZ);
					this.tilesGroup.add(coral);
				}
				break;
			}
			case 'glaciar': {
				const y0 = wallH + 0.02;
				if (seed <= 3) {
					const ic = this.createIceCrystal(0.9 + (seed % 2) * 0.3);
					ic.position.set(posX, y0, posZ);
					this.tilesGroup.add(ic);
				} else if (seed <= 5) {
					const pine = this.createSnowPine(0.95 + (seed % 2) * 0.2);
					pine.position.set(posX, y0, posZ);
					this.tilesGroup.add(pine);
				} else if (seed <= 7) {
					const mound = this.createSnowMound();
					mound.position.set(posX, y0, posZ);
					this.tilesGroup.add(mound);
				} else {
					const dish = this.createSatelliteDish();
					dish.position.set(posX, y0, posZ);
					this.tilesGroup.add(dish);
					const beacon = this.createNeonBeacon(0xa78bfa);
					beacon.position.set(posX + 0.2, y0, posZ + 0.2);
					this.tilesGroup.add(beacon);
				}
				break;
			}
			case 'campo':
			case 'bosque':
				if (seed <= 2) {
					const tree = this.createTree(0.72 + (seed * 0.08), seed % 2);
					tree.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(tree);
				} else if (seed <= 6) {
					const flowerColors = [0xfacc15, 0xf43f5e, 0xec4899, 0xa855f7, 0x38bdf8];
					const flower1 = this.createFlower(flowerColors[(c + r) % flowerColors.length], 0.9);
					flower1.position.set(posX - 0.18, wallH + 0.02, posZ - 0.12);
					const flower2 = this.createFlower(flowerColors[(c * 3 + r) % flowerColors.length], 0.75);
					flower2.position.set(posX + 0.16, wallH + 0.02, posZ + 0.15);
					const grass = this.createGrassTuft(0.85);
					grass.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(flower1, flower2, grass);
				} else {
					const grass1 = this.createGrassTuft(1.0);
					grass1.position.set(posX - 0.14, wallH + 0.02, posZ + 0.12);
					const grass2 = this.createGrassTuft(0.8);
					grass2.position.set(posX + 0.15, wallH + 0.02, posZ - 0.14);
					const flower = this.createFlower(0xfacc15, 0.8);
					flower.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(grass1, grass2, flower);
					if (biomeType === 'bosque') {
						const mush = this.createMushroom(seed % 2 ? 0xef4444 : 0xf59e0b, 1.2);
						mush.position.set(posX + 0.22, wallH + 0.02, posZ - 0.2);
						this.tilesGroup.add(mush);
					}
				}
				break;
			case 'espacio':
			case 'nave':
				if (seed >= 5 && seed <= 6) {
					const con = this.createConsole(0x38bdf8);
					con.position.set(posX, wallH + 0.02, posZ);
					con.rotation.y = Math.PI / 4;
					this.tilesGroup.add(con);
				} else if (seed === 4) {
					const crate = this.createCrate();
					crate.position.set(posX, wallH + 0.02, posZ);
					crate.rotation.y = 0.5;
					this.tilesGroup.add(crate);
				} else if (seed <= 3) {
					const crystal = this.createSpaceCrystal(0.8 + (seed * 0.1));
					crystal.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(crystal);
					this.animatedBiomeObjects.push({
						type: 'float',
						mesh: crystal,
						baseY: wallH + 0.02,
						phase: seed * 1.2,
						rotSpeed: 0.02
					});
				} else if (seed <= 6) {
					const sat = this.createSatelliteDish();
					sat.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(sat);
				} else {
					const beacon = this.createNeonBeacon(0x38bdf8);
					beacon.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(beacon);
				}
				break;
			case 'maquinas':
				if (seed <= 3) {
					const gear = this.createMechanicalGear(0.24, 8, 0xd97706);
					gear.position.set(posX, wallH + 0.16, posZ);
					gear.rotation.x = Math.PI / 2;
					this.tilesGroup.add(gear);
					this.animatedBiomeObjects.push({
						type: 'gear',
						mesh: gear,
						speed: (seed % 2 === 0 ? 1 : -1) * 0.025
					});
				} else if (seed <= 6) {
					const pipes = this.createPipeCluster();
					pipes.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(pipes);
				} else {
					const vent = this.createSteamVent();
					vent.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(vent);
				}
				break;
			case 'ciberespacio':
				if (seed <= 3) {
					const cube = this.createDataCube(0.22, 0xec4899);
					cube.position.set(posX, wallH + 0.22, posZ);
					this.tilesGroup.add(cube);
					this.animatedBiomeObjects.push({
						type: 'float',
						mesh: cube,
						baseY: wallH + 0.22,
						phase: seed * 1.5,
						rotSpeed: 0.03
					});
				} else if (seed <= 6) {
					const chip = this.createMicrochipTile();
					chip.position.set(posX, wallH + 0.03, posZ);
					this.tilesGroup.add(chip);
				} else {
					const beacon = this.createNeonBeacon(0xec4899);
					beacon.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(beacon);
				}
				break;
			case 'cristal':
				if (seed <= 3) {
					const cluster = this.createMysticCrystal(0.85);
					cluster.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(cluster);
					this.animatedBiomeObjects.push({
						type: 'float',
						mesh: cluster,
						baseY: wallH + 0.02,
						phase: seed * 1.3,
						rotSpeed: 0.015
					});
				} else if (seed <= 6) {
					const obelisk = this.createMiniObelisk();
					obelisk.position.set(posX, wallH + 0.02, posZ);
					this.tilesGroup.add(obelisk);
				} else {
					const orb = this.createEnergyOrb(0x10b981);
					orb.position.set(posX, wallH + 0.18, posZ);
					this.tilesGroup.add(orb);
					this.animatedBiomeObjects.push({
						type: 'pulse',
						mesh: orb,
						phase: seed * 0.9
					});
				}
				break;
		}
	}

	spawnBiomeAmbient(cols, rows, biomeType) {
		const radiusX = (cols / 2) + 0.9;
		const radiusZ = (rows / 2) + 0.9;

		this.spawnThemeAmbient(cols, rows, biomeType);

		if (biomeType === 'campo' || biomeType === 'bosque') {
			const butterflyColors = [0x38bdf8, 0xfb923c, 0xf472b6, 0xfacc15];
			for (let i = 0; i < 4; i++) {
				const bData = this.createButterfly(butterflyColors[i % butterflyColors.length]);
				bData.cx = 0;
				bData.cz = 0;
				bData.cy = 0.95 + (i * 0.2);
				bData.radiusX = radiusX - (i * 0.22);
				bData.radiusZ = radiusZ - (i * 0.18);
				bData.speed = (0.55 + (i * 0.15)) * (i % 2 === 0 ? 1 : -1);
				bData.phase = (Math.PI * 2 * i) / 4;
				bData.group.position.set(0, bData.cy, 0);
				this.itemsGroup.add(bData.group);
				this.butterflies.push(bData);
			}
		} else if (biomeType === 'espacio' || biomeType === 'nave') {
			for (let i = 0; i < 3; i++) {
				const probe = new THREE.Group();
				const pGeo = new THREE.SphereGeometry(0.09, 8, 8);
				const pMat = new THREE.MeshStandardMaterial({
					color: 0x38bdf8,
					emissive: 0x0284c7,
					emissiveIntensity: 0.8
				});
				probe.add(new THREE.Mesh(pGeo, pMat));
				const ringGeo = new THREE.RingGeometry(0.13, 0.16, 12);
				const ringMat = new THREE.MeshBasicMaterial({
					color: 0x7dd3fc,
					side: THREE.DoubleSide
				});
				const ring = new THREE.Mesh(ringGeo, ringMat);
				ring.rotation.x = Math.PI / 3;
				probe.add(ring);

				this.itemsGroup.add(probe);
				this.animatedBiomeObjects.push({
					type: 'orbit',
					mesh: probe,
					cx: 0,
					cz: 0,
					cy: 1.1 + (i * 0.3),
					radius: radiusX + 0.3 - (i * 0.2),
					speed: (0.45 + (i * 0.15)) * (i % 2 === 0 ? 1 : -1),
					phase: (Math.PI * 2 * i) / 3
				});
			}
		} else if (biomeType === 'maquinas' || biomeType === 'fabrica') {
			for (let i = 0; i < 3; i++) {
				const drone = new THREE.Group();
				const bGeo = new THREE.SphereGeometry(0.08, 6, 6);
				const bMat = new THREE.MeshStandardMaterial({
					color: 0xd97706,
					metalness: 0.8,
					roughness: 0.3
				});
				drone.add(new THREE.Mesh(bGeo, bMat));

				const propGeo = new THREE.BoxGeometry(0.24, 0.015, 0.04);
				const propMat = new THREE.MeshStandardMaterial({
					color: 0xf59e0b,
					metalness: 0.6
				});
				const prop = new THREE.Mesh(propGeo, propMat);
				prop.position.y = 0.09;
				drone.add(prop);

				this.itemsGroup.add(drone);
				this.animatedBiomeObjects.push({
					type: 'orbit',
					mesh: drone,
					cx: 0,
					cz: 0,
					cy: 1.0 + (i * 0.25),
					radius: radiusX + 0.2 - (i * 0.2),
					speed: (0.5 + (i * 0.15)) * (i % 2 === 0 ? 1 : -1),
					phase: (Math.PI * 2 * i) / 3
				});
				this.animatedBiomeObjects.push({
					type: 'gear',
					mesh: prop,
					speed: 0.25
				});
			}
		} else if (biomeType === 'ciberespacio') {
			for (let i = 0; i < 4; i++) {
				const spark = new THREE.Group();
				const sGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
				const sMat = new THREE.MeshStandardMaterial({
					color: i % 2 === 0 ? 0xec4899 : 0x38bdf8,
					emissive: i % 2 === 0 ? 0xec4899 : 0x38bdf8,
					emissiveIntensity: 1.0
				});
				spark.add(new THREE.Mesh(sGeo, sMat));
				this.itemsGroup.add(spark);
				this.animatedBiomeObjects.push({
					type: 'orbit',
					mesh: spark,
					cx: 0,
					cz: 0,
					cy: 1.05 + (i * 0.22),
					radius: radiusX + 0.2 - (i * 0.2),
					speed: (0.6 + (i * 0.12)) * (i % 2 === 0 ? 1 : -1),
					phase: (Math.PI * 2 * i) / 4
				});
				this.animatedBiomeObjects.push({
					type: 'float',
					mesh: spark,
					baseY: 1.05 + (i * 0.22),
					phase: i * 1.5,
					rotSpeed: 0.04
				});
			}
		} else if (biomeType === 'cristal') {
			for (let i = 0; i < 3; i++) {
				const wisp = new THREE.Group();
				const wGeo = new THREE.OctahedronGeometry(0.09, 0);
				const wMat = new THREE.MeshStandardMaterial({
					color: 0x10b981,
					emissive: 0x34d399,
					emissiveIntensity: 0.9,
					roughness: 0.2
				});
				wisp.add(new THREE.Mesh(wGeo, wMat));
				this.itemsGroup.add(wisp);
				this.animatedBiomeObjects.push({
					type: 'orbit',
					mesh: wisp,
					cx: 0,
					cz: 0,
					cy: 1.1 + (i * 0.26),
					radius: radiusX + 0.3 - (i * 0.2),
					speed: (0.45 + (i * 0.12)) * (i % 2 === 0 ? 1 : -1),
					phase: (Math.PI * 2 * i) / 3
				});
				this.animatedBiomeObjects.push({
					type: 'float',
					mesh: wisp,
					baseY: 1.1 + (i * 0.26),
					phase: i * 1.8,
					rotSpeed: 0.02
				});
			}
		}
	}

	createSpaceCrystal(scale) {
		const group = new THREE.Group();
		const baseGeo = new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, 0.06 * scale, 6);
		const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
		const base = new THREE.Mesh(baseGeo, baseMat);
		base.position.y = 0.03 * scale;
		group.add(base);

		const cryGeo = new THREE.OctahedronGeometry(0.18 * scale, 0);
		const cryMat = new THREE.MeshStandardMaterial({
			color: 0x38bdf8,
			emissive: 0x0284c7,
			emissiveIntensity: 0.6,
			roughness: 0.15,
			metalness: 0.2
		});
		const crystal = new THREE.Mesh(cryGeo, cryMat);
		crystal.position.y = 0.22 * scale;
		crystal.scale.set(0.7, 1.3, 0.7);
		crystal.castShadow = true;
		group.add(crystal);
		return group;
	}

	createSatelliteDish() {
		const group = new THREE.Group();
		const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6);
		const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
		const pole = new THREE.Mesh(poleGeo, poleMat);
		pole.position.y = 0.125;
		group.add(pole);

		const dishGeo = new THREE.ConeGeometry(0.14, 0.06, 8, 1, true);
		const dishMat = new THREE.MeshStandardMaterial({
			color: 0xe2e8f0,
			metalness: 0.5,
			roughness: 0.3,
			side: THREE.DoubleSide
		});
		const dish = new THREE.Mesh(dishGeo, dishMat);
		dish.position.set(0, 0.26, 0);
		dish.rotation.x = Math.PI * 0.7;
		group.add(dish);
		return group;
	}

	createMechanicalGear(radius, teeth, colorHex) {
		const group = new THREE.Group();
		const hubGeo = new THREE.CylinderGeometry(radius, radius, 0.05, 12);
		const gearMat = new THREE.MeshStandardMaterial({
			color: colorHex,
			metalness: 0.75,
			roughness: 0.3
		});
		const hub = new THREE.Mesh(hubGeo, gearMat);
		group.add(hub);

		const toothGeo = new THREE.BoxGeometry(0.04, 0.05, radius * 0.4);
		for (let i = 0; i < teeth; i++) {
			const angle = (Math.PI * 2 * i) / teeth;
			const tooth = new THREE.Mesh(toothGeo, gearMat);
			tooth.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
			tooth.rotation.y = -angle;
			group.add(tooth);
		}
		return group;
	}

	createPipeCluster() {
		const group = new THREE.Group();
		const pipeMat = new THREE.MeshStandardMaterial({
			color: 0xb45309,
			metalness: 0.8,
			roughness: 0.35
		});
		const p1Geo = new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8);
		const p1 = new THREE.Mesh(p1Geo, pipeMat);
		p1.position.set(-0.06, 0.15, 0);
		const p2Geo = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8);
		const p2 = new THREE.Mesh(p2Geo, pipeMat);
		p2.position.set(0.07, 0.11, 0);
		const jointGeo = new THREE.TorusGeometry(0.05, 0.015, 6, 8);
		const joint = new THREE.Mesh(jointGeo, pipeMat);
		joint.rotation.x = Math.PI / 2;
		joint.position.set(0.07, 0.18, 0);
		group.add(p1, p2, joint);
		return group;
	}

	createSteamVent() {
		const group = new THREE.Group();
		const ventGeo = new THREE.BoxGeometry(0.24, 0.18, 0.24);
		const ventMat = new THREE.MeshStandardMaterial({
			color: 0x451a03,
			metalness: 0.6,
			roughness: 0.4
		});
		const vent = new THREE.Mesh(ventGeo, ventMat);
		vent.position.y = 0.09;
		const grillGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8);
		const grillMat = new THREE.MeshStandardMaterial({
			color: 0xf59e0b,
			metalness: 0.7,
			roughness: 0.3
		});
		const grill = new THREE.Mesh(grillGeo, grillMat);
		grill.position.y = 0.19;
		group.add(vent, grill);
		return group;
	}

	createDataCube(size, colorHex) {
		const group = new THREE.Group();
		const cubeGeo = new THREE.BoxGeometry(size, size, size);
		const cubeMat = new THREE.MeshStandardMaterial({
			color: colorHex,
			emissive: colorHex,
			emissiveIntensity: 0.65,
			roughness: 0.2,
			metalness: 0.3,
			transparent: true,
			opacity: 0.85
		});
		const cube = new THREE.Mesh(cubeGeo, cubeMat);
		cube.rotation.x = Math.PI / 4;
		cube.rotation.y = Math.PI / 4;
		group.add(cube);
		return group;
	}

	createMicrochipTile() {
		const group = new THREE.Group();
		const plateGeo = new THREE.BoxGeometry(0.26, 0.03, 0.26);
		const plateMat = new THREE.MeshStandardMaterial({
			color: 0x1e1b4b,
			roughness: 0.4,
			metalness: 0.5
		});
		const plate = new THREE.Mesh(plateGeo, plateMat);
		plate.position.y = 0.015;
		const coreGeo = new THREE.BoxGeometry(0.14, 0.02, 0.14);
		const coreMat = new THREE.MeshStandardMaterial({
			color: 0xec4899,
			emissive: 0xdb2777,
			emissiveIntensity: 0.8
		});
		const core = new THREE.Mesh(coreGeo, coreMat);
		core.position.y = 0.035;
		group.add(plate, core);
		return group;
	}

	createNeonBeacon(colorHex) {
		const group = new THREE.Group();
		const baseGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.08, 8);
		const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
		const base = new THREE.Mesh(baseGeo, baseMat);
		base.position.y = 0.04;
		const lightGeo = new THREE.SphereGeometry(0.06, 8, 8);
		const lightMat = new THREE.MeshStandardMaterial({
			color: colorHex,
			emissive: colorHex,
			emissiveIntensity: 1.1
		});
		const light = new THREE.Mesh(lightGeo, lightMat);
		light.position.y = 0.12;
		group.add(base, light);
		return group;
	}

	createMysticCrystal(scale) {
		const group = new THREE.Group();
		const cryMat = new THREE.MeshStandardMaterial({
			color: 0x10b981,
			emissive: 0x059669,
			emissiveIntensity: 0.55,
			roughness: 0.15,
			metalness: 0.1
		});
		const geo1 = new THREE.ConeGeometry(0.08 * scale, 0.3 * scale, 5);
		const m1 = new THREE.Mesh(geo1, cryMat);
		m1.position.set(0, 0.15 * scale, 0);
		const geo2 = new THREE.ConeGeometry(0.06 * scale, 0.22 * scale, 5);
		const m2 = new THREE.Mesh(geo2, cryMat);
		m2.position.set(0.08 * scale, 0.11 * scale, 0.03 * scale);
		m2.rotation.z = -0.3;
		const geo3 = new THREE.ConeGeometry(0.05 * scale, 0.18 * scale, 5);
		const m3 = new THREE.Mesh(geo3, cryMat);
		m3.position.set(-0.07 * scale, 0.09 * scale, -0.04 * scale);
		m3.rotation.z = 0.35;
		group.add(m1, m2, m3);
		return group;
	}

	createMiniObelisk() {
		const group = new THREE.Group();
		const colGeo = new THREE.BoxGeometry(0.12, 0.3, 0.12);
		const colMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
		const col = new THREE.Mesh(colGeo, colMat);
		col.position.y = 0.15;
		const topGeo = new THREE.ConeGeometry(0.085, 0.1, 4);
		const topMat = new THREE.MeshStandardMaterial({
			color: 0xfacc15,
			metalness: 0.8,
			roughness: 0.2
		});
		const top = new THREE.Mesh(topGeo, topMat);
		top.position.y = 0.35;
		top.rotation.y = Math.PI / 4;
		group.add(col, top);
		return group;
	}

	createEnergyOrb(colorHex) {
		const group = new THREE.Group();
		const orbGeo = new THREE.SphereGeometry(0.09, 12, 12);
		const orbMat = new THREE.MeshStandardMaterial({
			color: colorHex,
			emissive: colorHex,
			emissiveIntensity: 0.9,
			transparent: true,
			opacity: 0.85
		});
		const orb = new THREE.Mesh(orbGeo, orbMat);
		group.add(orb);
		return group;
	}

	createTree(scale, variant) {
		const group = new THREE.Group();
		const trunkH = 0.35 * scale;
		const trunkGeo = new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, trunkH, 8);
		const trunkMat = new THREE.MeshStandardMaterial({
			color: 0x854d0e,
			roughness: 0.85
		});
		const trunk = new THREE.Mesh(trunkGeo, trunkMat);
		trunk.position.y = trunkH / 2;
		trunk.castShadow = true;
		group.add(trunk);

		const foliageColors = [0x22c55e, 0x16a34a, 0x4ade80];
		const folColor = foliageColors[variant % foliageColors.length];
		const folMat = new THREE.MeshStandardMaterial({
			color: folColor,
			roughness: 0.55,
			metalness: 0.05
		});

		if (variant === 1) {
			const folGeo1 = new THREE.ConeGeometry(0.28 * scale, 0.36 * scale, 7);
			const m1 = new THREE.Mesh(folGeo1, folMat);
			m1.position.y = trunkH + 0.14 * scale;
			m1.castShadow = true;
			const folGeo2 = new THREE.ConeGeometry(0.2 * scale, 0.3 * scale, 7);
			const m2 = new THREE.Mesh(folGeo2, folMat);
			m2.position.y = trunkH + 0.32 * scale;
			m2.castShadow = true;
			group.add(m1, m2);
		} else {
			const folGeo = new THREE.DodecahedronGeometry(0.26 * scale, 1);
			const m = new THREE.Mesh(folGeo, folMat);
			m.position.y = trunkH + 0.2 * scale;
			m.castShadow = true;
			group.add(m);
		}

		return group;
	}

	createFlower(colorHex, scale) {
		const group = new THREE.Group();
		const stemH = 0.12 * scale;
		const stemGeo = new THREE.CylinderGeometry(0.012 * scale, 0.012 * scale, stemH, 5);
		const stemMat = new THREE.MeshStandardMaterial({
			color: 0x15803d,
			roughness: 0.8
		});
		const stem = new THREE.Mesh(stemGeo, stemMat);
		stem.position.y = stemH / 2;
		group.add(stem);

		const petalGeo = new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 0.015 * scale, 5);
		const petalMat = new THREE.MeshStandardMaterial({
			color: colorHex,
			roughness: 0.35,
			metalness: 0.1
		});
		const petals = new THREE.Mesh(petalGeo, petalMat);
		petals.position.y = stemH + 0.005 * scale;
		petals.rotation.x = Math.PI / 8;

		const centerGeo = new THREE.SphereGeometry(0.018 * scale, 6, 6);
		const centerMat = new THREE.MeshStandardMaterial({
			color: 0xfacc15,
			roughness: 0.3
		});
		const center = new THREE.Mesh(centerGeo, centerMat);
		center.position.y = stemH + 0.015 * scale;

		group.add(petals, center);
		return group;
	}

	createGrassTuft(scale) {
		const group = new THREE.Group();
		const bladeGeo = new THREE.ConeGeometry(0.025 * scale, 0.14 * scale, 4);
		const bladeMat = new THREE.MeshStandardMaterial({
			color: 0x4ade80,
			roughness: 0.45
		});

		for (let i = 0; i < 3; i++) {
			const blade = new THREE.Mesh(bladeGeo, bladeMat);
			blade.position.set((i - 1) * 0.035 * scale, 0.07 * scale, 0);
			blade.rotation.z = (i - 1) * 0.25;
			blade.rotation.y = i * 0.8;
			group.add(blade);
		}
		return group;
	}

	createButterfly(wingColorHex) {
		const group = new THREE.Group();
		const bodyGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.09, 6);
		const bodyMat = new THREE.MeshStandardMaterial({
			color: 0x1e293b,
			roughness: 0.8
		});
		const body = new THREE.Mesh(bodyGeo, bodyMat);
		body.rotation.x = Math.PI / 2;
		group.add(body);

		const wingMat = new THREE.MeshStandardMaterial({
			color: wingColorHex,
			emissive: wingColorHex,
			emissiveIntensity: 0.25,
			roughness: 0.35,
			side: THREE.DoubleSide
		});

		const leftPivot = new THREE.Group();
		leftPivot.position.set(-0.012, 0.005, 0);
		const leftWingGeo = new THREE.CircleGeometry(0.075, 5);
		const leftWing = new THREE.Mesh(leftWingGeo, wingMat);
		leftWing.position.set(-0.065, 0, 0);
		leftWing.rotation.x = -Math.PI / 2;
		leftPivot.add(leftWing);

		const rightPivot = new THREE.Group();
		rightPivot.position.set(0.012, 0.005, 0);
		const rightWingGeo = new THREE.CircleGeometry(0.075, 5);
		const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
		rightWing.position.set(0.065, 0, 0);
		rightWing.rotation.x = -Math.PI / 2;
		rightPivot.add(rightWing);

		group.add(leftPivot, rightPivot);

		return {
			group: group,
			leftWing: leftPivot,
			rightWing: rightPivot
		};
	}

	/* ======================================================================
	 * AMBIENTACIÓN POR PLANETA (nave, fábrica, bosque, océano, glaciar)
	 * ====================================================================== */

	mulberry(seed) {
		let a = seed >>> 0;
		return () => {
			a |= 0; a = a + 0x6D2B79F5 | 0;
			let t = Math.imul(a ^ a >>> 15, 1 | a);
			t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}

	disposeChildren(group) {
		while (group.children.length > 0) {
			const obj = group.children[0];
			group.remove(obj);
			obj.traverse((o) => {
				if (o.geometry) o.geometry.dispose();
				if (o.material) {
					const mats = Array.isArray(o.material) ? o.material : [o.material];
					for (const m of mats) {
						if (m.map && m.map.userData && m.map.userData.disposable) m.map.dispose();
						m.dispose();
					}
				}
			});
		}
	}

	makeCanvasTexture(cv, srgb = true) {
		const tex = new THREE.CanvasTexture(cv);
		if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}

	getDotTexture() {
		if (this.dotTex) return this.dotTex;
		const cv = document.createElement('canvas');
		cv.width = cv.height = 32;
		const g = cv.getContext('2d');
		const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
		gr.addColorStop(0, 'rgba(255,255,255,1)');
		gr.addColorStop(0.4, 'rgba(255,255,255,0.7)');
		gr.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = gr;
		g.fillRect(0, 0, 32, 32);
		this.dotTex = this.makeCanvasTexture(cv);
		return this.dotTex;
	}

	getSurfaceTexture(biome, part) {
		this.texCache = this.texCache || {};
		const key = biome + ':' + part;
		if (this.texCache[key]) return this.texCache[key];
		const S = 256;
		const cv = document.createElement('canvas');
		cv.width = cv.height = S;
		const g = cv.getContext('2d');
		const rnd = this.mulberry(biome.charCodeAt(0) * 977 + part.length * 31 + biome.length);
		this.paintSurface(g, S, rnd, key);
		const tex = this.makeCanvasTexture(cv);
		tex.anisotropy = 4;
		this.texCache[key] = tex;
		return tex;
	}

	paintSurface(g, S, rnd, key) {
		const fill = (c) => { g.fillStyle = c; g.fillRect(0, 0, S, S); };
		const dots = (n, cols, r0, r1, a) => {
			g.globalAlpha = a;
			for (let i = 0; i < n; i++) {
				g.fillStyle = cols[(rnd() * cols.length) | 0];
				g.beginPath();
				g.arc(rnd() * S, rnd() * S, r0 + rnd() * (r1 - r0), 0, Math.PI * 2);
				g.fill();
			}
			g.globalAlpha = 1;
		};
		const line = (x0, y0, x1, y1, c, w, a) => {
			g.globalAlpha = a == null ? 1 : a;
			g.strokeStyle = c;
			g.lineWidth = w;
			g.beginPath();
			g.moveTo(x0, y0);
			g.lineTo(x1, y1);
			g.stroke();
			g.globalAlpha = 1;
		};
		switch (key) {
			case 'nave:floor':
				fill('#e6edf5');
				dots(60, ['#cbd5e1', '#f8fafc'], 2, 10, 0.35);
				line(128, 0, 128, S, '#94a3b8', 3);
				line(0, 128, S, 128, '#94a3b8', 3);
				g.strokeStyle = '#64748b'; g.lineWidth = 3; g.strokeRect(3, 3, S - 6, S - 6);
				g.strokeStyle = 'rgba(14,165,233,0.55)'; g.lineWidth = 2; g.strokeRect(22, 22, S - 44, S - 44);
				g.fillStyle = '#64748b';
				for (const x of [14, 114, 142, 242]) for (const y of [14, 114, 142, 242]) { g.beginPath(); g.arc(x, y, 3, 0, 6.3); g.fill(); }
				break;
			case 'nave:wall':
				fill('#3a475e');
				dots(40, ['#475569', '#2b374c'], 6, 20, 0.35);
				for (let k = 0; k <= S; k += 64) { line(k, 0, k, S, '#1e293b', 3); line(0, k, S, k, '#1e293b', 3); }
				g.fillStyle = '#38bdf8';
				for (let i = 0; i < 9; i++) g.fillRect(8 + ((rnd() * 7) | 0) * 34, 10 + ((rnd() * 5) | 0) * 52, 8, 4);
				for (let x = -S; x < S * 2; x += 28) line(x, S - 4, x + 26, S - 26, '#facc15', 12, 0.9);
				g.fillStyle = 'rgba(0,0,0,0.0)';
				break;
			case 'fabrica:floor':
				fill('#5b5e63');
				for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
					g.save();
					g.translate(gx * 32 + 16, gy * 32 + 16);
					g.rotate(((gx + gy) % 2 ? 1 : -1) * Math.PI / 4);
					g.fillStyle = '#8f949b';
					g.fillRect(-9, -2.5, 18, 5);
					g.restore();
				}
				g.strokeStyle = '#eab308'; g.lineWidth = 6; g.strokeRect(4, 4, S - 8, S - 8);
				break;
			case 'fabrica:wall':
				fill('#7c3f1c');
				dots(120, ['#a1521f', '#5c2c12', '#8a4a22'], 4, 22, 0.4);
				for (let i = 0; i < 26; i++) { const x = rnd() * S; line(x, 0, x + (rnd() - 0.5) * 8, S, '#2b1408', 1 + rnd() * 2, 0.25); }
				for (const y of [20, S - 20]) for (let x = 16; x < S; x += 32) {
					g.fillStyle = '#d7a47a'; g.beginPath(); g.arc(x, y, 3.5, 0, 6.3); g.fill();
					g.fillStyle = '#4a2208'; g.beginPath(); g.arc(x + 1, y + 1, 1.5, 0, 6.3); g.fill();
				}
				line(0, 128, S, 128, '#3b1c0a', 4);
				break;
			case 'bosque:floor':
				fill('#4a8f35');
				dots(140, ['#5aa63f', '#3b7a2b', '#6bb84a'], 6, 18, 0.45);
				for (let i = 0; i < 420; i++) {
					const x = rnd() * S, y = rnd() * S;
					line(x, y, x + (rnd() - 0.5) * 6, y - 4 - rnd() * 7, ['#2f6f26', '#78c35a', '#3f8a30'][(rnd() * 3) | 0], 1.2, 0.8);
				}
				dots(16, ['#fde047', '#ffffff', '#f9a8d4'], 1.8, 3.2, 1);
				break;
			case 'bosque:wall':
				fill('#1d5a2b');
				dots(200, ['#2e7d3a', '#14532d', '#3f9b4a', '#1a4d2e'], 8, 24, 0.55);
				dots(60, ['#a3e635', '#65a30d'], 2, 5, 0.35);
				break;
			case 'oceano:floor':
				fill('#e4d09a');
				for (let y = 6; y < S; y += 18) {
					g.globalAlpha = 0.5; g.strokeStyle = '#cdb77e'; g.lineWidth = 3; g.beginPath();
					for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.07 + y) * 4);
					g.stroke(); g.globalAlpha = 1;
				}
				for (let i = 0; i < 22; i++) {
					g.strokeStyle = 'rgba(255,255,255,0.38)'; g.lineWidth = 2; g.beginPath();
					let x = rnd() * S, y = rnd() * S; g.moveTo(x, y);
					for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); }
					g.stroke();
				}
				dots(14, ['#f9a8d4', '#fed7aa', '#ffffff'], 2, 4, 0.9);
				break;
			case 'oceano:wall':
				fill('#a24a67');
				dots(120, ['#c0627f', '#7e3550', '#d97796'], 8, 22, 0.5);
				dots(42, ['#4a1c2e'], 3, 8, 0.7);
				dots(40, ['#fda4af'], 1.5, 4, 0.5);
				break;
			case 'glaciar:floor':
				fill('#d9eefa');
				dots(70, ['#ffffff', '#bfe3f5'], 8, 26, 0.5);
				for (let i = 0; i < 9; i++) {
					g.strokeStyle = 'rgba(100,160,200,0.8)'; g.lineWidth = 1.5; g.beginPath();
					let x = rnd() * S, y = rnd() * S; g.moveTo(x, y);
					for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); }
					g.stroke();
				}
				dots(30, ['#ffffff'], 1, 2.2, 0.95);
				break;
			case 'glaciar:wall':
				fill('#7fc0e6');
				for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
					g.fillStyle = ['#8ecbf0', '#74b6de', '#9bd6f5', '#6aa9d4'][(rnd() * 4) | 0];
					g.fillRect(gx * 64, gy * 64, 64, 64);
					g.strokeStyle = 'rgba(224,244,255,0.9)'; g.lineWidth = 2; g.strokeRect(gx * 64 + 1, gy * 64 + 1, 62, 62);
				}
				for (let i = 0; i < 14; i++) { const x = rnd() * S; line(x, 0, x + 50, S, '#ffffff', 2 + rnd() * 3, 0.22); }
				break;
			default:
				fill('#999999');
		}
	}

	getBackgroundTexture(biome) {
		this.bgCache = this.bgCache || {};
		if (this.bgCache[biome]) return this.bgCache[biome];
		const W = 768, H = 768;
		const cv = document.createElement('canvas');
		cv.width = W; cv.height = H;
		const g = cv.getContext('2d');
		const rnd = this.mulberry(biome.charCodeAt(0) * 4099 + 7);
		this.paintBackground(g, W, H, rnd, biome);
		this.bgCache[biome] = this.makeCanvasTexture(cv);
		return this.bgCache[biome];
	}

	paintBackground(g, W, H, rnd, biome) {
		const grad = (stops) => {
			const gr = g.createLinearGradient(0, 0, 0, H);
			stops.forEach(([o, c]) => gr.addColorStop(o, c));
			g.fillStyle = gr;
			g.fillRect(0, 0, W, H);
		};
		const glow = (x, y, r, c0, c1) => {
			const gr = g.createRadialGradient(x, y, 0, x, y, r);
			gr.addColorStop(0, c0); gr.addColorStop(1, c1);
			g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
		};
		const stars = (n, a) => {
			for (let i = 0; i < n; i++) {
				g.globalAlpha = a * (0.3 + rnd() * 0.7);
				g.fillStyle = rnd() > 0.88 ? '#bae6fd' : '#ffffff';
				g.beginPath(); g.arc(rnd() * W, rnd() * H * 0.9, 0.6 + rnd() * 1.4, 0, 6.3); g.fill();
			}
			g.globalAlpha = 1;
		};
		const hills = (baseY, amp, color, freq, seed) => {
			g.fillStyle = color; g.beginPath(); g.moveTo(0, H);
			for (let x = 0; x <= W; x += 8) g.lineTo(x, baseY + Math.sin(x * freq + seed) * amp + Math.sin(x * freq * 2.3 + seed * 2) * amp * 0.4);
			g.lineTo(W, H); g.closePath(); g.fill();
		};
		const orbit = (cx, cy, rx, ry, rotation, color, width) => {
			g.save();
			g.strokeStyle = color;
			g.lineWidth = width;
			g.beginPath();
			g.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
			g.stroke();
			g.restore();
		};

		grad([[0, '#01030a'], [0.52, '#030713'], [1, '#080b18']]);
		glow(W * 0.12, H * 0.18, 330, 'rgba(30,64,175,0.11)', 'rgba(30,64,175,0)');
		glow(W * 0.9, H * 0.72, 390, 'rgba(88,28,135,0.08)', 'rgba(88,28,135,0)');
		stars(320, 0.92);

		switch (biome) {
			case 'nave':
				glow(W * 0.76, H * 0.24, 250, 'rgba(236,72,153,0.18)', 'rgba(236,72,153,0)');
				glow(W * 0.28, H * 0.48, 300, 'rgba(34,211,238,0.18)', 'rgba(34,211,238,0)');
				orbit(W * 0.57, H * 0.38, 230, 62, -0.18, 'rgba(56,189,248,0.22)', 2);
				orbit(W * 0.57, H * 0.38, 290, 86, -0.18, 'rgba(236,72,153,0.12)', 1.5);
				{
					const px = W * 0.18, py = H * 0.84, pr = 104;
					glow(px, py, pr * 1.7, 'rgba(34,211,238,0.24)', 'rgba(34,211,238,0)');
					const gr = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, 10, px, py, pr);
					gr.addColorStop(0, '#67e8f9'); gr.addColorStop(0.48, '#2563eb'); gr.addColorStop(1, '#080b1c');
					g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, 6.3); g.fill();
					g.globalAlpha = 0.24; g.fillStyle = '#e0f2fe';
					for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(px + (rnd() - 0.5) * pr, py + (rnd() - 0.5) * pr, 24 + rnd() * 24, 5, 0, 0, 6.3); g.fill(); }
					g.globalAlpha = 1;
				}
				break;
			case 'fabrica':
				glow(W * 0.54, H * 0.96, 420, 'rgba(245,158,11,0.28)', 'rgba(245,158,11,0)');
				glow(W * 0.82, H * 0.28, 230, 'rgba(194,65,12,0.15)', 'rgba(194,65,12,0)');
				g.save();
				g.strokeStyle = 'rgba(245,158,11,0.1)';
				g.lineWidth = 1;
				for (let x = 24; x < W; x += 64) {
					g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H * 0.68); g.stroke();
				}
				for (let y = 28; y < H * 0.68; y += 64) {
					g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
				}
				g.restore();
				for (let x = 0; x < W; x += 56 + rnd() * 30) {
					const h = 90 + rnd() * 190, w = 36 + rnd() * 40;
					g.fillStyle = '#090706'; g.fillRect(x, H - h, w, h);
					if (rnd() > 0.55) { g.fillRect(x + w * 0.35, H - h - 70, w * 0.3, 70); }
					g.fillStyle = 'rgba(251,146,60,0.68)';
					for (let wy = H - h + 12; wy < H - 10; wy += 20) if (rnd() > 0.5) g.fillRect(x + 6 + rnd() * (w - 16), wy, 4, 4);
				}
				orbit(W * 0.78, H * 0.24, 74, 74, 0, 'rgba(245,158,11,0.24)', 5);
				orbit(W * 0.78, H * 0.24, 48, 48, 0, 'rgba(251,146,60,0.16)', 2);
				break;
			case 'bosque':
				glow(W * 0.24, H * 0.72, 330, 'rgba(16,185,129,0.2)', 'rgba(16,185,129,0)');
				glow(W * 0.82, H * 0.2, 230, 'rgba(132,204,22,0.13)', 'rgba(132,204,22,0)');
				{
					const points = [
						[0.12, 0.28], [0.25, 0.18], [0.38, 0.32], [0.52, 0.2],
						[0.66, 0.34], [0.79, 0.22], [0.9, 0.38]
					];
					g.save();
					g.strokeStyle = 'rgba(132,204,22,0.24)';
					g.lineWidth = 1.5;
					g.beginPath();
					points.forEach(([x, y], index) => index === 0 ? g.moveTo(x * W, y * H) : g.lineTo(x * W, y * H));
					g.stroke();
					for (const [x, y] of points) {
						g.fillStyle = 'rgba(167,243,208,0.82)';
						g.beginPath(); g.arc(x * W, y * H, 2.2, 0, Math.PI * 2); g.fill();
						g.strokeStyle = 'rgba(34,197,94,0.22)';
						g.beginPath(); g.arc(x * W, y * H, 8, 0, Math.PI * 2); g.stroke();
					}
					g.restore();
				}
				hills(H * 0.73, 30, '#07130f', 0.012, 1);
				hills(H * 0.82, 24, '#0a2118', 0.016, 3);
				for (let i = 0; i < 30; i++) {
					const x = rnd() * W, y = H * 0.83 + rnd() * 15, s = 22 + rnd() * 34;
					g.fillStyle = i % 3 === 0 ? '#0c2b1d' : '#091c15';
					g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s * 0.65, y); g.lineTo(x - s * 0.65, y); g.fill();
				}
				break;
			case 'oceano':
				glow(W * 0.28, H * 0.6, 340, 'rgba(20,184,166,0.21)', 'rgba(20,184,166,0)');
				glow(W * 0.82, H * 0.32, 250, 'rgba(251,113,133,0.12)', 'rgba(251,113,133,0)');
				g.save();
				g.strokeStyle = 'rgba(103,232,249,0.24)';
				g.lineWidth = 1.5;
				for (let i = 0; i < 52; i++) { g.beginPath(); g.arc(rnd() * W, rnd() * H * 0.86, 2 + rnd() * 8, 0, 6.3); g.stroke(); }
				g.strokeStyle = 'rgba(45,212,191,0.2)';
				g.lineWidth = 2;
				for (let i = 0; i < 4; i++) {
					const y = H * (0.2 + i * 0.12);
					g.beginPath();
					g.moveTo(-40, y);
					g.bezierCurveTo(W * 0.22, y - 70, W * 0.68, y + 70, W + 40, y - 8);
					g.stroke();
				}
				g.restore();
				hills(H * 0.84, 24, '#06131d', 0.014, 2);
				g.save();
				g.strokeStyle = '#0a332f'; g.lineWidth = 6; g.lineCap = 'round';
				for (let i = 0; i < 24; i++) {
					const x = rnd() * W, h = 60 + rnd() * 110;
					g.beginPath(); g.moveTo(x, H);
					g.bezierCurveTo(x - 20, H - h * 0.4, x + 20, H - h * 0.7, x, H - h); g.stroke();
				}
				g.restore();
				break;
			case 'glaciar':
				glow(W * 0.26, H * 0.28, 280, 'rgba(139,92,246,0.18)', 'rgba(139,92,246,0)');
				glow(W * 0.8, H * 0.54, 310, 'rgba(56,189,248,0.15)', 'rgba(56,189,248,0)');
				for (let r = 0; r < 4; r++) {
					const y0 = H * (0.14 + r * 0.065), col = r % 2 ? '168,85,247' : '103,232,249';
					const gr = g.createLinearGradient(0, y0 - 30, 0, y0 + 200);
					gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.3, `rgba(${col},0.24)`); gr.addColorStop(1, `rgba(${col},0)`);
					g.fillStyle = gr; g.beginPath(); g.moveTo(0, y0);
					for (let x = 0; x <= W; x += 12) g.lineTo(x, y0 + Math.sin(x * 0.012 + r * 1.7) * 30 + Math.sin(x * 0.03 + r) * 10);
					for (let x = W; x >= 0; x -= 12) g.lineTo(x, y0 + 150 + Math.sin(x * 0.01 + r) * 24);
					g.closePath(); g.fill();
				}
				hills(H * 0.78, 48, '#0a1122', 0.011, 2);
				hills(H * 0.88, 32, '#101b32', 0.015, 5);
				g.save();
				g.strokeStyle = 'rgba(186,230,253,0.28)';
				g.lineWidth = 1.5;
				for (let i = 0; i < 12; i++) {
					const x = rnd() * W, y = H * (0.78 + rnd() * 0.16);
					g.beginPath(); g.moveTo(x - 26, y + 18); g.lineTo(x, y - 34 - rnd() * 38); g.lineTo(x + 30, y + 20); g.stroke();
				}
				g.restore();
				break;
			default:
				glow(W * 0.5, H * 0.5, 280, 'rgba(56,189,248,0.08)', 'rgba(56,189,248,0)');
		}
	}

	applyBackground(biome) {
		this.scene.background = this.getBackgroundTexture(biome);
	}

	createParticleField(kind, cols, rows) {
		const count = { nave: 70, fabrica: 46, bosque: 34, oceano: 56, glaciar: 90 }[kind] || 40;
		const spanX = cols / 2 + 3.2, spanZ = rows / 2 + 3.2, top = 5.2;
		const pos = new Float32Array(count * 3);
		const vel = new Float32Array(count * 3);
		const ph = new Float32Array(count);
		for (let i = 0; i < count; i++) {
			pos[i * 3] = (Math.random() * 2 - 1) * spanX;
			pos[i * 3 + 1] = Math.random() * top;
			pos[i * 3 + 2] = (Math.random() * 2 - 1) * spanZ;
			ph[i] = Math.random() * 6.283;
			if (kind === 'nave') { vel[i * 3] = (Math.random() - 0.5) * 0.004; vel[i * 3 + 1] = (Math.random() - 0.5) * 0.0016; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.004; }
			else if (kind === 'fabrica') vel[i * 3 + 1] = 0.01 + Math.random() * 0.016;
			else if (kind === 'bosque') { vel[i * 3] = (Math.random() - 0.5) * 0.003; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.003; }
			else if (kind === 'oceano') vel[i * 3 + 1] = 0.008 + Math.random() * 0.014;
			else vel[i * 3 + 1] = -(0.008 + Math.random() * 0.012);
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		const look = {
			nave: [0xbfe0ff, 2.2, 0.9, THREE.NormalBlending],
			fabrica: [0xffa13a, 3.2, 0.95, THREE.AdditiveBlending],
			bosque: [0xeaff7a, 4.2, 0.95, THREE.AdditiveBlending],
			oceano: [0xd6fbff, 3.4, 0.6, THREE.NormalBlending],
			glaciar: [0xffffff, 3.4, 0.9, THREE.NormalBlending]
		}[kind] || [0xffffff, 3, 0.8, THREE.NormalBlending];
		const mat = new THREE.PointsMaterial({
			color: look[0], size: look[1], sizeAttenuation: false, map: this.getDotTexture(),
			transparent: true, opacity: look[2], depthWrite: false, blending: look[3]
		});
		const pts = new THREE.Points(geo, mat);
		pts.frustumCulled = false;
		this.itemsGroup.add(pts);
		this.animatedBiomeObjects.push({ type: 'particles', points: pts, vel, ph, kind, spanX, spanZ, top });
	}

	updateParticles(obj, timestamp) {
		const pa = obj.points.geometry.attributes.position.array;
		const t = timestamp * 0.001;
		const n = obj.ph.length;
		const sway = obj.kind === 'bosque' ? 0.006 : 0.0016;
		for (let i = 0; i < n; i++) {
			const k = i * 3;
			let x = pa[k] + obj.vel[k] + Math.sin(t * 0.9 + obj.ph[i]) * sway;
			let y = pa[k + 1] + obj.vel[k + 1];
			let z = pa[k + 2] + obj.vel[k + 2] + Math.cos(t * 0.8 + obj.ph[i]) * sway;
			if (obj.kind === 'bosque') y += Math.sin(t * 0.7 + obj.ph[i] * 1.3) * 0.004;
			if (y > obj.top) y = 0; else if (y < 0) y = obj.top;
			if (x > obj.spanX) x = -obj.spanX; else if (x < -obj.spanX) x = obj.spanX;
			if (z > obj.spanZ) z = -obj.spanZ; else if (z < -obj.spanZ) z = obj.spanZ;
			pa[k] = x; pa[k + 1] = y; pa[k + 2] = z;
		}
		obj.points.geometry.attributes.position.needsUpdate = true;
	}

	addSteam(parent, y, scale = 1) {
		const sprites = [];
		for (let k = 0; k < 3; k++) {
			const mat = new THREE.SpriteMaterial({ map: this.getDotTexture(), color: 0xe5e7eb, transparent: true, opacity: 0.5, depthWrite: false });
			const s = new THREE.Sprite(mat);
			s.position.y = y;
			parent.add(s);
			sprites.push(s);
		}
		this.animatedBiomeObjects.push({ type: 'steam', sprites, baseY: y, scale, phase: Math.random() });
	}

	/* ---------- Piezas nuevas ---------- */
	createToothedGear(R, teeth, colorHex, thick = 0.07) {
		const group = new THREE.Group();
		const shape = new THREE.Shape();
		const ri = R * 0.78, u = (Math.PI * 2) / teeth;
		let first = true;
		for (let t = 0; t < teeth; t++) {
			for (const [f, r] of [[0, ri], [0.15, R], [0.45, R], [0.6, ri]]) {
				const a = t * u + f * u;
				const x = Math.cos(a) * r, y = Math.sin(a) * r;
				if (first) { shape.moveTo(x, y); first = false; } else shape.lineTo(x, y);
			}
		}
		shape.closePath();
		const hole = new THREE.Path();
		hole.absarc(0, 0, R * 0.3, 0, Math.PI * 2, true);
		shape.holes.push(hole);
		const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
		geo.translate(0, 0, -thick / 2);
		const mat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.8, roughness: 0.35 });
		const body = new THREE.Mesh(geo, mat);
		body.castShadow = true;
		group.add(body);
		const hub = new THREE.Mesh(
			new THREE.CylinderGeometry(R * 0.18, R * 0.18, thick * 1.7, 10),
			new THREE.MeshStandardMaterial({ color: 0x292524, metalness: 0.7, roughness: 0.4 })
		);
		hub.rotation.x = Math.PI / 2;
		group.add(hub);
		return group;
	}

	createPiston() {
		const group = new THREE.Group();
		const base = new THREE.Mesh(
			new THREE.CylinderGeometry(0.075, 0.085, 0.18, 10),
			new THREE.MeshStandardMaterial({ color: 0x44403c, metalness: 0.7, roughness: 0.4 })
		);
		base.position.y = 0.09;
		const rod = new THREE.Group();
		const shaft = new THREE.Mesh(
			new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8),
			new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 })
		);
		shaft.position.y = 0.1;
		const head = new THREE.Mesh(
			new THREE.BoxGeometry(0.17, 0.05, 0.17),
			new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.35 })
		);
		head.position.y = 0.22;
		rod.add(shaft, head);
		rod.position.y = 0.18;
		group.add(base, rod);
		group.userData.rod = rod;
		return group;
	}

	createChimney() {
		const group = new THREE.Group();
		const body = new THREE.Mesh(
			new THREE.CylinderGeometry(0.28, 0.36, 2.2, 14),
			new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 })
		);
		body.position.y = 1.1;
		body.castShadow = true;
		const ring = new THREE.Mesh(
			new THREE.TorusGeometry(0.3, 0.05, 6, 16),
			new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xea580c, emissiveIntensity: 0.9 })
		);
		ring.rotation.x = Math.PI / 2;
		ring.position.y = 2.2;
		const band = new THREE.Mesh(
			new THREE.CylinderGeometry(0.31, 0.33, 0.12, 14),
			new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.6 })
		);
		band.position.y = 1.4;
		group.add(body, ring, band);
		return group;
	}

	createConsole(colorHex) {
		const group = new THREE.Group();
		const base = new THREE.Mesh(
			new THREE.BoxGeometry(0.28, 0.16, 0.18),
			new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 })
		);
		base.position.y = 0.08;
		const screen = new THREE.Mesh(
			new THREE.BoxGeometry(0.22, 0.13, 0.02),
			new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.9 })
		);
		screen.position.set(0, 0.22, -0.04);
		screen.rotation.x = -0.35;
		group.add(base, screen);
		for (let i = 0; i < 3; i++) {
			const b = new THREE.Mesh(
				new THREE.SphereGeometry(0.014, 6, 6),
				new THREE.MeshStandardMaterial({ color: [0xef4444, 0xfacc15, 0x22c55e][i], emissive: [0xef4444, 0xfacc15, 0x22c55e][i], emissiveIntensity: 0.8 })
			);
			b.position.set(-0.07 + i * 0.07, 0.165, 0.05);
			group.add(b);
		}
		return group;
	}

	createCrate() {
		const group = new THREE.Group();
		const box = new THREE.Mesh(
			new THREE.BoxGeometry(0.24, 0.22, 0.24),
			new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.45 })
		);
		box.position.y = 0.11;
		box.castShadow = true;
		const stripe = new THREE.Mesh(
			new THREE.BoxGeometry(0.255, 0.045, 0.255),
			new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })
		);
		stripe.position.y = 0.11;
		group.add(box, stripe);
		return group;
	}

	createMushroom(colorHex, s = 1) {
		const group = new THREE.Group();
		const stem = new THREE.Mesh(
			new THREE.CylinderGeometry(0.03 * s, 0.04 * s, 0.1 * s, 8),
			new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8 })
		);
		stem.position.y = 0.05 * s;
		const cap = new THREE.Mesh(
			new THREE.SphereGeometry(0.1 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
			new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 })
		);
		cap.position.y = 0.1 * s;
		cap.castShadow = true;
		group.add(stem, cap);
		const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
		for (let i = 0; i < 4; i++) {
			const a = i * 1.6;
			const d = new THREE.Mesh(new THREE.SphereGeometry(0.013 * s, 6, 6), dotMat);
			d.position.set(Math.cos(a) * 0.055 * s, 0.1 * s + 0.06 * s, Math.sin(a) * 0.055 * s);
			group.add(d);
		}
		return group;
	}

	createCoral(scale, colorHex) {
		const group = new THREE.Group();
		const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.18, roughness: 0.55 });
		for (let i = 0; i < 5; i++) {
			const h = (0.16 + (i % 3) * 0.07) * scale;
			const br = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * scale, 0.04 * scale, h, 6), mat);
			const a = (i / 5) * Math.PI * 2;
			br.position.set(Math.cos(a) * 0.07 * scale, h / 2, Math.sin(a) * 0.07 * scale);
			br.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
			br.castShadow = true;
			const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03 * scale, 8, 6), mat);
			tip.position.set(br.position.x + Math.cos(a) * 0.04 * scale, h, br.position.z + Math.sin(a) * 0.04 * scale);
			group.add(br, tip);
		}
		return group;
	}

	createKelp() {
		const group = new THREE.Group();
		const mat = new THREE.MeshStandardMaterial({ color: 0x1f9d55, roughness: 0.6, emissive: 0x064e3b, emissiveIntensity: 0.3 });
		for (let i = 0; i < 3; i++) {
			const h = 0.38 + i * 0.1;
			const curve = new THREE.CatmullRomCurve3([
				new THREE.Vector3(0, 0, 0),
				new THREE.Vector3(0.03, h * 0.35, 0.02),
				new THREE.Vector3(-0.03, h * 0.7, -0.02),
				new THREE.Vector3(0.02, h, 0.01)
			]);
			const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.018, 5, false), mat);
			tube.position.set((i - 1) * 0.07, 0, (i % 2) * 0.05);
			group.add(tube);
		}
		return group;
	}

	createSeaRock() {
		const group = new THREE.Group();
		const rock = new THREE.Mesh(
			new THREE.DodecahedronGeometry(0.16, 0),
			new THREE.MeshStandardMaterial({ color: 0x4b6a7a, roughness: 0.85 })
		);
		rock.scale.set(1, 0.6, 1);
		rock.position.y = 0.08;
		rock.castShadow = true;
		const star = new THREE.Shape();
		for (let i = 0; i < 10; i++) {
			const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.04 : 0.095;
			if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
		}
		const sGeo = new THREE.ExtrudeGeometry(star, { depth: 0.02, bevelEnabled: false });
		const sf = new THREE.Mesh(sGeo, new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }));
		sf.rotation.x = -Math.PI / 2;
		sf.position.set(0.04, 0.14, 0.02);
		group.add(rock, sf);
		return group;
	}

	createFish(colorHex) {
		const group = new THREE.Group();
		const mat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.25, roughness: 0.4 });
		const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat);
		body.scale.set(1.5, 0.7, 0.5);
		const tail = new THREE.Group();
		const fin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 4), mat);
		fin.rotation.z = Math.PI / 2;
		fin.position.x = -0.06;
		tail.add(fin);
		tail.position.x = -0.14;
		group.add(body, tail);
		group.userData.tail = tail;
		return group;
	}

	createJellyfish(colorHex) {
		const group = new THREE.Group();
		const bell = new THREE.Mesh(
			new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
			new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.6, transparent: true, opacity: 0.7, roughness: 0.2 })
		);
		group.add(bell);
		const tMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55 });
		for (let i = 0; i < 5; i++) {
			const a = (i / 5) * Math.PI * 2;
			const t = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4), tMat);
			t.position.set(Math.cos(a) * 0.07, -0.1, Math.sin(a) * 0.07);
			group.add(t);
		}
		return group;
	}

	createIceCrystal(s = 1) {
		const group = new THREE.Group();
		const mat = new THREE.MeshStandardMaterial({
			color: 0xbfe9ff, emissive: 0x38bdf8, emissiveIntensity: 0.28,
			transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.1
		});
		const cfgs = [[0, 0, 0, 0, 1], [0.09, 0.02, 0.05, 0.35, 0.7], [-0.08, -0.01, 0.04, -0.4, 0.8]];
		for (const [x, y, z, tilt, k] of cfgs) {
			const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 * s * k, 0), mat);
			m.scale.set(0.7, 2.3, 0.7);
			m.position.set(x * s, 0.18 * s * k + y, z * s);
			m.rotation.z = tilt;
			m.castShadow = true;
			group.add(m);
		}
		return group;
	}

	createSnowPine(s = 1) {
		const group = new THREE.Group();
		const trunk = new THREE.Mesh(
			new THREE.CylinderGeometry(0.03 * s, 0.04 * s, 0.12 * s, 6),
			new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 })
		);
		trunk.position.y = 0.06 * s;
		group.add(trunk);
		const green = new THREE.MeshStandardMaterial({ color: 0x1f6f55, roughness: 0.8 });
		const snow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
		const layers = [[0.17, 0.22, 0.2], [0.13, 0.2, 0.34], [0.09, 0.18, 0.47]];
		for (const [r, h, y] of layers) {
			const c = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 8), green);
			c.position.y = y * s;
			c.castShadow = true;
			const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.78 * s, h * 0.6 * s, 8), snow);
			cap.position.y = (y + h * 0.22) * s;
			group.add(c, cap);
		}
		return group;
	}

	createSnowMound() {
		const group = new THREE.Group();
		const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
		const a = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat);
		a.scale.set(1, 0.45, 1);
		a.position.y = 0.02;
		a.castShadow = true;
		const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), mat);
		b.scale.set(1, 0.5, 1);
		b.position.set(0.15, 0.0, 0.08);
		group.add(a, b);
		return group;
	}

	/* Ambiente exterior propio de cada planeta */
	spawnThemeAmbient(cols, rows, biome) {
		this.createParticleField(biome, cols, rows);
		const ox = cols / 2 + 1.7, oz = rows / 2 + 1.7;
		const radiusX = cols / 2 + 0.9, radiusZ = rows / 2 + 0.9;

		if (biome === 'nave') {
			for (let i = 0; i < 4; i++) {
				const a = i * 1.7 + 0.4;
				const rock = new THREE.Mesh(
					new THREE.IcosahedronGeometry(0.25 + (i % 2) * 0.15, 0),
					new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, flatShading: true })
				);
				rock.position.set(Math.cos(a) * (ox + 1.3), 0.4, Math.sin(a) * (oz + 1.3));
				this.itemsGroup.add(rock);
				this.animatedBiomeObjects.push({ type: 'float', mesh: rock, baseY: 0.2 + i * 0.4, phase: i * 1.4, rotSpeed: 0.006 });
			}
		} else if (biome === 'fabrica') {
			for (const [sx, sz, k] of [[-1, -1, 1], [-1, 1, 0.8]]) {
				const ch = this.createChimney();
				ch.scale.set(k, k, k);
				ch.position.set(sx * (ox + 0.4), -0.7, sz * (oz + 0.4));
				this.itemsGroup.add(ch);
				this.addSteam(ch, 2.35, 1.3);
			}
		} else if (biome === 'bosque') {
			for (const [sx, sz, k] of [[-1, -1, 1.5], [-1, 1, 1.2], [1, -1, 1.3]]) {
				const tree = this.createTree(k, 0);
				tree.position.set(sx * (ox + 0.6), -0.55, sz * (oz + 0.6));
				this.itemsGroup.add(tree);
			}
		} else if (biome === 'oceano') {
			const fishCols = [0xfb923c, 0xfacc15, 0xf472b6, 0x60a5fa];
			for (let i = 0; i < 4; i++) {
				const f = this.createFish(fishCols[i]);
				this.itemsGroup.add(f);
				this.animatedBiomeObjects.push({
					type: 'swim', mesh: f, tail: f.userData.tail, cx: 0, cz: 0,
					rx: radiusX + 0.3 + (i % 2) * 0.5, rz: radiusZ + 0.3 + (i % 2) * 0.5,
					cy: 0.9 + i * 0.35, speed: (0.5 + i * 0.1) * (i % 2 ? -1 : 1), phase: i * 1.6
				});
			}
			for (let i = 0; i < 2; i++) {
				const j = this.createJellyfish(i ? 0xf0abfc : 0x67e8f9);
				this.itemsGroup.add(j);
				this.animatedBiomeObjects.push({ type: 'orbit', mesh: j, cx: 0, cz: 0, cy: 1.6, radius: radiusX + 0.9 + i * 0.4, speed: 0.18 * (i ? -1 : 1), phase: i * 3 });
				this.animatedBiomeObjects.push({ type: 'float', mesh: j, baseY: 1.4 + i * 0.5, phase: i * 2.1, rotSpeed: 0.004 });
			}
			for (const [sx, sz, c] of [[-1, -1, 0xf472b6], [-1, 1, 0xfb923c]]) {
				const co = this.createCoral(2.2, c);
				co.position.set(sx * (ox + 0.3), -0.6, sz * (oz + 0.3));
				this.itemsGroup.add(co);
			}
		} else if (biome === 'glaciar') {
			for (let i = 0; i < 3; i++) {
				const m = new THREE.Mesh(
					new THREE.OctahedronGeometry(0.16, 0),
					new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: 0x34d399, emissiveIntensity: 0.9, roughness: 0.2 })
				);
				this.itemsGroup.add(m);
				this.animatedBiomeObjects.push({ type: 'orbit', mesh: m, cx: 0, cz: 0, cy: 1.2 + i * 0.3, radius: radiusX + 0.4 - i * 0.2, speed: (0.35 + i * 0.1) * (i % 2 ? -1 : 1), phase: i * 2.1 });
				this.animatedBiomeObjects.push({ type: 'float', mesh: m, baseY: 1.2 + i * 0.3, phase: i * 1.8, rotSpeed: 0.03 });
			}
			for (const [sx, sz, k] of [[-1, -1, 2.4], [-1, 1, 1.8], [1, -1, 2.0]]) {
				const ic = this.createIceCrystal(k);
				ic.position.set(sx * (ox + 0.5), -0.6, sz * (oz + 0.5));
				this.itemsGroup.add(ic);
			}
		}
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
		if (!this.canvas.hidden) {
			this.update(timestamp);
			this.render(timestamp);
		}
		requestAnimationFrame(this.boundLoop);
	}

	update(timestamp) {
		this.laserTimer += 1;
		if (this.laserTimer % 90 === 0) {
			this.laserState = !this.laserState;
			this.updateLaserVisuals();
		}

		for (const b of this.butterflies) {
			const t = timestamp * 0.0012 * b.speed + b.phase;
			b.group.position.x = b.cx + Math.cos(t) * b.radiusX;
			b.group.position.z = b.cz + Math.sin(t) * b.radiusZ;
			b.group.position.y = b.cy + Math.sin(timestamp * 0.004 + b.phase) * 0.18;
			b.group.rotation.y = -t + (b.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
			const flap = Math.sin(timestamp * 0.024 + b.phase) * 0.7;
			b.leftWing.rotation.z = flap;
			b.rightWing.rotation.z = -flap;
		}

		for (const obj of this.animatedBiomeObjects) {
			if (obj.type === 'gear') {
				obj.mesh.rotation.z += obj.speed;
			} else if (obj.type === 'float') {
				obj.mesh.position.y = obj.baseY + Math.sin(timestamp * 0.003 + obj.phase) * 0.08;
				obj.mesh.rotation.y += obj.rotSpeed || 0.015;
			} else if (obj.type === 'pulse') {
				const s = 1.0 + Math.sin(timestamp * 0.005 + obj.phase) * 0.12;
				obj.mesh.scale.set(s, s, s);
				} else if (obj.type === 'particles') {
				this.updateParticles(obj, timestamp);
			} else if (obj.type === 'piston') {
				obj.mesh.position.y = obj.baseY + (Math.sin(timestamp * 0.004 + obj.phase) * 0.5 + 0.5) * 0.14;
			} else if (obj.type === 'sway') {
				obj.mesh.rotation.z = Math.sin(timestamp * 0.002 + obj.phase) * obj.amp;
				obj.mesh.rotation.x = Math.cos(timestamp * 0.0017 + obj.phase) * obj.amp * 0.6;
			} else if (obj.type === 'steam') {
				for (let k = 0; k < obj.sprites.length; k++) {
					const f = (timestamp * 0.0006 + k / obj.sprites.length + obj.phase) % 1;
					const sp = obj.sprites[k];
					sp.position.y = obj.baseY + f * 0.9 * obj.scale;
					sp.position.x = Math.sin(f * 5 + k) * 0.05;
					const sc = (0.15 + f * 0.5) * obj.scale;
					sp.scale.set(sc, sc, sc);
					sp.material.opacity = 0.5 * (1 - f);
				}
			} else if (obj.type === 'swim') {
				const t = timestamp * 0.001 * obj.speed + obj.phase;
				const sg = obj.speed > 0 ? 1 : -1;
				obj.mesh.position.x = obj.cx + Math.cos(t) * obj.rx;
				obj.mesh.position.z = obj.cz + Math.sin(t) * obj.rz;
				obj.mesh.position.y = obj.cy + Math.sin(timestamp * 0.003 + obj.phase) * 0.1;
				obj.mesh.rotation.y = Math.atan2(-sg * Math.cos(t), -sg * Math.sin(t));
				if (obj.tail) obj.tail.rotation.y = Math.sin(timestamp * 0.02 + obj.phase) * 0.5;
			} else if (obj.type === 'orbit') {
				const t = timestamp * 0.001 * obj.speed + obj.phase;
				obj.mesh.position.x = obj.cx + Math.cos(t) * obj.radius;
				obj.mesh.position.z = obj.cz + Math.sin(t) * obj.radius;
				obj.mesh.position.y = obj.cy + Math.sin(timestamp * 0.003 + obj.phase) * 0.15;
			}
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

