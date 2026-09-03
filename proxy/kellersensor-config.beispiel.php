<?php
/**
 * Vorlage. Echte Datei heißt kellersensor-config.php, liegt daneben und
 * gehört NICHT ins Repo — sie steht in .gitignore.
 *
 * access_id / access_secret: iot.tuya.com → Cloud → dein Projekt → Overview
 * device_id:                 aus der Smart-Life-App, Geräteseite → Einstellungen
 * region:                    eu (Central Europe), sonst us / cn / in
 * proxy_token:               frei erfundene lange Zeichenfolge, kommt in die URL
 */
return [
    'access_id'     => '',
    'access_secret' => '',
    'device_id'     => 'bfae48a133806de206k5a7',
    'region'        => 'eu',
    'proxy_token'   => '',
];
