const Storage = {
	BASE_KEY: 'codeboot_save_v1',
	activeUserCode: null,

	setActiveUser(codigoUsuario) {
		this.activeUserCode = codigoUsuario ? String(codigoUsuario) : null;
	},

	getStorageKey() {
		return this.activeUserCode ? `${this.BASE_KEY}_${this.activeUserCode}` : this.BASE_KEY;
	},

	getDefaultState() {
		return {
			studentName: '',
			unlockedLevel: 0,
			totalScore: 0,
			stars: {},
			scores: {},
			blocksUsed: {},
			attempts: {},
			bestTimes: {},
			savedWorkspaces: {},
			pendingAttempts: {},
			pendingResults: {},
			pendingImport: null,
			lastUpdated: Date.now()
		};
	},

	normalizeState(raw) {
		const base = this.getDefaultState();
		const merged = {
			...base,
			...(raw || {}),
			stars: { ...(raw && raw.stars ? raw.stars : {}) },
			scores: { ...(raw && raw.scores ? raw.scores : {}) },
			blocksUsed: { ...(raw && raw.blocksUsed ? raw.blocksUsed : {}) },
			attempts: { ...(raw && raw.attempts ? raw.attempts : {}) },
			bestTimes: { ...raw?.bestTimes },
			savedWorkspaces: { ...(raw && raw.savedWorkspaces ? raw.savedWorkspaces : {}) },
			pendingAttempts: { ...raw?.pendingAttempts },
			pendingResults: { ...raw?.pendingResults }
		};
		merged.unlockedLevel = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(Number(merged.unlockedLevel) || 0)));
		const lastCompleted = LEVELS.findLastIndex(level => Number(merged.stars[level.id]) > 0);
		merged.unlockedLevel = Math.max(merged.unlockedLevel, Math.min(lastCompleted + 1, LEVELS.length - 1));
		for (const [levelId, time] of Object.entries(merged.bestTimes)) {
			if (!Number.isInteger(time) || time < 1 || time > 86400000) delete merged.bestTimes[levelId];
		}
		for (const levelId in merged.stars) {
			if (!merged.scores[levelId] && merged.stars[levelId] > 0) {
				const s = merged.stars[levelId];
				merged.scores[levelId] = s === 3 ? 350 : s === 2 ? 200 : 100;
			}
		}
		merged.totalScore = this.getTotalScore(merged);
		return merged;
	},

	load() {
		try {
			const data = localStorage.getItem(this.getStorageKey());
			if (!data) return this.getDefaultState();
			const parsed = JSON.parse(data);
			return this.normalizeState(parsed);
		} catch (e) {
			return this.getDefaultState();
		}
	},

	save(state) {
		try {
			state.totalScore = this.getTotalScore(state);
			state.lastUpdated = Date.now();
			localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
		} catch (e) {}
	},

	hydrateFromRemote(remoteProgress, fallbackName, local = this.getDefaultState()) {
		const mergeRecords = (remote, cached, combine) => {
			const result = { ...remote };
			for (const [id, value] of Object.entries(cached)) {
				result[id] = result[id] == null ? value : combine(result[id], value);
			}
			return result;
		};
		const normalized = this.normalizeState({
			...local,
			studentName: local.studentName || remoteProgress?.studentName || fallbackName || '',
			unlockedLevel: Math.max(local.unlockedLevel, remoteProgress?.unlockedLevel || 0),
			stars: mergeRecords(remoteProgress?.stars, local.stars, Math.max),
			scores: mergeRecords(remoteProgress?.scores, local.scores, Math.max),
			blocksUsed: mergeRecords(remoteProgress?.blocksUsed, local.blocksUsed, Math.min),
			attempts: mergeRecords(remoteProgress?.attempts, local.attempts, Math.max),
			bestTimes: mergeRecords(remoteProgress?.bestTimes, local.bestTimes, Math.min),
			savedWorkspaces: { ...remoteProgress?.savedWorkspaces, ...local.savedWorkspaces }
		});
		this.save(normalized);
		return normalized;
	},

	calculateLevelScore(starsWon, blocksUsed, optimalBlocks) {
		if (starsWon >= 3) {
			const bonus = Math.max(0, (optimalBlocks - blocksUsed) * 25);
			return 350 + bonus;
		}
		if (starsWon === 2) {
			return 200;
		}
		return 100;
	},

	getTotalStars(state) {
		let total = 0;
		if (!state || !state.stars) return 0;
		for (const key in state.stars) {
			total += Number(state.stars[key]) || 0;
		}
		return total;
	},

	getTotalScore(state) {
		let total = 0;
		if (!state || !state.scores) return 0;
		for (const key in state.scores) {
			total += Number(state.scores[key]) || 0;
		}
		return total;
	},

	getCompletedCount(state) {
		if (!state || !state.stars) return 0;
		let count = 0;
		for (const key in state.stars) {
			if (Number(state.stars[key]) > 0) count++;
		}
		return count;
	},

	exportCode(state) {
		try {
			const { pendingAttempts, pendingResults, pendingImport, ...backup } = state;
			const json = JSON.stringify(backup);
			const encoded = btoa(unescape(encodeURIComponent(json)));
			return 'CB1-' + encoded;
		} catch (e) {
			return '';
		}
	},

	importCode(code) {
		if (!code || typeof code !== 'string') {
			throw new Error('El código ingresado está vacío o no es válido.');
		}
		const trimmed = code.trim();
		if (!trimmed.startsWith('CB1-')) {
			throw new Error('El formato del código es inválido. Debe comenzar con "CB1-".');
		}
		const rawBase64 = trimmed.substring(4);
		try {
			const decoded = decodeURIComponent(escape(atob(rawBase64)));
			const state = JSON.parse(decoded);
			if (typeof state.unlockedLevel !== 'number' || typeof state.stars !== 'object') {
				throw new Error('Estructura de datos corrupta.');
			}
			const normalized = this.normalizeState({ ...state, pendingAttempts: {}, pendingResults: {}, pendingImport: null });
			this.save(normalized);
			return normalized;
		} catch (e) {
			throw new Error('No se pudo decodificar el código de respaldo.');
		}
	},

	renderCertificate(canvas, studentName, totalStars, maxStars, totalScore, totalLevels) {
		const ctx = canvas.getContext('2d');
		const w = canvas.width;
		const h = canvas.height;
		const levelsCount = totalLevels || LEVELS.length;

		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, w, h);

		ctx.strokeStyle = '#10b981';
		ctx.lineWidth = 4;
		ctx.strokeRect(16, 16, w - 32, h - 32);

		ctx.strokeStyle = '#e2e8f0';
		ctx.lineWidth = 1.5;
		ctx.strokeRect(24, 24, w - 48, h - 48);

		ctx.fillStyle = '#059669';
		ctx.font = 'bold 12px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('CODEBOOT ACADEMY • CONSTANCIA OFICIAL', w / 2, 58);

		ctx.fillStyle = '#0f172a';
		ctx.font = '800 24px sans-serif';
		ctx.fillText('CONSTANCIA DE FINALIZACIÓN', w / 2, 94);

		ctx.fillStyle = '#475569';
		ctx.font = '13px sans-serif';
		ctx.fillText('Por haber demostrado dominio en Fundamentos de Programación y Pensamiento Computacional', w / 2, 120);

		ctx.fillStyle = '#2563eb';
		ctx.font = '600 13px sans-serif';
		ctx.fillText('Se otorga la presente distinción a:', w / 2, 160);

		const name = studentName && studentName.trim() ? studentName.trim().toUpperCase() : 'ESTUDIANTE DESTACADO';
		ctx.fillStyle = '#0f172a';
		ctx.font = '800 26px sans-serif';
		ctx.fillText(name, w / 2, 198);

		ctx.strokeStyle = '#2563eb';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(w / 2 - 140, 212);
		ctx.lineTo(w / 2 + 140, 212);
		ctx.stroke();

		ctx.fillStyle = '#d97706';
		ctx.font = 'bold 16px sans-serif';
		const scoreSuffix = typeof totalScore === 'number' && totalScore > 0 ? ` • ${totalScore} Puntos` : '';
		ctx.fillText(`Calificación de Eficiencia: ${totalStars} de ${maxStars} Estrellas${scoreSuffix}`, w / 2, 245);

		ctx.fillStyle = '#475569';
		ctx.font = '12px sans-serif';
		ctx.fillText(`Completó con éxito los ${levelsCount} desafíos de CodeBoot.`, w / 2, 275);
		ctx.fillText('Secuencias, Bucles, Condicionales, Variables, Funciones y Matrices', w / 2, 294);

		const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
		ctx.fillStyle = '#64748b';
		ctx.font = '11px sans-serif';
		ctx.fillText(`Fecha de emisión: ${date}`, w / 2, 335);

		ctx.fillStyle = '#10b981';
		ctx.font = 'bold 11px sans-serif';
		ctx.fillText('VERIFICADO POR EL MOTOR CODEBOOT', w / 2, 355);
	}
};
