class MatrixMission {
	constructor(definition, panel = null) {
		this.definition = definition;
		this.panel = panel;
		this.values = definition.initial.map(row => row.slice());
		this.totalCells = this.values.reduce((total, row) => total + row.length, 0);
		this.finishStep = null;
		if (panel) this.buildPanel();
	}

	reset() {
		this.cancelAnimation();
		this.values = this.definition.initial.map(row => row.slice());
		if (this.panel) this.updatePanel([], null);
	}

	index(value, length, axis, board) {
		if (!Number.isInteger(value) || value < 1 || value > length) {
			throw new Error(`En ${board}, la ${axis} debe estar entre 1 y ${length}.`);
		}
		return value - 1;
	}

	coordinates(matrix, row, column, board) {
		const rowIndex = this.index(row, matrix.length, 'fila', board);
		const columnIndex = this.index(column, matrix[rowIndex].length, 'columna', board);
		return [rowIndex, columnIndex];
	}

	async step(action, [first, second, third, fourth] = []) {
		const { source } = this.definition;
		const work = 'la matriz de trabajo';
		let cells;
		let selectedSource = null;
		let value;

		switch (action) {
			case 'matriz_escribir':
				cells = [this.coordinates(this.values, first, second, work)];
				value = third;
				break;
			case 'matriz_copiar': {
				if (!source) throw new Error('Este nivel no tiene una matriz fuente.');
				selectedSource = this.coordinates(source, first, second, 'la matriz fuente');
				cells = [this.coordinates(this.values, third, fourth, work)];
				const [sourceRow, sourceColumn] = selectedSource;
				value = source[sourceRow][sourceColumn];
				break;
			}
			case 'matriz_llenar_fila': {
				const row = this.index(first, this.values.length, 'fila', work);
				cells = this.values[row].map((_, column) => [row, column]);
				value = second;
				break;
			}
			case 'matriz_llenar_columna': {
				const column = this.index(first, this.values[0].length, 'columna', work);
				cells = this.values.map((_, row) => [row, column]);
				value = second;
				break;
			}
			default:
				throw new Error('Esta instrucción no modifica una matriz.');
		}

		if (!Number.isInteger(value)) throw new Error('La celda necesita un número entero.');
		for (const [row, column] of cells) this.values[row][column] = value;
		if (!this.panel) return;

		this.cancelAnimation();
		this.updatePanel(cells, selectedSource);
		await new Promise(resolve => {
			const timer = setTimeout(() => this.cancelAnimation(), 260);
			this.finishStep = () => {
				clearTimeout(timer);
				this.finishStep = null;
				resolve();
			};
		});
	}

	cancelAnimation() {
		this.finishStep?.();
	}

	matchingCells() {
		return this.values.reduce((total, row, index) => total + row.filter(
			(value, column) => value === this.definition.target[index][column]
		).length, 0);
	}

	isSolved() {
		return this.matchingCells() === this.totalCells;
	}

	buildPanel() {
		const document = this.panel.ownerDocument;
		const boards = document.createElement('div');
		boards.className = 'matrix-boards';
		if (this.definition.source) {
			this.sourceCells = this.addBoard(boards, this.definition.source, 'Matriz fuente', 'source');
		}
		this.workCells = this.addBoard(boards, this.values, 'Matriz de trabajo', 'work');
		this.addBoard(boards, this.definition.target, 'Matriz objetivo', 'target');
		this.progress = document.createElement('p');
		this.progress.className = 'matrix-progress';
		this.progress.setAttribute('role', 'status');
		this.panel.replaceChildren(boards, this.progress);
		this.updatePanel([], null);
	}

	addBoard(boards, values, label, role) {
		const document = this.panel.ownerDocument;
		const table = document.createElement('table');
		table.className = `matrix-board matrix-board--${role}`;
		const caption = table.createCaption();
		caption.textContent = label;
		const dims = document.createElement('span');
		dims.className = 'matrix-dimensions';
		dims.textContent = `${values.length} × ${values[0].length}`;
		caption.append(' ', dims);

		const header = table.createTHead().insertRow();
		const corner = document.createElement('td');
		corner.className = 'matrix-axis';
		corner.textContent = 'F/C';
		corner.setAttribute('aria-label', 'Fila y columna');
		header.append(corner);
		for (let column = 0; column < values[0].length; column++) {
			const cell = document.createElement('th');
			cell.className = 'matrix-axis';
			cell.scope = 'col';
			cell.textContent = column + 1;
			cell.setAttribute('aria-label', `Columna ${column + 1}`);
			header.append(cell);
		}

		const body = table.createTBody();
		const cells = values.map((row, index) => {
			const line = body.insertRow();
			const coordinate = document.createElement('th');
			coordinate.className = 'matrix-axis';
			coordinate.scope = 'row';
			coordinate.textContent = index + 1;
			coordinate.setAttribute('aria-label', `Fila ${index + 1}`);
			line.append(coordinate);
			return row.map(value => {
				const cell = line.insertCell();
				cell.className = 'matrix-cell';
				cell.textContent = value;
				return cell;
			});
		});
		const card = document.createElement('div');
		card.className = 'matrix-board-card';
		card.append(table);
		boards.append(card);
		return cells;
	}

	updatePanel(changes, selectedSource) {
		for (let row = 0; row < this.values.length; row++) {
			for (let column = 0; column < this.values[row].length; column++) {
				const cell = this.workCells[row][column];
				cell.textContent = this.values[row][column];
				cell.classList.toggle('is-changed', changes.some(([r, c]) => row === r && column === c));
			}
		}
		this.lastSourceCell?.classList.remove('is-changed');
		this.lastSourceCell = selectedSource ? this.sourceCells[selectedSource[0]][selectedSource[1]] : null;
		this.lastSourceCell?.classList.add('is-changed');
		const matches = this.matchingCells();
		this.progress.textContent = `${matches} de ${this.totalCells} celdas coinciden con el objetivo`;
		this.progress.classList.toggle('is-solved', matches === this.totalCells);
	}
}

if (typeof module !== 'undefined' && module.exports) module.exports = MatrixMission;
