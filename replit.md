# LoRA Craft

## Overview

LoRA Craft is an end-to-end dataset builder designed for training LoRA (Low-Rank Adaptation) image models for systems like Flux and SDXL. The application provides a complete workflow for collecting, organizing, cleaning, and preparing image datasets, then exporting them for model training or pushing them directly to Replicate.com for training.

The application follows a workspace-based organization where users create workspaces containing multiple datasets. Each dataset consists of images with associated metadata (captions, tags, aspect ratios) that can be cleaned, deduplicated, and prepared according to LoRA training best practices.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Application Structure

**Monorepo Architecture**: The application uses a full-stack TypeScript monorepo with clear separation between client, server, and shared code:

- **Client**: React-based SPA built with Vite, located in `client/`
- **Server**: Express.js REST API, located in `server/`
- **Shared**: Common types and schemas in `shared/`, enabling type safety across the stack

**Rationale**: This structure provides end-to-end type safety while maintaining clear boundaries between frontend and backend concerns. The shared folder eliminates type duplication and ensures consistency.

### Frontend Architecture

**UI Framework**: React with TypeScript, using functional components and hooks exclusively

**Styling System**: TailwindCSS with shadcn/ui component library
- Provides a consistent design system with the "new-york" style variant
- Custom dark theme optimized for image viewing (`#0f0f0f`, `#121212`, `#1d1d1d` backgrounds)
- CSS variables for theming flexibility

**State Management**: 
- **TanStack Query (React Query)** for server state and API data caching
- **Local component state** (useState) for UI-specific state
- No global state management library needed due to React Query's robust caching

**Rationale**: React Query eliminates the need for Redux/similar by handling all server state, automatic refetching, optimistic updates, and cache invalidation. This simplifies the architecture significantly.

**Routing**: Wouter - a minimal routing library
- Chosen for simplicity over React Router
- Single-page application with minimal routing needs

**Key UI Patterns**:
- Three-panel layout: Sidebar (workspaces/datasets) → Main grid (images) → Detail panel (selected image)
- Drag-and-drop file upload with progress feedback
- Real-time image preview and metadata editing
- Toast notifications for user feedback

### Backend Architecture

**Framework**: Express.js with TypeScript

**Database**: PostgreSQL via Neon serverless with Drizzle ORM
- **Schema-first design**: All database schemas defined in `shared/schema.ts`
- **Drizzle ORM** chosen for type-safe SQL queries and excellent TypeScript integration
- **Migration management**: Using drizzle-kit for schema migrations

**Key Database Tables**:
- `workspaces`: Top-level organizational containers
- `datasets`: Collections of images within workspaces
- `images`: Individual images with metadata (captions, tags, dimensions, hashes)
- `exports`: Export jobs and their status
- `tasks`: Background task tracking (deduplication, captioning, etc.)

**Rationale**: Drizzle provides compile-time type safety without code generation overhead, and its schema definition approach keeps types synchronized automatically. Neon serverless provides connection pooling and autoscaling.

### File Storage Architecture

**Primary Storage**: Google Cloud Storage via Replit's object storage sidecar
- External account authentication using Replit's sidecar service
- Stores original images and generated thumbnails
- Bucket-based organization matching workspace/dataset hierarchy

**Storage Service Pattern**: 
- Abstract storage interface (`IStorage`) with concrete implementation
- Separates business logic from storage implementation details
- Enables future storage backend swaps if needed

**File Processing**:
- **Multer** for handling multipart/form-data uploads
- In-memory buffering before cloud storage upload
- SHA-256 hash generation for duplicate detection
- Automatic thumbnail generation (implementation pending)

**Rationale**: Cloud storage offloads file management from the database and enables CDN integration for faster image delivery. The sidecar pattern simplifies authentication in the Replit environment.

### Data Validation

