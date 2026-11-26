<?php

declare(strict_types=1);

function startSecureSession(): void
{
	if (session_status() === PHP_SESSION_NONE) {
		$isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
		session_set_cookie_params([
			'lifetime' => 0,
			'path' => '/',
			'secure' => $isHttps,
			'httponly' => true,
			'samesite' => 'Lax',
		]);
		session_start();
	}
}

function jsonResponse(array $payload, int $statusCode = 200): void
{
	http_response_code($statusCode);
	header('Content-Type: application/json; charset=utf-8');
	header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
	echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

function readRequestInput(): array
{
	$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
	if (stripos($contentType, 'application/json') !== false) {
		$raw = file_get_contents('php://input');
		$decoded = json_decode($raw ?: '', true);
		return is_array($decoded) ? $decoded : [];
	}

	if (!empty($_POST)) {
		return $_POST;
	}

	$raw = file_get_contents('php://input');
	if ($raw) {
		$decoded = json_decode($raw, true);
		if (is_array($decoded)) {
			return $decoded;
		}
		$parsed = [];
		parse_str($raw, $parsed);
		if (is_array($parsed)) {
			return $parsed;
		}
	}

	return [];
}

function clearSession(): void
{
	startSecureSession();
	$_SESSION = [];
}

function destroySession(): void
{
	startSecureSession();
	$_SESSION = [];
	if (ini_get('session.use_cookies')) {
		$params = session_get_cookie_params();
		setcookie(
			session_name(),
			'',
			time() - 42000,
			$params['path'],
			$params['domain'],
			$params['secure'],
			$params['httponly']
		);
	}
	session_destroy();
}

function storeSessionUser(array $data): array
{
	startSecureSession();
	$user = [
		'codigoUsuario' => (string) ($data['codigoUsuario'] ?? ''),
		'correoElectronico' => (string) ($data['correoElectronico'] ?? ''),
		'nombreCompleto' => (string) ($data['nombreCompleto'] ?? ''),
		'extensionAvatar' => isset($data['extensionAvatar']) ? (string) $data['extensionAvatar'] : null,
		'nombreTipoUsuario' => isset($data['nombreTipoUsuario']) ? (string) $data['nombreTipoUsuario'] : null,
		'ultimaActualizacion' => isset($data['ultimaActualizacion']) ? (string) $data['ultimaActualizacion'] : null,
	];

	$_SESSION['codigoUsuario'] = $user['codigoUsuario'];
	$_SESSION['correoElectronico'] = $user['correoElectronico'];
	$_SESSION['nombreCompleto'] = $user['nombreCompleto'];
	$_SESSION['extensionAvatar'] = $user['extensionAvatar'];
	$_SESSION['nombreTipoUsuario'] = $user['nombreTipoUsuario'];
	$_SESSION['ultimaActualizacion'] = $user['ultimaActualizacion'];

	session_regenerate_id(true);

	return $user;
}

function getSessionUser(): ?array
{
	startSecureSession();
	if (empty($_SESSION['codigoUsuario'])) {
		return null;
	}

	return [
		'codigoUsuario' => (string) $_SESSION['codigoUsuario'],
		'correoElectronico' => (string) ($_SESSION['correoElectronico'] ?? ''),
		'nombreCompleto' => (string) ($_SESSION['nombreCompleto'] ?? ''),
		'extensionAvatar' => $_SESSION['extensionAvatar'] ?? null,
		'nombreTipoUsuario' => $_SESSION['nombreTipoUsuario'] ?? null,
		'ultimaActualizacion' => $_SESSION['ultimaActualizacion'] ?? null,
	];
}
