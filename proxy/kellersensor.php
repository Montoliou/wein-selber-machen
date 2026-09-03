<?php
/**
 * Kellersensor-Proxy für den Weinbegleiter.
 *
 * Warum es diesen Proxy gibt: Die Tuya-Cloud verlangt eine Signatur aus Access ID und
 * Access Secret. Das Secret gibt Zugriff auf ALLE Geräte des Kontos. Die Weinbegleiter-App
 * läuft im Browser — alles, was sie kennt, ist öffentlich lesbar. Das Secret bleibt deshalb
 * hier auf dem Server, und die App bekommt nur zwei Zahlen.
 *
 * Antwort im Erfolgsfall:
 *   { "temperature": 23.7, "humidity": 63, "zeit": "...", "quelle": "tuya", "roh": [...] }
 *
 * In der App unter "Mehr → Kellersensor" einzutragen:
 *   Adapter          Generisches JSON
 *   HTTPS-Endpunkt   https://www.montolio.de/wein/kellersensor.php?token=<TUYA_PROXY_TOKEN>
 *   JSON-Pfad Temp.  temperature
 *   JSON-Pfad Feuchte humidity
 *
 * Zugangsdaten liegen NICHT in dieser Datei, sondern in kellersensor-config.php
 * daneben (nicht im Repo, nicht im Web-Wurzelverzeichnis lesbar machen).
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');   // App und Proxy liegen auf derselben Domain; hilft beim Testen.
header('Cache-Control: no-store');

function raus(int $code, array $daten): never
{
    http_response_code($code);
    echo json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$konfigPfad = __DIR__ . '/kellersensor-config.php';
if (!is_file($konfigPfad)) {
    raus(500, ['fehler' => 'kellersensor-config.php fehlt.']);
}
/** @var array{access_id:string,access_secret:string,device_id:string,region:string,proxy_token:string} $konfig */
$konfig = require $konfigPfad;

// Einfacher Missbrauchsschutz. Kein Geheimnisschutz — der Endpunkt liefert nur zwei Messwerte —,
// sondern Schutz vor fremdem Dauerabruf, der das Tuya-Kontingent aufbraucht.
if (($_GET['token'] ?? '') !== $konfig['proxy_token']) {
    raus(403, ['fehler' => 'Token fehlt oder stimmt nicht.']);
}

// ---------------------------------------------------------------------------
// Zwischenspeicher: Der Sensor misst alle paar Minuten, die App fragt womöglich
// häufiger. 60 Sekunden Cache schonen das Tuya-Kontingent der kostenlosen Stufe.
// ---------------------------------------------------------------------------
$cacheDatei = sys_get_temp_dir() . '/weinbegleiter-kellersensor.json';
$cacheSekunden = 60;
if (is_file($cacheDatei) && (time() - filemtime($cacheDatei)) < $cacheSekunden) {
    $inhalt = file_get_contents($cacheDatei);
    if ($inhalt !== false) {
        echo $inhalt;
        exit;
    }
}

$basis = match ($konfig['region']) {
    'us' => 'https://openapi.tuyaus.com',
    'cn' => 'https://openapi.tuyacn.com',
    'in' => 'https://openapi.tuyain.com',
    default => 'https://openapi.tuyaeu.com',
};

/**
 * Tuya-Signatur. Aufbau laut Tuya-Dokumentation:
 *   stringToSign = METHODE \n SHA256(Body) \n Signatur-Header \n Pfad
 *   sign         = HMAC-SHA256(clientId [+ accessToken] + t + nonce + stringToSign, secret)
 * Ergebnis in GROSSBUCHSTABEN-Hex.
 */
function signiere(string $clientId, string $secret, string $token, string $t, string $nonce, string $methode, string $pfad): string
{
    $stringToSign = $methode . "\n" . hash('sha256', '') . "\n" . "\n" . $pfad;
    $roh = $clientId . $token . $t . $nonce . $stringToSign;
    return strtoupper(hash_hmac('sha256', $roh, $secret));
}

function tuyaAnfrage(string $basis, array $konfig, string $pfad, string $token = ''): array
{
    $t = (string) (int) (microtime(true) * 1000);
    $nonce = bin2hex(random_bytes(8));
    $sign = signiere($konfig['access_id'], $konfig['access_secret'], $token, $t, $nonce, 'GET', $pfad);

    $kopf = [
        'client_id: ' . $konfig['access_id'],
        'sign: ' . $sign,
        't: ' . $t,
        'nonce: ' . $nonce,
        'sign_method: HMAC-SHA256',
    ];
    if ($token !== '') {
        $kopf[] = 'access_token: ' . $token;
    }

    $ch = curl_init($basis . $pfad);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $kopf,
        CURLOPT_TIMEOUT => 10,
    ]);
    $antwort = curl_exec($ch);
    $fehler = curl_error($ch);
    curl_close($ch);

    if ($antwort === false) {
        raus(502, ['fehler' => 'Tuya nicht erreichbar.', 'detail' => $fehler]);
    }
    $daten = json_decode((string) $antwort, true);
    if (!is_array($daten) || ($daten['success'] ?? false) !== true) {
        raus(502, ['fehler' => 'Tuya meldet einen Fehler.', 'antwort' => $daten]);
    }
    return $daten;
}

// 1. Zugriffstoken holen
$tokenAntwort = tuyaAnfrage($basis, $konfig, '/v1.0/token?grant_type=1');
$zugriffstoken = (string) ($tokenAntwort['result']['access_token'] ?? '');
if ($zugriffstoken === '') {
    raus(502, ['fehler' => 'Kein Zugriffstoken erhalten.']);
}

// 2. Gerätestatus abfragen
$statusAntwort = tuyaAnfrage($basis, $konfig, '/v1.0/devices/' . $konfig['device_id'] . '/status', $zugriffstoken);
$roh = $statusAntwort['result'] ?? [];

/**
 * Tuya liefert Temperaturen bei diesen Sensoren als Ganzzahl mit einer Nachkommastelle,
 * also 237 für 23,7 °C. Die Feldnamen unterscheiden sich je nach Gerätemodell, deshalb
 * werden mehrere bekannte Schreibweisen akzeptiert.
 */
$tempCodes = ['va_temperature', 'temp_current', 'temperature'];
$feuchteCodes = ['va_humidity', 'humidity_value', 'humidity'];

$temperatur = null;
$feuchte = null;
foreach ($roh as $eintrag) {
    $code = (string) ($eintrag['code'] ?? '');
    $wert = $eintrag['value'] ?? null;
    if (!is_numeric($wert)) {
        continue;
    }
    if ($temperatur === null && in_array($code, $tempCodes, true)) {
        // Werte über 100 sind sicher skaliert (kein Keller hat 237 °C).
        $temperatur = abs((float) $wert) > 100 ? ((float) $wert) / 10 : (float) $wert;
    }
    if ($feuchte === null && in_array($code, $feuchteCodes, true)) {
        $feuchte = (float) $wert;
    }
}

$ergebnis = [
    'temperature' => $temperatur,
    'humidity' => $feuchte,
    'zeit' => date('c'),
    'quelle' => 'tuya',
    // Rohdaten bleiben drin, solange die Feldnamen dieses Geräts nicht bestätigt sind.
    // Sobald die Zuordnung stimmt, kann dieser Schlüssel entfallen.
    'roh' => $roh,
];

$json = json_encode($ergebnis, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
@file_put_contents($cacheDatei, $json);
echo $json;
