<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$dataFile = $dataDir . '/db.json';

function loadData() {
    global $dataFile;
    if (!file_exists($dataFile)) {
        return ['members' => [], 'ideas' => [], 'comments' => [], 'votes' => [], 'notifications' => [], 'next_id' => 1];
    }
    $data = json_decode(file_get_contents($dataFile), true);
    if (!isset($data['notifications'])) $data['notifications'] = [];
    return $data;
}

function saveData($data) {
    global $dataFile;
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
}

function nextId(&$data) {
    $id = $data['next_id'];
    $data['next_id']++;
    return $id;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function getMemberName($members, $id) {
    foreach ($members as $m) {
        if ($m['id'] === $id) return $m['name'];
    }
    return null;
}

function resolveAssignees($idea, $members) {
    // Normalize assigned_to to always be an array
    $ids = $idea['assigned_to'] ?? [];
    if (!is_array($ids)) {
        $ids = $ids ? [$ids] : [];
    }
    $idea['assigned_to'] = $ids;

    $names = [];
    foreach ($ids as $id) {
        $name = getMemberName($members, $id);
        if ($name) $names[] = $name;
    }
    $idea['assigned_to_names'] = $names;
    // Keep backward compat for simple display
    $idea['assigned_to_name'] = $names ? implode(', ', $names) : null;
    return $idea;
}

function createNotification(&$data, $memberId, $type, $message, $ideaId = null) {
    $notif = [
        'id' => nextId($data),
        'member_id' => (int)$memberId,
        'type' => $type,
        'message' => $message,
        'idea_id' => $ideaId,
        'read' => false,
        'created_at' => date('Y-m-d H:i:s'),
    ];
    $data['notifications'][] = $notif;
    // Try to send email
    sendNotificationEmail($data, $memberId, $message);
    return $notif;
}

function loadSmtpConfig() {
    static $config = null;
    if ($config === null) {
        $configFile = __DIR__ . '/smtp-config.php';
        if (!file_exists($configFile)) return null;
        $config = require $configFile;
    }
    return $config;
}

function sendNotificationEmail($data, $memberId, $message) {
    $config = loadSmtpConfig();
    if (!$config || empty($config['enabled'])) return;

    $email = null;
    foreach ($data['members'] as $m) {
        if ($m['id'] === (int)$memberId && !empty($m['email'])) {
            $email = $m['email'];
            break;
        }
    }
    if (!$email) return;

    $host = $config['host'];
    $port = $config['port'] ?? 587;
    $user = $config['username'];
    $pass = $config['password'];
    $from = $config['from_email'];
    $fromName = $config['from_name'] ?? 'AI Thursdays';
    $subject = 'Idle Tuesday on Thursdays';

    try {
        $sock = @fsockopen($host, $port, $errno, $errstr, 10);
        if (!$sock) return;

        $read = function() use ($sock) { return trim(fgets($sock, 512)); };
        $send = function($cmd) use ($sock, $read) {
            fwrite($sock, $cmd . "\r\n");
            return $read();
        };

        $read();
        $send("EHLO localhost");
        stream_set_timeout($sock, 2);
        while ($line = fgets($sock, 512)) {
            if (substr(trim($line), 3, 1) === ' ') break;
        }

        $send("STARTTLS");
        stream_set_blocking($sock, true);
        if (!@stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($sock); return; }

        $send("EHLO localhost");
        while ($line = fgets($sock, 512)) {
            if (substr(trim($line), 3, 1) === ' ') break;
        }

        $send("AUTH LOGIN");
        $send(base64_encode($user));
        $resp = $send(base64_encode($pass));
        if (substr($resp, 0, 3) !== '235') { fclose($sock); return; }

        $send("MAIL FROM:<$from>");
        $send("RCPT TO:<$email>");
        $send("DATA");

        $body = "From: $fromName <$from>\r\n";
        $body .= "To: $email\r\n";
        $body .= "Subject: $subject\r\n";
        $body .= "MIME-Version: 1.0\r\n";
        $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $body .= "\r\n";
        $body .= str_replace("\n.", "\n..", $message);

        $send($body . "\r\n.");
        $send("QUIT");
        fclose($sock);
    } catch (\Exception $e) {
        // Silently fail
    }
}

$route = $_GET['route'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// Honeypot: if the hidden "website" field has a value, it's a bot
if (!empty($body['website'])) {
    jsonResponse(['ok' => true]);
}

$data = loadData();

// Migration v3: force-set emails, avatars, and rename Sascha -> Sasch
if (empty($data['_migrated_v3'])) {
    $nameMap = [
        'sascha' => 'Sasch',
    ];
    $profileMap = [
        'dan'  => ['email' => 'daneel@pros.co.za',       'avatar' => 'dan.svg'],
        'lion' => ['email' => 'Lionel.moyal@gmail.com',   'avatar' => 'lion.svg'],
        'migs' => ['email' => 'migalvanas@gmail.com',     'avatar' => 'migs.svg'],
        'ben'  => ['email' => 'vorsterben@gmail.com',     'avatar' => 'ben.svg'],
        'sasc' => ['email' => 'saschaeh@gmail.com',       'avatar' => 'sasch.svg'],
    ];
    foreach ($data['members'] as &$member) {
        $lower = strtolower($member['name']);
        // Rename
        if (isset($nameMap[$lower])) {
            $member['name'] = $nameMap[$lower];
            $lower = strtolower($member['name']);
        }
        // Match by first 4 chars, then 3
        $key = substr($lower, 0, 4);
        if (!isset($profileMap[$key])) $key = substr($lower, 0, 3);
        if (isset($profileMap[$key])) {
            $member['email'] = $profileMap[$key]['email'];
            $member['avatar'] = $profileMap[$key]['avatar'];
        }
    }
    unset($member);
    $data['_migrated_v3'] = true;
    saveData($data);
}

// Route: /members
if ($route === '/members') {
    if ($method === 'GET') {
        $members = $data['members'];
        usort($members, fn($a, $b) => strcasecmp($a['name'], $b['name']));
        jsonResponse($members);
    }
    if ($method === 'POST') {
        $name = trim($body['name'] ?? '');
        if (!$name) jsonResponse(['error' => 'Name is required'], 400);

        foreach ($data['members'] as $m) {
            if (strcasecmp($m['name'], $name) === 0) jsonResponse($m);
        }

        $member = ['id' => nextId($data), 'name' => $name, 'email' => trim($body['email'] ?? ''), 'avatar' => '', 'created_at' => date('Y-m-d H:i:s')];
        $data['members'][] = $member;
        saveData($data);
        jsonResponse($member);
    }
}

// Route: /ideas
if ($route === '/ideas') {
    if ($method === 'GET') {
        $result = [];
        foreach ($data['ideas'] as $idea) {
            $idea['submitted_by_name'] = getMemberName($data['members'], $idea['submitted_by']);
            $idea = resolveAssignees($idea, $data['members']);
            $idea['vote_count'] = count(array_filter($data['votes'], fn($v) => $v['idea_id'] === $idea['id']));
            $idea['comment_count'] = count(array_filter($data['comments'], fn($c) => $c['idea_id'] === $idea['id']));
            $result[] = $idea;
        }
        usort($result, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));
        jsonResponse($result);
    }
    if ($method === 'POST') {
        $title = trim($body['title'] ?? '');
        if (!$title) jsonResponse(['error' => 'Title is required'], 400);

        $idea = [
            'id' => nextId($data),
            'title' => $title,
            'description' => $body['description'] ?? '',
            'category' => $body['category'] ?? 'General',
            'status' => 'new',
            'submitted_by' => $body['submitted_by'] ?? null,
            'assigned_to' => [],
            'target_date' => null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        $data['ideas'][] = $idea;
        saveData($data);
        jsonResponse($idea);
    }
}

// Route: /ideas/:id
if (preg_match('#^/ideas/(\d+)$#', $route, $m)) {
    $id = (int)$m[1];

    $ideaIdx = null;
    foreach ($data['ideas'] as $idx => $idea) {
        if ($idea['id'] === $id) { $ideaIdx = $idx; break; }
    }
    if ($ideaIdx === null) jsonResponse(['error' => 'Not found'], 404);

    if ($method === 'GET') {
        $idea = $data['ideas'][$ideaIdx];
        $idea['submitted_by_name'] = getMemberName($data['members'], $idea['submitted_by']);
        $idea = resolveAssignees($idea, $data['members']);
        $idea['vote_count'] = count(array_filter($data['votes'], fn($v) => $v['idea_id'] === $id));

        $comments = array_values(array_filter($data['comments'], fn($c) => $c['idea_id'] === $id));
        foreach ($comments as &$c) {
            $c['member_name'] = getMemberName($data['members'], $c['member_id']) ?? '';
        }
        usort($comments, fn($a, $b) => strcmp($a['created_at'], $b['created_at']));
        $idea['comments'] = $comments;

        $votes = array_values(array_filter($data['votes'], fn($v) => $v['idea_id'] === $id));
        foreach ($votes as &$v) {
            $v['member_name'] = getMemberName($data['members'], $v['member_id']) ?? '';
        }
        $idea['votes'] = $votes;

        jsonResponse($idea);
    }

    if ($method === 'PATCH') {
        $oldAssignees = $data['ideas'][$ideaIdx]['assigned_to'] ?? [];
        if (!is_array($oldAssignees)) $oldAssignees = $oldAssignees ? [$oldAssignees] : [];

        foreach (['title', 'description', 'category', 'status', 'target_date'] as $key) {
            if (array_key_exists($key, $body)) {
                $data['ideas'][$ideaIdx][$key] = $body[$key];
            }
        }
        if (array_key_exists('assigned_to', $body)) {
            $val = $body['assigned_to'];
            if (is_array($val)) {
                $data['ideas'][$ideaIdx]['assigned_to'] = array_map('intval', $val);
            } else {
                $data['ideas'][$ideaIdx]['assigned_to'] = $val ? [(int)$val] : [];
            }
        }
        $data['ideas'][$ideaIdx]['updated_at'] = date('Y-m-d H:i:s');

        // Notify newly assigned members
        $newAssignees = $data['ideas'][$ideaIdx]['assigned_to'] ?? [];
        if (!is_array($newAssignees)) $newAssignees = $newAssignees ? [$newAssignees] : [];
        $ideaTitle = $data['ideas'][$ideaIdx]['title'];
        foreach ($newAssignees as $assigneeId) {
            if (!in_array($assigneeId, $oldAssignees)) {
                createNotification($data, $assigneeId, 'assigned', "You were assigned to \"$ideaTitle\"", $id);
            }
        }

        saveData($data);
        jsonResponse($data['ideas'][$ideaIdx]);
    }

    if ($method === 'DELETE') {
        array_splice($data['ideas'], $ideaIdx, 1);
        $data['comments'] = array_values(array_filter($data['comments'], fn($c) => $c['idea_id'] !== $id));
        $data['votes'] = array_values(array_filter($data['votes'], fn($v) => $v['idea_id'] !== $id));
        saveData($data);
        jsonResponse(['ok' => true]);
    }
}

// Route: /ideas/:id/comments
if (preg_match('#^/ideas/(\d+)/comments$#', $route, $m)) {
    $ideaId = (int)$m[1];
    if ($method === 'POST') {
        $content = trim($body['content'] ?? '');
        if (!$content) jsonResponse(['error' => 'Content is required'], 400);

        $comment = [
            'id' => nextId($data),
            'idea_id' => $ideaId,
            'parent_id' => isset($body['parent_id']) ? (int)$body['parent_id'] : null,
            'member_id' => (int)$body['member_id'],
            'content' => $content,
            'created_at' => date('Y-m-d H:i:s'),
        ];
        $data['comments'][] = $comment;

        // Notify submitter + all assignees (except the commenter themselves)
        $commenterName = getMemberName($data['members'], $comment['member_id']) ?? 'Someone';
        $notified = [];
        foreach ($data['ideas'] as $idea) {
            if ($idea['id'] === $ideaId) {
                $ideaTitle = $idea['title'];
                // Notify submitter
                if ($idea['submitted_by'] && $idea['submitted_by'] !== $comment['member_id']) {
                    createNotification($data, $idea['submitted_by'], 'comment', "$commenterName commented on \"$ideaTitle\"", $ideaId);
                    $notified[] = $idea['submitted_by'];
                }
                // Notify all assignees (skip commenter and already-notified submitter)
                $assignees = $idea['assigned_to'] ?? [];
                if (!is_array($assignees)) $assignees = $assignees ? [$assignees] : [];
                foreach ($assignees as $assigneeId) {
                    if ($assigneeId !== $comment['member_id'] && !in_array($assigneeId, $notified)) {
                        createNotification($data, $assigneeId, 'comment', "$commenterName commented on \"$ideaTitle\"", $ideaId);
                    }
                }
                break;
            }
        }

        saveData($data);

        $comment['member_name'] = getMemberName($data['members'], $comment['member_id']) ?? '';
        jsonResponse($comment);
    }
}

// Route: /comments/:id (edit or delete)
if (preg_match('#^/comments/(\d+)$#', $route, $m)) {
    $cId = (int)$m[1];
    $commentIdx = null;
    foreach ($data['comments'] as $idx => $c) {
        if ($c['id'] === $cId) { $commentIdx = $idx; break; }
    }
    if ($commentIdx === null) jsonResponse(['error' => 'Not found'], 404);

    if ($method === 'PATCH') {
        $content = trim($body['content'] ?? '');
        if (!$content) jsonResponse(['error' => 'Content is required'], 400);
        $data['comments'][$commentIdx]['content'] = $content;
        $data['comments'][$commentIdx]['edited_at'] = date('Y-m-d H:i:s');
        saveData($data);
        jsonResponse($data['comments'][$commentIdx]);
    }

    if ($method === 'DELETE') {
        // Delete this comment and all its children recursively
        $toDelete = [$cId];
        $changed = true;
        while ($changed) {
            $changed = false;
            foreach ($data['comments'] as $c) {
                if (in_array($c['parent_id'], $toDelete) && !in_array($c['id'], $toDelete)) {
                    $toDelete[] = $c['id'];
                    $changed = true;
                }
            }
        }
        $data['comments'] = array_values(array_filter($data['comments'], fn($c) => !in_array($c['id'], $toDelete)));
        saveData($data);
        jsonResponse(['ok' => true]);
    }
}

// Route: /ideas/:id/votes
if (preg_match('#^/ideas/(\d+)/votes$#', $route, $m)) {
    $ideaId = (int)$m[1];
    if ($method === 'POST') {
        $memberId = (int)$body['member_id'];
        $existingIdx = null;
        foreach ($data['votes'] as $idx => $v) {
            if ($v['idea_id'] === $ideaId && $v['member_id'] === $memberId) {
                $existingIdx = $idx;
                break;
            }
        }
        if ($existingIdx !== null) {
            array_splice($data['votes'], $existingIdx, 1);
            $data['votes'] = array_values($data['votes']);
            saveData($data);
            jsonResponse(['voted' => false]);
        } else {
            $data['votes'][] = [
                'id' => nextId($data),
                'idea_id' => $ideaId,
                'member_id' => $memberId,
                'created_at' => date('Y-m-d H:i:s'),
            ];
            saveData($data);
            jsonResponse(['voted' => true]);
        }
    }
}

// Route: /notifications?member_id=X
if ($route === '/notifications') {
    $memberId = (int)($_GET['member_id'] ?? 0);
    if ($method === 'GET' && $memberId) {
        $notifs = array_values(array_filter($data['notifications'], fn($n) => $n['member_id'] === $memberId));
        usort($notifs, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));
        jsonResponse($notifs);
    }
}

// Route: /notifications/read-all?member_id=X
if ($route === '/notifications/read-all') {
    $memberId = (int)($_GET['member_id'] ?? ($body['member_id'] ?? 0));
    if ($method === 'POST' && $memberId) {
        foreach ($data['notifications'] as &$n) {
            if ($n['member_id'] === $memberId) $n['read'] = true;
        }
        unset($n);
        saveData($data);
        jsonResponse(['ok' => true]);
    }
}

// Route: /notifications/:id
if (preg_match('#^/notifications/(\d+)$#', $route, $m)) {
    $nId = (int)$m[1];
    if ($method === 'PATCH') {
        foreach ($data['notifications'] as &$n) {
            if ($n['id'] === $nId) {
                $n['read'] = true;
                break;
            }
        }
        unset($n);
        saveData($data);
        jsonResponse(['ok' => true]);
    }
}

// Route: /members/:id (update profile)
if (preg_match('#^/members/(\d+)$#', $route, $m)) {
    $mId = (int)$m[1];
    if ($method === 'GET') {
        foreach ($data['members'] as $member) {
            if ($member['id'] === $mId) {
                jsonResponse($member);
            }
        }
        jsonResponse(['error' => 'Not found'], 404);
    }
    if ($method === 'PATCH') {
        foreach ($data['members'] as &$member) {
            if ($member['id'] === $mId) {
                if (array_key_exists('name', $body) && trim($body['name'])) {
                    $member['name'] = trim($body['name']);
                }
                if (array_key_exists('email', $body)) {
                    $member['email'] = trim($body['email']);
                }
                if (array_key_exists('avatar', $body)) {
                    $member['avatar'] = trim($body['avatar']);
                }
                break;
            }
        }
        unset($member);
        saveData($data);
        // Return updated member
        foreach ($data['members'] as $member) {
            if ($member['id'] === $mId) jsonResponse($member);
        }
        jsonResponse(['ok' => true]);
    }
}

// Temp debug
if ($route === '/test-email') {
    $mid = (int)($_GET['member_id'] ?? 0);
    if (!$mid) jsonResponse(['error' => 'need member_id'], 400);
    $log = [];
    $config = loadSmtpConfig();
    $log[] = 'config: ' . ($config ? json_encode($config) : 'NULL');
    $email = null;
    foreach ($data['members'] as $m) {
        if ($m['id'] === $mid) { $email = $m['email'] ?? ''; $log[] = "member: {$m['name']} email: $email"; break; }
    }
    if ($email && $config && !empty($config['enabled'])) {
        sendNotificationEmail($data, $mid, 'Test from debug route');
        $log[] = 'sendNotificationEmail called';
    } else {
        $log[] = 'SKIPPED: email=' . ($email ?: 'empty') . ' config_enabled=' . ($config['enabled'] ?? 'unset');
    }
    jsonResponse(['log' => $log]);
}

http_response_code(404);
echo json_encode(['error' => 'Not found']);
