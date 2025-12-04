# MongoDB Community Edition 8.2 Vector Search POC

This is a proof-of-concept demonstrating **native vector search** using MongoDB Community Edition 8.2 with `mongot` (MongoDB's full-text search engine) and a Next.js frontend.

- Youtube short - https://youtube.com/shorts/s7BdWBz_VWs?si=8Px_ADmEXwVgdfF9
- [plan-mongodbVectorSearchPoc.prompt.md](.github/prompts/plan-mongodbVectorSearchPoc.prompt.md)
- [DRAMA.md](DRAMA.md)
- Try this out at: https://mongo-vector-search.opensource.mieweb.org/

## ✨ Features

- **MongoDB Community 8.2** with vector search capabilities
- **mongot 0.55.0** for search indexing and `$vectorSearch` aggregation
- **Next.js 15** with TypeScript and Tailwind CSS
- **OpenAI Embeddings** (text-embedding-3-small, 1536 dimensions)
- **Docker Compose** orchestration
- **Replica Set** with keyfile authentication

## 🏗️ Architecture

```
┌─────────────────┐
│   Next.js App   │
│  (Port 3000)    │
└────────┬────────┘
         │ MongoDB Driver
         ├──────────────────────┐
         │                      │
         v                      v
┌─────────────────┐    ┌──────────────────┐
│  MongoDB 8.2.2  │───▶│  mongot 0.55.0   │
│  (Port 27017)   │    │  gRPC on 27027   │
└─────────────────┘    └──────────────────┘
 Replica Set rs0       Vector Search Index
```

## 🚀 Quick Start

### Prerequisites

- Docker Desktop
- Node.js 25+ (for development)
- OpenAI API key
- **MongoDB Search (mongot)**: The `mongot-community` folder is required but excluded from the repository. Download the MongoDB Search Community Edition tarball, extract it, and rename the folder to `mongot-community` in the project root.

### Setup

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Create `.env.local`:

```env
OPENAI_API_KEY=your_openai_api_key_here
MONGODB_URI=mongodb://admin:password123@localhost:27017/?authSource=admin&directConnection=true
```

3. **Start MongoDB and mongot:**

```bash
docker-compose up -d
```

Wait for containers to be healthy (~10 seconds).

4. **Initialize MongoDB replica set and create search user:**

```bash
# Initialize replica set
docker exec mongodb_vector_search mongosh -u admin -p password123 --authenticationDatabase admin --eval "rs.initiate()"

# Create mongot user with SCRAM-SHA-256
docker exec mongodb_vector_search mongosh -u admin -p password123 --authenticationDatabase admin --eval "
db = db.getSiblingDB('admin');
db.createUser({
  user: 'mongotUser',
  pwd: 'password123',
  roles: [{ role: 'searchCoordinator', db: 'admin' }],
  mechanisms: ['SCRAM-SHA-256']
});
"
```

5. **Restart mongot to connect with the new user:**

```bash
docker restart mongot_vector_search
```

6. **Start the Next.js development server:**

```bash
npm run dev
```

7. **Seed the database and create the vector search index:**

Visit http://localhost:3000 and click **"Seed Database"**.

Then create the vector search index:

You can run the provided script:
```bash
./create-vector-index.sh
```

Or run the command manually:

```bash
docker exec mongodb_vector_search mongosh -u admin -p password123 --authenticationDatabase admin --eval "
db = db.getSiblingDB('vector_search_db');
db.runCommand({
  createSearchIndexes: 'products',
  indexes: [
    {
      name: 'vector_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 1536,
            similarity: 'cosine'
          }
        ]
      }
    }
  ]
});
"
```

8. **Test vector search:**

Go to http://localhost:3000 and search for:
- "yoga mat" → Returns Yoga Mat, Meditation Cushion, etc.
- "fitness" → Returns fitness-related products
- "office" → Returns Laptop Stand, Wireless Keyboard, etc.

## 📚 API Endpoints

### POST /api/seed
Seeds the database with 12 sample products and generates embeddings using OpenAI.

**Response:**
```json
{
  "success": true,
  "message": "Successfully seeded 12 products with embeddings",
  "count": 12
}
```

### POST /api/search
Performs vector search using the `$vectorSearch` aggregation stage.

**Request:**
```json
{
  "query": "yoga mat"
}
```

**Response:**
```json
{
  "success": true,
  "query": "yoga mat",
  "results": [
    {
      "_id": "...",
      "name": "Yoga Mat",
      "description": "...",
      "category": "Sports & Fitness",
      "price": 39.99,
      "score": 0.8379503488540649
    }
  ],
  "count": 10
}
```

## 🔧 Configuration Details

### MongoDB Parameters
The following parameters enable mongot integration (see `docker-compose.yml`):

- `searchIndexManagementHostAndPort=mongot:27027` - Where MongoDB sends index management requests
- `mongotHost=mongot:27027` - mongot's gRPC endpoint
- `skipAuthenticationToSearchIndexManagementServer=false` - Require auth for search operations
- `useGrpcForSearch=true` - Use gRPC protocol for search queries

### mongot Configuration
See `mongot-config.yml` for the complete configuration. Key points:

- **Authentication:** Uses `mongotUser` with `searchCoordinator` role
- **Auth Mechanism:** SCRAM-SHA-256 (required for MongoDB 8.2+)
- **Password:** Stored in `mongot-password.txt` with 400 permissions
- **Sync Source:** Connects to MongoDB replica set for index synchronization

### Important Notes

1. **SCRAM-SHA-256 Required:** MongoDB 8.0+ removed SCRAM-SHA-1. The `mongotUser` must be created with `mechanisms: ['SCRAM-SHA-256']`.

2. **Replica Set Required:** mongot requires MongoDB to run as a replica set, even with a single node.
   > **Why?** `mongot` stays in sync by watching the MongoDB **Oplog** (Operations Log). Standalone MongoDB instances do not have an Oplog; only Replica Sets do. Therefore, we must run a "Replica Set of 1" so that `mongot` has a stream of data changes to index.

3. **Keyfile Authentication:** The replica set uses keyfile auth for internal communication (`mongodb-keyfile` with 600 permissions).

4. **Index Creation:** Use `db.runCommand({createSearchIndexes: ...})` instead of the collection helper method for proper mongot integration.

## 🐛 Troubleshooting

### mongot crashes with "Authentication failed"
- Ensure `mongotUser` was created with `SCRAM-SHA-256` mechanism
- Check `mongot-password.txt` has correct password and 400 permissions

### Search returns empty results
- Verify the vector index was created: check mongot logs for `numExistingIndexes > 0`
- Ensure products were seeded with embeddings
- Wait 5-10 seconds after index creation for it to become active

### "Failed to establish connectivity of gRPC channel"
- Verify mongot container is running: `docker ps | grep mongot`
- Check MongoDB has correct parameters: `docker logs mongodb_vector_search | grep searchIndexManagementHostAndPort`
- Ensure mongot connected successfully: `docker logs mongot_vector_search | grep CONNECTED`

## 📦 Technology Stack

- **Backend:** Next.js 15.5.6, Node.js 25.2.1
- **Database:** MongoDB Community 8.2.2
- **Search Engine:** mongot 0.55.0
- **Frontend:** React 19, TypeScript 5.6.3, Tailwind CSS 3.4.15
- **Vector Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **Container:** Docker Compose with ubuntu:22.04 base images

## 📄 License

This is a proof-of-concept for educational purposes.

## 🔐 Configuration Files

### 1. mongot-password.txt
This file contains the plain text password used by the `mongot` process to authenticate with the MongoDB database.
"password123" is the default password set for mongodb in this POC.
- **How to create:**
  ```bash
  echo "password123" > mongot-password.txt
  chmod 400 mongot-password.txt
  ```
- **Content:** `password123` (must match the `mongotUser` password created in the database).

### 2. mongodb-keyfile
This file is used for internal authentication between MongoDB replica set members.
- **How to create:**
  ```bash
  openssl rand -base64 756 > mongodb-keyfile
  chmod 400 mongodb-keyfile
  ```

## 🐧 Debian Container Setup (PM2)

This project has been configured to run in a Debian-based container environment using **PM2** for process management. This setup replaces the manual `nohup` or Docker Compose method for this specific environment.

### Key Changes & Components

1.  **Process Management (PM2):**
    - We use `pm2` to manage `mongodb`, `mongot`, and `nextjs` processes.
    - Configuration is defined in `ecosystem.config.js`.
    - **Mongot Specifics:** The `mongot` process is a bash script wrapper, so it is configured with `interpreter: "/bin/bash"` in PM2 to avoid syntax errors.

2.  **Startup Script (`start-all.sh`):**
    - A comprehensive bootstrap script that:
        - Installs MongoDB 8.2 and Node.js if missing.
        - Sets up data directories and keyfiles.
        - Installs and configures PM2.
        - Cleans up old processes (`pkill`, `pm2 delete`).
        - Starts all services via PM2.
        - Initializes the MongoDB Replica Set (`rs0`) and creates required users (`admin`, `mongotUser`).

3.  **Usage:**
    To start the entire stack in this environment:
    ```bash
    sudo ./start-all.sh
    ```

    To manage processes:
    ```bash
    sudo pm2 status
    sudo pm2 logs
    sudo pm2 stop all
    sudo pm2 restart all
    ```
