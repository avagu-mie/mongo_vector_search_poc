# The MongoDB Vector Search POC Drama: A Journey of Pain and Triumph 🎭

## Act 1: The Naive Beginning
**"It should be easy, right?"**

Started with high hopes: MongoDB Community Edition 8.2 supports vector search! Just download it and go!

**Reality Check #1:** MongoDB Community Edition alone doesn't do vector search. You need **mongot** (a separate binary that nobody tells you about upfront).

**The Revelation:**
```
MongoDB docs: "Use $vectorSearch for semantic search!"
Me: "Great! Let me try it..."
MongoDB: "CommandNotSupported: $vectorSearch requires mongot"
Me: "What's mongot?"
MongoDB: "🤷"
```

---

## Act 2: The Docker Debacle
**"Let's use Docker!"**

**Problem:** mongot Docker images don't exist publicly.

**The Download Quest:**
- ❌ Searched Docker Hub → Nothing
- ❌ Tried `docker pull mongodb/mongot` → Image not found
- ❌ MongoDB website download → 404 errors everywhere
- ❌ Attempted to construct download URLs manually → Authentication required
- ❌ Tried various version numbers → All broken
- ❌ Searched GitHub for mongot source → Proprietary, not available

**The Breakthrough:** 
User manually downloaded mongot from MongoDB Enterprise downloads (after creating an account and navigating a maze of download pages) and saved the day!

**Lesson Learned:** MongoDB makes it intentionally hard to get mongot outside of Atlas. They want you on their cloud platform.

---

## Act 3: The Replica Set Requirement
**"Why won't mongot connect?"**

Got mongot running in a Docker container, but it kept crashing with mysterious errors:

```
ERROR: oplog.rs collection not found
FATAL: Cannot sync from MongoDB - no oplog available
Container mongot_vector_search exited with code 1
```

**The Investigation:**
```bash
$ docker logs mongot_vector_search
"Replica set oplog not found"
```

**Discovery:** mongot requires MongoDB to run as a **replica set**, not standalone mode.

