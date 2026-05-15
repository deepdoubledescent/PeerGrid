# This code is part of the matchmaking module running on our AWS Lambda server.
# It is responsible for performing matchmaking between researchers and storing
# the results in the database.
import json
import os
import csv
import numpy as np
import pymysql
from collections import Counter

db_conn = None

# CSV path (relative to Lambda deployment package root)
# It manually read the CSV file to build topic hierarchies and name mappings!
# so in case you utilize this matchmaking code: Include openAlexTopics.csv within the lambda folder.
TOPIC_CSV_PATH = os.path.join(os.path.dirname(__file__), 'openAlexTopics.csv')



def clean_id(raw_id):
    """
    Normalizes OpenAlex IDs by removing the URL prefix.
    Example: 'https://openalex.org/A123' -> 'A123'
    """
    if not raw_id:
        return None
    raw_id = str(raw_id)
    return raw_id.split('/')[-1] if '/' in raw_id else raw_id



def get_db_conn():
    global db_conn
    if db_conn:
        try:
            db_conn.ping(reconnect=True)
        except:
            db_conn = None
    if db_conn is None:
        db_conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database=os.environ.get("DB_NAME"),
            port=int(os.environ.get("DB_PORT", 3306)),
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=5
        )
    return db_conn


def load_topic_hierarchy(csv_path=TOPIC_CSV_PATH):
    """
    Builds topic_id → subfield_id / field_id mappings and ID → name lookups.
    """
    topic_to_hierarchy = {}   # topic_id(str) -> {'subfield_id': str, 'field_id': str}
    topic_names        = {}   # topic_id(str)    -> topic_name
    subfield_names     = {}   # subfield_id(str) -> subfield_name
    field_names        = {}   # field_id(str)    -> field_name

    if not os.path.exists(csv_path):
        print(f"Warning: CSV not found at {csv_path}. Hierarchy matching will be limited.")
        return {}, {}, {}, {}

    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tid = str(row['topic_id'])
            sid = str(row['subfield_id'])
            fid = str(row['field_id'])

            topic_to_hierarchy[tid] = {'subfield_id': sid, 'field_id': fid}
            topic_names[tid]    = row['topic_name']
            subfield_names[sid] = row['subfield_name']
            field_names[fid]    = row['field_name']

    return topic_to_hierarchy, topic_names, subfield_names, field_names


