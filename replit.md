# LoRA Craft

## Overview

LoRA Craft is an end-to-end dataset builder for training LoRA (Low-Rank Adaptation) image models for systems like Flux and SDXL. The application provides a complete workflow for collecting, organizing, captioning, and preparing image datasets for AI model training. It follows a workspace-based organization where users create workspaces containing multiple datasets, with each dataset consisting of images and their associated metadata (captions, tags, aspect ratios).

The application is designed as a cross-platform desktop tool with support for both cloud-based (Replit) and local Electron/Tauri deployments.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Deployment Architecture

**Multi-Platform Strategy**: The application supports three deployment modes:
- **Cloud (Replit)**: Web-based deployment using PostgreSQL and Google Cloud Storage
- **Electron Desktop**: Standalone desktop application with local SQLite database and filesystem storage
- **Tauri Desktop**: Alternative desktop runtime (planned/partial implementation)

**Rationale**: This multi-platform approach allows users to choose between cloud convenience and local data privacy. The architecture abstracts storage and database layers to support both environments seamlessly.

### Application Structure

**Monorepo Architecture**: Full-stack TypeScript monorepo with clear separation:
- `client/`: React SPA built with Vite
- `server/`: Express.js REST API
- `shared/`: Common types and Drizzle schemas for end-to-end type safety
- `electron/`: Electron main/preload processes
- `src-tauri/`: Tauri desktop configuration

**Rationale**: Shared types eliminate duplication and ensure consistency across frontend and backend. The monorepo structure simplifies dependency management and enables atomic changes across the stack.

### Frontend Architecture

**UI Framework**: React with TypeScript using functional components and hooks exclusively

**Styling**: TailwindCSS with shadcn/ui component library
- Custom dark theme optimized for image viewing (`#0f0f0f`, `#121212`, `#1d1d1d` backgrounds)
- Windows 11-inspired glass effect styling with CSS variables
- "new-york" variant of shadcn/ui components

**State Management**:
- **TanStack Query (React Query)** for all server state, caching, and API data synchronization
- **Local component state** (useState) for UI-specific concerns
- No global state library needed

**Rationale**: React Query eliminates Redux complexity by handling server state, automatic refetching, optimistic updates, and cache invalidation. This significantly simplifies the architecture while providing robust data synchronization.

**Routing**: Wouter - minimal routing library chosen for simplicity over React Router for this SPA's limited routing needs

**Key UI Patterns**:
- Three-panel layout: Sidebar (workspaces/datasets) → Main grid (images) → Detail panel (metadata editing)
- Drag-and-drop file upload with progress feedback
- Real-time image preview and inline metadata editing
- Toast notifications for user feedback

### Backend Architecture

**API Framework**: Express.js REST API with TypeScript

**Database Layer**: Dual-mode database abstraction
- **Cloud Mode**: PostgreSQL via Neon serverless with Drizzle ORM
- **Electron Mode**: SQLite via better-sqlite3 with custom adapter
- **Abstract Interface** (`IDatabase`): Both implementations conform to the same interface defined in `server/databaseAdapter.ts`

**Rationale**: The adapter pattern allows seamless switching between cloud PostgreSQL and local SQLite without changing business logic. Drizzle provides type-safe queries while remaining database-agnostic at the schema level.

**File Storage**: Dual-mode storage abstraction
- **Cloud Mode**: Google Cloud Storage with Replit sidecar authentication
- **Electron Mode**: Local filesystem storage in user data directory
- **Abstract Interface** (`StorageService`): Unified API in `server/storageAdapter.ts`

**Rationale**: Storage abstraction enables the same codebase to work with cloud object storage or local files, chosen at runtime based on deployment mode.

**Image Processing**: Sharp library for server-side image manipulation
- Resizing and aspect ratio normalization
- Thumbnail generation
- Background removal support

**API Architecture**:
- RESTful endpoints organized by resource (`/api/workspaces`, `/api/datasets`, `/api/images`)
- Multipart form data for file uploads via multer
- Zod schema validation for request bodies
- Error handling middleware with consistent error responses

### Database Schema

**Core Entities** (defined in `shared/schema.ts`):
- **Workspaces**: Top-level organization containers
- **Datasets**: Collections of images within workspaces, linked to training jobs
- **Images**: Individual image records with metadata (caption, tags, dimensions, hash)
- **Exports**: Dataset export records with download URLs
- **Tasks**: Async operation tracking (captioning, deduplication, exports)

**Key Design Decisions**:
- Cascade deletes ensure referential integrity (deleting workspace removes all datasets and images)
- Image hashing (SHA-256) for duplicate detection within datasets
- Aspect ratio stored as text for flexible matching
- Status fields for tracking async operations (captioning, cropping, training)

