const LEVELS = [
	{
		id: "1.1",
		module: "Secuencias",
		title: "Pasarela Estelar",
		instruction: "Lleva a BIT hasta el núcleo de energía a través de la pasarela y enciéndelo.",
		hint: "BIT necesita avanzar 5 veces en línea recta hacia el este y luego encender el núcleo.",
		maxBlocksFor3Stars: 6,
		availableBlocks: ["avanzar", "encender"],
		start: { x: 1, y: 2, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1],
			[1, 1, 0, 0, 0, 0, 1, 1],
			[1, 0, 0, 0, 0, 0, 2, 1],
			[1, 1, 0, 0, 0, 0, 1, 1],
			[1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "1.2",
		module: "Secuencias",
		title: "La Curva en Escuadra",
		instruction: "Avanza por el pasillo, gira a la izquierda y alcanza el núcleo en la esquina superior.",
		hint: "Avanza 4 pasos, gira a la izquierda, avanza 4 pasos más y activa el reactor.",
		maxBlocksFor3Stars: 10,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "encender"],
		start: { x: 1, y: 5, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1],
			[1, 1, 1, 1, 1, 2, 1],
			[1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 0, 1],
			[1, 0, 0, 0, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "1.3",
		module: "Secuencias",
		title: "El Laberinto en S",
		instruction: "Navega a través del circuito con muros en serpentina hasta el núcleo terminal.",
		hint: "Coordina giros a la derecha e izquierda según el trazado del pasillo.",
		maxBlocksFor3Stars: 18,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "encender"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 0, 0, 1, 1, 1],
			[1, 1, 1, 1, 0, 1, 1, 1],
			[1, 1, 0, 0, 0, 1, 1, 1],
			[1, 1, 0, 1, 1, 1, 1, 1],
			[1, 1, 0, 0, 0, 0, 2, 1],
			[1, 1, 1, 1, 1, 1, 1, 1]
		]
	},
	{
		id: "1.4",
		module: "Secuencias",
		title: "Maniobra del Doble Núcleo",
		instruction: "Activa el núcleo intermedio de paso y luego continúa hasta el núcleo final.",
		hint: "Enciende el primer núcleo al pasar sobre él, gira hacia el sur y llega a la meta final.",
		maxBlocksFor3Stars: 12,
		availableBlocks: ["avanzar", "girar_izq", "girar_der", "encender"],
		start: { x: 1, y: 1, dir: 1 },
		grid: [
			[1, 1, 1, 1, 1, 1, 1, 1],
			[1, 0, 0, 0, 2, 0, 0, 1],
			[1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 0, 1],
			[1, 1, 1, 1, 1, 1, 2, 1],
			[1, 1, 1, 1, 1, 1, 1, 1]
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
			[1, 0, 0, 3, 0, 0, 1, 1],
			[1, 1, 1, 1, 1, 0, 1, 1],
			[1, 1, 1, 1, 1, 3, 1, 1],
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
	}
];
