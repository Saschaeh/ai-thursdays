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
        return ['members' => [], 'ideas' => [], 'comments' => [], 'votes' => [], 'next_id' => 1];
    }
    return json_decode(file_get_contents($dataFile), true);
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

$route = $_GET['route'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];
$data = loadData();

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

        $member = ['id' => nextId($data), 'name' => $name, 'created_at' => date('Y-m-d H:i:s')];
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
            $idea['submitted_by_name'] = null;
            $idea['assigned_to_name'] = null;
            foreach ($data['members'] as $m) {
                if ($m['id'] === $idea['submitted_by']) $idea['submitted_by_name'] = $m['name'];
                if ($m['id'] === $idea['assigned_to']) $idea['assigned_to_name'] = $m['name'];
            }
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
            'assigned_to' => null,
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
        $idea['submitted_by_name'] = null;
        $idea['assigned_to_name'] = null;
        foreach ($data['members'] as $mem) {
            if ($mem['id'] === $idea['submitted_by']) $idea['submitted_by_name'] = $mem['name'];
            if ($mem['id'] === $idea['assigned_to']) $idea['assigned_to_name'] = $mem['name'];
        }
        $idea['vote_count'] = count(array_filter($data['votes'], fn($v) => $v['idea_id'] === $id));

        $comments = array_values(array_filter($data['comments'], fn($c) => $c['idea_id'] === $id));
        foreach ($comments as &$c) {
            $c['member_name'] = '';
            foreach ($data['members'] as $mem) {
                if ($mem['id'] === $c['member_id']) { $c['member_name'] = $mem['name']; break; }
            }
        }
        usort($comments, fn($a, $b) => strcmp($a['created_at'], $b['created_at']));
        $idea['comments'] = $comments;

        $votes = array_values(array_filter($data['votes'], fn($v) => $v['idea_id'] === $id));
        foreach ($votes as &$v) {
            $v['member_name'] = '';
            foreach ($data['members'] as $mem) {
                if ($mem['id'] === $v['member_id']) { $v['member_name'] = $mem['name']; break; }
            }
        }
        $idea['votes'] = $votes;

        jsonResponse($idea);
    }

    if ($method === 'PATCH') {
        foreach (['title', 'description', 'category', 'status', 'target_date'] as $key) {
            if (array_key_exists($key, $body)) {
                $data['ideas'][$ideaIdx][$key] = $body[$key];
            }
        }
        if (array_key_exists('assigned_to', $body)) {
            $data['ideas'][$ideaIdx]['assigned_to'] = $body['assigned_to'] ? (int)$body['assigned_to'] : null;
        }
        $data['ideas'][$ideaIdx]['updated_at'] = date('Y-m-d H:i:s');
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
        saveData($data);

        $comment['member_name'] = '';
        foreach ($data['members'] as $mem) {
            if ($mem['id'] === $comment['member_id']) { $comment['member_name'] = $mem['name']; break; }
        }
        jsonResponse($comment);
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

http_response_code(404);
echo json_encode(['error' => 'Not found']);
