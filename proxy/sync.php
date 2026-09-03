<?php
/**
 * Geräteabgleich für den Weinbegleiter.
 *
 * POST nimmt genau den Datenstand ohne Fotos entgegen. Die acht Sammlungen
 * werden über ihre IDs vereinigt. Bei gleicher ID gewinnt zuletztGeaendert;
 * Grabsteine entfernen ältere Datensätze. Der Schreibvorgang ist gesperrt,
 * atomar und behält die letzten zehn vorherigen Fassungen.
 */

// Bewusst ohne strict_types und ohne PHP-8-only-Syntax, damit der Endpunkt
// wie der Kellersensor-Proxy auch unter PHP 7.4 lauffähig bleibt.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Cache-Control: no-store');

function antwort($code, array $daten)
{
    http_response_code($code);
    echo json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    antwort(405, ['fehler' => 'Nur POST ist erlaubt.']);
}

$konfigPfad = __DIR__ . '/sync-config.php';
if (!is_file($konfigPfad)) {
    antwort(500, ['fehler' => 'sync-config.php fehlt.']);
}
$konfig = require $konfigPfad;
if (!is_array($konfig) || empty($konfig['proxy_token']) || empty($konfig['daten_pfad'])) {
    antwort(500, ['fehler' => 'sync-config.php ist unvollständig.']);
}
$gesendetToken = (string) ($_GET['token'] ?? '');
if (!hash_equals((string) $konfig['proxy_token'], $gesendetToken)) {
    antwort(403, ['fehler' => 'Token fehlt oder stimmt nicht.']);
}

$laenge = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
if ($laenge > 5 * 1024 * 1024) {
    antwort(413, ['fehler' => 'Der Datenstand ist größer als 5 MB. Fotos gehören nicht in den Abgleich.']);
}
$roh = file_get_contents('php://input');
if ($roh === false || trim($roh) === '') {
    antwort(400, ['fehler' => 'Der POST-Body ist leer.']);
}
$eingang = json_decode($roh, true);
if (!is_array($eingang)) {
    antwort(400, ['fehler' => 'Der POST-Body enthält kein gültiges JSON-Objekt.']);
}
if (array_key_exists('fotos', $eingang)) {
    antwort(400, ['fehler' => 'Fotos gehören nicht in den Geräteabgleich.']);
}

$sammlungen = ['chargen', 'behaelter', 'messungen', 'ereignisse', 'reminder', 'wiki', 'klima', 'vorrat'];

function pruefeStand(array $stand, array $sammlungen)
{
    if (!isset($stand['version']) || !is_numeric($stand['version']) || !isset($stand['jahrgang']) || !is_numeric($stand['jahrgang']) || !isset($stand['sensor']) || !is_array($stand['sensor'])) {
        throw new RuntimeException('Version, Jahrgang oder Sensor-Konfiguration fehlt.');
    }
    foreach ($sammlungen as $sammlung) {
        if (!isset($stand[$sammlung]) || !is_array($stand[$sammlung])) {
            throw new RuntimeException('Sammlung ' . $sammlung . ' fehlt.');
        }
        foreach ($stand[$sammlung] as $datensatz) {
            if (!is_array($datensatz) || empty($datensatz['id']) || empty($datensatz['zuletztGeaendert'])) {
                throw new RuntimeException('Ein Datensatz in ' . $sammlung . ' hat keine ID oder keinen Änderungszeitpunkt.');
            }
            if (strtotime((string) $datensatz['zuletztGeaendert']) === false) {
                throw new RuntimeException('Ungültiger Änderungszeitpunkt in ' . $sammlung . '.');
            }
        }
    }
    if (empty($stand['sensor']['zuletztGeaendert']) || strtotime((string) $stand['sensor']['zuletztGeaendert']) === false) {
        throw new RuntimeException('Die Sensor-Konfiguration hat keinen gültigen Änderungszeitpunkt.');
    }
    if (isset($stand['geloescht']) && !is_array($stand['geloescht'])) {
        throw new RuntimeException('geloescht ist keine Liste.');
    }
    $erlaubteSammlungen = array_fill_keys($sammlungen, true);
    foreach (($stand['geloescht'] ?? []) as $grabstein) {
        if (!is_array($grabstein) || empty($grabstein['id']) || empty($erlaubteSammlungen[$grabstein['sammlung'] ?? '']) || empty($grabstein['zeit'])) {
            throw new RuntimeException('Ein Grabstein ist unvollständig.');
        }
        if (strtotime((string) $grabstein['zeit']) === false) {
            throw new RuntimeException('Ein Grabstein hat keinen gültigen Zeitpunkt.');
        }
    }
}

