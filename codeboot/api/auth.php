<?php

declare(strict_types=1);

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/database.php';

function requestCodideepLogin(string $correo, string $contrasenia): array
{
	$config = require __DIR__ . '/config.php';
	$url = $config['codideep']['login_url'];
	$timeout = (int) $config['codideep']['timeout'];

	$formBody = http_build_query([
		'correoElectronico' => $correo,
		'contrasenia' => $contrasenia,
	]);

	$ch = curl_init($url);
	if ($ch === false) {
		throw new RuntimeException('No se pudo inicializar el cliente HTTP.');
	}

	$options = [
		CURLOPT_POST => true,
		CURLOPT_POSTFIELDS => $formBody,
		CURLOPT_RETURNTRANSFER => true,
		CURLOPT_TIMEOUT => $timeout,
		CURLOPT_CONNECTTIMEOUT => 10,
		CURLOPT_HTTPHEADER => [
			'Content-Type: application/x-www-form-urlencoded',
			'Accept: application/json',
		],
	];

	if (defined('CURLSSLOPT_NATIVE_CA')) {
		$options[CURLOPT_SSL_OPTIONS] = CURLSSLOPT_NATIVE_CA;
	}

	curl_setopt_array($ch, $options);
	$rawResponse = curl_exec($ch);
	$curlError = curl_error($ch);
	curl_close($ch);

	if ($rawResponse === false) {
		throw new RuntimeException('Error de conexión con Codideep: ' . $curlError);
	}

	$decoded = json_decode($rawResponse, true);
	return is_array($decoded) ? $decoded : [];
}

function actionLogIn(): void
{
	$input = readRequestInput();
	$correo = trim((string) ($input['correoElectronico'] ?? ''));
	$contrasenia = trim((string) ($input['contrasenia'] ?? ''));

	if ($correo === '' || $contrasenia === '') {
		jsonResponse([
			'success' => false,
			'message' => 'Ingresa tu correo electrónico y contraseña.',
		], 400);
	}

	try {
		$apiResponse = requestCodideepLogin($correo, $contrasenia);
	} catch (Throwable $e) {
		jsonResponse([
			'success' => false,
			'message' => 'No se pudo conectar con el servicio de autenticación de Codideep.',
			'detail' => $e->getMessage(),
		], 502);
	}

	clearSession();

	if (array_key_exists('successMessage', $apiResponse) && isset($apiResponse['data']) && is_array($apiResponse['data'])) {
		$user = storeSessionUser($apiResponse['data']);
		$nombreCompleto = $user['nombreCompleto'];

		$progress = null;
		$dbConnected = false;
		$dbError = null;

		try {
			GameDatabase::upsertUser($user);
			$progress = GameDatabase::loadUserProgress($user['codigoUsuario']);
			$dbConnected = true;
		} catch (Throwable $e) {
			$dbError = $e->getMessage();
		}

		jsonResponse([
			'success' => true,
			'message' => 'Se bienvenido(a) al sistema, ' . $nombreCompleto . ' .',
			'user' => $user,
			'progress' => $progress,
			'dbConnected' => $dbConnected,
			'dbError' => $dbError,
		], 200);
	}

	jsonResponse([
		'success' => false,
		'message' => 'Nombre de usuario y/o contraseña erroneos, intente nuevamente',
	], 401);
}

function actionLogOut(): void
{
	destroySession();

	jsonResponse([
		'success' => true,
		'message' => 'Sesión cerrada correctamente.',
	], 200);
}

function actionSession(): void
{
	$user = getSessionUser();
	if ($user === null) {
		jsonResponse([
			'authenticated' => false,
			'user' => null,
			'progress' => null,
			'dbConnected' => false,
		], 200);
	}

	$progress = null;
	$dbConnected = false;
	$dbError = null;

	try {
		GameDatabase::upsertUser($user);
		$progress = GameDatabase::loadUserProgress($user['codigoUsuario']);
		$dbConnected = true;
	} catch (Throwable $e) {
		$dbError = $e->getMessage();
	}

	jsonResponse([
		'authenticated' => true,
		'user' => $user,
		'progress' => $progress,
		'dbConnected' => $dbConnected,
		'dbError' => $dbError,
	], 200);
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = strtolower(trim((string) ($_GET['action'] ?? '')));

if ($method === 'POST') {
	if ($action === 'logout') {
		actionLogOut();
	}
	actionLogIn();
}

if ($action === 'logout') {
	actionLogOut();
}

actionSession();