def load_all_data(topic_to_hierarchy):
    """
    Loads researcher data into memory.
    Level 2 Optimization: Loads pre-aggregated topics from User_Topic_Stats.
    Level 3 Optimization: Checks Coauthor_Graph first, falls back to Authorships JOIN.
    """
    conn   = get_db_conn()
    cursor = conn.cursor()

    # 1. Paper embeddings (needed for minilm_score)
    print("Loading embeddings...")

    cursor.execute("""
    SELECT openalex_id, embedding
    FROM (
        SELECT a.openalex_id, p.embedding,
               ROW_NUMBER() OVER(PARTITION BY a.openalex_id ORDER BY p.paper_id DESC) as r_num
        FROM Papers p
        JOIN Authorships a ON p.paper_id = a.paper_id
        WHERE p.embedding IS NOT NULL
    ) AS ranked
    WHERE r_num <= 5
    """)

    emb_cache = {}
    for row in cursor.fetchall():
        oid = clean_id(row['openalex_id'])
        emb_cache.setdefault(oid, []).append(np.array(json.loads(row['embedding'])))

    # 2. Topic profiles (Level 2: Use User_Topic_Stats)
    print("Loading topic profiles from User_Topic_Stats...")
    cursor.execute("SELECT openalex_id, topic_id, count FROM User_Topic_Stats")
    topic_cache = {}
    
    # Fallback to legacy count aggregation if User_Topic_Stats is empty
    rows = cursor.fetchall()
    if not rows:
        print("User_Topic_Stats is empty. Falling back to Authorships/Works_Topics JOIN...")
        cursor.execute("""
            SELECT a.openalex_id, wt.topic_id
            FROM Authorships a
            JOIN Works_Topics wt ON a.paper_id = wt.paper_id
        """)
        for row in cursor.fetchall():
            oid = clean_id(row['openalex_id'])
            tid = str(row['topic_id'])
            if oid not in topic_cache:
                topic_cache[oid] = {'topics': Counter(), 'subfields': Counter(), 'fields': Counter()}
            topic_cache[oid]['topics'][tid] += 1
            if tid in topic_to_hierarchy:
                sid = topic_to_hierarchy[tid]['subfield_id']
                fid = topic_to_hierarchy[tid]['field_id']
                if sid: topic_cache[oid]['subfields'][sid] += 1
                if fid: topic_cache[oid]['fields'][fid]    += 1
    else:
        for row in rows:
            oid = clean_id(row['openalex_id'])
            tid = str(row['topic_id'])
            cnt = row['count']
            if oid not in topic_cache:
                topic_cache[oid] = {'topics': Counter(), 'subfields': Counter(), 'fields': Counter()}
            topic_cache[oid]['topics'][tid] = cnt
            if tid in topic_to_hierarchy:
                sid = topic_to_hierarchy[tid]['subfield_id']
                fid = topic_to_hierarchy[tid]['field_id']
                if sid: topic_cache[oid]['subfields'][sid] = cnt
                if fid: topic_cache[oid]['fields'][fid]    = cnt

    # 3. Co-author pairs (Level 3: Check Coauthor_Graph first)
    print("Loading co-authorship data...")
    cursor.execute("SELECT author1_id, author2_id FROM Coauthor_Graph")
    coauthor_pairs = set()
    graph_rows = cursor.fetchall()
    
    if graph_rows:
        print(f"Using Coauthor_Graph ({len(graph_rows)} pairs).")
        for row in graph_rows:
            id1 = clean_id(row['author1_id'])
            id2 = clean_id(row['author2_id'])
            coauthor_pairs.add(frozenset([id1, id2]))
    else:
        print("Coauthor_Graph is empty. Falling back to Authorships JOIN...")
        cursor.execute("""
            SELECT DISTINCT a1.openalex_id AS id1, a2.openalex_id AS id2
            FROM Authorships a1
            JOIN Authorships a2 ON a1.paper_id = a2.paper_id
            WHERE a1.openalex_id != a2.openalex_id
        """)
        for row in cursor.fetchall():
            id1 = clean_id(row['id1'])
            id2 = clean_id(row['id2'])
            coauthor_pairs.add(frozenset([id1, id2]))

    return emb_cache, topic_cache, coauthor_pairs


