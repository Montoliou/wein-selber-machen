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

// Bewusst ohne strict_types und ohne PHP-8-Syntax (match, never), damit das Skript
// auch auf aelteren Hostern mit PHP 7.4 laeuft.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');   // App und Proxy liegen auf derselben Domain; hilft beim Testen.
header('Cache-Control: no-store');

function raus($code, array $daten)
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

$logDatei = __DIR__ . '/kellerklima.jsonl';
$logMaxZeilen = 40000;   // rund ein Jahr bei einem Wert alle 15 Minuten

// ---------------------------------------------------------------------------
// Verlaufsabfrage: ?verlauf=1&n=200 liefert die letzten n Messpunkte.
// Damit kann die App (oder ich beim Review) die Kellerkurve zeichnen, ohne
// dass jemand die Rohdatei direkt lesen muss.
// ---------------------------------------------------------------------------
if (isset($_GET['verlauf'])) {
    $anzahl = isset($_GET['n']) ? max(1, min(5000, (int) $_GET['n'])) : 200;
    if (!is_file($logDatei)) {
        raus(200, ['punkte' => [], 'hinweis' => 'Noch keine Aufzeichnung vorhanden.']);
    }
    $zeilen = file($logDatei, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $zeilen = array_slice($zeilen ?: [], -$anzahl);
    $punkte = [];
    foreach ($zeilen as $zeile) {
        $eintrag = json_decode($zeile, true);
        if (is_array($eintrag)) {
            $punkte[] = $eintrag;
        }
    }
    raus(200, ['punkte' => $punkte, 'anzahl' => count($punkte)]);
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

$endpunkte = [
    'eu' => 'https://openapi.tuyaeu.com',
    'us' => 'https://openapi.tuyaus.com',
    'cn' => 'https://openapi.tuyacn.com',
    'in' => 'https://openapi.tuyain.com',
];
$basis = isset($endpunkte[$konfig['region']]) ? $endpunkte[$konfig['region']] : $endpunkte['eu'];

/**
 * Tuya-Signatur. Aufbau laut Tuya-Dokumentation:
 *   stringToSign = METHODE \n SHA256(Body) \n Signatur-Header \n Pfad
 *   sign         = HMAC-SHA256(clientId [+ accessToken] + t + nonce + stringToSign, secret)
 * Ergebnis in GROSSBUCHSTABEN-Hex.
 */
function signiere($clientId, $secret, $token, $t, $nonce, $methode, $pfad)
{
    $stringToSign = $methode . "\n" . hash('sha256', '') . "\n" . "\n" . $pfad;
    $roh = $clientId . $token . $t . $nonce . $stringToSign;
    return strtoupper(hash_hmac('sha256', $roh, $secret));
}

function tuyaAnfrage($basis, array $konfig, $pfad, $token = '')
{
    $t = (string) round(microtime(true) * 1000);
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
$batterieCodes = ['battery_percentage', 'battery_state', 'va_battery'];

$temperatur = null;
$feuchte = null;
$batterie = null;
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
    if ($batterie === null && in_array($code, $batterieCodes, true)) {
        $batterie = (float) $wert;
    }
}

// Feldnamen dieses Geräts am 03.09.2026 am echten Sensor bestätigt:
// va_temperature = 212 für 21,2 °C, va_humidity = 62, battery_percentage = 100.
// Die Rohdaten sind deshalb nicht mehr Teil der Antwort.
$ergebnis = [
    'temperature' => $temperatur,
    'humidity' => $feuchte,
    'battery' => $batterie,
    'zeit' => date('c'),
    'quelle' => 'tuya',
];

$json = json_encode($ergebnis, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
@file_put_contents($cacheDatei, $json);

// ---------------------------------------------------------------------------
// Mitschreiben — nur bei einem echten Abruf, nicht bei Cache-Treffern.
// Dadurch entsteht die lückenlose Kellerkurve, unabhängig davon, ob die App
// geöffnet ist: Ein Cronjob auf dem Mac Mini ruft diesen Endpunkt alle
// 15 Minuten auf und loest damit genau einen Eintrag aus.
// ---------------------------------------------------------------------------
if ($temperatur !== null) {
    $zeile = json_encode([
        't' => $ergebnis['zeit'],
        'temp' => $temperatur,
        'hum' => $feuchte,
        'bat' => $batterie,
    ], JSON_UNESCAPED_SLASHES);
    @file_put_contents($logDatei, $zeile . "\n", FILE_APPEND | LOCK_EX);

    // Selten und billig: nur alle ~500 Schreibvorgänge kürzen.
    if (random_int(1, 500) === 1 && is_file($logDatei)) {
        $alle = file($logDatei, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($alle !== false && count($alle) > $logMaxZeilen) {
            @file_put_contents($logDatei, implode("\n", array_slice($alle, -$logMaxZeilen)) . "\n", LOCK_EX);
        }
    }
}

echo $json;
