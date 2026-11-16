const origWorkspaceSetScale = (typeof Blockly !== 'undefined' && Blockly.WorkspaceSvg) ? Blockly.WorkspaceSvg.prototype.setScale : null;
if (origWorkspaceSetScale) {
	Blockly.WorkspaceSvg.prototype.setScale = function(newScale) {
		if (this.isFlyout || this.targetWorkspace_) {
			return origWorkspaceSetScale.call(this, 1.0);
		}
		const res = origWorkspaceSetScale.call(this, newScale);
		if (this.flyout_) {
			const flyoutWs = this.flyout_.workspace_ || (typeof this.flyout_.getWorkspace === 'function' && this.flyout_.getWorkspace());
			if (flyoutWs) {
				origWorkspaceSetScale.call(flyoutWs, 1.0);
			}
		}
		return res;
	};
}

const App = {
	state: null,
	engine: null,
	workspace: null,
	currentLevelIndex: 0,
	isRunning: false,
	isStepMode: false,
	abortExecution: false,
	stepResolver: null,
	activeMobileView: 'blockly',
	currentScreen: 'map',
	pendingMigration: null,
	mapModule: null,

	init() {
		this.state = Storage.load();
		BlocksManager.init();
		if (typeof THREE !== 'undefined' && typeof GameEngine3D !== 'undefined') {
			this.engine = new GameEngine3D('game-canvas');
		} else {
			this.engine = new GameEngine('game-canvas');
		}
		this.engine.onHighlightBlock = (id) => {
			if (this.workspace && id) {
				this.workspace.highlightBlock(id);
			}
		};

		this.selectedBiomeFilter = 'all';
		this.mapModule = (typeof ProgressMap3D !== 'undefined') ? ProgressMap3D : ProgressMap;
		this.initBlockly();
		this.initProgressMap();
		this.initTutorial();
		this.bindEvents();
		this.bindToolbarEvents();
		this.updateResponsiveView();
		this.loadLevel(Math.min(this.state.unlockedLevel, LEVELS.length - 1));
		this.showScreen('map');
	},

	initBlockly() {
		const initialToolbox = BlocksManager.createToolboxXml(LEVELS[0].availableBlocks);
		this.workspace = Blockly.inject('blockly-div', {
			toolbox: initialToolbox,
			renderer: 'geras',
			trashcan: false,
			scrollbars: true,
			sounds: false,
			grid: {
				spacing: 24,
				length: 3,
				colour: '#cbd5e1',
				snap: false
			},
			zoom: {
				controls: false,
				wheel: true,
				startScale: 1.0,
				maxScale: 1.4,
				minScale: 0.6,
				scaleSpeed: 1.1
			}
		});

		this.lockFlyoutScale();

		this.workspace.addChangeListener(() => {
			this.updateBlockStats();
			this.updateCodePreview();
			this.saveCurrentWorkspace();
		});

		window.addEventListener('resize', () => {
			Blockly.svgResize(this.workspace);
			this.engine.computeLayout();
			this.updateResponsiveView();
		});

		window.addEventListener('keydown', (e) => {
			if ((e.key === 'Delete' || e.key === 'Backspace') && Blockly.selected && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
				Blockly.selected.dispose(true);
			}
		});
	},

	lockFlyoutScale() {
		try {
			if (!this.workspace) return;
			const flyout = this.workspace.getFlyout();
			if (!flyout) return;
			const flyoutWorkspace = flyout.workspace_ || (typeof flyout.getWorkspace === 'function' && flyout.getWorkspace());
			if (flyoutWorkspace) {
				if (origWorkspaceSetScale) {
					origWorkspaceSetScale.call(flyoutWorkspace, 1.0);
				}
				try {
					Object.defineProperty(flyoutWorkspace, 'scale', {
						get() { return 1.0; },
						set(_) {},
						configurable: true
					});
				} catch (e) {}
			}
			const flyoutGroup = flyout.svgGroup_;
			if (flyoutGroup && !flyoutGroup.__wheelIsolated) {
				flyoutGroup.__wheelIsolated = true;
				flyoutGroup.addEventListener('wheel', (e) => {
					e.stopPropagation();
				}, { passive: true });
			}
		} catch (e) {}
	},

	initProgressMap() {
		this.mapModule.init('map-canvas', 'map-scroll-container', 'map-node-tooltip', (levelIndex) => {
			this.selectLevelFromMap(levelIndex);
		});
		this.mapModule.updateState(this.state);

		document.getElementById('btn-map-play-current').addEventListener('click', () => {
			const targetLevel = Math.min(this.state.unlockedLevel, LEVELS.length - 1);
			this.selectLevelFromMap(targetLevel);
		});
	},

	showScreen(screen) {
		this.currentScreen = screen;
		const mapPanel = document.getElementById('progress-map-panel');
		const workspacePanel = document.getElementById('main-workspace');
		const toggleBtn = document.getElementById('btn-toggle-map');
		const toggleText = document.getElementById('btn-toggle-map-text');
		const counterBadge = document.getElementById('block-counter');
		const responsiveToggle = document.getElementById('responsive-view-toggle');

		if (screen === 'map') {
			mapPanel.classList.add('active-screen');
			workspacePanel.style.display = 'none';
			toggleBtn.classList.add('active');
			toggleText.textContent = 'Jugar';
			counterBadge.style.display = 'none';
			responsiveToggle.style.display = 'none';
			this.updateMapStats();
			this.mapModule.updateState(this.state);
			setTimeout(() => {
				this.mapModule.computeLayout();
				this.mapModule.scrollToNode(this.state.unlockedLevel);
			}, 50);
		} else {
			mapPanel.classList.remove('active-screen');
			workspacePanel.style.display = 'flex';
			toggleBtn.classList.remove('active');
			toggleText.textContent = 'Mapa';
			counterBadge.style.display = 'flex';
			this.updateResponsiveView();
			setTimeout(() => {
				if (this.workspace) Blockly.svgResize(this.workspace);
				if (this.engine) this.engine.computeLayout();
			}, 50);
			setTimeout(() => {
				if (this.engine) this.engine.computeLayout();
			}, 150);
		}
	},

	selectLevelFromMap(levelIndex) {
		this.loadLevel(levelIndex);
		this.showScreen('workspace');
	},

	updateMapStats() {
		let totalStars = 0;
		for (const key in this.state.stars) {
			totalStars += this.state.stars[key];
		}
		const el = document.getElementById('map-total-stars');
		if (el) el.textContent = `${totalStars} / ${LEVELS.length * 3}`;
		const playBtnText = document.getElementById('map-play-btn-text');
		if (playBtnText) {
			const currentLevel = LEVELS[Math.min(this.state.unlockedLevel, LEVELS.length - 1)];
			playBtnText.textContent = `Continuar Nivel ${currentLevel.id}`;
		}
	},

	getStarSvg(filled, isCelebration) {
		const className = isCelebration ? `star-celebration-icon ${filled ? '' : 'empty'}` : `star-icon ${filled ? '' : 'empty'}`;
		return `<svg class="${className}" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
	},

	renderStars(container, count, total, isCelebration) {
		let html = '';
		for (let i = 0; i < total; i++) {
			html += this.getStarSvg(i < count, isCelebration);
		}
		container.innerHTML = html;
	},

	bindToolbarEvents() {
		document.getElementById('btn-dock-undo').addEventListener('click', () => {
			if (this.workspace) {
				this.workspace.undo(false);
			}
		});

		document.getElementById('btn-dock-redo').addEventListener('click', () => {
			if (this.workspace) {
				this.workspace.undo(true);
			}
		});

		document.getElementById('btn-dock-cleanup').addEventListener('click', () => {
			if (this.workspace) {
				this.workspace.cleanUp();
				SoundFX.playSnap();
			}
		});

		document.getElementById('btn-dock-clear').addEventListener('click', () => {
			if (!this.workspace) return;
			const total = this.workspace.getAllBlocks(false).length;
			if (total === 0) return;
			if (confirm('¿Deseas eliminar todos los bloques del lienzo de trabajo?')) {
				this.workspace.clear();
				SoundFX.playSnap();
			}
		});

		document.getElementById('btn-view-blocks').addEventListener('click', () => {
			this.switchMobileView('blockly');
		});

		document.getElementById('btn-view-sim').addEventListener('click', () => {
			this.switchMobileView('simulator');
		});
	},

	switchMobileView(view) {
		this.activeMobileView = view;
		const btnBlocks = document.getElementById('btn-view-blocks');
		const btnSim = document.getElementById('btn-view-sim');
		const panelBlocks = document.getElementById('blockly-panel');
		const panelSim = document.getElementById('simulator-panel');

		if (view === 'blockly') {
			btnBlocks.classList.add('active');
			btnSim.classList.remove('active');
			panelBlocks.classList.add('active-view');
			panelSim.classList.remove('active-view');
			setTimeout(() => {
				if (this.workspace) Blockly.svgResize(this.workspace);
			}, 50);
		} else {
			btnSim.classList.add('active');
			btnBlocks.classList.remove('active');
			panelSim.classList.add('active-view');
			panelBlocks.classList.remove('active-view');
			setTimeout(() => {
				this.engine.computeLayout();
			}, 50);
		}
	},

	updateResponsiveView() {
		const isNarrow = window.innerWidth <= 900;
		const panelBlocks = document.getElementById('blockly-panel');
		const panelSim = document.getElementById('simulator-panel');

		if (!isNarrow) {
			panelBlocks.classList.remove('active-view');
			panelSim.classList.remove('active-view');
		} else {
			this.switchMobileView(this.activeMobileView);
		}
	},

	bindEvents() {
		document.getElementById('btn-run').addEventListener('click', () => {
			if (this.isRunning) {
				this.stop();
			} else {
				if (window.innerWidth <= 900 && this.activeMobileView === 'blockly') {
					this.switchMobileView('simulator');
				}
				this.run(false);
			}
		});

		document.getElementById('btn-step').addEventListener('click', () => {
			if (window.innerWidth <= 900 && this.activeMobileView === 'blockly') {
				this.switchMobileView('simulator');
			}
			if (!this.isRunning) {
				this.run(true);
			} else if (this.isStepMode && this.stepResolver) {
				const resolve = this.stepResolver;
				this.stepResolver = null;
				resolve();
			}
		});

		document.getElementById('btn-reset').addEventListener('click', () => {
			this.stop();
			this.engine.reset();
			this.hideToast();
			if (this.workspace) {
				this.workspace.highlightBlock(null);
			}
		});

		document.getElementById('btn-hint').addEventListener('click', () => {
			const level = LEVELS[this.currentLevelIndex];
			document.getElementById('hint-text').textContent = level.hint;
			this.openModal('modal-hint');
		});

		document.getElementById('btn-toggle-code').addEventListener('click', () => {
			const drawer = document.getElementById('code-drawer');
			drawer.classList.toggle('open');
			this.updateCodePreview();
		});

		document.getElementById('btn-close-code').addEventListener('click', () => {
			document.getElementById('code-drawer').classList.remove('open');
		});

		document.getElementById('btn-sound-toggle').addEventListener('click', () => {
			const enabled = SoundFX.toggle();
			const icon = document.getElementById('icon-sound');
			if (enabled) {
				icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
			} else {
				icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
			}
		});

		document.getElementById('btn-toggle-map').addEventListener('click', () => {
			if (this.currentScreen === 'map') {
				this.showScreen('workspace');
			} else {
				this.showScreen('map');
			}
		});

		document.getElementById('btn-open-tutorial').addEventListener('click', () => {
			this.openTutorialModal();
		});

		document.getElementById('btn-map-tutorial').addEventListener('click', () => {
			this.openTutorialModal();
		});

		const btnZoomIn = document.getElementById('btn-cam-zoom-in');
		const btnZoomOut = document.getElementById('btn-cam-zoom-out');
		const btnFocusBot = document.getElementById('btn-cam-focus-bot');

		if (btnZoomIn) {
			btnZoomIn.addEventListener('click', () => {
				if (this.engine && this.engine.zoomIn) {
					this.engine.zoomIn();
				}
			});
		}
		if (btnZoomOut) {
			btnZoomOut.addEventListener('click', () => {
				if (this.engine && this.engine.zoomOut) {
					this.engine.zoomOut();
				}
			});
		}
		if (btnFocusBot) {
			btnFocusBot.addEventListener('click', () => {
				if (this.engine && this.engine.toggleFocus) {
					const isFocused = this.engine.toggleFocus();
					btnFocusBot.classList.toggle('active', isFocused);
				}
			});
		}

		document.getElementById('btn-open-levels').addEventListener('click', () => {
			this.renderLevelsGrid();
			this.openModal('modal-levels');
		});

		const levelTabs = document.querySelectorAll('#modal-levels-tabs .tab-btn');
		levelTabs.forEach(tab => {
			tab.addEventListener('click', () => {
				levelTabs.forEach(t => t.classList.remove('active'));
				tab.classList.add('active');
				this.selectedBiomeFilter = tab.dataset.biome;
				this.renderLevelsGrid();
			});
		});

		document.getElementById('btn-open-backup').addEventListener('click', () => {
			this.updateBackupModal();
			this.openModal('modal-backup');
		});

		document.getElementById('student-name-input').addEventListener('input', (e) => {
			this.state.studentName = e.target.value;
			Storage.save(this.state);
		});

		document.getElementById('btn-copy-code').addEventListener('click', () => {
			const input = document.getElementById('backup-code-display');
			input.select();
			navigator.clipboard.writeText(input.value).then(() => {
				const msg = document.getElementById('backup-message');
				msg.textContent = 'Código copiado al portapapeles';
				msg.style.color = 'var(--color-primary)';
				setTimeout(() => { msg.textContent = ''; }, 3000);
			});
		});

		document.getElementById('btn-restore-code').addEventListener('click', () => {
			const code = document.getElementById('restore-code-input').value;
			const msg = document.getElementById('backup-message');
			try {
				this.state = Storage.importCode(code);
				msg.textContent = 'Progreso restaurado con éxito';
				msg.style.color = 'var(--color-primary)';
				setTimeout(() => {
					this.closeModal('modal-backup');
					this.loadLevel(Math.min(this.state.unlockedLevel, LEVELS.length - 1));
				}, 1000);
			} catch (err) {
				msg.textContent = err.message;
				msg.style.color = 'var(--color-danger)';
			}
		});

		document.getElementById('btn-victory-next').addEventListener('click', () => {
			this.closeModal('modal-victory');
			if (this.pendingMigration) {
				const mig = this.pendingMigration;
				this.pendingMigration = null;
				this.showScreen('map');
				this.mapModule.animateTransition(mig.from, mig.to).then(() => {
					setTimeout(() => {
						this.selectLevelFromMap(mig.to);
					}, 400);
				});
			} else if (this.currentLevelIndex < LEVELS.length - 1) {
				this.loadLevel(this.currentLevelIndex + 1);
			}
		});

		document.getElementById('btn-victory-map').addEventListener('click', () => {
			this.closeModal('modal-victory');
			this.showScreen('map');
			if (this.pendingMigration) {
				const mig = this.pendingMigration;
				this.pendingMigration = null;
				this.mapModule.animateTransition(mig.from, mig.to);
			}
		});

		document.getElementById('btn-victory-replay').addEventListener('click', () => {
			this.closeModal('modal-victory');
			this.loadLevel(this.currentLevelIndex);
		});

		document.getElementById('btn-victory-certificate').addEventListener('click', () => {
			this.closeModal('modal-victory');
			this.openCertificateModal();
		});

		document.getElementById('btn-open-diploma-direct').addEventListener('click', () => {
			this.closeModal('modal-backup');
			this.openCertificateModal();
		});

		document.getElementById('btn-download-certificate').addEventListener('click', () => {
			const canvas = document.getElementById('certificate-canvas');
			const link = document.createElement('a');
			link.download = `CodeBoot_Constancia_${this.state.studentName || 'Estudiante'}.png`;
			link.href = canvas.toDataURL('image/png');
			link.click();
		});

		document.querySelectorAll('[data-close]').forEach(btn => {
			btn.addEventListener('click', (e) => {
				const modalId = e.currentTarget.getAttribute('data-close');
				this.closeModal(modalId);
			});
		});

		document.querySelectorAll('.modal-backdrop').forEach(modal => {
			modal.addEventListener('click', (e) => {
				if (e.target === modal) {
					modal.classList.remove('active');
				}
			});
		});
	},

	loadLevel(index) {
		this.stop();
		this.currentLevelIndex = index;
		const level = LEVELS[index];

		document.getElementById('header-level-title').textContent = `Módulo ${level.id.split('.')[0]} • Nivel ${level.id}`;
		const starsCount = this.state.stars[level.id] || 0;
		this.renderStars(document.getElementById('header-stars'), starsCount, 3, false);

		document.getElementById('mission-module-badge').textContent = level.module;
		document.getElementById('mission-title').textContent = level.title;
		document.getElementById('mission-instruction').textContent = level.instruction;

		document.getElementById('counter-optimal').textContent = level.maxBlocksFor3Stars;

		const toolboxXml = BlocksManager.createToolboxXml(level.availableBlocks);
		this.workspace.updateToolbox(toolboxXml);
		this.lockFlyoutScale();

		this.workspace.clear();
		const savedXml = this.state.savedWorkspaces[level.id];
		if (savedXml) {
			try {
				const xml = Blockly.utils.xml.textToDom(savedXml);
				Blockly.Xml.domToWorkspace(xml, this.workspace);
			} catch (e) {}
		}

		this.engine.loadLevel(level);
		this.hideToast();
		const btnFocusBot = document.getElementById('btn-cam-focus-bot');
		if (btnFocusBot) btnFocusBot.classList.remove('active');
		this.updateBlockStats();
		this.updateCodePreview();
		this.updateMapStats();
		this.mapModule.updateState(this.state);
		Blockly.svgResize(this.workspace);
	},

	updateBlockStats() {
		if (!this.workspace) return;
		const blocks = this.workspace.getAllBlocks(false).length;
		const level = LEVELS[this.currentLevelIndex];
		const optimal = level.maxBlocksFor3Stars;

		const currentEl = document.getElementById('counter-current');
		const badge = document.getElementById('block-counter');
		const statusEl = document.getElementById('counter-status');

		currentEl.textContent = blocks;
		badge.classList.remove('warning', 'exceeded');

		if (blocks <= optimal) {
			statusEl.textContent = '(Óptimo)';
		} else if (blocks <= optimal + 2) {
			badge.classList.add('warning');
			statusEl.textContent = '(Aceptable)';
		} else {
			badge.classList.add('exceeded');
			statusEl.textContent = '(Excedido)';
		}
	},

	updateCodePreview() {
		if (!this.workspace) return;
		const preview = document.getElementById('code-preview');
		preview.textContent = BlocksManager.generateCleanCode(this.workspace);
	},

	saveCurrentWorkspace() {
		if (!this.workspace || !this.state) return;
		const level = LEVELS[this.currentLevelIndex];
		const dom = Blockly.Xml.workspaceToDom(this.workspace);
		const xml = Blockly.utils.xml.domToText(dom);
		this.state.savedWorkspaces[level.id] = xml;
		Storage.save(this.state);
	},

	async run(stepMode) {
		if (this.isRunning) return;
		this.isRunning = true;
		this.isStepMode = stepMode;
		this.abortExecution = false;

		const btnRun = document.getElementById('btn-run');
		document.getElementById('run-icon-wrapper').innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>';
		document.getElementById('run-text').textContent = 'Detener';
		btnRun.style.backgroundColor = 'var(--color-danger)';

		this.engine.reset();
		this.hideToast();

		const code = BlocksManager.generateExecutableCode(this.workspace);

		const shouldAbort = () => this.abortExecution;

		const waitStep = () => {
			if (!this.isStepMode) return Promise.resolve();
			return new Promise(resolve => {
				this.stepResolver = resolve;
			});
		};

		const stepProxy = async (action, blockId, arg) => {
			if (this.abortExecution) {
				throw new Error('ABORTED');
			}
			await this.engine.step(action, blockId, arg);
			if (this.abortExecution) {
				throw new Error('ABORTED');
			}
			await waitStep();
		};

		const wrappedEngine = {
			step: stepProxy,
			checkPitAhead: () => this.engine.checkPitAhead(),
			checkWallAhead: () => this.engine.checkWallAhead(),
			checkLaserAhead: () => this.engine.checkLaserAhead(),
			isAtGoal: () => this.engine.isAtGoal(),
			bot: this.engine.bot
		};

		try {
			const runFn = new Function('engine', 'shouldAbort', `return (${code})(engine, shouldAbort);`);
			await runFn(wrappedEngine, shouldAbort);

			if (!this.abortExecution) {
				await new Promise(r => setTimeout(r, 200));
				this.evaluateOutcome();
			}
		} catch (err) {
			if (!this.abortExecution && err.message !== 'ABORTED') {
				if (this.engine && this.engine.bot3D) this.engine.bot3D.setMood('error');
				SoundFX.playError();
				this.showToast(err.message, 'error');
			}
		} finally {
			this.stop();
		}
	},

	evaluateOutcome() {
		const level = LEVELS[this.currentLevelIndex];
		const allCoresActive = this.engine.areAllCoresActive();
		const atGoal = this.engine.isAtGoal();

		if (allCoresActive && atGoal) {
			const blocks = this.workspace.getAllBlocks(false).length;
			let starsWon = 1;
			if (blocks <= level.maxBlocksFor3Stars) {
				starsWon = 3;
			} else if (blocks <= level.maxBlocksFor3Stars + 2) {
				starsWon = 2;
			}

			const prevStars = this.state.stars[level.id] || 0;
			if (starsWon > prevStars) {
				this.state.stars[level.id] = starsWon;
			}

			const oldUnlocked = this.state.unlockedLevel;
			if (this.currentLevelIndex + 1 > this.state.unlockedLevel) {
				this.state.unlockedLevel = Math.min(this.currentLevelIndex + 1, LEVELS.length - 1);
			}
			if (this.state.unlockedLevel > oldUnlocked) {
				this.pendingMigration = {
					from: this.currentLevelIndex,
					to: this.state.unlockedLevel
				};
			} else {
				this.pendingMigration = null;
			}

			Storage.save(this.state);
			this.mapModule.updateState(this.state);
			if (this.engine && this.engine.bot3D) this.engine.bot3D.setMood('happy');
			SoundFX.playSuccess();
			this.showVictoryModal(starsWon, blocks, level.maxBlocksFor3Stars);
		} else if (atGoal && !allCoresActive) {
			if (this.engine && this.engine.bot3D) this.engine.bot3D.setMood('error');
			SoundFX.playError();
			this.showToast('BIT llegó al final, pero olvidaste encender todos los núcleos.', 'info');
		} else {
			if (this.engine && this.engine.bot3D) this.engine.bot3D.setMood('error');
			SoundFX.playError();
			this.showToast('BIT terminó sus órdenes, pero no alcanzó el objetivo de la misión.', 'info');
		}
	},

	stop() {
		this.abortExecution = true;
		this.isRunning = false;
		this.isStepMode = false;
		if (this.stepResolver) {
			const resolve = this.stepResolver;
			this.stepResolver = null;
			resolve();
		}
		if (this.engine) {
			this.engine.cancelAnimation();
		}

		const btnRun = document.getElementById('btn-run');
		document.getElementById('run-icon-wrapper').innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
		document.getElementById('run-text').textContent = 'Ejecutar';
		btnRun.style.backgroundColor = 'var(--color-primary)';

		if (this.workspace) {
			this.workspace.highlightBlock(null);
		}
	},

	showToast(text, type) {
		const toast = document.getElementById('status-toast');
		toast.textContent = text;
		toast.className = `status-toast ${type}`;
		toast.style.display = 'flex';
	},

	hideToast() {
		const toast = document.getElementById('status-toast');
		toast.style.display = 'none';
	},

	showVictoryModal(starsWon, blocksUsed, optimal) {
		this.renderStars(document.getElementById('victory-stars'), starsWon, 3, true);
		document.getElementById('victory-blocks-used').textContent = blocksUsed;
		document.getElementById('victory-blocks-optimal').textContent = optimal;

		const ratingText = starsWon === 3 ? 'Perfección Absoluta: 3 Estrellas' : starsWon === 2 ? 'Gran Trabajo: 2 Estrellas' : 'Completado con 1 Estrella';
		document.getElementById('victory-rating').textContent = ratingText;

		const feedback = document.getElementById('victory-feedback');
		if (starsWon === 3) {
			feedback.textContent = 'Escribiste una solución muy eficiente.';
		} else {
			feedback.textContent = 'Puedes optimizar reduciendo bloques para alcanzar las 3 estrellas.';
		}

		const btnCert = document.getElementById('btn-victory-certificate');
		const btnNext = document.getElementById('btn-victory-next');
		if (this.currentLevelIndex >= LEVELS.length - 1) {
			btnNext.style.display = 'none';
			btnCert.style.display = 'inline-block';
		} else {
			btnNext.style.display = 'inline-block';
			btnCert.style.display = 'none';
		}

		this.openModal('modal-victory');
	},

	renderLevelsGrid() {
		const container = document.getElementById('levels-container');
		if (!container) return;
		container.innerHTML = '';

		let totalStars = 0;
		for (const key in this.state.stars) {
			totalStars += this.state.stars[key];
		}
		const starsLabel = document.getElementById('modal-levels-stars');
		if (starsLabel) {
			starsLabel.textContent = `${totalStars} / ${LEVELS.length * 3}`;
		}

		const biomeColors = {
			1: '#2563eb',
			2: '#d97706',
			3: '#7c3aed',
			4: '#db2777',
			5: '#059669'
		};
		const biomeNames = {
			1: 'Secuencias',
			2: 'Bucles',
			3: 'Condicionales',
			4: 'Variables',
			5: 'Funciones'
		};

		LEVELS.forEach((level, idx) => {
			const biomeId = Math.floor(idx / 4) + 1;
			if (this.selectedBiomeFilter && this.selectedBiomeFilter !== 'all' && this.selectedBiomeFilter !== String(biomeId)) {
				return;
			}

			const isUnlocked = idx <= this.state.unlockedLevel;
			const isCurrent = idx === this.currentLevelIndex;
			const stars = this.state.stars[level.id] || 0;
			const color = biomeColors[biomeId] || '#2563eb';

			const card = document.createElement('div');
			card.className = `level-card ${isUnlocked ? '' : 'is-locked'} ${isCurrent ? 'is-current' : ''}`;
			card.style.setProperty('--biome-color', color);

			const headerRow = document.createElement('div');
			headerRow.className = 'level-card-header';

			const tagSpan = document.createElement('span');
			tagSpan.className = 'level-card-tag';
			tagSpan.textContent = `Nivel ${level.id}`;
			tagSpan.style.backgroundColor = `${color}15`;
			tagSpan.style.color = color;
			headerRow.appendChild(tagSpan);

			const statusSpan = document.createElement('span');
			statusSpan.className = 'level-card-status';
			if (isCurrent) {
				statusSpan.className += ' status-current';
				statusSpan.textContent = 'Actual';
			} else if (stars === 3) {
				statusSpan.className += ' status-perfect';
				statusSpan.textContent = '3 estrellas';
			} else if (isUnlocked) {
				statusSpan.className += ' status-unlocked';
				statusSpan.textContent = stars > 0 ? `${stars}/3` : 'Disponible';
			} else {
				statusSpan.className += ' status-locked';
				statusSpan.innerHTML = '<svg class="svg-icon-xs" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>';
			}
			headerRow.appendChild(statusSpan);
			card.appendChild(headerRow);

			const titleDiv = document.createElement('div');
			titleDiv.className = 'level-card-title';
			titleDiv.textContent = level.title;
			card.appendChild(titleDiv);

			const conceptDiv = document.createElement('div');
			conceptDiv.className = 'level-card-concept';
			conceptDiv.textContent = biomeNames[biomeId];
			card.appendChild(conceptDiv);

			const footerRow = document.createElement('div');
			footerRow.className = 'level-card-footer';

			const starsSpan = document.createElement('span');
			starsSpan.className = 'level-card-stars';
			if (isUnlocked) {
				this.renderStars(starsSpan, stars, 3, false);
			} else {
				starsSpan.textContent = 'Bloqueado';
				starsSpan.style.color = '#94a3b8';
				starsSpan.style.fontSize = '0.75rem';
			}
			footerRow.appendChild(starsSpan);

			const blocksHint = document.createElement('span');
			blocksHint.className = 'level-card-hint';
			blocksHint.textContent = `Máx ${level.maxBlocksFor3Stars || 6} blqs`;
			footerRow.appendChild(blocksHint);

			card.appendChild(footerRow);

			if (isUnlocked) {
				card.addEventListener('click', () => {
					this.closeModal('modal-levels');
					this.loadLevel(idx);
				});
			}

			container.appendChild(card);
		});
	},

	updateBackupModal() {
		document.getElementById('student-name-input').value = this.state.studentName || '';
		document.getElementById('backup-code-display').value = Storage.exportCode(this.state);
		document.getElementById('restore-code-input').value = '';
		document.getElementById('backup-message').textContent = '';

		const isCompleted = Object.keys(this.state.stars).length >= LEVELS.length;
		document.getElementById('btn-open-diploma-direct').style.display = isCompleted ? 'inline-block' : 'none';
	},

	openCertificateModal() {
		const canvas = document.getElementById('certificate-canvas');
		let totalStars = 0;
		for (const key in this.state.stars) {
			totalStars += this.state.stars[key];
		}
		Storage.renderCertificate(canvas, this.state.studentName, totalStars, LEVELS.length * 3);
		this.openModal('modal-certificate');
	},

	tutorialStep: 0,

	tutorialSteps: [
		{
			module: "Módulo 1",
			title: "Secuencias y Movimiento",
			badgeColor: "#2563eb",
			desc: "Aprende los fundamentos del control espacial de BIT. Las instrucciones se ejecutan estrictamente en orden descendente, una tras otra.",
			blocks: [
				{ pill: "Avanzar 1 paso", color: "blue", desc: "Desplaza a BIT una baldosa al frente en la dirección que esté mirando." },
				{ pill: "Girar a la derecha / izquierda", color: "blue", desc: "Rota la orientación de BIT 90 grados en el mismo sitio sin avanzar." },
				{ pill: "Saltar 2 pasos", color: "blue", desc: "Propulsa a BIT sobre huecos del circuito espacial para aterrizar en suelo firme." },
				{ pill: "Encender núcleo", color: "green", desc: "Activa el reactor de energía en la baldosa meta para completar la misión." }
			],
			proTip: "Para obtener 3 estrellas, minimiza la cantidad total de bloques usados. Observa la meta óptima en la barra superior antes de ejecutar."
		},
		{
			module: "Módulo 2",
			title: "Bucles y Automatización",
			badgeColor: "#d97706",
			desc: "Los bucles permiten repetir secuencias de código de forma automática, haciendo tus programas mucho más compactos, elegantes y óptimos.",
			blocks: [
				{ pill: "Repetir [N] veces", color: "orange", desc: "Ejecuta todas las instrucciones dentro de su interior la cantidad de veces indicada." },
				{ pill: "Mientras no en núcleo", color: "orange", desc: "Repite continuamente las órdenes hasta que BIT alcanza con éxito la baldosa meta." }
			],
			proTip: "Si detectas que estás colocando bloques idénticos varias veces, empaquétalos dentro de un bucle 'Repetir N veces' para conseguir las 3 estrellas."
		},
		{
			module: "Módulo 3",
			title: "Condicionales y Sensores",
			badgeColor: "#7c3aed",
			desc: "Permite a BIT tomar decisiones inteligentes en tiempo real analizando los peligros y obstáculos del entorno espacial con sus sensores.",
			blocks: [
				{ pill: "Si hay hueco adelante", color: "purple", desc: "Detecta el vacío del espacio al frente. Usa 'Saltar' si es verdadero o 'Avanzar' si no." },
				{ pill: "Si láser está encendido", color: "purple", desc: "Reconoce barreras láser activas. Si está encendido, ejecuta 'Esperar 1 turno' hasta que se apague." },
				{ pill: "Si hay muro adelante", color: "purple", desc: "Detecta paredes del circuito para ordenar un giro oportuno a izquierda o derecha." },
				{ pill: "Esperar 1 turno", color: "purple", desc: "Pone a BIT en reposo durante 1 ciclo sin desplazarse, ideal para esperar ciclos de láser." }
			],
			proTip: "Combina bucles 'Mientras' con condicionales 'Si / si no' para que BIT navegue de forma autónoma cualquier laberinto dinámico."
		},
		{
			module: "Módulo 4",
			title: "Variables y Memoria",
			badgeColor: "#db2777",
			desc: "Las variables son espacios de memoria donde BIT almacena datos dinámicos, como el conteo de baterías recolectadas para desbloquear compuertas.",
			blocks: [
				{ pill: "Recoger batería", color: "blue", desc: "Recolecta una celda energética de la baldosa y suma +1 al contador de energía de BIT." },
				{ pill: "Comprobar compuerta", color: "pink", desc: "Verifica si la energía almacenada en memoria cumple el requisito para abrir la compuerta de seguridad." },
				{ pill: "Cambiar variable en 1", color: "pink", desc: "Incrementa o disminuye el valor de un registro numérico en la memoria del robot." }
			],
			proTip: "Asegúrate de recoger todas las baterías del camino antes de llegar a la compuerta; de lo contrario, el sistema de seguridad impedirá el paso."
		},
		{
			module: "Módulo 5",
			title: "Funciones y Modularidad",
			badgeColor: "#059669",
			desc: "Las funciones te permiten agrupar algoritmos complejos bajo un solo nombre y reutilizarlos tantas veces como desees sin duplicar código.",
			blocks: [
				{ pill: "Definir función [nombre]", color: "green", desc: "Crea una receta o subrutina con los bloques que quieras reutilizar en cualquier momento." },
				{ pill: "Llamar a función [nombre]", color: "green", desc: "Ejecuta instantáneamente la secuencia completa de la función definida con un solo bloque." }
			],
			proTip: "En los niveles finales, definir una función con la maniobra básica (ej. avanzar y saltar) te permitirá resolver circuitos gigantes con la meta óptima de bloques."
		}
	],

	initTutorial() {
		const btnPrev = document.getElementById('btn-tutorial-prev');
		const btnNext = document.getElementById('btn-tutorial-next');
		if (btnPrev) {
			btnPrev.addEventListener('click', () => {
				if (this.tutorialStep > 0) {
					this.tutorialStep--;
					this.renderTutorialStep();
				}
			});
		}
		if (btnNext) {
			btnNext.addEventListener('click', () => {
				if (this.tutorialStep < this.tutorialSteps.length - 1) {
					this.tutorialStep++;
					this.renderTutorialStep();
				} else {
					this.closeModal('modal-tutorial');
				}
			});
		}

		const tabs = document.querySelectorAll('#tutorial-tabs .tab-btn');
		tabs.forEach(tab => {
			tab.addEventListener('click', () => {
				const step = parseInt(tab.dataset.step, 10);
				if (!isNaN(step)) {
					this.tutorialStep = step;
					this.renderTutorialStep();
				}
			});
		});

		const dots = document.querySelectorAll('#tutorial-dots .tutorial-dot');
		dots.forEach((dot, idx) => {
			dot.addEventListener('click', () => {
				this.tutorialStep = idx;
				this.renderTutorialStep();
			});
		});
	},

	openTutorialModal(step) {
		if (typeof step === 'number') {
			this.tutorialStep = step;
		}
		this.renderTutorialStep();
		this.openModal('modal-tutorial');
	},

	renderTutorialStep() {
		const data = this.tutorialSteps[this.tutorialStep];
		if (!data) return;

		const indicator = document.getElementById('tutorial-step-indicator');
		if (indicator) {
			indicator.textContent = `Paso ${this.tutorialStep + 1} de ${this.tutorialSteps.length}`;
		}

		const tabs = document.querySelectorAll('#tutorial-tabs .tab-btn');
		tabs.forEach(tab => {
			const step = parseInt(tab.dataset.step, 10);
			if (step === this.tutorialStep) {
				tab.classList.add('active');
			} else {
				tab.classList.remove('active');
			}
		});

		const dots = document.querySelectorAll('#tutorial-dots .tutorial-dot');
		dots.forEach((dot, idx) => {
			if (idx === this.tutorialStep) {
				dot.classList.add('active');
			} else {
				dot.classList.remove('active');
			}
		});

		const btnPrev = document.getElementById('btn-tutorial-prev');
		const btnNext = document.getElementById('btn-tutorial-next');
		if (btnPrev) {
			btnPrev.disabled = (this.tutorialStep === 0);
			btnPrev.style.opacity = (this.tutorialStep === 0) ? '0.5' : '1';
			btnPrev.style.cursor = (this.tutorialStep === 0) ? 'not-allowed' : 'pointer';
		}
		if (btnNext) {
			if (this.tutorialStep === this.tutorialSteps.length - 1) {
				btnNext.textContent = '¡A programar!';
			} else {
				btnNext.textContent = 'Siguiente';
			}
		}

		const body = document.getElementById('tutorial-body');
		if (!body) return;

		let blocksHtml = '';
		data.blocks.forEach(b => {
			blocksHtml += `<div class="tutorial-block-item"><span class="tutorial-block-pill pill-${b.color}">${b.pill}</span><span class="tutorial-block-desc">${b.desc}</span></div>`;
		});

		body.innerHTML = `
			<div class="tutorial-card">
				<div class="tutorial-card-header">
					<span class="tutorial-badge" style="background-color: ${data.badgeColor}15; color: ${data.badgeColor};">${data.module}</span>
				</div>
				<h4 class="tutorial-card-title">${data.title}</h4>
				<p class="tutorial-card-desc">${data.desc}</p>
				<div class="tutorial-grid-blocks">
					${blocksHtml}
				</div>
				<div class="tutorial-pro-tip">
					<svg class="svg-icon-sm tutorial-pro-tip-icon" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm-2 18c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-1h-4v1z"/></svg>
					<div class="tutorial-pro-tip-text">
						<strong>Consejo Pro:</strong> ${data.proTip}
					</div>
				</div>
			</div>
		`;
	},

	openModal(id) {
		const el = document.getElementById(id);
		if (el) el.classList.add('active');
	},

	closeModal(id) {
		const el = document.getElementById(id);
		if (el) el.classList.remove('active');
	}
};

window.addEventListener('DOMContentLoaded', () => {
	App.init();
});