class ResearchMatcherV6:
    def __init__(self):
        self.alpha = 0.65
        self.beta  = 0.35
        self.level_weights = {'topic': 1.0, 'subfield': 0.4, 'field': 0.1}

    def _cosine_similarity(self, dict_a, dict_b):
        if not dict_a or not dict_b:
            return 0.0
        all_keys = set(dict_a.keys()) | set(dict_b.keys())
        v1   = np.array([dict_a.get(k, 0) for k in all_keys])
        v2   = np.array([dict_b.get(k, 0) for k in all_keys])
        norm = np.linalg.norm(v1) * np.linalg.norm(v2)
        return float(np.dot(v1, v2) / norm) if norm > 0 else 0.0

    def compute_topic_similarity(self, profile_a, profile_b):
        score  = self.level_weights['topic']    * self._cosine_similarity(profile_a['topics'],    profile_b['topics'])
        score += self.level_weights['subfield'] * self._cosine_similarity(profile_a['subfields'], profile_b['subfields'])
        score += self.level_weights['field']    * self._cosine_similarity(profile_a['fields'],    profile_b['fields'])
        return score

    def find_matches(self, target_id, target_embs, target_profile,
                     authors, emb_cache, topic_cache, topic_names,
                     coauthor_pairs, top_k=5, use_boost=False):
        candidates = []
        for auth in authors:
            auth_id = clean_id(auth['openalex_id'])
            if auth_id == target_id or frozenset([target_id, auth_id]) in coauthor_pairs:
                continue

            auth_profile = topic_cache.get(auth_id)
            auth_embs    = emb_cache.get(auth_id)
            if not auth_profile or not auth_embs:
                continue

            t_score = self.compute_topic_similarity(target_profile, auth_profile)
            
            m_score = 0.0
            for t_emb in target_embs:
                for a_emb in auth_embs:
                    norm = np.linalg.norm(t_emb) * np.linalg.norm(a_emb)
                    if norm > 0:
                        m_score = max(m_score, float(np.dot(t_emb, a_emb) / norm))

            base_score = self.alpha * t_score + self.beta * m_score
            if base_score < 0.2: continue

            final_score = base_score
            if use_boost:
                t_fields = set(target_profile['fields'].keys())
                a_fields = set(auth_profile['fields'].keys())
                if not (t_fields & a_fields) and (set(target_profile['topics'].keys()) & set(auth_profile['topics'].keys())):
                    final_score += 0.15

            top_topic_ids = list(auth_profile['topics'].keys())[:3]
            topics  = [topic_names[tid] for tid in top_topic_ids if tid in topic_names]
            summary = "Researches %s." % ", ".join(topics) if topics else ""

            candidates.append({
                'cognito_sub':  auth['cognito_sub'],
                'score':        final_score,
                'topic_score':  t_score,
                'minilm_score': m_score,
                'summary':      summary
            })

        candidates.sort(key=lambda x: x['score'], reverse=True)
        return candidates[:top_k]


def lambda_handler(event, context):
    conn = get_db_conn()
    cursor = conn.cursor()

    topic_to_hierarchy, topic_names, _, _ = load_topic_hierarchy()
    emb_cache, topic_cache, coauthor_pairs = load_all_data(topic_to_hierarchy)

    matcher = ResearchMatcherV6()
    cursor.execute("SELECT cognito_sub, openalex_id, name FROM Users WHERE openalex_id IS NOT NULL")
    all_users = cursor.fetchall()

    # If targetSub is provided, filter's to only that user. Otherwise, process all.
    # target_sub = event.get("targetSub")
    # users_to_process = [u for u in all_users if u['cognito_sub'] == target_sub] if target_sub else all_users
    success, failed = 0, 0
    for user in all_users:
        try:
            target_id = clean_id(user['openalex_id'])
            target_embs = emb_cache.get(target_id)
            target_profile = topic_cache.get(target_id)
            if not target_embs or not target_profile: continue

            matches = matcher.find_matches(target_id, target_embs, target_profile, all_users, 
                                           emb_cache, topic_cache, topic_names, coauthor_pairs)
            
            # Clear stale recommendations before inserting new ones, in case of roll back: delete following cursor.excute
            cursor.execute(
                "DELETE FROM User_Recommendations WHERE cognito_sub = %s",
                (user['cognito_sub'],)
            )

            for rank_idx, match in enumerate(matches, start=1):
                cursor.execute("""
                    INSERT INTO User_Recommendations
                        (cognito_sub, recommended_cognito_sub, score, topic_score,
                         minilm_score, match_rank, summary, computed_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                """, 
                # # In case of roll back, put following codes back into """  
                # ON DUPLICATE KEY UPDATE
                #         score=VALUES(score), topic_score=VALUES(topic_score), 
                #         minilm_score=VALUES(minilm_score), match_rank=VALUES(match_rank),
                #         summary=VALUES(summary), computed_at=NOW()
                (user['cognito_sub'], match['cognito_sub'], match['score'], 
                      match['topic_score'], match['minilm_score'], rank_idx, match.get('summary', '')))
            conn.commit()
            success += 1
        except Exception as e:
            failed += 1
    return {"body": f"Done. success={success}, failed={failed}"}
