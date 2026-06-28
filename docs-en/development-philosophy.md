# Development Environment Philosophy

This project follows a Docker-first development workflow.

The Windows host machine should remain as clean as possible.

## Philosophy

The host operating system is NOT a development environment.

The host is only responsible for:

- Docker Desktop
- Git
- VS Code
- WSL2
- Browser

Everything else must run inside Docker containers.

---

## Mandatory Rule

Do NOT instruct the developer to install runtimes or package managers on the host machine.

Examples:

❌ Node.js

❌ npm

❌ pnpm

❌ Python

❌ Redis

❌ PostgreSQL

❌ RabbitMQ

❌ Nginx

❌ PHP

All of them must run inside Docker containers.

---

## Preferred Workflow

VS Code

↓

Docker Compose

↓

Frontend Container

↓

Backend Container

↓

Redis Container

↓

PostgreSQL Container

↓

Worker Container

---

## Exception

Host installations are only acceptable if absolutely required by Docker Desktop or VS Code itself.

Otherwise, assume everything is containerized.

---

Whenever suggesting installation steps, always prefer Docker-based solutions over native host installation.