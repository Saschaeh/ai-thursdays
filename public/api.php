<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

mysqli_report(MYSQLI_REPORT_OFF);
$db = new mysqli('localhost', 'idletuesday', 'fApufdLPD9uAX5e', 'idletuesday');
if ($db->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}
$db->set_charset('utf8mb4');

$db->multi_query("
    CREATE TABLE IF NOT EXISTS ait_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ait_ideas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        submitted_by INT,
        assigned_to INT,
        target_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (submitted_by) REFERENCES ait_members(id),
        FOREIGN KEY (assigned_to) REFERENCES ait_members(id)
    );
    CREATE TABLE IF NOT EXISTS ait_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        idea_id INT NOT NULL,
        member_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idea_id) REFERENCES ait_ideas(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES ait_members(id)
    );
    CREATE TABLE IF NOT EXISTS ait_votes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        idea_id INT NOT NULL,
        member_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_vote (idea_id, member_id),
        FOREIGN KEY (idea_id) REFERENCES ait_ideas(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES ait_members(id)
    );
");
// Flush multi_query results
while ($db->next_result()) { $db->store_result(); }

$route = $_GET['route'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function queryAll($db, $sql, $params = [], $types = '') {
    $stmt = $db->prepare($sql);
    if ($params) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();
    return $rows;
}

function queryOne($db, $sql, $params = [], $types = '') {
    $rows = queryAll($db, $sql, $params, $types);
    return $rows[0] ?? null;
}

// Route: /members
if ($route === '/members') {
    if ($method === 'GET') {
        jsonResponse(queryAll($db, 'SELECT * FROM ait_members ORDER BY name'));
    }
    if ($method === 'POST') {
        $name = trim($body['name'] ?? '');
        if (!$name) jsonResponse(['error' => 'Name is required'], 400);

        $existing = queryOne($db, 'SELECT * FROM ait_members WHERE name = ?', [$name], 's');
        if ($existing) jsonResponse($existing);

        $stmt = $db->prepare('INSERT INTO ait_members (name) VALUES (?)');
        $stmt->bind_param('s', $name);
        $stmt->execute();
        $id = $stmt->insert_id;
        $stmt->close();
        jsonResponse(queryOne($db, 'SELECT * FROM ait_members WHERE id = ?', [$id], 'i'));
    }
}

// Route: /ideas
if ($route === '/ideas') {
    if ($method === 'GET') {
        jsonResponse(queryAll($db, "
            SELECT i.*,
                m1.name as submitted_by_name,
                m2.name as assigned_to_name,
                (SELECT COUNT(*) FROM ait_votes WHERE idea_id = i.id) as vote_count,
                (SELECT COUNT(*) FROM ait_comments WHERE idea_id = i.id) as comment_count
            FROM ait_ideas i
            LEFT JOIN ait_members m1 ON i.submitted_by = m1.id
            LEFT JOIN ait_members m2 ON i.assigned_to = m2.id
            ORDER BY i.created_at DESC
        "));
    }
    if ($method === 'POST') {
        $title = trim($body['title'] ?? '');
        if (!$title) jsonResponse(['error' => 'Title is required'], 400);

        $desc = $body['description'] ?? '';
        $cat = $body['category'] ?? 'General';
        $by = $body['submitted_by'] ?? null;

        $stmt = $db->prepare('INSERT INTO ait_ideas (title, description, category, submitted_by) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('sssi', $title, $desc, $cat, $by);
        $stmt->execute();
        $id = $stmt->insert_id;
        $stmt->close();
        jsonResponse(queryOne($db, 'SELECT * FROM ait_ideas WHERE id = ?', [$id], 'i'));
    }
}

// Route: /ideas/:id
if (preg_match('#^/ideas/(\d+)$#', $route, $m)) {
    $id = (int)$m[1];

    if ($method === 'GET') {
        $idea = queryOne($db, "
            SELECT i.*,
                m1.name as submitted_by_name,
                m2.name as assigned_to_name,
                (SELECT COUNT(*) FROM ait_votes WHERE idea_id = i.id) as vote_count
            FROM ait_ideas i
            LEFT JOIN ait_members m1 ON i.submitted_by = m1.id
            LEFT JOIN ait_members m2 ON i.assigned_to = m2.id
            WHERE i.id = ?
        ", [$id], 'i');
        if (!$idea) jsonResponse(['error' => 'Not found'], 404);

        $idea['comments'] = queryAll($db, "
            SELECT c.*, m.name as member_name
            FROM ait_comments c JOIN ait_members m ON c.member_id = m.id
            WHERE c.idea_id = ? ORDER BY c.created_at ASC
        ", [$id], 'i');

        $idea['votes'] = queryAll($db, "
            SELECT v.*, m.name as member_name
            FROM ait_votes v JOIN ait_members m ON v.member_id = m.id
            WHERE v.idea_id = ?
        ", [$id], 'i');

        jsonResponse($idea);
    }

    if ($method === 'PATCH') {
        $sets = [];
        $params = [];
        $types = '';
        foreach (['title', 'description', 'category', 'status', 'target_date'] as $key) {
            if (array_key_exists($key, $body)) {
                $sets[] = "$key = ?";
                $params[] = $body[$key];
                $types .= 's';
            }
        }
        if (array_key_exists('assigned_to', $body)) {
            $sets[] = "assigned_to = ?";
            $params[] = $body['assigned_to'] ? (int)$body['assigned_to'] : null;
            $types .= 'i';
        }
        if (empty($sets)) jsonResponse(['error' => 'No fields to update'], 400);

        $params[] = $id;
        $types .= 'i';

        $stmt = $db->prepare("UPDATE ait_ideas SET " . implode(', ', $sets) . " WHERE id = ?");
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $stmt->close();
        jsonResponse(queryOne($db, 'SELECT * FROM ait_ideas WHERE id = ?', [$id], 'i'));
    }

    if ($method === 'DELETE') {
        $stmt = $db->prepare('DELETE FROM ait_ideas WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        jsonResponse(['ok' => true]);
    }
}

// Route: /ideas/:id/comments
if (preg_match('#^/ideas/(\d+)/comments$#', $route, $m)) {
    $ideaId = (int)$m[1];
    if ($method === 'POST') {
        $content = trim($body['content'] ?? '');
        if (!$content) jsonResponse(['error' => 'Content is required'], 400);

        $memberId = (int)$body['member_id'];
        $stmt = $db->prepare('INSERT INTO ait_comments (idea_id, member_id, content) VALUES (?, ?, ?)');
        $stmt->bind_param('iis', $ideaId, $memberId, $content);
        $stmt->execute();
        $cid = $stmt->insert_id;
        $stmt->close();

        jsonResponse(queryOne($db, "
            SELECT c.*, m.name as member_name
            FROM ait_comments c JOIN ait_members m ON c.member_id = m.id
            WHERE c.id = ?
        ", [$cid], 'i'));
    }
}

// Route: /ideas/:id/votes
if (preg_match('#^/ideas/(\d+)/votes$#', $route, $m)) {
    $ideaId = (int)$m[1];
    if ($method === 'POST') {
        $memberId = (int)$body['member_id'];
        $existing = queryOne($db, 'SELECT id FROM ait_votes WHERE idea_id = ? AND member_id = ?',
            [$ideaId, $memberId], 'ii');
        if ($existing) {
            $stmt = $db->prepare('DELETE FROM ait_votes WHERE id = ?');
            $eid = (int)$existing['id'];
            $stmt->bind_param('i', $eid);
            $stmt->execute();
            $stmt->close();
            jsonResponse(['voted' => false]);
        } else {
            $stmt = $db->prepare('INSERT INTO ait_votes (idea_id, member_id) VALUES (?, ?)');
            $stmt->bind_param('ii', $ideaId, $memberId);
            $stmt->execute();
            $stmt->close();
            jsonResponse(['voted' => true]);
        }
    }
}

http_response_code(404);
echo json_encode(['error' => 'Not found']);
