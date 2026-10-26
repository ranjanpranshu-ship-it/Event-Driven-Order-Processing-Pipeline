# Event-Driven Order Processing Pipeline

A backend-focused order processing system built with **NestJS, Apache Kafka, Redis, MongoDB, Docker Compose, and Nginx**. It demonstrates asynchronous event processing, the cache-aside pattern, cache invalidation, and HTTP load balancing across multiple backend instances.

## Overview

The API decouples order creation from order persistence. When a client submits an order, the API publishes an event to Kafka and returns immediately. A Kafka consumer processes the event asynchronously and writes the order to MongoDB. Redis caches order reads to reduce repeated database lookups, and Nginx distributes incoming HTTP requests across two NestJS instances.

## Tech Stack

| Technology | Purpose |
|---|---|
| **NestJS** | Backend framework, REST API and microservices |
| **Apache Kafka** | Asynchronous messaging and event-driven processing |
| **MongoDB** | Order persistence |
| **TypeORM** | Database access and entity management |
| **Redis** | Caching and cache invalidation |
| **Nginx** | Reverse proxy and HTTP load balancing |
| **Docker Compose** | Containerized services and local orchestration |

## Architecture

```text
                         Client
                           |
                           v
                    Nginx :8082
               (reverse proxy / load balancer)
                    /          \
                   v          v
              edge1:3001   edge2:3001
             (NestJS instance) (NestJS instance)
                   |          |
        +----------+----------+-----------+
        |          |          |           |
        v          v          v           v
   Kafka      Redis     MongoDB      Kafka Consumer
 orders.created  (cache)   (persist)  orders.updated
 orders.updated
```

- Each `edge` container runs the NestJS HTTP server **and** a Kafka consumer microservice that shares the `db-pipeline-group` consumer group. Kafka therefore load-balances order events across the running instances.
- `POST /orders` emits an `orders.created` event. The consumer persists the order with an initial `pending` status and invalidates the related cache entries.
- `PATCH /orders/:orderId` emits an `orders.updated` event. The consumer applies the status change and invalidates the caches.

## Key Features

### 1. RESTful Order APIs

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/orders` | Submit an order (queues it for processing) |
| `GET` | `/orders` | Retrieve all orders |
| `GET` | `/orders/:orderId` | Retrieve a single order |
| `PATCH` | `/orders/:orderId` | Update order status |
| `GET` | `/health` | Check application health |

### 2. Event-Driven Order Processing

- Publishes order creation events to the `orders.created` Kafka topic.
- Processes events asynchronously with a NestJS Kafka consumer.
- Persists processed orders with an initial `pending` status.
- Uses Kafka consumer groups to coordinate processing across backend instances.

### 3. Redis Caching (Cache-Aside)

For reads, the application follows the cache-aside pattern:

1. Check Redis for the requested order (or the full order list).
2. Return the cached data when available.
3. Query MongoDB on a cache miss.
4. Store the retrieved data in Redis for subsequent requests.

`GET /orders` reports cache behavior through an `X-Cache` response header (`HIT` or `MISS`). After an order is created or updated, the consumer invalidates both the single-order cache and the `orders:all` list cache so stale data is never served.

### 4. Reverse Proxy and Load Balancing

Nginx is the single entry point for HTTP traffic and distributes requests across the two NestJS instances using the `least_conn` strategy.

### 5. Containerized Infrastructure

Docker Compose runs the application and its supporting services (Kafka, MongoDB, Redis, Nginx). Kafka topics are created automatically at startup and are idempotent, so the stack can be restarted safely.

## Project Structure

```text
.
├── src/
│   ├── config/
│   │   └── ORM.config.ts              # TypeORM (MongoDB) connection options
│   ├── health/
│   │   ├── health.controller.ts       # /health endpoint (Terminus)
│   │   └── health.module.ts
│   ├── kafka/
│   │   ├── kafka-consumer.controller.ts  # @EventPattern handlers
│   │   ├── kafka.module.ts
│   │   └── kafka-producer.service.ts
│   ├── orders/
│   │   ├── dto/                       # class-validator request payloads
│   │   ├── entities/order.entity.ts
│   │   ├── cache-keys.ts              # shared Redis cache keys / TTL
│   │   ├── orders.controller.ts
│   │   ├── orders.module.ts
│   │   └── orders.service.ts
│   ├── app.module.ts
│   └── main.ts                        # bootstrap, Swagger, hybrid microservice
├── migrations/                        # migrate-mongo migrations
├── test/                              # HTTP-level e2e tests
├── Dockerfile
├── Dockerfile.jenkins
├── Jenkinsfile
├── docker-compose.yaml
├── migrate-mongo-config.cjs
├── nginx.conf
└── README.md
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 22+ and pnpm (only required for local development and migrations)

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd <your-project-directory>
```

### 2. Start the services

```bash
docker compose up --build -d
```

This builds the application image and starts Kafka, MongoDB, Redis, Nginx, and the two NestJS instances.

### 3. Inspect the logs

```bash
docker compose logs -f edge1 edge2
```

To inspect all services:

```bash
docker compose logs -f
```

### 4. Access the API

The application is exposed through Nginx on port `8082`.

```text
http://localhost:8082
```

Example request:

```bash
curl -X POST http://localhost:8082/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product-123",
    "quantity": 2
  }'
