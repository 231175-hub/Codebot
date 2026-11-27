const AlienPatrols = {
	create(definitions) {
		return definitions.map(({ kind, path }) => ({
			kind,
			path,
			index: 0,
			x: path[0][0],
			y: path[0][1]
		}));
	},

	at(patrols, x, y) {
		return patrols.find(alien => alien.x === x && alien.y === y);
	},

	assertFree(patrols, x, y) {
		if (this.at(patrols, x, y)) {
			throw new Error('Un alien interceptó a BIT. Observa su patrulla antes de cruzar o prueba otro camino.');
		}
	},

	advance(patrols, bot, grid) {
		for (const alien of patrols) {
			const nextIndex = (alien.index + 1) % alien.path.length;
			const [x, y] = alien.path[nextIndex];
			if (![0, 7, 9, 10].includes(grid[y]?.[x])) continue;
			alien.index = nextIndex;
			alien.x = x;
			alien.y = y;
		}
		this.assertFree(patrols, bot.x, bot.y);
	}
};
