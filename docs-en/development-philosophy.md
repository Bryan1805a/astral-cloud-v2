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

## Project Bootstrap Policy

This project is Docker-first from the very first command.

The project must never follow the workflow:

Host → Install Node.js → Create Project → Dockerize

Instead, the workflow is:

Host
→ Docker Compose
→ Development Container
→ Bootstrap Project
→ Install Dependencies
→ Run Development Server

Project scaffolding, dependency installation, code generation, package management, database migration, Prisma generation, Next.js creation, NestJS creation, and every development task must execute inside Docker containers.

Examples:

✅ docker compose run web pnpm create next-app

✅ docker compose run api pnpm install

✅ docker compose run api prisma migrate dev

❌ pnpm create next-app (host)

❌ npm install (host)

❌ npx prisma migrate (host)

❌ node scripts/... (host)

If proposing commands, always provide the Docker equivalent.