```

The order is queued asynchronously. Wait a moment and then list the orders:

```bash
curl http://localhost:8082/orders
```

### 5. Stop the services

```bash
docker compose down
```

To also remove the persistent MongoDB volume, run the following only when you intend to delete the local database data:

```bash
docker compose down -v
```

## API Reference

Interactive documentation is available through Swagger UI at:

```text
http://localhost:8082/api/docs
```

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/orders` | Create a new order |
| `GET` | `/orders` | Retrieve all orders (includes `X-Cache` header) |
| `GET` | `/orders/:orderId` | Retrieve a single order |
| `PATCH` | `/orders/:orderId` | Update order status |
| `GET` | `/health` | Check dependency health |

Valid order statuses are `pending`, `confirmed`, `shipped`, `delivered`, and `cancelled`.

### Health Monitoring

`GET /health` uses **NestJS Terminus** to report the status of MongoDB and Redis. A successful response indicates that the monitored dependencies are available at the time of the check.

Example response:

```json
{
  "status": "ok",
  "info": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

## Database Migrations

MongoDB indexes are managed with reversible [migrate-mongo](https://github.com/seppevs/migrate-mongo) migrations located in `migrations/`.

- **`add-orders-index`** — creates a compound index on `{ productId: 1, status: 1 }` to speed up product/status filtered lookups.
- **`seed-orders`** — inserts 50 sample orders for local development.

Run the migrations against the Docker MongoDB instance:

```bash
pnpm migrate:up
```

Roll back the most recent migration (run the command again to roll back further):

```bash
pnpm migrate:down
```

The connection settings live in `migrate-mongo-config.cjs` and can be overridden with `MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_DATABASE`, or a full `MONGODB_URI`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | NestJS HTTP port (inside the container) |
| `KAFKA_BROKERS` | `kafka:9092` | Comma-separated Kafka broker list |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Redis connection settings |
| `REDIS_URL` | `redis://localhost:6379` | Optional full Redis URL |
| `MONGODB_HOST` / `MONGODB_PORT` | `localhost` / `27017` | MongoDB connection settings |
| `MONGODB_DATABASE` | `db-pipeline` | MongoDB database name |
| `KAFKAJS_NO_PARTITIONER_WARNING` | `1` | Suppresses a KafkaJS deprecation warning |

## Testing

The project uses [Vitest](https://vitest.dev/) for unit tests and HTTP-level end-to-end tests.

```bash
pnpm test        # unit tests
pnpm test:e2e    # HTTP-level e2e tests (no infrastructure required)
pnpm test:cov    # coverage report
```

The e2e suite boots the orders module and mocks MongoDB, Redis, and Kafka, so it runs without Docker.

## CI with Jenkins

A `Jenkinsfile` runs install, lint, test, and build stages. The Jenkins server is available as an opt-in Compose profile so it does not start with the default `docker compose up`:

```bash
docker compose --profile ci up -d
```

## Engineering Concepts Demonstrated

- REST API design with NestJS
- Input validation with class-validator and a global `ValidationPipe`
- Swagger/OpenAPI documentation
- Event-driven architecture and asynchronous messaging
- Kafka topics, producers, consumers, and consumer groups
- MongoDB persistence using TypeORM
- Redis cache-aside reads and cache invalidation
- Docker-based service orchestration and health checks
- Nginx reverse proxy and load balancing
- Reversible database migrations and indexing
- Separation of HTTP request handling from background processing

## Author

**Pranshu Ranjan Tiwari**

Backend Developer | NestJS | REST APIs | Event-Driven Systems

- GitLab: https://gitlab.com/ranjanpranshu-ship-it
- LinkedIn: https://www.linkedin.com/in/pranshu-ranjan-tiwari-77b6513b7/