**Zod Schema Validation**: End-to-end validation using Zod schemas
- Schemas defined alongside Drizzle table definitions
- Same schemas used for API request validation and TypeScript types
- Automatic type inference eliminates manual type definitions

**Validation Flow**:
1. API receives request → 2. Zod validates payload → 3. Drizzle ensures DB type safety → 4. Response types auto-inferred

**Rationale**: Single source of truth for data shapes. Zod schemas serve triple duty (runtime validation, TypeScript types, API documentation).

### Image Processing Pipeline

**Planned Features** (architecture in place, implementation in progress):

1. **Deduplication**: SHA-256 hashing with database lookups to flag duplicates
2. **Auto-captioning**: Integration points prepared for BLIP/LLaVA models
3. **Aspect Ratio Enforcement**: Metadata tracking for target ratios
4. **Face/Subject Cropping**: Planned integration with image processing libraries

**Task System**: Background task tracking table for long-running operations
- Status tracking (pending, running, completed, failed)
- Progress percentage
- Error logging

### Export System

**Dataset Export Structure**:
- ZIP archive generation using `archiver` library
- Industry-standard folder structure for LoRA training
- Images + caption files + metadata JSON
- Stored in cloud storage for download

**Export Flow**:
1. Create export record → 2. Package images and metadata → 3. Upload to storage → 4. Return download URL

### API Design

**RESTful Conventions**:
- Resource-oriented endpoints (`/api/workspaces`, `/api/datasets`, `/api/images`)
- Standard HTTP methods (GET, POST, PATCH, DELETE)
- Nested routes for resource relationships (`/api/workspaces/:id/datasets`)

**Error Handling**:
- Centralized error middleware
- Consistent error response format
- Status code conventions (400 validation, 404 not found, 500 server error)

**Request/Response Patterns**:
- JSON payloads
- Credential-based authentication (session cookies)
- CORS configured for development

## External Dependencies

### Cloud Services

**Neon Database** (PostgreSQL):
- Serverless PostgreSQL database
- Connection via `@neondatabase/serverless` with WebSocket support
- Environment variable: `DATABASE_URL`

**Google Cloud Storage**:
- Image and file storage
- Accessed via Replit's object storage sidecar
- Authentication through external account credentials
- No direct GCP API keys needed (sidecar handles auth)

### Planned Integrations

**Replicate.com API**:
- Architecture prepared for direct dataset upload
- Training job submission and status tracking
- Model URL retrieval after training completion
- Implementation: HTTP client integration needed

**Image Search APIs** (planned):
- Google/Bing/Brave image search integration points
- Architecture supports pluggable search providers

**AI Captioning Services** (planned):
- BLIP or LLaVA model integration for auto-captioning
- Task-based processing for async caption generation

### Development Tools

**Vite**: Frontend build tool and dev server
- HMR (Hot Module Replacement) in development
- Optimized production builds
- Replit-specific plugins for error overlays and dev tooling

**Drizzle Kit**: Database migration tool
- Schema synchronization via `db:push` command
- Migration generation and management

**TypeScript**: Type safety across entire stack
- Strict mode enabled
- ESNext module system
- Path aliases for clean imports (`@/`, `@shared/`)

### UI Component Libraries

**shadcn/ui**: Pre-built accessible components
- Based on Radix UI primitives
- Full Radix UI component suite available (accordion, dialog, dropdown, etc.)
- Customized with TailwindCSS

**React Query**: Server state management
- Automatic caching and revalidation
- Optimistic updates
- Query invalidation on mutations

### File Processing

**Multer**: Multipart form data handling
- 50MB file size limit
- Image-only file filtering
- Memory storage for cloud upload pipeline

**Archiver**: ZIP file generation for exports
- Streaming archive creation
- Efficient for large datasets

### Build and Runtime

**esbuild**: Server-side bundling for production
- Fast compilation
- ESM output format
- External package handling

**tsx**: Development TypeScript execution
- Direct TS execution without compilation step
- Used in `dev` script for hot reloading