const path = require("path");

const appRoot = path.resolve(__dirname, "..");
const novaDir = path.join(appRoot, "nova");

module.exports = {
  apps: [
    {
      name: "nova-hr",
      cwd: novaDir,
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
