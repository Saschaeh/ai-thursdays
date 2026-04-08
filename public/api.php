<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dbPath = __DIR__ . '/data/ai-thursdays.db';
$dbDir = dirname($dbPath);
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

$db = new SQLite3($dbPath);
$db->exec('PRAGMA journal_mode = WAL');
$db->exec('PRAGMA foreign_keys = ON');

$db->exec("
    CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ideas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'General',
        status TEXT NOT NULL DEFAULT 'new',
        submitted_by INTEGER REFERENCES members(id),
        assigned_to INTEGER REFERENCES members(id),
        target_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(idea_id, member_id)
    );
");

$path = $_SERVER['PATH_INFO'] ?? $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($path, PHP_URL_PATH);
// Strip base path prefix if present
$path = preg_replace('#^/Thursdays#', '', $path);
$path = preg_replace('#^/api\.php#', '', $path);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function queryAll($db, $sql, $params = []) {
    $stmt = $db->prepare($sql);
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    $result = $stmt->execute();
    $rows = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $rows[] = $row;
    }
    return $rows;
}

function queryOne($db, $sql, $params = []) {
    $rows = queryAll($db, $sql, $params);
    return $rows[0] ?? null;
}

// Route: /members
if (preg_match('#^/members$#', $path)) {
    if ($method === 'GET') {
        jsonResponse(queryAll($db, 'SELECT * FROM members ORDER BY name'));
    }
    if ($method === 'POST') {
        $name = trim($body['name'] ?? '');
        if (!$name) jsonResponse(['error' => 'Name is required'], 400);

        $existing = queryOne($db, 'SELECT * FROM members WHERE name = :name', [':name' => $name]);
        if ($existing) jsonResponse($existing);

        $stmt = $db->prepare('INSERT INTO members (name) VALUES (:name)');
        $stmt->bindValue(':name', $name);
        $stmt->execute();
        jsonResponse(queryOne($db, 'SELECT * FROM members WHERE id = :id', [':id' => $db->lastInsertRowID()]));
    }
}

// Route: /ideas
if (preg_match('#^/ideas$#', $path)) {
    if ($method === 'GET') {
        jsonResponse(queryAll($db, "
            SELECT i.*,
                m1.name as submitted_by_name,
                m2.name as assigned_to_name,
                (SELECT COUNT(*) FROM votes WHERE idea_id = i.id) as vote_count,
                (SELECT COUNT(*) FROM comments WHERE idea_id = i.id) as comment_count
            FROM ideas i
            LEFT JOIN members m1 ON i.submitted_by = m1.id
            LEFT JOIN members m2 ON i.assigned_to = m2.id
            ORDER BY i.created_at DESC
        "));
    }
    if ($method === 'POST') {
        $title = trim($body['title'] ?? '');
        if (!$title) jsonResponse(['error' => 'Title is required'], 400);

        $stmt = $db->prepare('INSERT INTO ideas (title, description, category, submitted_by) VALUES (:title, :desc, :cat, :by)');
        $stmt->bindValue(':title', $title);
        $stmt->bindValue(':desc', $body['description'] ?? '');
        $stmt->bindValue(':cat', $body['category'] ?? 'General');
        $stmt->bindValue(':by', $body['submitted_by'] ?? null);
        $stmt->execute();
        jsonResponse(queryOne($db, 'SELECT * FROM ideas WHERE id = :id', [':id' => $db->lastInsertRowID()]));
    }
}

// Route: /ideas/:id
if (preg_match('#^/ideas/(\d+)$#', $path, $m)) {
    $id = (int)$m[1];

    if ($method === 'GET') {
        $idea = queryOne($db, "
            SELECT i.*,
                m1.name as submitted_by_name,
                m2.name as assigned_to_name,
                (SELECT COUNT(*) FROM votes WHERE idea_id = i.id) as vote_count
            FROM ideas i
            LEFT JOIN members m1 ON i.submitted_by = m1.id
            LEFT JOIN members m2 ON i.assigned_to = m2.id
            WHERE i.id = :id
        ", [':id' => $id]);
        if (!$idea) jsonResponse(['error' => 'Not found'], 404);

        $idea['comments'] = queryAll($db, "
            SELECT c.*, m.name as member_name
            FROM comments c JOIN members m ON c.member_id = m.id
            WHERE c.idea_id = :id ORDER BY c.created_at ASC
        ", [':id' => $id]);

        $idea['votes'] = queryAll($db, "
            SELECT v.*, m.name as member_name
            FROM votes v JOIN members m ON v.member_id = m.id
            WHERE v.idea_id = :id
        ", [':id' => $id]);

        jsonResponse($idea);
    }

    if ($method === 'PATCH') {
        $fields = [];
        $params = [':id' => $id];
        foreach (['title', 'description', 'category', 'status', 'assigned_to', 'target_date'] as $key) {
            if (array_key_exists($key, $body)) {
                $fields[] = "$key = :$key";
                $params[":$key"] = $body[$key];
            }
        }
        if (empty($fields)) jsonResponse(['error' => 'No fields to update'], 400);

        $fields[] = "updated_at = datetime('now')";
        $stmt = $db->prepare("UPDATE ideas SET " . implode(', ', $fields) . " WHERE id = :id");
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->execute();
        jsonResponse(queryOne($db, 'SELECT * FROM ideas WHERE id = :id', [':id' => $id]));
    }

    if ($method === 'DELETE') {
        $db->exec("DELETE FROM ideas WHERE id = $id");
        jsonResponse(['ok' => true]);
    }
}

// Route: /ideas/:id/comments
if (preg_match('#^/ideas/(\d+)/comments$#', $path, $m)) {
    $ideaId = (int)$m[1];
    if ($method === 'POST') {
        $content = trim($body['content'] ?? '');
        if (!$content) jsonResponse(['error' => 'Content is required'], 400);

        $stmt = $db->prepare('INSERT INTO comments (idea_id, member_id, content) VALUES (:idea_id, :member_id, :content)');
        $stmt->bindValue(':idea_id', $ideaId);
        $stmt->bindValue(':member_id', $body['member_id']);
        $stmt->bindValue(':content', $content);
        $stmt->execute();

        jsonResponse(queryOne($db, "
            SELECT c.*, m.name as member_name
            FROM comments c JOIN members m ON c.member_id = m.id
            WHERE c.id = :id
        ", [':id' => $db->lastInsertRowID()]));
    }
}

// Route: /ideas/:id/votes
if (preg_match('#^/ideas/(\d+)/votes$#', $path, $m)) {
    $ideaId = (int)$m[1];
    if ($method === 'POST') {
        $memberId = $body['member_id'];
        $existing = queryOne($db, 'SELECT id FROM votes WHERE idea_id = :iid AND member_id = :mid',
            [':iid' => $ideaId, ':mid' => $memberId]);
        if ($existing) {
            $db->exec("DELETE FROM votes WHERE id = {$existing['id']}");
            jsonResponse(['voted' => false]);
        } else {
            $stmt = $db->prepare('INSERT INTO votes (idea_id, member_id) VALUES (:iid, :mid)');
            $stmt->bindValue(':iid', $ideaId);
            $stmt->bindValue(':mid', $memberId);
            $stmt->execute();
            jsonResponse(['voted' => true]);
        }
    }
}

http_response_code(404);
echo json_encode(['error' => 'Not found']);
