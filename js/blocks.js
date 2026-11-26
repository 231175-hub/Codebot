const BlocksManager = {
	initialized: false,
	matrixCommands: {
		matriz_escribir: {
			label: 'Escribir celda',
			tooltip: 'Cambia el valor de una celda de la matriz de trabajo.',
			rows: [[['Fila', 'ROW'], ['Columna', 'COLUMN']], [['Valor', 'VALUE']]],
			preview: ([row, column, value]) => `matriz[${row - 1}][${column - 1}] = ${value};`
		},
		matriz_copiar: {
			label: 'Copiar celda',
			tooltip: 'Lee una celda de la matriz fuente y escribe su valor en la matriz de trabajo.',
			rows: [
				[['Origen · Fila', 'SOURCE_ROW'], ['Col.', 'SOURCE_COLUMN']],
				[['Destino · Fila', 'TARGET_ROW'], ['Col.', 'TARGET_COLUMN']]
			],
			preview: ([sourceRow, sourceColumn, targetRow, targetColumn]) =>
				`matriz[${targetRow - 1}][${targetColumn - 1}] = fuente[${sourceRow - 1}][${sourceColumn - 1}];`
		},
		matriz_llenar_fila: {
			label: 'Llenar fila',
			tooltip: 'Escribe el mismo valor en todas las columnas de una fila.',
			rows: [[['Fila', 'ROW'], ['Valor', 'VALUE']]],
			preview: ([row, value]) => `matriz[${row - 1}].fill(${value});`
		},
		matriz_llenar_columna: {
			label: 'Llenar columna',
			tooltip: 'Escribe el mismo valor en la columna seleccionada de todas las filas.',
			rows: [[['Columna', 'COLUMN'], ['Valor', 'VALUE']]],
			preview: ([column, value], indent) => `for (const fila of matriz) {\n${indent}\tfila[${column - 1}] = ${value};\n${indent}}`
		}
	},

	createUniformLabel(text, minWidth = 175) {
		const label = new Blockly.FieldLabel(text);
		const origGetSize = label.getSize.bind(label);
		label.getSize = function() {
			const size = origGetSize();
			return {
				width: Math.max(size.width, minWidth),
				height: size.height
			};
		};
		return label;
	},

	init() {
		if (this.initialized || typeof Blockly === 'undefined') return;

		if (Blockly.Msg) {
			Blockly.Msg['UNDO'] = 'Deshacer';
			Blockly.Msg['REDO'] = 'Rehacer';
			Blockly.Msg['CLEAN_UP'] = 'Ordenar bloques';
			Blockly.Msg['DUPLICATE_BLOCK'] = 'Duplicar';
			Blockly.Msg['DELETE_BLOCK'] = 'Eliminar bloque';
			Blockly.Msg['DELETE_X_BLOCKS'] = 'Eliminar %1 bloques';
			Blockly.Msg['DELETE_ALL_BLOCKS'] = '¿Eliminar los %1 bloques?';
			Blockly.Msg['ADD_COMMENT'] = 'Añadir comentario';
			Blockly.Msg['REMOVE_COMMENT'] = 'Eliminar comentario';
			Blockly.Msg['DUPLICATE_COMMENT'] = 'Duplicar comentario';
			Blockly.Msg['COLLAPSE_BLOCK'] = 'Colapsar bloque';
			Blockly.Msg['COLLAPSE_ALL'] = 'Colapsar bloques';
			Blockly.Msg['EXPAND_BLOCK'] = 'Expandir bloque';
			Blockly.Msg['EXPAND_ALL'] = 'Expandir bloques';
			Blockly.Msg['DISABLE_BLOCK'] = 'Desactivar bloque';
			Blockly.Msg['ENABLE_BLOCK'] = 'Activar bloque';
			Blockly.Msg['INLINE_INPUTS'] = 'Entradas en línea';
			Blockly.Msg['EXTERNAL_INPUTS'] = 'Entradas externas';
			Blockly.Msg['HELP'] = 'Ayuda';
		}

		if (Blockly.ContextMenuRegistry && Blockly.ContextMenuRegistry.registry) {
			const reg = Blockly.ContextMenuRegistry.registry;
			const overrideItem = (id, textFn) => {
				const item = reg.getItem(id);
				if (item) {
					item.displayText = textFn;
				}
			};

			overrideItem('blockDuplicate', () => 'Duplicar');
			overrideItem('blockComment', (scope) => {
				const b = scope.block;
				return b && b.getCommentIcon && b.getCommentIcon() ? 'Eliminar comentario' : 'Añadir comentario';
			});
			overrideItem('blockInline', (scope) => {
				const b = scope.block;
				return b && b.getInputsInline && b.getInputsInline() ? 'Entradas externas' : 'Entradas en línea';
			});
			overrideItem('blockCollapseExpand', (scope) => {
				const b = scope.block;
				return b && b.isCollapsed && b.isCollapsed() ? 'Expandir bloque' : 'Colapsar bloque';
			});
			overrideItem('blockDisable', (scope) => {
				const b = scope.block;
				return b && b.isEnabled && !b.isEnabled() ? 'Activar bloque' : 'Desactivar bloque';
			});
			overrideItem('blockDelete', (scope) => {
				if (!scope.block) return 'Eliminar bloque';
				const count = scope.block.getDescendants(false).length;
				return count > 1 ? `Eliminar ${count} bloques` : 'Eliminar bloque';
			});
			overrideItem('blockHelp', () => 'Ayuda');
			overrideItem('workspaceUndo', () => 'Deshacer');
			overrideItem('workspaceRedo', () => 'Rehacer');
			overrideItem('workspaceCleanUp', () => 'Ordenar bloques');
			overrideItem('workspaceCollapseHorizontal', () => 'Colapsar bloques');
			overrideItem('workspaceExpandHorizontal', () => 'Expandir bloques');
			overrideItem('workspaceDelete', (scope) => {
				const count = scope.workspace ? scope.workspace.getAllBlocks(false).length : 0;
				return `Eliminar ${count} bloques`;
			});
		}

		Blockly.Blocks['avanzar'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Avanzar 1 paso"));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#2563eb');
				this.setTooltip("Mueve a BIT 1 casilla hacia adelante.");
			}
		};

		Blockly.Blocks['girar_izq'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Girar a la izquierda"));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#2563eb');
				this.setTooltip("Gira a BIT 90 grados a la izquierda sobre su casilla.");
			}
		};

		Blockly.Blocks['girar_der'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Girar a la derecha"));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#2563eb');
				this.setTooltip("Gira a BIT 90 grados a la derecha sobre su casilla.");
			}
		};

		Blockly.Blocks['saltar'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Saltar adelante"));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#2563eb');
				this.setTooltip("Salta 2 casillas hacia adelante, esquivando agujeros o trampas.");
			}
		};

		Blockly.Blocks['encender'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Encender núcleo"));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#10b981');
				this.setTooltip("Enciende el núcleo de energía si BIT está parado en él.");
			}
		};

		Blockly.Blocks['esperar'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Esperar 1 turno"));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#7c3aed');
				this.setTooltip("Pausa a BIT durante un ciclo.");
			}
		};

		Blockly.Blocks['repetir'] = {
			init: function() {
				this.appendDummyInput()
					.appendField("Repetir")
					.appendField(new Blockly.FieldNumber(2, 1, 20), "TIMES")
					.appendField(BlocksManager.createUniformLabel("veces", 65));
				this.appendStatementInput("DO").appendField("hacer");
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#d97706');
				this.setTooltip("Ejecuta el bloque interno el número de veces indicado.");
			}
		};

		Blockly.Blocks['mientras_no_meta'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Mientras no en núcleo"));
				this.appendStatementInput("DO").appendField("hacer");
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#d97706');
				this.setTooltip("Repite las acciones mientras BIT no haya llegado al núcleo.");
			}
		};

		Blockly.Blocks['si_hueco'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Si hay agujero adelante"));
				this.appendStatementInput("DO").appendField("hacer");
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#7c3aed');
				this.setTooltip("Comprueba si la siguiente casilla es un hueco.");
			}
		};

		Blockly.Blocks['si_muro'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Si hay muro adelante"));
				this.appendStatementInput("DO").appendField("hacer");
				this.appendStatementInput("ELSE").appendField("si no");
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#7c3aed');
				this.setTooltip("Ejecuta una acción si hay muro o la alternativa si el camino está libre.");
			}
		};

		Blockly.Blocks['si_laser'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Si láser está encendido"));
				this.appendStatementInput("DO").appendField("hacer");
				this.appendStatementInput("ELSE").appendField("si no");
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#7c3aed');
				this.setTooltip("Evalúa el estado de la barrera láser intermitente.");
			}
		};

		Blockly.Blocks['recoger_memoria'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Guardar batería"));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#db2777');
				this.setTooltip("Recoge el valor del objeto actual y lo almacena en memoria.");
			}
		};

		Blockly.Blocks['sumar_memoria'] = {
			init: function() {
				this.appendDummyInput().appendField(BlocksManager.createUniformLabel("Sumar +1 a memoria"));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#db2777');
				this.setTooltip("Incrementa el contador interno de BIT en 1.");
			}
		};

		Blockly.Blocks['si_memoria_mayor_igual'] = {
			init: function() {
				this.appendDummyInput()
					.appendField("Si memoria >=")
					.appendField(new Blockly.FieldNumber(3, 1, 99), "VAL")
					.appendField(BlocksManager.createUniformLabel("", 40));
				this.appendStatementInput("DO").appendField("hacer");
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#db2777');
				this.setTooltip("Verifica si el valor en memoria alcanza el umbral.");
			}
		};

		Blockly.Blocks['definir_funcion'] = {
			init: function() {
				this.appendDummyInput()
					.appendField("Definir función")
					.appendField(new Blockly.FieldTextInput("MiFuncion"), "NAME");
				this.appendStatementInput("DO").appendField("hacer");
				this.setColour('#10b981');
				this.setTooltip("Agrupa instrucciones en una función reutilizable.");
			}
		};

		Blockly.Blocks['llamar_funcion'] = {
			init: function() {
				this.appendDummyInput()
					.appendField("Ejecutar")
					.appendField(new Blockly.FieldTextInput("MiFuncion"), "NAME")
					.appendField(BlocksManager.createUniformLabel("", 50));
				this.setPreviousStatement(true, null);
				this.setNextStatement(true, null);
				this.setColour('#10b981');
				this.setTooltip("Invoca la función declarada.");
			}
		};
		for (const [type, command] of Object.entries(this.matrixCommands)) {
			Blockly.Blocks[type] = {
				init() {
					this.appendDummyInput().appendField(BlocksManager.createUniformLabel(command.label));
					for (const row of command.rows) {
						const line = this.appendDummyInput();
						for (const [label, field] of row) {
							const number = field === 'VALUE'
								? new Blockly.FieldNumber(0, -99, 99, 1)
								: new Blockly.FieldNumber(1, 1, 9, 1);
							line.appendField(label).appendField(number, field);
						}
					}
					this.setPreviousStatement(true, null);
					this.setNextStatement(true, null);
					this.setColour('#be306e');
					this.setTooltip(command.tooltip);
				}
			};
		}

		this.initialized = true;
	},

	getMatrixArguments(block, command) {
		return command.rows.flat().map(([, field]) => Number(block.getFieldValue(field)));
	},

	generateExecutableCode(workspace) {
		const topBlocks = workspace.getTopBlocks(true);
		let functionsCode = '';
		let mainCode = '';

		for (const block of topBlocks) {
			if (block.type === 'definir_funcion') {
				functionsCode += this.blockToExecutable(block);
			} else {
				mainCode += this.blockToExecutable(block);
			}
		}

		return `async function runProgram(engine, shouldAbort) {\n${functionsCode}\n${mainCode}\n}`;
	},

	blockToExecutable(block) {
		if (!block) return '';
		let code = '';
		const id = block.id;

		switch (block.type) {
			case 'avanzar':
				code = `if (shouldAbort()) return;\nawait engine.step('avanzar', '${id}');\n`;
				break;
			case 'girar_izq':
				code = `if (shouldAbort()) return;\nawait engine.step('girar_izq', '${id}');\n`;
				break;
			case 'girar_der':
				code = `if (shouldAbort()) return;\nawait engine.step('girar_der', '${id}');\n`;
				break;
			case 'saltar':
				code = `if (shouldAbort()) return;\nawait engine.step('saltar', '${id}');\n`;
				break;
			case 'encender':
				code = `if (shouldAbort()) return;\nawait engine.step('encender', '${id}');\n`;
				break;
			case 'esperar':
				code = `if (shouldAbort()) return;\nawait engine.step('esperar', '${id}');\n`;
				break;
			case 'recoger_memoria':
				code = `if (shouldAbort()) return;\nawait engine.step('recoger', '${id}');\n`;
				break;
			case 'sumar_memoria':
				code = `if (shouldAbort()) return;\nawait engine.step('sumar_memoria', '${id}', 1);\n`;
				break;
			case 'repetir': {
				const times = block.getFieldValue('TIMES') || 1;
				const branch = this.blockToExecutable(block.getInputTargetBlock('DO'));
				code = `for (let i = 0; i < ${times}; i++) {\nif (shouldAbort()) return;\n${branch}}\n`;
				break;
			}
			case 'mientras_no_meta': {
				const branch = this.blockToExecutable(block.getInputTargetBlock('DO'));
				code = `let loopGuard = 0;\nwhile (!engine.isAtGoal() && loopGuard++ < 100) {\nif (shouldAbort()) return;\n${branch}}\n`;
				break;
			}
			case 'si_hueco': {
				const branch = this.blockToExecutable(block.getInputTargetBlock('DO'));
				code = `if (engine.checkPitAhead()) {\n${branch}}\n`;
				break;
			}
			case 'si_muro': {
				const branchDo = this.blockToExecutable(block.getInputTargetBlock('DO'));
				const branchElse = this.blockToExecutable(block.getInputTargetBlock('ELSE'));
				code = `if (engine.checkWallAhead()) {\n${branchDo}} else {\n${branchElse}}\n`;
				break;
			}
			case 'si_laser': {
				const branchDo = this.blockToExecutable(block.getInputTargetBlock('DO'));
				const branchElse = this.blockToExecutable(block.getInputTargetBlock('ELSE'));
				code = `if (engine.checkLaserAhead()) {\n${branchDo}} else {\n${branchElse}}\n`;
				break;
			}
			case 'si_memoria_mayor_igual': {
				const val = block.getFieldValue('VAL') || 0;
				const branch = this.blockToExecutable(block.getInputTargetBlock('DO'));
				code = `if (engine.bot.memory >= ${val}) {\n${branch}}\n`;
				break;
			}
			case 'definir_funcion': {
				const name = (block.getFieldValue('NAME') || 'MiFuncion').replace(/[^a-zA-Z0-9_]/g, '_');
				const branch = this.blockToExecutable(block.getInputTargetBlock('DO'));
				return `async function func_${name}() {\n${branch}}\n`;
			}
			case 'llamar_funcion': {
				const name = (block.getFieldValue('NAME') || 'MiFuncion').replace(/[^a-zA-Z0-9_]/g, '_');
				code = `if (shouldAbort()) return;\nif (typeof func_${name} === 'function') await func_${name}();\n`;
				break;
			}
			default: {
				if (!Object.hasOwn(this.matrixCommands, block.type)) break;
				const args = this.getMatrixArguments(block, this.matrixCommands[block.type]);
				code = `if (shouldAbort()) return;\nawait engine.step('${block.type}', ${JSON.stringify(id)}, ${JSON.stringify(args)});\n`;
			}
		}

		const nextBlock = block.getNextBlock();
		if (nextBlock) {
			code += this.blockToExecutable(nextBlock);
		}
		return code;
	},

	generateCleanCode(workspace) {
		const topBlocks = workspace.getTopBlocks(true);
		let output = '';
		for (const block of topBlocks) {
			output += this.blockToCleanCode(block, 0) + '\n';
		}
		return output.trim() || '';
	},

	blockToCleanCode(block, indentLevel) {
		if (!block) return '';
		const indent = '\t'.repeat(indentLevel);
		let line = '';

		switch (block.type) {
			case 'avanzar':
				line = `${indent}avanzar();`;
				break;
			case 'girar_izq':
				line = `${indent}girarIzquierda();`;
				break;
			case 'girar_der':
				line = `${indent}girarDerecha();`;
				break;
			case 'saltar':
				line = `${indent}saltar();`;
				break;
			case 'encender':
				line = `${indent}encenderNucleo();`;
				break;
			case 'esperar':
				line = `${indent}esperar();`;
				break;
			case 'recoger_memoria':
				line = `${indent}memoria = leerBateria();`;
				break;
			case 'sumar_memoria':
				line = `${indent}memoria += 1;`;
				break;
			case 'repetir': {
				const times = block.getFieldValue('TIMES') || 1;
				const branch = this.blockToCleanCode(block.getInputTargetBlock('DO'), indentLevel + 1);
				line = `${indent}for (let i = 0; i < ${times}; i++) {\n${branch}\n${indent}}`;
				break;
			}
			case 'mientras_no_meta': {
				const branch = this.blockToCleanCode(block.getInputTargetBlock('DO'), indentLevel + 1);
				line = `${indent}while (!enNucleo()) {\n${branch}\n${indent}}`;
				break;
			}
			case 'si_hueco': {
				const branch = this.blockToCleanCode(block.getInputTargetBlock('DO'), indentLevel + 1);
				line = `${indent}if (hayHuecoAdelante()) {\n${branch}\n${indent}}`;
				break;
			}
			case 'si_muro': {
				const branchDo = this.blockToCleanCode(block.getInputTargetBlock('DO'), indentLevel + 1);
				const branchElse = this.blockToCleanCode(block.getInputTargetBlock('ELSE'), indentLevel + 1);
				line = `${indent}if (hayMuroAdelante()) {\n${branchDo}\n${indent}} else {\n${branchElse}\n${indent}}`;
				break;
			}
			case 'si_laser': {
				const branchDo = this.blockToCleanCode(block.getInputTargetBlock('DO'), indentLevel + 1);
				const branchElse = this.blockToCleanCode(block.getInputTargetBlock('ELSE'), indentLevel + 1);
				line = `${indent}if (laserActivo()) {\n${branchDo}\n${indent}} else {\n${branchElse}\n${indent}}`;
				break;
			}
			case 'si_memoria_mayor_igual': {
				const val = block.getFieldValue('VAL') || 0;
				const branch = this.blockToCleanCode(block.getInputTargetBlock('DO'), indentLevel + 1);
				line = `${indent}if (memoria >= ${val}) {\n${branch}\n${indent}}`;
				break;
			}
			case 'definir_funcion': {
				const name = block.getFieldValue('NAME') || 'MiFuncion';
				const branch = this.blockToCleanCode(block.getInputTargetBlock('DO'), indentLevel + 1);
				return `${indent}function ${name}() {\n${branch}\n${indent}}\n`;
			}
			case 'llamar_funcion': {
				const name = block.getFieldValue('NAME') || 'MiFuncion';
				line = `${indent}${name}();`;
				break;
			}
			default: {
				if (!Object.hasOwn(this.matrixCommands, block.type)) break;
				const command = this.matrixCommands[block.type];
				line = indent + command.preview(this.getMatrixArguments(block, command), indent);
			}
		}

		const nextBlock = block.getNextBlock();
		if (nextBlock) {
			line += '\n' + this.blockToCleanCode(nextBlock, indentLevel);
		}
		return line;
	},

	createToolboxXml(availableBlocks) {
		let xml = '<xml id="toolbox" style="display: none">';
		for (const blockType of availableBlocks) {
			xml += `<block type="${blockType}"></block>`;
		}
		xml += '</xml>';
		return xml;
	}
};
