#!/bin/bash
# Wait for MongoDB to be ready
sleep 5

# Initialize replica set
mongosh -u admin -p password123 --authenticationDatabase admin <<EOF
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "mongodb:27017" }]
})
EOF