**Rationale**: The schema balances normalization with query performance. Cascade deletes prevent orphaned records. Hash-based deduplication is fast and reliable for identifying duplicate uploads.

### AI Integration Layer

**Caption Generation**: OpenAI GPT-4o-mini via OpenAI SDK
- Automated image captioning with detailed prompt engineering
- System prompt optimized for training dataset quality
- Base64 image encoding for API transmission

**Configuration**: AI API keys configurable via:
- Environment variables (cloud deployment)
- Electron settings store (desktop deployment)
- Runtime settings API endpoint

**Rationale**: Using GPT-4o-mini provides high-quality captions at reasonable cost. The prompt engineering ensures captions are suitable for LoRA training (detailed, natural language, no preamble).

**Training Integration**: Replicate API integration (partial implementation in `server/replicateIntegration.ts`)
- Flux LoRA trainer model support
- Training job status tracking
- Model weight download URLs

### Cross-Platform Desktop Support

**Electron Implementation**:
- Main process handles window management, file dialogs, and local settings storage
- Preload script exposes safe IPC APIs to renderer
- electron-store for persistent user settings
- Local server bundled and spawned as child process

**Tauri v2 Implementation**:
- Configuration present in `src-tauri/tauri.conf.json`
- Uses Tauri v2 API (@tauri-apps/api v2.x) for all native operations
- Custom window decorations with draggable title bar and window controls
- Window controls use `@tauri-apps/api/window` (getCurrentWindow().minimize(), maximize(), close())
- Lighter alternative to Electron using Rust backend
- **Development Mode**: Run `npm run dev` first to start the Express server, then `npm run tauri:dev`
- **Production Builds**: Requires sidecar configuration to bundle and run the Express server
- Native scrolling with `overflow-y-auto` instead of custom ScrollArea components for better Webview2 performance

**Settings Management**:
- Cloud: Environment variables
- Desktop: Electron-store or Tauri preferences
- Unified API endpoint (`/api/settings`) abstracts platform differences

**Rationale**: Electron provides mature desktop integration. Tauri offers a lighter alternative. The adapter pattern allows the same frontend to work with either runtime.

## External Dependencies

### Cloud Services (Replit Deployment)

**PostgreSQL Database**: Neon serverless PostgreSQL
- Accessed via `@neondatabase/serverless` with WebSocket support
- Connection pooling for serverless environments
- Drizzle ORM for type-safe queries and migrations

**Object Storage**: Google Cloud Storage via Replit sidecar
- Custom authentication via Replit sidecar endpoint (`127.0.0.1:1106`)
- External account credentials with token URL
- Handles image files, thumbnails, and export archives

**Rationale**: Neon provides serverless PostgreSQL that scales to zero. GCS via Replit sidecar simplifies deployment without managing credentials. Both integrate seamlessly with Replit's infrastructure.

### AI Services

**OpenAI API**: GPT-4o-mini for image captioning
- Configurable base URL and API key
- Vision capabilities for image-to-text generation
- Supports custom prompts for training-optimized captions

**Replicate API**: LoRA model training (partial integration)
- Flux Dev LoRA trainer model
- Async training job management
- Model weight storage and retrieval

### Desktop Dependencies

**Electron**: Desktop application framework
- Window management and native dialogs
- IPC for secure renderer-main communication
- electron-builder for packaging and distribution

**Better-sqlite3**: High-performance synchronous SQLite
- Used in Electron mode for local database
- Faster than async alternatives for desktop use
- WAL mode for concurrent read access

**Local File System**: Native Node.js fs module for file storage in desktop mode

### Frontend Libraries

**React Ecosystem**:
- React 18 with TypeScript
- Vite for fast development and optimized builds
- TanStack Query for server state management
- Wouter for lightweight routing

**UI Components**:
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library (Radix + Tailwind + custom styling)
- Lucide React for icons

**Image Upload**: Uppy (references in package.json)
- Dashboard UI for file selection
- AWS S3 integration support
- Progress tracking and file validation

### Image Processing

**Sharp**: High-performance image processing
- Image resizing and format conversion
- Thumbnail generation
- Background removal support (via OpenAI API integration)

### Development Tools

**TypeScript**: End-to-end type safety
**Drizzle Kit**: Database migrations and schema management
**ESBuild**: Fast bundling for server code
**PostCSS + Autoprefixer**: CSS processing for Tailwind

### Build and Packaging

**Vite**: Frontend bundling and development server
**ESBuild**: Server code bundling for production
**electron-builder**: Desktop application packaging (Windows, macOS, Linux)
**Tauri CLI**: Alternative desktop packaging