# LoRA Craft

## Overview

LoRA Craft is an end-to-end dataset builder designed for training LoRA (Low-Rank Adaptation) image models for systems like Flux and SDXL. The application provides a complete workflow for collecting, organizing, cleaning, and preparing image datasets, then exporting them for model training or pushing them directly to Replicate.com for training.

The application follows a workspace-based organization where users create workspaces (called "Concepts") containing multiple datasets. Each dataset consists of images with associated metadata (captions, tags, aspect ratios) that can be cleaned, deduplicated, and prepared according to LoRA training best practices.

## Getting Started

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. For desktop mode (Tauri), ensure you have [Rust](https://www.rust-lang.org/tools/install) installed.

### Running the Application

**Development (Desktop - Recommended):**
```bash
npm run tauri:dev
```

**Development (Web):**
```bash
npm run dev
```

**Production Build:**
```bash
npm run tauri:build
```

## Features

- **Web Image Search**: Search for images across multiple search engines (Brave, Bing, Google, Pinterest, Reddit)
- **Drag & Drop Upload**: Easily add local images to your datasets
- **Auto-Captioning**: Generate captions using AI (requires OpenAI API key)
- **Duplicate Detection**: Automatically detect and flag duplicate images
- **Dataset Export**: Export datasets in LoRA-ready format
- **Replicate Integration**: Train models directly on Replicate.com

## Search Engine API Keys

To use the web image search feature, you'll need to obtain API keys for at least one search engine. Configure these in **Settings > Search Engines**.

### Brave Search (Recommended - Free Tier Available)

Brave Search offers a generous free tier with 2,000 queries/month.

1. Go to [Brave Search API](https://brave.com/search/api/)
2. Click "Get Started for Free"
3. Create an account or sign in
4. Subscribe to the "Free" plan (2,000 queries/month) or a paid plan
5. Go to your [API Dashboard](https://api.search.brave.com/app/dashboard)
6. Copy your API key
7. Paste it in LoRA Craft Settings > Search Engines > Brave API Key

### Bing Image Search (Azure)

Bing Search is part of Azure Cognitive Services.

1. Go to [Azure Portal](https://portal.azure.com/)
2. Create an Azure account if you don't have one (free tier available)
3. Click "Create a resource"
4. Search for "Bing Search v7" and select it
5. Click "Create"
6. Fill in the required fields:
   - **Resource group**: Create new or select existing
   - **Name**: Choose a name for your resource
   - **Pricing tier**: F1 (Free - 1,000 transactions/month) or S1 (Paid)
7. Click "Review + create" then "Create"
8. Once deployed, go to your resource
9. Click "Keys and Endpoint" in the left sidebar
10. Copy "Key 1" or "Key 2"
11. Paste it in LoRA Craft Settings > Search Engines > Bing API Key

### Google Custom Search

Google Custom Search requires both an API key and a Search Engine ID.

**Step 1: Create API Key**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "API Key"
5. Copy the API key
6. (Optional) Click "Edit API key" to restrict it to Custom Search API

**Step 2: Create Custom Search Engine**
1. Go to [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Click "Add" to create a new search engine
3. Under "Sites to search", select "Search the entire web"
4. Give it a name and click "Create"
5. Click "Customize" on your new search engine
6. Copy the "Search engine ID" (cx)
7. Under "Image search", toggle it ON

**Step 3: Enable API**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Library"
3. Search for "Custom Search API"
4. Click on it and click "Enable"

**Step 4: Configure in LoRA Craft**
- Paste the API Key in Settings > Search Engines > Google API Key
- Paste the Search Engine ID in Settings > Search Engines > Google Search Engine ID

**Note**: Google Custom Search has a free tier of 100 queries/day. Additional queries cost $5 per 1,000.

### Pinterest

Pinterest API access requires a Pinterest Business account and app approval.

1. Go to [Pinterest Developers](https://developers.pinterest.com/)
2. Sign in with a Pinterest Business account
3. Click "My apps" > "Create app"
4. Fill in app details and submit for review
5. Once approved, go to your app's dashboard
6. Copy the access token
7. Paste it in LoRA Craft Settings > Search Engines > Pinterest Access Token

**Note**: Pinterest API access is more restrictive and may require app review approval.

### Reddit

Reddit API requires creating an app for OAuth2 credentials.

1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Scroll down and click "create another app..."
3. Fill in the details:
   - **Name**: LoRA Craft (or any name)
   - **App type**: Select "script"
   - **Description**: Optional
   - **About URL**: Optional
   - **Redirect URI**: `http://localhost:5000` (required but not used)
4. Click "create app"
5. Note down:
   - **Client ID**: The string under your app name (looks like random characters)
   - **Client Secret**: The "secret" field
6. Paste both in LoRA Craft Settings > Search Engines

**Note**: Reddit API is free but has rate limits (60 requests/minute for OAuth2).

### Recommended Setup

For the best experience, we recommend setting up **Brave Search** first:
- Easy signup process
- Generous free tier (2,000 queries/month)
- Good image search quality
- Fast API response times

You can add additional search engines later for more variety in search results.

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

## Desktop Application Architecture (Electron)

### Dual-Mode Architecture
The application supports both web (cloud-based) and desktop (local) deployments:

**Web Mode** (default):
- PostgreSQL database via Neon
- Google Cloud Storage for files
- Deployed as web application

**Desktop Mode** (Electron):
- SQLite database for local storage (`server/localDatabase.ts`)
- Local filesystem for images (`server/localFileStorage.ts`)
- Packaged as Windows executable with installer

### Electron Configuration
- **Main Process**: `electron/main.ts` - Window management, IPC handlers, server process management
- **Preload Script**: `electron/preload.ts` - Secure context bridge for renderer
- **Build Config**: `electron-builder.json` - Windows NSIS installer configuration

### Settings Management
- **Electron Store**: Persistent settings storage using `electron-store`
- **Settings API**: `/api/settings` endpoints for GET/PATCH operations
- **Settings UI**: `/settings` page with tabbed interface (API Keys, Search Engines, Preferences)

### Search Engine Integrations
Located in `server/searchEngines.ts`:
- **Brave Search**: Image search via Brave API
- **Bing Image Search**: Azure Cognitive Services integration
- **Google Custom Search**: Google CSE for image search

### Replicate.com Integration
Located in `server/replicateIntegration.ts`:
- Dataset preparation for LoRA training
- Training job submission and monitoring
- Model retrieval after training completion

## Visual Design System

### Windows 11-Inspired Theme
The application features a modern Windows 11-style dark theme with:

**Surface Levels** (depth system):
- `surface-0`: #0a0a0a (deepest/base)
- `surface-1`: #0f0f0f 
- `surface-2`: #141414
- `surface-3`: #1a1a1a
- `surface-4`: #1f1f1f (lightest)

**Glass Effects**:
- `glass`: Backdrop blur with semi-transparent backgrounds
- `sidebar-glass`: For the navigation sidebar
- `toolbar-glass`: For toolbars
- `panel-glass`: For detail panels

**Accent Color**:
- Pink: hsl(330 85% 60%) / #ff58a5

**Text Hierarchy**:
- `text-primary-emphasis`: White for headings
- `text-secondary`: 70% white for body text
- `text-tertiary`: 50% white for captions

**Animations**:
- All transitions use CSS variables (--transition-fast, --transition-normal)
- Easing: cubic-bezier(0.16, 1, 0.3, 1)
- Key animations: fadeIn, slideInRight, slideInUp, scaleIn

### Custom Title Bar
Located at `client/src/components/TitleBar.tsx`:
- Native Windows 11 appearance
- Draggable region for window movement
- Window controls (minimize, maximize, close)
- Tauri-aware for native window management

## Tauri Configuration (Desktop Build Alternative)

### Files
Located in `src-tauri/`:
- `Cargo.toml`: Rust dependencies (Tauri v2)
- `tauri.conf.json`: Build configuration
- `src/lib.rs`: Rust commands (window controls, app paths)
- `src/main.rs`: Entry point

### Building with Tauri
Requires Rust toolchain installed locally:
```bash
npm run tauri dev    # Development
npm run tauri build  # Production build
```


Built with ❤️ in ~/Los_Angeles by weezly.works & his army of robots.
