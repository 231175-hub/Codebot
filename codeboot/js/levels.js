const LEVELS = [
	{
		id: "1.1",
		module: "Secuencias",
		title: "Pasarela Estelar",
		instruction: "Recoge 2 infotrones y enciende el núcleo. Puedes cruzar la pasarela patrullada o tomar el túnel inferior.",
		hint: "Usa «Paso a paso» para observar a Céfiro y la pieza que cae. La pasarela y el túnel inferior tienen dos infotrones cada uno.",
		maxBlocksFor3Stars: 6,
		infotronsRequired: 2,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "esperar", "encender"],
		start: { x: 1, y: 2, dir: 1 },
		exit: { x: 6, y: 2 },
		aliens: [
			{ kind: "orb", path: [[4, 2], [5, 2], [5, 1], [4, 1]] },
			{ kind: "manta", path: [[7, 3], [8, 3], [8, 4], [7, 4]] }
		],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
			[1, 0, 0, 9, 0, 9, 2, 0, 0, 1],
			[1, 0, 0, 1, 8, 1, 0, 0, 0, 1],
			[1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			[1, 0, 1, 1, 1, 1, 0, 0, 0, 1],
			[1, 0, 0, 9, 0, 9, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "1.2",
		module: "Secuencias",
		title: "La Curva en Escuadra",
		instruction: "Combina avances y giros para llegar al núcleo. El corredor central tiene una patrulla.",
		hint: "Para hacer un solo giro, avanza cuatro casillas, gira a la izquierda y avanza otras cuatro hasta el núcleo.",
		maxBlocksFor3Stars: 10,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "encender"],
		start: { x: 1, y: 5, dir: 1 },
		aliens: [{ kind: "stalk", path: [[3, 2], [2, 2], [2, 3], [3, 3]] }],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 2, 0, 0, 1],
			[1, 1, 0, 0, 1, 0, 1, 0, 1],
			[1, 1, 0, 0, 0, 0, 1, 0, 1],
			[1, 1, 1, 0, 1, 0, 1, 0, 1],
			[1, 0, 0, 0, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "1.3",
		module: "Secuencias",
		title: "El Laberinto en S",
		instruction: "Enciende el núcleo al final del laberinto. Puedes seguir la S o cruzar el atajo patrullado.",
		hint: "La ruta en S gira hacia el oeste en la tercera fila. Para ahorrar giros, observa la patrulla y sigue hacia el sur.",
		maxBlocksFor3Stars: 18,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "encender"],
		start: { x: 1, y: 1, dir: 1 },
		aliens: [{ kind: "manta", path: [[4, 3], [4, 4], [5, 4], [5, 3]] }],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 0, 0, 1, 1, 1, 1],
			[1, 1, 1, 1, 0, 1, 1, 1, 1],
			[1, 1, 0, 0, 0, 0, 0, 0, 1],
			[1, 1, 0, 1, 0, 0, 1, 0, 1],
			[1, 1, 0, 0, 0, 0, 2, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "1.4",
		module: "Secuencias",
		title: "Maniobra del Doble Núcleo",
		instruction: "Enciende los dos núcleos. Después del primero puedes seguir por el borde o tomar la bifurcación patrullada.",
		hint: "Activa el primer núcleo al pasar sobre él. Para seguir por el borde, avanza dos casillas antes de girar al sur.",
		maxBlocksFor3Stars: 12,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "encender"],
		start: { x: 1, y: 1, dir: 1 },
		aliens: [{ kind: "orb", path: [[4, 4], [4, 3], [5, 3], [5, 4]] }],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 0, 2, 0, 0, 1, 1],
			[1, 1, 1, 1, 0, 1, 0, 0, 1],
			[1, 1, 1, 1, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 2, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "2.1",
		module: "Bucles",
		title: "El Gran Corredor",
		instruction: "Cruza el pasillo largo con un solo bucle de repetición y enciende el núcleo.",
		hint: "Usa el bloque 'Repetir 7 veces' con un bloque 'Avanzar' en su interior.",
		maxBlocksFor3Stars: 3,
		availableBlocks: ["avanzar", "encender", "repetir"],
		start: { x: 1, y: 2, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
			[1, 0, 0, 0, 0, 0, 0, 0, 2, 1],
			[1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "2.2",
		module: "Bucles",
		title: "El Abismo Abierto",
		instruction: "Usa saltos propulsados para superar las fosas del circuito y orientarte a la meta.",
		hint: "El salto propulsa a BIT dos casillas adelante evitando caer al vacío.",
		maxBlocksFor3Stars: 8,
		availableBlocks: ["avanzar", "saltar", "girar_der", "girar_izq", "encender"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 3, 0, 0, 0, 1],
			[1, 1, 1, 1, 0, 0, 1, 1],
			[1, 1, 1, 1, 3, 3, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1],
			[1, 1, 1, 1, 1, 2, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "2.3",
		module: "Bucles",
		title: "Cadencia de Saltos Rítmicos",
		instruction: "Supera la serie de grietas alternando avances y saltos dentro de un bucle.",
		hint: "Empaqueta la secuencia [Avanzar, Saltar] en un bucle repetido 2 veces.",
		maxBlocksFor3Stars: 5,
		availableBlocks: ["avanzar", "saltar", "encender", "repetir"],
		start: { x: 1, y: 2, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 0, 1, 0, 0, 1, 0, 1, 1],
			[1, 0, 0, 3, 0, 0, 3, 0, 2, 1],
			[1, 1, 0, 1, 0, 0, 1, 0, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "2.4",
		module: "Bucles",
		title: "La Ronda Perimetral",
		instruction: "Recorre el perímetro cuadrado activando los 4 núcleos con un bucle anidado.",
		hint: "Avanza por cada lado, enciende el núcleo de la esquina y gira a la derecha.",
		maxBlocksFor3Stars: 7,
		availableBlocks: ["avanzar", "girar_der", "encender", "repetir"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1],
			[1, 2, 0, 0, 0, 2, 1],
			[1, 0, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 0, 1],
			[1, 2, 0, 0, 0, 2, 1],
			[1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "3.1",
		module: "Condicionales",
		title: "Suelo Irregular Mixto",
		instruction: "Cruza la pasarela utilizando tu sensor para saltar cuando haya hueco y avanzar si está despejado.",
		hint: "Coloca la condición 'Si hay hueco adelante saltar, si no avanzar' dentro de un bucle.",
		maxBlocksFor3Stars: 5,
		availableBlocks: ["avanzar", "saltar", "encender", "repetir", "si_hueco"],
		start: { x: 1, y: 2, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 0, 1, 0, 0, 1, 0, 1, 1],
			[1, 0, 0, 3, 0, 0, 3, 0, 2, 1],
			[1, 1, 0, 1, 0, 0, 1, 0, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "3.2",
		module: "Condicionales",
		title: "Barreras Láser en Serie",
		instruction: "Espera a que los rayos láser se desactiven antes de avanzar por el corredor.",
		hint: "Si el láser está encendido debes esperar, de lo contrario puedes avanzar con seguridad.",
		maxBlocksFor3Stars: 5,
		availableBlocks: ["avanzar", "esperar", "encender", "repetir", "si_laser"],
		start: { x: 1, y: 2, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 0, 1, 0, 1, 0, 1, 1],
			[1, 0, 0, 6, 0, 6, 0, 2, 1],
			[1, 1, 0, 1, 0, 1, 0, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "3.3",
		module: "Condicionales",
		title: "El Laberinto Autónomo",
		instruction: "Guía a BIT hasta el núcleo interior haciendo que doble a la derecha ante cada muro y enciéndelo al llegar.",
		hint: "Usa 'Mientras no en núcleo': si hay muro adelante gira a la derecha, si no avanza. Al salir del bucle, conecta 'Encender núcleo'.",
		maxBlocksFor3Stars: 5,
		availableBlocks: ["avanzar", "girar_der", "girar_izq", "encender", "mientras_no_meta", "si_muro"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 0, 1, 0, 1],
			[1, 0, 1, 1, 2, 1, 0, 1],
			[1, 0, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "3.4",
		module: "Condicionales",
		title: "Pista de Sensores Mixtos",
		instruction: "Supera la pista combinando sensores para esquivar huecos y esperar el paso de láseres.",
		hint: "Evalúa si hay hueco para saltar, y de lo contrario verifica si el láser requiere esperar.",
		maxBlocksFor3Stars: 7,
		availableBlocks: ["avanzar", "saltar", "esperar", "encender", "repetir", "si_hueco", "si_laser"],
		start: { x: 1, y: 2, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
			[1, 0, 0, 3, 0, 6, 0, 3, 2, 1],
			[1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "4.1",
		module: "Variables",
		title: "Acceso de Seguridad Nivel 1",
		instruction: "Recoge la batería de memoria para desbloquear la compuerta de seguridad y acceder al reactor.",
		hint: "Pasa sobre la batería y guárdala en memoria antes de aproximarte a la compuerta rosa.",
		maxBlocksFor3Stars: 10,
		requiredMemory: 1,
		availableBlocks: ["avanzar", "girar_der", "girar_izq", "recoger_memoria", "encender"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 0, 4, 0, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1],
			[1, 1, 1, 1, 1, 5, 1, 1],
			[1, 1, 1, 1, 1, 2, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "4.2",
		module: "Variables",
		title: "Acumulador Trifásico",
		instruction: "Reúne las 3 unidades de energía en memoria para que la compuerta se abra.",
		hint: "Suma +1 a la memoria en cada batería usando un bucle para cumplir el requisito de 3 unidades.",
		maxBlocksFor3Stars: 6,
		requiredMemory: 3,
		availableBlocks: ["avanzar", "sumar_memoria", "encender", "repetir"],
		start: { x: 1, y: 2, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 0, 0, 0, 0, 1, 1, 1],
			[1, 0, 4, 4, 4, 0, 5, 2, 1],
			[1, 1, 0, 0, 0, 0, 1, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "4.3",
		module: "Variables",
		title: "Doble Cámara de Baterías",
		instruction: "Explora las dos salas acumulando 2 baterías antes de cruzar la compuerta hacia el núcleo.",
		hint: "Recoge las 2 baterías sumando memoria para alcanzar el valor necesario en la compuerta.",
		maxBlocksFor3Stars: 10,
		requiredMemory: 2,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "sumar_memoria", "encender", "repetir"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 4, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 4, 1],
			[1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 5, 1],
			[1, 1, 1, 1, 1, 1, 2, 1],
			[1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "4.4",
		module: "Variables",
		title: "La Bóveda Blindada",
		instruction: "Reúne las 4 celdas del circuito exterior para desbloquear la compuerta de la bóveda central.",
		hint: "Recorre el pasillo recogiendo las 4 baterías para desactivar la seguridad interior.",
		maxBlocksFor3Stars: 9,
		requiredMemory: 4,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "sumar_memoria", "encender", "repetir"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 4, 0, 0, 0, 1],
			[1, 0, 1, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 1, 4, 1],
			[1, 4, 1, 0, 2, 1, 0, 1],
			[1, 0, 1, 5, 1, 1, 0, 1],
			[1, 0, 0, 0, 4, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "5.1",
		module: "Funciones",
		title: "Las Tres Torres de Reparación",
		instruction: "Define una función modular para encender cada torre y reutilízala con un bucle.",
		hint: "Crea la función 'Reparar' que avance y encienda, luego invócala 3 veces en un bucle.",
		maxBlocksFor3Stars: 6,
		availableBlocks: ["avanzar", "encender", "repetir", "definir_funcion", "llamar_funcion"],
		start: { x: 1, y: 2, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
			[1, 0, 0, 2, 0, 2, 0, 2, 0, 1],
			[1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "5.2",
		module: "Funciones",
		title: "La Cruz de Energía",
		instruction: "Crea una función para recorrer un brazo de la cruz con retorno al centro e invócala en las 4 direcciones.",
		hint: "La función debe avanzar, encender el núcleo, dar media vuelta y regresar al nodo central.",
		maxBlocksFor3Stars: 11,
		availableBlocks: ["avanzar", "girar_der", "encender", "repetir", "definir_funcion", "llamar_funcion"],
		start: { x: 3, y: 3, dir: 0 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1],
			[1, 1, 1, 2, 1, 1, 1],
			[1, 1, 1, 0, 1, 1, 1],
			[1, 2, 0, 0, 0, 2, 1],
			[1, 1, 1, 0, 1, 1, 1],
			[1, 1, 1, 2, 1, 1, 1],
			[1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "5.3",
		module: "Funciones",
		title: "Puente Modular Doble",
		instruction: "Usa funciones para cruzar los sectores de prueba, recolectar energía y franquear la compuerta.",
		hint: "Encapsula las secuencias compuestas en una función para optimizar el total de bloques.",
		maxBlocksFor3Stars: 10,
		requiredMemory: 1,
		availableBlocks: ["avanzar", "girar_der", "saltar", "encender", "repetir", "sumar_memoria", "definir_funcion", "llamar_funcion"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 3, 0, 4, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 5, 1],
			[1, 1, 1, 1, 1, 1, 1, 2, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "5.4",
		module: "Funciones",
		title: "El Templo del Gran Maestro",
		instruction: "Crea una función maestra para sortear los sectores de prueba y activar la matriz final en ambas alas.",
		hint: "Encapsula la secuencia de avance y salto en una función para reutilizarla en ambos núcleos.",
		maxBlocksFor3Stars: 12,
		availableBlocks: ["avanzar", "girar_der", "girar_izq", "saltar", "encender", "repetir", "definir_funcion", "llamar_funcion"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 3, 2, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 2, 3, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "6.1",
		module: "Matrices",
		title: "Balizas de coordenadas",
		instruction: "Usa las coordenadas de fila y columna para colocar las dos señales de la matriz objetivo.",
		hint: "Cuenta las filas de arriba abajo y las columnas de izquierda a derecha, empezando en 1. Escribe 7 en la fila 1, columna 2, y 4 en la fila 2, columna 3.",
		maxBlocksFor3Stars: 2,
		availableBlocks: ["matriz_escribir"],
		matrix: {
			initial: [[0, 0, 0], [0, 0, 0]],
			target: [[0, 7, 0], [0, 0, 4]]
		}
	},
	{
		id: "6.2",
		module: "Matrices",
		title: "Archivo de señales",
		instruction: "Localiza las tres señales en la matriz fuente y cópialas a las posiciones de la matriz objetivo.",
		hint: "El 6 está en la fuente en (1, 3) y debe ir a (1, 1). Busca el 2 y el 8 del mismo modo. Cada par indica primero la fila y después la columna.",
		maxBlocksFor3Stars: 3,
		availableBlocks: ["matriz_copiar"],
		matrix: {
			initial: [[0, 0, 0], [0, 0, 0]],
			source: [[2, 9, 6], [8, 1, 3]],
			target: [[6, 0, 2], [0, 8, 0]]
		}
	},
	{
		id: "6.3",
		module: "Matrices",
		title: "Cruce de frecuencias",
		instruction: "Llena la segunda fila con 7 y la segunda columna con 5 para reproducir el cruce del objetivo.",
		hint: "Llena primero la fila y luego la columna. Las dos operaciones tocan la celda (2, 2), así que allí queda el valor de la última operación.",
		maxBlocksFor3Stars: 2,
		availableBlocks: ["matriz_llenar_fila", "matriz_llenar_columna", "matriz_escribir"],
		matrix: {
			initial: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
			target: [[0, 5, 0, 0], [7, 5, 7, 7], [0, 5, 0, 0]]
		}
	},
	{
		id: "6.4",
		module: "Matrices",
		title: "Antena transpuesta",
		instruction: "Transpón la matriz fuente de 2 filas y 3 columnas para reconstruir la antena de 3 filas y 2 columnas.",
		hint: "Intercambia la fila y la columna de cada señal. Por ejemplo, copia el 4 de (1, 3) a (3, 1). Repite la regla con las otras cinco celdas.",
		maxBlocksFor3Stars: 6,
		availableBlocks: ["matriz_copiar"],
		matrix: {
			initial: [[0, 0], [0, 0], [0, 0]],
			source: [[2, 8, 4], [7, 1, 5]],
			target: [[2, 7], [8, 1], [4, 5]]
		}
	},
	{
		id: "7.1",
		module: "Microprocesador",
		title: "Primer bocado al circuito",
		instruction: "Reúne 3 infotrones y activa la terminal. El corredor de pistas es corto y tiene una patrulla; el túnel inferior rodea su territorio.",
		hint: "Observa el recorrido del alien antes de doblar hacia la salida. El túnel que sale al sur de BIT también tiene tres cristales.",
		maxBlocksFor3Stars: 6,
		infotronsRequired: 3,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "despejar_frente", "esperar", "repetir", "si_objeto_frente"],
		start: { x: 1, y: 1, dir: 1 },
		aliens: [{ kind: "orb", path: [[7, 1], [6, 1], [6, 2], [7, 2], [8, 2], [8, 1]] }],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 7, 9, 7, 9, 7, 0, 0, 1, 1, 1, 1, 1],
			[1, 0, 7, 1, 7, 1, 9, 0, 0, 1, 1, 1, 1, 1],
			[1, 0, 3, 1, 3, 1, 10, 0, 0, 0, 9, 0, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 9, 0, 0, 0, 0, 9, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "7.2",
		module: "Microprocesador",
		title: "Alerta de gravedad",
		instruction: "Reúne 2 infotrones y llega a la terminal. Puedes cruzar bajo el componente pesado o rodearlo por los túneles.",
		hint: "Para cruzar por arriba, avanza un paso, despeja la pista frontal, espera y cruza. El corredor inferior tiene dos cristales y evita la caída.",
		maxBlocksFor3Stars: 7,
		infotronsRequired: 2,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "despejar_frente", "esperar", "repetir", "si_peligro_arriba", "si_objeto_frente"],
		start: { x: 1, y: 2, dir: 1 },
		aliens: [{ kind: "stalk", path: [[6, 4], [7, 4], [7, 5], [6, 5], [5, 5], [5, 4]] }],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 1, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 7, 9, 9, 10, 0, 0, 0, 0, 0, 0, 1],
			[1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 9, 0, 0, 0, 9, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 9, 0, 0, 0, 0, 0, 9, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "7.3",
		module: "Microprocesador",
		title: "Desprendimiento en cascada",
		instruction: "Reúne 3 infotrones y llega a la terminal. Desvía los componentes pesados para abrir el paso superior o explora el túnel profundo.",
		hint: "Despeja la pista justo delante de BIT para que el componente de arriba ruede hacia el hueco lateral. El corredor inferior tiene tres cristales.",
		maxBlocksFor3Stars: 11,
		infotronsRequired: 3,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "despejar_frente", "esperar", "repetir", "si_objeto_frente"],
		start: { x: 1, y: 3, dir: 1 },
		aliens: [{ kind: "manta", path: [[6, 1], [5, 1], [4, 1], [4, 2], [4, 3], [5, 3], [5, 2], [6, 2], [7, 2], [7, 1]] }],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 8, 9, 9, 0, 0, 1, 1, 1, 1, 1, 1],
			[1, 0, 7, 8, 7, 9, 10, 0, 0, 3, 0, 0, 3, 1],
			[1, 0, 0, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 9, 0, 0, 0, 0, 9, 0, 9, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "7.4",
		module: "Microprocesador",
		title: "El empuje estratégico",
		instruction: "Reúne 2 infotrones y entra en la terminal. Puedes empujar el componente hacia el pozo o rodear el corredor por el sur.",
		hint: "Empuja el bloque desde la izquierda cuando la casilla posterior esté vacía. Caerá por el pozo y podrás continuar.",
		maxBlocksFor3Stars: 7,
		infotronsRequired: 2,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "empujar_frente", "esperar", "repetir", "si_objeto_frente"],
		start: { x: 1, y: 2, dir: 1 },
		aliens: [{ kind: "orb", path: [[7, 1], [8, 1], [8, 2], [7, 2], [6, 2], [6, 1]] }],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 7, 7, 3, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 8, 0, 9, 7, 9, 0, 1, 1, 1, 1, 1, 1],
			[1, 0, 1, 1, 0, 1, 1, 10, 0, 0, 0, 0, 0, 0, 1],
			[1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1],
			[1, 0, 1, 1, 0, 0, 0, 0, 3, 0, 0, 1, 1, 0, 1],
			[1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "7.5",
		module: "Microprocesador",
		title: "Fusión cuántica del electrón",
		instruction: "Transmuta un electrón al dejar caer un componente pesado, recoge 9 infotrones y llega a la terminal. Hay dos cámaras de fusión.",
		hint: "Despeja lateralmente la pista entre el componente y el electrón. Recoge los infotrones de la cámara por filas y vigila la patrulla al acercarte a la salida.",
		maxBlocksFor3Stars: 28,
		infotronsRequired: 9,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "despejar_frente", "esperar", "repetir", "si_objeto_frente"],
		start: { x: 1, y: 1, dir: 1 },
		aliens: [{ kind: "manta", path: [[6, 6], [6, 5], [7, 5], [8, 5], [8, 6], [7, 6]] }],
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 7, 7, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
			[1, 0, 0, 8, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
			[1, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 8, 1, 0, 1],
			[1, 1, 0, 16, 0, 1, 10, 3, 0, 0, 0, 7, 0, 0, 1],
			[1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 16, 0, 1, 1],
			[1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			[1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
		]
	}
];
