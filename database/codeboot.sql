CREATE DATABASE IF NOT EXISTS codeboot
	CHARACTER SET utf8mb4
	COLLATE utf8mb4_unicode_ci;

USE codeboot;

CREATE TABLE IF NOT EXISTS usuarios (
	codigo_usuario VARCHAR(64) NOT NULL,
	correo_electronico VARCHAR(150) NOT NULL,
	nombre_completo VARCHAR(180) NOT NULL,
	extension_avatar VARCHAR(20) NULL,
	nombre_tipo_usuario VARCHAR(60) NULL,
	ultima_actualizacion_api VARCHAR(64) NULL,
	nivel_desbloqueado TINYINT UNSIGNED NOT NULL DEFAULT 0,
	estrellas_totales SMALLINT UNSIGNED NOT NULL DEFAULT 0,
	puntuacion_total INT UNSIGNED NOT NULL DEFAULT 0,
	niveles_completados TINYINT UNSIGNED NOT NULL DEFAULT 0,
	ultimo_acceso TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (codigo_usuario),
	UNIQUE KEY uk_usuarios_correo (correo_electronico)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS progreso_niveles (
	id_progreso INT UNSIGNED NOT NULL AUTO_INCREMENT,
	codigo_usuario VARCHAR(64) NOT NULL,
	nivel_id VARCHAR(10) NOT NULL,
	estrellas TINYINT UNSIGNED NOT NULL DEFAULT 0,
	puntuacion INT UNSIGNED NOT NULL DEFAULT 0,
	bloques_usados SMALLINT UNSIGNED NULL,
	intentos INT UNSIGNED NOT NULL DEFAULT 0,
	completado TINYINT(1) NOT NULL DEFAULT 0,
	workspace_xml MEDIUMTEXT NULL,
	actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id_progreso),
	UNIQUE KEY uk_usuario_nivel (codigo_usuario, nivel_id),
	KEY idx_progreso_usuario_completado (codigo_usuario, completado),
	CONSTRAINT fk_progreso_usuario
		FOREIGN KEY (codigo_usuario)
		REFERENCES usuarios (codigo_usuario)
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tiempos_niveles (
	codigo_usuario VARCHAR(64) NOT NULL,
	nivel_id VARCHAR(10) NOT NULL,
	mejor_tiempo_ms INT UNSIGNED NOT NULL,
	PRIMARY KEY (codigo_usuario, nivel_id),
	CONSTRAINT fk_tiempo_progreso
		FOREIGN KEY (codigo_usuario, nivel_id)
		REFERENCES progreso_niveles (codigo_usuario, nivel_id)
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ejecuciones_niveles (
	codigo_usuario VARCHAR(64) NOT NULL,
	ejecucion_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	nivel_id VARCHAR(10) NOT NULL,
	PRIMARY KEY (codigo_usuario, ejecucion_id),
	CONSTRAINT fk_ejecucion_progreso
		FOREIGN KEY (codigo_usuario, nivel_id)
		REFERENCES progreso_niveles (codigo_usuario, nivel_id)
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salas (
	id_sala INT UNSIGNED NOT NULL AUTO_INCREMENT,
	codigo CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	PRIMARY KEY (id_sala),
	UNIQUE KEY uk_salas_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sala_miembros (
	codigo_usuario VARCHAR(64) NOT NULL,
	id_sala INT UNSIGNED NOT NULL,
	PRIMARY KEY (codigo_usuario),
	KEY idx_miembros_sala (id_sala),
	CONSTRAINT fk_miembros_usuario
		FOREIGN KEY (codigo_usuario)
		REFERENCES usuarios (codigo_usuario)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	CONSTRAINT fk_miembros_sala
		FOREIGN KEY (id_sala)
		REFERENCES salas (id_sala)
		ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
