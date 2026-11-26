const Social = {
	pollInterval: 10000,
	endpoint: 'api/rooms.php',
	medals: {
		diamante: 'Diamante',
		oro: 'Oro',
		plata: 'Plata',
		cobre: 'Cobre'
	},
	roomMessages: {
		create: 'Sala creada.',
		join: 'Ya formas parte de la sala.',
		leave: 'Saliste de la sala.'
	},
	session: null,
	room: null,
	scope: 'global',
	visible: false,
	pollTimer: null,
	scoreRequest: null,
	scoreSignature: null,
	busy: false,

	init(callbacks) {
		this.callbacks = callbacks;
		this.dialog = this.element('room-dialog');
		this.scopeButtons = document.querySelectorAll('[data-score-scope]');

		document.addEventListener('visibilitychange', () => this.updatePolling());
		for (const button of this.scopeButtons) {
			button.addEventListener('click', () => this.selectScope(button.dataset.scoreScope));
		}
		this.element('btn-jump-leaderboard').addEventListener('click', () => {
			this.element('map-leaderboard').scrollIntoView({ block: 'start' });
			this.element('map-leaderboard-title').focus({ preventScroll: true });
		});
		for (const id of ['btn-open-room', 'btn-score-login']) {
			this.element(id).addEventListener('click', () => this.openDialog());
		}
		this.element('room-login-form').addEventListener('submit', event => {
			event.preventDefault();
			this.authenticate();
		});
		this.element('btn-room-logout').addEventListener('click', () => this.authenticate(true));
		this.element('btn-room-create').addEventListener('click', () => this.changeRoom('create'));
		this.element('room-join-form').addEventListener('submit', event => {
			event.preventDefault();
			const code = this.element('room-join-code').value.trim().toUpperCase();
			if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
				this.showFeedback('Ingresa los 8 caracteres del código de sala.', true);
				return;
			}
			this.changeRoom('join', code);
		});
		this.element('btn-room-leave').addEventListener('click', () => this.changeRoom('leave'));
		this.element('btn-room-copy').addEventListener('click', () => this.copyCode());
	},

	element(id) {
		return document.getElementById(id);
	},

	get connected() {
		return Boolean(this.session?.authenticated && this.session.dbConnected);
	},

	setSession(session) {
		const sameUser = this.session?.user?.codigoUsuario === session.user?.codigoUsuario;
		const wasConnected = this.connected;
		this.session = session;
		if (!sameUser || wasConnected !== this.connected) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
			this.cancelScoreRequest();
			this.room = null;
			this.scope = 'global';
			this.scoreSignature = null;
			this.element('leaderboard-rows').replaceChildren();
			this.element('leaderboard-table').hidden = true;
			this.element('leaderboard-note').hidden = true;
		}

		this.renderRoom();
		this.element('btn-score-login').hidden = session.authenticated;
		if (!this.connected) {
			this.element('leaderboard-table').hidden = true;
			this.element('leaderboard-note').hidden = true;
			const message = session.authenticated
				? 'La clasificación no está disponible en este momento.'
				: 'Inicia sesión para ver el Top 10 y entrar a una sala.';
			this.showScoreState(message);
		}
		this.updatePolling();
	},

	setVisible(visible) {
		this.visible = visible;
		this.updatePolling();
	},

	updatePolling() {
		const canPoll = this.visible && !document.hidden && this.connected;
		if (!canPoll) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
			this.cancelScoreRequest();
			return;
		}
		if (this.pollTimer === null) {
			this.pollTimer = setInterval(() => this.loadScores(), this.pollInterval);
			this.loadScores();
		}
	},

	cancelScoreRequest() {
		this.scoreRequest?.abort();
		this.scoreRequest = null;
	},

	selectScope(scope) {
		if (scope === this.scope || (scope === 'room' && !this.room)) return;
		this.cancelScoreRequest();
		this.scope = scope;
		this.scoreSignature = null;
		this.element('leaderboard-table').hidden = true;
		this.element('leaderboard-note').hidden = true;
		this.renderRoom();
		this.loadScores();
	},

	async loadScores() {
		if (this.pollTimer === null || this.busy || this.scoreRequest) return;
		const request = new AbortController();
		this.scoreRequest = request;
		if (this.scoreSignature === null) this.showScoreState('Cargando clasificación…');

		try {
			const { ok, status, data } = await Auth.requestJson(`${this.endpoint}?scope=${this.scope}`, {
				headers: { Accept: 'application/json' },
				signal: request.signal
			});
			if (request.signal.aborted) return;
			if (status === 401) {
				this.callbacks.onSessionExpired();
				this.showScoreState('Tu sesión venció. Inicia sesión para ver la clasificación.');
				return;
			}
			if (!ok || !data?.success) throw new Error();
			this.room = data.room;
			if (this.scope === 'room' && !this.room) {
				this.selectScope('global');
				return;
			}
			this.renderRoom();
			this.renderScores(data.leaderboard);
		} catch (error) {
			if (!request.signal.aborted) this.showScoreState('No se pudo actualizar la clasificación. Volveremos a intentarlo.');
		} finally {
			if (this.scoreRequest === request) this.scoreRequest = null;
		}
	},

	renderScores(scores) {
		const signature = JSON.stringify(scores);
		if (this.scoreSignature !== signature) {
			const template = this.element('leaderboard-row');
			const rows = document.createDocumentFragment();
			scores.slice(0, 10).forEach((score, index) => {
				const row = template.content.firstElementChild.cloneNode(true);
				row.querySelector('.leaderboard-place').textContent = index + 1;
				const playerName = row.querySelector('.leaderboard-name');
				playerName.textContent = score.isSelf ? `${score.name} (Tú)` : score.name;
				playerName.title = playerName.textContent;
				row.classList.toggle('is-self', score.isSelf);
				const medalId = Object.hasOwn(this.medals, score.medal) ? score.medal : 'cobre';
				const medal = row.querySelector('.leaderboard-medal');
				medal.dataset.medal = medalId;
				medal.querySelector('.leaderboard-medal-name').textContent = this.medals[medalId];
				medal.title = `${this.medals[medalId]} · ${score.attempts} ${score.attempts === 1 ? 'intento' : 'intentos'}`;
				row.querySelector('.leaderboard-stars').textContent = score.stars;
				row.querySelector('.leaderboard-levels').textContent = `${score.completedLevels}/${LEVELS.length}`;
				const timeCell = row.querySelector('.leaderboard-time');
				timeCell.textContent = this.formatTime(score.timeMs);
				if (score.timeMs == null) {
					timeCell.title = 'Sin tiempo registrado para todos los niveles completados';
					timeCell.setAttribute('aria-label', timeCell.title);
				}
				rows.append(row);
			});
			this.element('leaderboard-rows').replaceChildren(rows);
			this.scoreSignature = signature;
		}

		this.element('leaderboard-table').hidden = scores.length === 0;
		this.element('leaderboard-note').hidden = false;
		this.showScoreState(scores.length ? '' : 'Aún no hay resultados.');
	},

	formatTime(timeMs) {
		if (timeMs == null) return '—';
		const seconds = Math.floor(timeMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const secondText = String(seconds % 60).padStart(2, '0');
		if (minutes < 60) return `${minutes}:${secondText}`;
		return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${secondText}`;
	},

	showScoreState(message) {
		const state = this.element('leaderboard-state');
		if (state.textContent !== message) state.textContent = message;
		state.hidden = !message;
	},

	openDialog() {
		this.showFeedback('');
		this.renderRoom();
		this.dialog.showModal();
		if (!this.session?.authenticated && this.session) this.element('room-login-email').focus();
	},

	renderRoom() {
		const signedIn = Boolean(this.session?.authenticated);
		const canUseRooms = this.connected;
		const room = this.room;
		const roomCount = room ? `${room.memberCount}/${room.capacity} personas` : '';
		const codeInput = this.element('room-share-code');

		this.element('room-login-form').hidden = !this.session || signedIn;
		this.element('room-session-panel').hidden = !signedIn;
		this.element('room-join-panel').hidden = !canUseRooms || Boolean(room);
		this.element('room-member-panel').hidden = !canUseRooms || !room;
		this.element('room-unavailable').hidden = canUseRooms;
		this.element('room-user').textContent = this.session?.user?.nombreCompleto || '';
		if (codeInput.value !== (room?.code || '')) codeInput.value = room?.code || '';
		this.element('room-member-count').textContent = roomCount;

		this.element('leaderboard-scopes').hidden = !canUseRooms;
		const summary = this.element('leaderboard-room-summary');
		summary.hidden = !room;
		summary.textContent = room ? `Sala ${room.code} · ${roomCount}` : '';
		for (const button of this.scopeButtons) {
			button.setAttribute('aria-pressed', String(button.dataset.scoreScope === this.scope));
			button.disabled = button.dataset.scoreScope === 'room' && !room;
		}
		if (!this.session) this.showFeedback('Comprobando tu sesión…');
	},

	async authenticate(signOut = false) {
		if (this.busy) return;
		this.setBusy(true);
		this.showFeedback(signOut ? 'Cerrando sesión…' : 'Iniciando sesión…');
		const email = this.element('room-login-email');
		const password = this.element('room-login-password');
		let result;
		try {
			result = signOut ? await this.callbacks.onLogout() : await this.callbacks.onLogin(email.value, password.value);
			if (result.success) {
				this.showFeedback('');
			} else {
				this.showFeedback(result.message || 'No se pudo completar la solicitud.', true);
			}
		} catch (error) {
			this.showFeedback('No se pudo conectar con el servidor. Vuelve a intentarlo.', true);
		} finally {
			password.value = '';
			this.setBusy(false);
			this.loadScores();
		}
		if (result?.success && this.dialog.open) {
			this.element(signOut ? 'room-login-email' : 'room-title').focus();
		}
	},

	async changeRoom(action, code) {
		if (this.busy || !this.connected) return;
		this.setBusy(true);
		this.cancelScoreRequest();
		this.showFeedback('Guardando…');
		let changed = false;
		try {
			const { ok, data } = await Auth.requestJson(this.endpoint, {
				method: 'POST',
				headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, code })
			});
			if (!ok || !data?.success) {
				this.showFeedback(data?.message || 'No se pudo actualizar la sala.', true);
				return;
			}
			this.room = data.room;
			this.element('room-join-code').value = '';
			this.selectScope(this.room ? 'room' : 'global');
			this.renderRoom();
			this.showFeedback(this.roomMessages[action]);
			changed = true;
		} catch (error) {
			this.showFeedback('No se pudo conectar con el servidor. Vuelve a intentarlo.', true);
		} finally {
			this.setBusy(false);
			this.loadScores();
		}
		if (changed && this.dialog.open) this.element(this.room ? 'btn-room-copy' : 'btn-room-create').focus();
	},

	async copyCode() {
		const input = this.element('room-share-code');
		try {
			await navigator.clipboard.writeText(input.value);
			this.showFeedback('Código copiado.');
		} catch (error) {
			input.focus();
			input.select();
			this.showFeedback('Seleccionamos el código para que puedas copiarlo.');
		}
	},

	setBusy(busy) {
		this.busy = busy;
		for (const id of ['btn-room-login', 'btn-room-logout', 'btn-room-create', 'btn-room-join', 'btn-room-leave']) {
			this.element(id).disabled = busy;
		}
	},

	showFeedback(message, isError = false) {
		const feedback = this.element('room-feedback');
		feedback.textContent = message;
		feedback.dataset.error = String(isError);
	}
};
