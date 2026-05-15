# 🔬 PeerGrid — Lambda Matchmaking System

## Overview

The PeerGrid matchmaking pipeline runs entirely on **AWS Lambda** and is responsible for embedding researcher profiles and computing peer-to-peer recommendations. The system is designed to run as a fully automated nightly batch job with no manual intervention required.

---

## Architecture

The Lambda deployment consists of **three modules**:

| Module | Role |
|---|---|
| **Embedding Manager** | Orchestrates the embedding pipeline — identifies users that need processing, sends requests to the Embedding Model, and persists results to the database. |
| **Embedding Model** | A standalone Lambda that hosts a pure embedding model (MiniLM). It receives text payloads in a predefined format and returns embedding vectors — nothing more. |
| **Matchmaking** | Consumes the stored embeddings and topic profiles to compute researcher-to-researcher similarity scores, then writes the top-K recommendations back to the database. |

---

## Nightly Execution Flow

The entire pipeline is triggered automatically via **AWS EventBridge** on the following schedule (times in CET/German local time):

```
┌──────────────────────────────────────────────────────────────────────┐
│  01:00  Embedding Manager triggers                                   │
│         ├─ Queries the DB for users who have linked their OpenAlex   │
│         │  profile but whose research topics and paper abstracts     │
│         │  have NOT yet been embedded.                               │
│         ├─ Sends the relevant text data to the Embedding Model       │
│         │  in the agreed-upon request format.                        │
│         ├─ Receives embedding vectors back from the Model            │
│         │  in the agreed-upon response format.                       │
│         └─ Stores the resulting embeddings in the database.          │
│                                                                      │
│  02:00  Matchmaking triggers                                         │
│         ├─ Queries the DB for users who have embeddings stored       │
│         │  but do NOT yet have matchmaking results.                  │
│         ├─ Computes pairwise similarity using topic hierarchy        │
│         │  overlap (weighted across topic / subfield / field)        │
│         │  and MiniLM cosine similarity on paper embeddings.         │
│         └─ Writes the top-K recommendations per user to the DB.     │
└──────────────────────────────────────────────────────────────────────┘
```

### Step-by-step

1. **01:00 CET — Embedding phase**
   - The **Embedding Manager** is invoked by EventBridge.
   - It identifies registered users whose research topics and top-5 paper abstracts have not yet been embedded.
   - It packages the text data and sends it to the **Embedding Model** Lambda.
   - The Embedding Model returns the embedding vectors, which the Manager writes to the database.

2. **02:00 CET — Matchmaking phase**
   - The **Matchmaking** Lambda is invoked by EventBridge.
   - It loads all available embeddings and topic profiles from the database.
   - For every user with embeddings but no existing recommendations, it computes similarity scores against all other users using a weighted combination of:
     - **Topic similarity** (hierarchical cosine similarity across topic → subfield → field levels)
     - **MiniLM similarity** (cosine similarity between paper abstract embeddings)
   - Co-authors are excluded from recommendations to promote novel connections.
   - The top-K results per user are written to the `User_Recommendations` table.

---

## Key File

| File | Description |
|---|---|
| `matchmaking.py` | Core matchmaking logic — scoring, ranking, and DB persistence. |
| `openAlexTopics.csv` | OpenAlex topic hierarchy used for multi-level topic similarity. Must be included in the Lambda deployment package. |

---

## Questions?

This README provides a simple summary of the system. If you have any questions about specific components, the scoring algorithm,deployment configuration, or anything else — don't hesitate to ask. Happy to clarify any details!
