# MongoDB Vector Search PoC (Next.js + Community Edition 8.2)

Build a Next.js application with TypeScript demonstrating semantic search using MongoDB Community Edition 8.2 running locally with vector search capabilities. The app will showcase embedding generation, vector indexing, and semantic queries using the native `$vectorSearch` aggregation stage.

## Steps

1. **Set up MongoDB Community Edition 8.2 locally with Docker**
   - Use Docker Compose to run both `mongodb` and `mongot` binaries for search support
   - Configure the connection between MongoDB server and mongot search component
   - Verify the setup and ensure vector search capabilities are available

2. **Initialize a Next.js 15 project with TypeScript**
   - Create new Next.js app with TypeScript template
   - Install dependencies: `mongodb`, `openai` (or alternative embedding provider)
   - Configure environment variables for MongoDB connection and API keys

3. **Create MongoDB client connection (`lib/mongodb.ts`)**
   - Implement singleton pattern for MongoDB client to prevent connection pooling issues
   - Configure connection to local MongoDB Community Edition instance
   - Export reusable database and collection utilities

4. **Build seed API route (`app/api/seed/route.ts`)**
   - Generate embeddings for sample text data using chosen embedding provider
   - Insert documents with both raw text and vector embeddings into MongoDB collection
   - Return success/failure status and document count

5. **Implement search API route (`app/api/search/route.ts`)**
   - Accept search query from frontend
   - Convert query text to vector embedding
   - Execute `$vectorSearch` aggregation pipeline against MongoDB
   - Return top-k most semantically similar results with scores

6. **Create React UI (`app/page.tsx`)**
   - Build search input form for user queries
   - Display search results with relevance scores
   - Include seed data button to populate initial dataset
   - Show loading states and error handling

7. **Create vector search index configuration**
   - Provide JSON configuration for creating the vector search index
   - Document the process for creating the index via MongoDB shell or Compass
   - Specify index name, vector field path, dimensions, and similarity function

## Further Considerations

### 1. Docker vs Manual Install
- **Docker (Recommended)**: Quick setup with Docker Compose, includes both mongodb and mongot
- **Manual**: Download MongoDB 8.2+ and mongot binaries separately from MongoDB downloads page

### 2. Embedding Provider
- **OpenAI API**: Simple integration, requires API key, paid per token usage
  - Model: `text-embedding-3-small` (1536 dimensions)
- **Local Model**: Free, runs offline, heavier on resources
  - Option: `transformers.js` with open-source models

### 3. Sample Data Domain
- **Product Search**: E-commerce products with descriptions
- **Document Search**: Articles, blog posts, or documentation
- **FAQ System**: Question-answer pairs for customer support
- **Movie/Book Database**: Titles with plot summaries

### 4. Vector Search Index Parameters
- **Dimensions**: Must match embedding model (e.g., 1536 for OpenAI text-embedding-3-small)
- **Similarity**: Choose between `cosine`, `euclidean`, or `dotProduct`
- **numCandidates**: Candidates to consider during search (affects accuracy vs speed)

## Technical Requirements

- **MongoDB Community Edition**: 8.2+ (for vector search support)
- **Node.js**: 18+ (for Next.js 15)
- **Next.js**: 15.x with App Router
- **TypeScript**: 5.x
- **Docker**: Latest (if using containerized setup)

## Expected Outcomes

- Fully functional Next.js app with semantic search
- Local MongoDB instance with vector search enabled
- Sample dataset with vector embeddings
- Search interface demonstrating semantic similarity
- Documentation for creating vector search indexes
