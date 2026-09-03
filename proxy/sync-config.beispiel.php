<?php
/**
 * Vorlage. Die echte Datei heißt sync-config.php, liegt neben sync.php und
 * wird getrennt vom Repository auf den Server übertragen.
 *
 * proxy_token: Derselbe lange Token, den die App bereits für den
 *               Kellersensor verwendet. Er wird als ?token=... übertragen.
 * daten_pfad:   Absoluter Pfad zur kanonischen JSON-Datei. Wenn möglich
 *               außerhalb des öffentlich ausgelieferten Web-Verzeichnisses.
 */
return [
    'proxy_token' => '',
    'daten_pfad'  => dirname(__DIR__, 2) . '/weinbegleiter-sync/sync.json',
];
