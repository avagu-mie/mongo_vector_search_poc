module.exports = {
  apps: [
    {
      name: "mongodb",
      script: "mongod",
      args: [
        "--bind_ip_all",
        "--replSet", "rs0",
        "--port", "27017",
        "--dbpath", "/data/db",
        "--keyFile", "/etc/mongodb-keyfile",
        "--setParameter", "searchIndexManagementHostAndPort=localhost:27027",
        "--setParameter", "mongotHost=localhost:27027",
        "--setParameter", "skipAuthenticationToSearchIndexManagementServer=false",
        "--setParameter", "useGrpcForSearch=true"
      ],
      autorestart: true,
      watch: false,
    },
    {
      name: "mongot",
      script: "./mongot-community/mongot",
      args: ["--config=./mongot-config.yml"],
      cwd: "/opt/mongo_vector_search_poc",
      interpreter: "/bin/bash",
      autorestart: true,
      watch: false,
    },
    {
      name: "nextjs",
      script: "npm",
      args: "run dev -- -p 80",
      cwd: "/opt/mongo_vector_search_poc",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};
