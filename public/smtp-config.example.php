<?php
// Copy this file to smtp-config.php and fill in your SMTP settings.
// Then run: composer require phpmailer/phpmailer
// in the public/ directory (or wherever api.php lives on your server).

return [
    'enabled' => false,
    'host' => 'smtp.gmail.com',       // SMTP server
    'port' => 587,                     // 587 for TLS, 465 for SSL
    'encryption' => 'tls',            // 'tls' or 'ssl'
    'username' => 'you@gmail.com',    // SMTP username
    'password' => 'app-password',     // SMTP password (use app password for Gmail)
    'from_email' => 'you@gmail.com',  // From address
    'from_name' => 'AI Thursdays',    // From name
];