**But why?!** 
- mongot needs to tail the oplog (operation log) to keep search indexes synchronized
- When you insert/update/delete a document, mongot watches the oplog to update its Lucene indexes
- The oplog only exists in replica set mode (it's how MongoDB does replication)
- Even a single-node "replica set" needs the oplog for mongot

**The Fix:**
```yaml
# docker-compose.yml
command: >
  mongod
  --replSet rs0  # ← This one line changes everything
```

Then initialize it:
```bash
docker exec mongodb_vector_search mongosh --eval "rs.initiate()"
```

**Lesson Learned:** mongot is designed for MongoDB Atlas (which always runs as replica sets). Local single-node setups need replica set mode anyway.

---

## Act 4: The Authentication Nightmare
**"SASL authentication failed"**

mongot crashed repeatedly with authentication errors. This was a multi-stage debugging nightmare:

### Attempt 1: No Authentication
```yaml
# mongot-config.yml
syncSource:
  replicaSet:
    hostAndPort: "mongodb:27017"
```

**Result:**
```
ERROR: Authentication required but no credentials provided
```

### Attempt 2: Basic Username/Password
```yaml
syncSource:
  replicaSet:
    hostAndPort: "mongodb:27017"
    username: "admin"
    password: "password123"
```

**Result:**
```
ERROR: "password" field not supported, use "passwordFile"
```

### Attempt 3: Password File (Wrong Permissions)
```yaml
syncSource:
  replicaSet:
    username: "admin"
    passwordFile: "/opt/mongot/password.txt"
```

```bash
$ echo "password123" > mongot-password.txt
$ chmod 644 mongot-password.txt
```

**Result:**
```
ERROR: Password file permissions too open (must be 400 or 600)
```

### Attempt 4: Fixed Permissions (Wrong Auth Mechanism)
```bash
$ chmod 400 mongot-password.txt
```

**Result:**
```
MongoSecurityException: Exception authenticating MongoCredential{
  mechanism=SCRAM-SHA-1, userName='admin', source='admin'
}
Caused by: MongoCommandException: Command failed with error 18 
(AuthenticationFailed): 'Authentication failed.'
```

**The Discovery:** MongoDB 8.0+ removed SCRAM-SHA-1 support! Only SCRAM-SHA-256 is allowed.

### Attempt 5: Try to Specify Auth Mechanism in Config
```yaml
syncSource:
  replicaSet:
    authenticationMechanism: "SCRAM-SHA-256"
```

**Result:**
```
BsonParseException: "syncSource.replicaSet" unrecognized field 
"authenticationMechanism"
```

mongot config doesn't support specifying the auth mechanism! 😱

### Attempt 6: Create User with Correct Mechanism
```javascript
db.createUser({
  user: 'mongotUser',
  pwd: 'password123',
  roles: [{ role: 'searchCoordinator', db: 'admin' }],
  mechanisms: ['SCRAM-SHA-256']  // ← THE CRITICAL LINE
});
```

**Result:** ✅ **SUCCESS!**

**Lessons Learned:**
1. mongot requires `passwordFile`, not inline passwords
2. Password file needs exactly 400 permissions (not 600, not 644)
3. MongoDB 8.0+ only supports SCRAM-SHA-256
4. You must create users with explicit `mechanisms: ['SCRAM-SHA-256']`
5. mongot config doesn't let you specify auth mechanism—it relies on MongoDB's default

---

## Act 5: The Keyfile Conundrum
**"Replica sets need keyfiles for internal authentication"**

Even with a single-node replica set, MongoDB requires a keyfile for security.

**The Challenge:**
```bash
# Generate keyfile
$ openssl rand -base64 756 > mongodb-keyfile

# Set permissions
$ chmod 600 mongodb-keyfile  # MongoDB requires owner-only read/write
```

**Docker Volume Mount Issues on macOS:**
- File permissions get weird when mounting from macOS to Linux containers
- Docker Desktop on macOS runs containers in a VM
- Permission bits don't always translate correctly

**The Solution:**
```yaml
# docker-compose.yml
volumes:
  - ./mongodb-keyfile:/data/mongodb-keyfile:ro  # Mount as read-only
```

```bash
# Inside container startup
command: >
  bash -c "
    chmod 600 /data/mongodb-keyfile &&  # Fix permissions inside container
    mongod --keyFile /data/mongodb-keyfile ...
  "
```

**Lesson Learned:** Keyfiles are required for replica sets, even single-node ones. Docker volume permissions need special handling.

---

## Act 6: The Configuration Parameter Maze
**"Using $search requires additional configuration"**

Finally got MongoDB and mongot both running and connected! Tried a vector search:

```javascript
db.products.aggregate([{
  $vectorSearch: {
    queryVector: [...],
    path: "embedding"
  }
}])
```

**Result:**
```
MongoServerError: Using $search and $vectorSearch aggregation stages 
requires additional configuration. Please connect to Atlas or an Atlas 
Data Lake to use $search and $vectorSearch.
```

**Translation:** "We want you to pay for Atlas, but fine, here are the parameters you need..."

### The Parameter Hunt

**Attempt 1: Obvious Parameter**
```bash
--setParameter searchIndexManagementHostAndPort=mongot:27027
```

**Result:** Still failing. Need more parameters.

**Attempt 2: Add mongotHost**
```bash
--setParameter mongotHost=mongot:27027
```

**Result:** Still failing!

**Attempt 3: Research MongoDB Docs (finally found buried in a changelog)**

Required parameters:
```bash
--setParameter searchIndexManagementHostAndPort=mongot:27027
--setParameter mongotHost=mongot:27027
--setParameter skipAuthenticationToSearchIndexManagementServer=false
--setParameter useGrpcForSearch=true
```

**Result:** ✅ **Finally working!**

**The Confusion:**
- `searchIndexManagementHostAndPort` - Where to send index management commands
- `mongotHost` - Where to send actual search queries (why separate?!)
- `skipAuthenticationToSearchIndexManagementServer=false` - Require auth (double negative!)
- `useGrpcForSearch=true` - Use gRPC protocol (as opposed to what? HTTP?)

**Lesson Learned:** MongoDB's documentation for Community Edition + mongot is intentionally sparse. They really want you on Atlas.

---

## Act 7: The searchCoordinator Role Discovery
**"Access denied even with admin user"**

mongot was connecting but failing with permission errors:

```
MongoCommandException: Command failed with error 13 (Unauthorized): 
'not authorized on admin to execute command'
```

**The Problem:** Using the admin user with `root` role wasn't enough!

**The Discovery:** Found buried in MongoDB docs that mongot requires a user with the `searchCoordinator` role:

```javascript
db.createUser({
  user: 'mongotUser',  // Separate user just for mongot!
  pwd: 'password123',
  roles: [{ 
    role: 'searchCoordinator',  // Special role for search operations
    db: 'admin' 
  }],
  mechanisms: ['SCRAM-SHA-256']
});
```

**Why?** MongoDB uses role-based access control. The `searchCoordinator` role grants specific permissions needed for:
- Reading from all databases to build search indexes
- Managing search index metadata
- Syncing with mongot via internal commands

**Lesson Learned:** Even with root access, you need a specific role for mongot. MongoDB's security is thorough but confusing.

---

## Act 8: The Index Creation Saga
**"Why is there no index?"**

Created a vector search index using the collection helper:

```javascript
db.products.createSearchIndex({
  name: "vector_index",
  type: "vectorSearch",
  definition: {
    fields: [{
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    }]
  }
});
```

Checked mongot logs:
```
numExistingIndexes: 0
numDeletedIndexes: 0
numStagedIndexes: 0
```

**The index wasn't being created!**

**The Investigation:**
```bash
# Check MongoDB's search.indexes collection
$ docker exec mongodb_vector_search mongosh --eval "
  db.getSiblingDB('vector_search_db')
    .getCollection('search.indexes')
    .find({})
"
# Empty!
```

**The Problem:** The `createSearchIndex()` collection helper doesn't properly notify mongot in Community Edition.

**The Solution:** Use `db.runCommand()` instead:

```javascript
db.runCommand({
  createSearchIndexes: 'products',
  indexes: [{
    name: 'vector_index',
    type: 'vectorSearch',
    definition: {
      fields: [{
        type: 'vector',
        path: 'embedding',
        numDimensions: 1536,
        similarity: 'cosine'
      }]
    }
  }]
});
```

**Result:**
```javascript
{ 
  indexesCreated: [{ 
    id: '6927548be8bf7c2e4dd406eb', 
    name: 'vector_index' 
  }],
  ok: 1
}
```

Check mongot again:
```
numExistingIndexes: 1  // ✅ Success!
```

**Lessons Learned:**
1. Collection helpers (`createSearchIndex`) don't work reliably with mongot
2. Use `db.runCommand()` for proper index creation
3. Wait 5-10 seconds after index creation for mongot to build the Lucene index

---

## Act 9: The gRPC Connection Failure
**"Failed to establish connectivity of gRPC channel before deadline"**

Everything configured correctly, but vector searches failed:

```
MongoServerError: Executor error during aggregate command :: caused by :: 
Failed to establish connectivity of gRPC channel before deadline
```

**The Debugging Marathon:**

### Issue 1: Docker Network
```bash
# Check if containers can talk to each other
$ docker exec mongodb_vector_search ping mongot
ping: mongot: Name or service not known
```

**Problem:** Default bridge network doesn't provide DNS resolution.

**Solution:**
```yaml
# docker-compose.yml
networks:
  mongodb_network:
    driver: bridge

services:
  mongodb:
    networks:
      - mongodb_network
  mongot:
    networks:
      - mongodb_network
```

### Issue 2: mongot Not Listening
```bash
$ docker exec mongot_vector_search netstat -tuln | grep 27027
# Empty - mongot not listening!
```

**Problem:** mongot was binding to `127.0.0.1` (localhost only)

**Solution:**
```yaml
# mongot-config.yml
server:
  grpc:
    address: "0.0.0.0:27027"  # Listen on all interfaces
```

### Issue 3: mongot Crash-Looping
```bash
$ docker ps | grep mongot
mongot_vector_search   Restarting (1) Less than a second ago
```

**Problem:** mongot was crashing due to SCRAM-SHA-1 authentication failures

**Solution:** Recreate mongotUser with SCRAM-SHA-256 (see Act 4)

### Issue 4: Timing Issues
```bash
$ docker-compose up -d
# mongot starts before MongoDB is ready
# mongot fails to connect
# mongot crashes
```

**Solution:**
```yaml
# docker-compose.yml
services:
  mongot:
    depends_on:
      mongodb:
        condition: service_healthy  # Wait for MongoDB health check
```

**Lesson Learned:** Docker networking, timing, and configuration all had to be perfect for gRPC to work.

---

## Act 10: The Environment Variable Mystery
**"Why is seeding failing?"**

The Next.js application couldn't connect to MongoDB or OpenAI.

### Issue 1: Missing .env.local
```bash
$ curl -X POST http://localhost:3000/api/seed
<!DOCTYPE html>...  # HTML error page instead of JSON
```

**Problem:** No `.env.local` file existed!

**Solution:**
```bash
# Create .env.local
OPENAI_API_KEY=sk-...
MONGODB_URI=mongodb://admin:password123@localhost:27017/?authSource=admin&directConnection=true
```

### Issue 2: Wrong Connection String Format
First tried:
```
MONGODB_URI=mongodb://localhost:27017
```

**Problem:** Authentication required!

Then tried:
```
MONGODB_URI=mongodb://admin:password123@localhost:27017
```

**Problem:** `authSource` required!

**Final solution:**
```
MONGODB_URI=mongodb://admin:password123@localhost:27017/?authSource=admin&directConnection=true
```

### Issue 3: Next.js Not Picking Up Env Vars
```bash
# Modified .env.local but changes not reflected
```

**Problem:** Next.js dev server caches environment variables

**Solution:**
```bash
pkill -f "next dev"  # Kill old server
npm run dev          # Start fresh
```

**Lesson Learned:** Environment variables are finicky. Always restart the dev server after changes.

---

## Act 11: The Database Name Mismatch
**"Search works but returns no results"**

Vector search was finally working (no errors!) but returning empty results:

```json
{
  "success": true,
  "results": [],
  "count": 0
}
```

**The Investigation:**
```bash
# Check what databases exist
$ docker exec mongodb_vector_search mongosh --eval "show dbs"
admin            0.000GB
config           0.000GB
local            0.000GB
vector_search    0.000GB  # ← Products are here

# Check lib/mongodb.ts
const dbName = "vector_search_db";  # ← Connecting to wrong DB!
```

**Problem:** Code was connecting to `vector_search_db` but data was in `vector_search`

**Solution:** Changed default database name to match, reseeded data, recreated index.

**Lesson Learned:** Always verify your database names match across: code, seed scripts, and index creation commands.

---

## Act 12: The Triumphant Finale
**"IT FINALLY WORKS!"**

After:
- 15+ container restarts
- 8 configuration file modifications
- 20+ different error messages
- 10+ documentation pages consulted
- Multiple authentication mechanism attempts
- Replica set initialization
- Keyfile generation and permission fixes
- Docker network configuration
- gRPC troubleshooting
- Index creation debugging
- Environment variable wrestling

**The magic moment:**

```bash
$ curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"yoga mat"}'
```

**Response:**
```json
{
  "success": true,
  "query": "yoga mat",
  "results": [
    {
      "name": "Yoga Mat",
      "description": "Eco-friendly non-slip yoga mat...",
      "score": 0.8379503488540649
    },
    {
      "name": "Meditation Cushion",
      "score": 0.7328525185585022
    }
  ],
  "count": 10
}
```

**🎉 ACTUAL SEMANTIC SEARCH WORKING WITH MONGODB COMMUNITY EDITION! 🎉**

---

## The PostgreSQL Reality Check

After all this drama, someone pointed out:

**"But PostgreSQL + pgvector does this in 3 commands..."**

```sql
CREATE EXTENSION vector;
CREATE TABLE products (embedding vector(1536));
CREATE INDEX ON products USING hnsw (embedding vector_cosine_ops);
```

**Comparison:**

| Feature | PostgreSQL + pgvector | MongoDB + mongot |
|---------|----------------------|------------------|
| Setup complexity | ⭐ Simple | ⭐⭐⭐⭐⭐ Extremely complex |
| Number of processes | 1 (postgres) | 2 (mongod + mongot) |
| Replica set required | ❌ No | ✅ Yes |
| Keyfile required | ❌ No | ✅ Yes |
| Special auth mechanism | ❌ No | ✅ SCRAM-SHA-256 only |
| Docker images available | ✅ Yes, official | ❌ mongot not public |
| Index creation | Simple `CREATE INDEX` | Complex `runCommand` |
| Configuration files | 0-1 | 3+ (compose, mongot config, env) |
| gRPC setup | ❌ Not needed | ✅ Required |
| Works locally | ✅ Out of the box | ⚠️ After significant effort |
| Free tier cloud option | ✅ Many providers | ⚠️ Atlas only |

**The Honest Truth:**

MongoDB's approach only makes sense if:
1. You're already committed to MongoDB for document storage
2. You're willing to pay for Atlas (where all this is managed)
3. You enjoy pain and suffering

For a POC or local development, **PostgreSQL + pgvector is objectively superior**.

---

## Why MongoDB Made It This Hard

**Theory 1: Atlas Revenue**
- Make Community Edition painful → Push users to Atlas
- Atlas includes mongot pre-configured
- Atlas is MongoDB Inc's main revenue source

**Theory 2: Enterprise Focus**
- MongoDB Enterprise gets better mongot support
- Community Edition is deliberately second-class
- Force serious users to upgrade

**Theory 3: Architectural Decision**
- MongoDB chose to leverage Apache Lucene instead of building native vector search
- Lucene is a separate process by design
- The complexity is inherent to their architecture

**The Reality:** Probably all three. MongoDB is a business, and they're incentivized to make the free self-hosted option less appealing than paid Atlas.

---

## Key Lessons Learned

### 1. **mongot is NOT optional**
MongoDB Community Edition cannot do vector search without mongot. Period.

### 2. **Replica Set is mandatory**
Even single-node deployments need `--replSet` for mongot's oplog tailing.

### 3. **SCRAM-SHA-256 is critical**
MongoDB 8.0+ removed SCRAM-SHA-1. Users must be created with explicit `mechanisms: ['SCRAM-SHA-256']`.

### 4. **Password files need exact permissions**
- Not 644 (too open)
- Not 600 (mongot wants 400)
- Exactly **400** (owner read-only)

### 5. **Use `runCommand` for indexes**
Collection helpers (`createSearchIndex`) don't properly notify mongot. Use `db.runCommand({createSearchIndexes: ...})`.

### 6. **Four MongoDB parameters required**
```bash
--setParameter searchIndexManagementHostAndPort=mongot:27027
--setParameter mongotHost=mongot:27027
--setParameter skipAuthenticationToSearchIndexManagementServer=false
--setParameter useGrpcForSearch=true
```

### 7. **Docker networking matters**
- Custom bridge networks for DNS resolution
- `depends_on` with health checks for startup order
- `0.0.0.0` binding for cross-container communication

### 8. **mongot needs time to index**
Wait 5-10 seconds after `createSearchIndexes` for Lucene index to build.

### 9. **searchCoordinator role required**
Admin users aren't enough—mongot needs a user with the specific `searchCoordinator` role.

### 10. **PostgreSQL is simpler**
If you're starting from scratch and just need vector search, use PostgreSQL + pgvector. Save yourself the drama.

---

## The Stats

- **Docker containers restarted:** 15+
- **Configuration files modified:** 8
- **Error messages encountered:** 20+
- **Documentation pages consulted:** 10+
- **Authentication attempts:** 6
- **Index creation attempts:** 4
- **Hours invested:** Many
- **Sanity remaining:** Questionable
- **Final result:** Priceless ✨

---

## The Bottom Line

**Getting MongoDB Community Edition vector search working locally is:**
- ✅ Technically possible
- ❌ Practically reasonable
- 🤔 Worth it only if you're masochistic or already committed to MongoDB

**Better alternatives:**
1. **MongoDB Atlas** - Managed, mongot included, costs money but saves sanity
2. **PostgreSQL + pgvector** - Open source, simple, free, works great
3. **Specialized vector DBs** - Pinecone, Weaviate, Qdrant if you want pure vector search

**When this setup makes sense:**
- You're building for MongoDB Atlas deployment (test locally first)
- You need both document DB features AND vector search in one system
- Your organization is already standardized on MongoDB
- You enjoy debugging Docker networking issues

**When it doesn't:**
- You just want to try vector search (use pgvector)
- You're building an MVP (use pgvector or Atlas)
- You value your time (use pgvector)
- You value your sanity (use pgvector)

---

## Epilogue: Was It Worth It?

**What we proved:**
- ✅ MongoDB Community Edition CAN do vector search locally
- ✅ mongot works with proper configuration
- ✅ Native `$vectorSearch` aggregation performs well
- ✅ Semantic search with HNSW algorithm is fast and accurate

**What we learned:**
- ⚠️ MongoDB's architecture makes self-hosting complex
- ⚠️ Documentation for Community Edition + mongot is sparse
- ⚠️ MongoDB really wants you on Atlas
- ⚠️ PostgreSQL's integrated approach is superior for self-hosting

**The verdict:**
This POC successfully demonstrates MongoDB vector search, but also demonstrates why most developers choose either Atlas (managed) or PostgreSQL (simpler) instead of self-hosting MongoDB + mongot.

**Would I do this again?**
Only if someone paid me. Or if I lost a bet. 😅

**Achievement Unlocked:** 🏆 **MongoDB Vector Search Masochist**
*Successfully configured mongot locally without losing all sanity*

---

*This drama brought to you by: Docker, MongoDB, mongot, gRPC, SCRAM-SHA-256, replica sets, keyfiles, and an unhealthy amount of coffee.* ☕
