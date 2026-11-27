const Auth = {
	AUTH_ENDPOINT: 'api/auth.php',
	PROGRESS_ENDPOINT: 'api/progress.php',
	workspaceTimer: null,

	async requestJson(url, options) {
		const res = await fetch(url, {
			credentials: 'same-origin',
			...options
		});
		const text = await res.text();
		let data = null;
		try {
			data = JSON.parse(text);
		} catch (e) {
			throw new Error('Respuesta inválida del servidor. Asegúrate de ejecutar CodeBoot en un servidor PHP.');
		}
		return { ok: res.ok, status: res.status, data };
	},

	async checkSession() {
		try {
			const { ok, data } = await this.requestJson(`${this.AUTH_ENDPOINT}?action=session`, {
				method: 'GET',
				headers: { 'Accept': 'application/json' }
			});
			if (!ok || !data) {
				return { authenticated: false, user: null, progress: null, dbConnected: false, serverAvailable: true };
			}
			return {
				authenticated: Boolean(data.authenticated),
				user: data.user || null,
				progress: data.progress || null,
				dbConnected: Boolean(data.dbConnected),
				dbError: data.dbError || null,
				serverAvailable: true
			};
		} catch (e) {
			return {
				authenticated: false,
				user: null,
				progress: null,
				dbConnected: false,
				serverAvailable: false
			};
		}
	},

	async login(correoElectronico, contrasenia) {
		const body = new URLSearchParams({
			correoElectronico: (correoElectronico || '').trim(),
			contrasenia: (contrasenia || '').trim()
		});

		const { ok, data } = await this.requestJson(`${this.AUTH_ENDPOINT}?action=login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'Accept': 'application/json'
			},
			body: body.toString()
		});

		if (!ok || !data || !data.success) {
			return {
				success: false,
				message: (data && data.message) || 'Nombre de usuario y/o contraseña erroneos, intente nuevamente'
			};
		}

		return {
			success: true,
			message: data.message || `Se bienvenido(a) al sistema, ${data.user.nombreCompleto} .`,
			user: data.user,
			progress: data.progress || null,
			dbConnected: Boolean(data.dbConnected),
			dbError: data.dbError || null
		};
	},

	async logout() {
		const { data } = await this.requestJson(`${this.AUTH_ENDPOINT}?action=logout`, {
			method: 'POST',
			headers: { 'Accept': 'application/json' }
		});

		return {
			success: Boolean(data && data.success),
			message: (data && data.message) || 'Sesión cerrada correctamente.'
		};
	},

	async saveLevelProgress(payload) {
		try {
			const { ok, data } = await this.requestJson(this.PROGRESS_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=UTF-8',
					'Accept': 'application/json'
				},
				body: JSON.stringify({
					action: 'level',
					...payload
				})
			});
			return ok && data && data.success ? data : null;
		} catch (e) {
			return null;
		}
	},

	async recordAttempt(nivelId, ejecucionId, expectedUserCode) {
		try {
			const { ok, data } = await this.requestJson(this.PROGRESS_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=UTF-8',
					'Accept': 'application/json'
				},
				body: JSON.stringify({
					action: 'attempt',
					nivelId,
					ejecucionId,
					expectedUserCode
				})
			});
			return ok && data && data.success ? data : null;
		} catch (e) {
			return null;
		}
	},

	saveWorkspaceDebounced(nivelId, workspaceXml) {
		if (this.workspaceTimer) {
			clearTimeout(this.workspaceTimer);
		}
		this.workspaceTimer = setTimeout(() => {
			this.workspaceTimer = null;
			this.saveWorkspace(nivelId, workspaceXml);
		}, 800);
	},

	async saveWorkspace(nivelId, workspaceXml) {
		try {
			await this.requestJson(this.PROGRESS_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=UTF-8',
					'Accept': 'application/json'
				},
				body: JSON.stringify({
					action: 'workspace',
					nivelId,
					workspaceXml
				})
			});
		} catch (e) {}
	},

	async syncFullProgress(state, expectedUserCode) {
		try {
			const { ok, data } = await this.requestJson(this.PROGRESS_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=UTF-8',
					'Accept': 'application/json'
				},
				body: JSON.stringify({
					action: 'sync',
					expectedUserCode,
					unlockedLevel: state.unlockedLevel,
					stars: state.stars,
					scores: state.scores,
					blocksUsed: state.blocksUsed,
					attempts: state.attempts,
					bestTimes: state.bestTimes,
					savedWorkspaces: state.savedWorkspaces
				})
			});
			return ok && data && data.success ? data : null;
		} catch (e) {
			return null;
		}
	},

	getInitials(nombreCompleto) {
		if (!nombreCompleto || typeof nombreCompleto !== 'string') return 'U';
		const parts = nombreCompleto.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return 'U';
		if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
};
