const Storage = {
	KEY: 'codeboot_save_v1',

	getDefaultState() {
		return {
			studentName: '',
			unlockedLevel: 0,
			stars: {},
			savedWorkspaces: {},
			lastUpdated: Date.now()
		};
	},

	load() {
		try {
			const data = localStorage.getItem(this.KEY);
			if (!data) return this.getDefaultState();
			const parsed = JSON.parse(data);
			return { ...this.getDefaultState(), ...parsed };
		} catch (e) {
			return this.getDefaultState();
		}
	},

	save(state) {
		try {
			state.lastUpdated = Date.now();
			localStorage.setItem(this.KEY, JSON.stringify(state));
		} catch (e) {}
	},

	exportCode(state) {
		try {
			const json = JSON.stringify(state);
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
			this.save(state);
			return state;
		} catch (e) {
			throw new Error('No se pudo decodificar el código de respaldo.');
		}
	},

	renderCertificate(canvas, studentName, totalStars, maxStars) {
		const ctx = canvas.getContext('2d');
		const w = canvas.width;
		const h = canvas.height;

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
		ctx.fillText(`Calificación de Eficiencia: ${totalStars} de ${maxStars} Estrellas`, w / 2, 245);

		ctx.fillStyle = '#475569';
		ctx.font = '12px sans-serif';
		ctx.fillText('Completó con éxito los 15 desafíos de Secuencias, Bucles, Condicionales, Variables y Funciones.', w / 2, 280);

		const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
		ctx.fillStyle = '#64748b';
		ctx.font = '11px sans-serif';
		ctx.fillText(`Fecha de emisión: ${date}`, w / 2, 335);

		ctx.fillStyle = '#10b981';
		ctx.font = 'bold 11px sans-serif';
		ctx.fillText('VERIFICADO POR EL MOTOR CODEBOOT', w / 2, 355);
	}
};