function stabilisiere($wert)
{
    if (!is_array($wert)) {
        return $wert;
    }
    if (array_keys($wert) === range(0, count($wert) - 1)) {
        return array_map('stabilisiere', $wert);
    }
    ksort($wert, SORT_STRING);
    foreach ($wert as $schluessel => $inhalt) {
        $wert[$schluessel] = stabilisiere($inhalt);
    }
    return $wert;
}

function rechtsGewinnt(array $links, array $rechts)
{
    $linksZeit = (string) ($links['zuletztGeaendert'] ?? '');
    $rechtsZeit = (string) ($rechts['zuletztGeaendert'] ?? '');
    if ($linksZeit !== $rechtsZeit) {
        return $rechtsZeit > $linksZeit;
    }
    $linksText = json_encode(stabilisiere($links), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $rechtsText = json_encode(stabilisiere($rechts), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return strcmp((string) $rechtsText, (string) $linksText) > 0;
}

function fuehreGrabsteineZusammen(array $links, array $rechts, array $sammlungen)
{
    $erlaubt = array_fill_keys($sammlungen, true);
    $nachSchluessel = [];
    foreach (array_merge($links, $rechts) as $grabstein) {
        if (!is_array($grabstein) || empty($grabstein['id']) || empty($erlaubt[$grabstein['sammlung'] ?? '']) || empty($grabstein['zeit'])) {
            continue;
        }
        if (strtotime((string) $grabstein['zeit']) === false) {
            continue;
        }
        $schluessel = $grabstein['sammlung'] . "\0" . $grabstein['id'];
        if (!isset($nachSchluessel[$schluessel]) || $grabstein['zeit'] > $nachSchluessel[$schluessel]['zeit']) {
            $nachSchluessel[$schluessel] = $grabstein;
        }
    }
    ksort($nachSchluessel, SORT_STRING);
    return array_values($nachSchluessel);
}

function fuehreSammlungZusammen(array $links, array $rechts, $sammlung, array $grabsteine)
{
    $nachId = [];
    foreach (array_merge($links, $rechts) as $datensatz) {
        $id = (string) $datensatz['id'];
        if (!isset($nachId[$id]) || rechtsGewinnt($nachId[$id], $datensatz)) {
            $nachId[$id] = $datensatz;
        }
    }
    foreach ($grabsteine as $grabstein) {
        if ($grabstein['sammlung'] !== $sammlung) {
            continue;
        }
        $id = (string) $grabstein['id'];
        if (isset($nachId[$id]) && $grabstein['zeit'] >= ($nachId[$id]['zuletztGeaendert'] ?? '')) {
            unset($nachId[$id]);
        }
    }
    ksort($nachId, SORT_STRING);
    return array_values($nachId);
}

function fuehreStaendeZusammen(array $kanonisch, array $eingang, array $sammlungen)
{
    if ((int) $kanonisch['jahrgang'] !== (int) $eingang['jahrgang']) {
        throw new RuntimeException('Die Jahrgänge der Datenstände stimmen nicht überein.');
    }
    $ergebnis = $kanonisch;
    $grabsteine = fuehreGrabsteineZusammen($kanonisch['geloescht'] ?? [], $eingang['geloescht'] ?? [], $sammlungen);
    foreach ($sammlungen as $sammlung) {
        $ergebnis[$sammlung] = fuehreSammlungZusammen($kanonisch[$sammlung], $eingang[$sammlung], $sammlung, $grabsteine);
    }
    $ergebnis['sensor'] = rechtsGewinnt($kanonisch['sensor'], $eingang['sensor']) ? $eingang['sensor'] : $kanonisch['sensor'];
    $ergebnis['version'] = max((int) $kanonisch['version'], (int) $eingang['version']);
    $ergebnis['jahrgang'] = (int) $kanonisch['jahrgang'];
    $ergebnis['geloescht'] = $grabsteine;
    return $ergebnis;
}

function schreibeVollstaendig($handle, $inhalt)
{
    $position = 0;
    $laenge = strlen($inhalt);
    while ($position < $laenge) {
        $geschrieben = fwrite($handle, substr($inhalt, $position));
        if ($geschrieben === false || $geschrieben === 0) {
            throw new RuntimeException('Temporäre Datei konnte nicht vollständig geschrieben werden.');
        }
        $position += $geschrieben;
    }
    if (!fflush($handle)) {
        throw new RuntimeException('Temporäre Datei konnte nicht auf den Datenträger geschrieben werden.');
    }
    if (function_exists('fsync')) {
        fsync($handle);
    }
}

try {
    pruefeStand($eingang, $sammlungen);
} catch (Throwable $fehler) {
    antwort(400, ['fehler' => $fehler->getMessage()]);
}

$datenPfad = (string) $konfig['daten_pfad'];
$ordner = dirname($datenPfad);
if (!is_dir($ordner) && !mkdir($ordner, 0700, true) && !is_dir($ordner)) {
    antwort(500, ['fehler' => 'Datenordner konnte nicht angelegt werden.']);
}
$sperrPfad = $datenPfad . '.lock';
$sperre = fopen($sperrPfad, 'c');
if ($sperre === false) {
    antwort(500, ['fehler' => 'Dateisperre konnte nicht geöffnet werden.']);
}
if (!flock($sperre, LOCK_EX)) {
    fclose($sperre);
    antwort(503, ['fehler' => 'Dateisperre konnte nicht gesetzt werden.']);
}

$tempPfad = null;
try {
    if (is_file($datenPfad)) {
        $kanonischRoh = file_get_contents($datenPfad);
        $kanonisch = $kanonischRoh === false ? null : json_decode($kanonischRoh, true);
        if (!is_array($kanonisch)) {
            throw new RuntimeException('Die kanonische JSON-Datei ist beschädigt; sie wurde nicht überschrieben.');
        }
        pruefeStand($kanonisch, $sammlungen);
        $ergebnis = fuehreStaendeZusammen($kanonisch, $eingang, $sammlungen);

        $backup = $ordner . '/sync-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.json';
        if (!copy($datenPfad, $backup)) {
            throw new RuntimeException('Die vorherige Fassung konnte nicht gesichert werden; es wurde nichts geschrieben.');
        }
    } else {
        $ergebnis = $eingang;
        $ergebnis['geloescht'] = fuehreGrabsteineZusammen([], $eingang['geloescht'] ?? [], $sammlungen);
        foreach ($sammlungen as $sammlung) {
            $ergebnis[$sammlung] = fuehreSammlungZusammen([], $eingang[$sammlung], $sammlung, $ergebnis['geloescht']);
        }
    }

    $json = json_encode($ergebnis, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        throw new RuntimeException('Der zusammengeführte Stand konnte nicht als JSON geschrieben werden.');
    }
    $tempPfad = tempnam($ordner, '.sync-temp-');
    if ($tempPfad === false) {
        throw new RuntimeException('Temporäre Datei konnte nicht angelegt werden.');
    }
    $tempHandle = fopen($tempPfad, 'wb');
    if ($tempHandle === false) {
        throw new RuntimeException('Temporäre Datei konnte nicht geöffnet werden.');
    }
    try {
        schreibeVollstaendig($tempHandle, $json . "\n");
    } finally {
        fclose($tempHandle);
    }
    if (!rename($tempPfad, $datenPfad)) {
        throw new RuntimeException('Die neue Fassung konnte nicht atomar übernommen werden.');
    }
    $tempPfad = null;

    $backups = glob($ordner . '/sync-*.json') ?: [];
    rsort($backups, SORT_STRING);
    foreach (array_slice($backups, 10) as $altesBackup) {
        @unlink($altesBackup);
    }
} catch (Throwable $fehler) {
    if ($tempPfad !== null && is_file($tempPfad)) {
        @unlink($tempPfad);
    }
    flock($sperre, LOCK_UN);
    fclose($sperre);
    antwort(500, ['fehler' => $fehler->getMessage()]);
}

flock($sperre, LOCK_UN);
fclose($sperre);
echo json_encode($ergebnis, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
