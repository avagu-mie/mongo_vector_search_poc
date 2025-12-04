#!/bin/bash

# Create vector search index for local mongot setup
mongosh -u admin -p password123 --authenticationDatabase admin --quiet --eval '
db = db.getSiblingDB("vector_search_db");

// Create the vector search index
db.products.createSearchIndex(
  "vector_index",
  {
    "mappings": {
      "dynamic": true,
      "fields": {
        "embedding": {
          "type": "knnVector",
          "dimensions": 1536,
          "similarity": "cosine"
        }
      }
    }
  }
);

print("Vector search index created successfully!");
'
