# LoRA Craft

## Overview

LoRA Craft is a professional desktop application for building high-quality LoRA (Low-Rank Adaptation) training datasets for AI image models like Flux and SDXL. The application provides an end-to-end workflow for collecting, organizing, captioning, and exporting image datasets for model training.

The application is built as a cross-platform desktop app using modern web technologies, offering both cloud-based and local-first modes of operation. It features a workspace-based organization where users create "Concepts" (workspaces) containing multiple datasets, with each dataset consisting of images and associated metadata.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Application Architecture

**Dual-Mode Desktop Application**
- The application supports two deployment modes: cloud-based (web) and local desktop (Electron/Tauri)
- Mode is determined by the `ELECTRON_APP` environment variable
- Local mode uses SQLite with local file storage; cloud mode uses PostgreSQL with Google Cloud Storage
- This architectural decision allows users to choose between centralized cloud deployment or privacy-focused local-only operation

**Frontend Framework**
- React-based single-page application with TypeScript
- Vite for build tooling and development server
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query (React Query) for server state management and caching
- Shadcn/ui components with Radix UI primitives for accessible, customizable UI components

**Backend Framework**
- Express.js REST API server
- Modular route organization with separate files for different feature domains
- Middleware for request logging and error handling

### Database Layer

**Dual Database Strategy**
- Cloud mode: PostgreSQL via Neon serverless with Drizzle ORM
- Desktop mode: Better-SQLite3 for local database with compatible schema
- Database adapter pattern (`databaseAdapter.ts`) provides unified interface across both modes
- Schema defined in shared TypeScript file (`shared/schema.ts`) using Drizzle ORM definitions

**Data Model**
- Workspaces (top-level organization units)
- Datasets (collections within workspaces)
- Images (individual items with metadata: captions, tags, dimensions, hashes)
- Exports (generated dataset bundles)
- Tasks (background job tracking)

### Storage Layer

**Dual Storage Strategy**
- Cloud mode: Google Cloud Storage via `@google-cloud/storage` SDK
- Desktop mode: Local filesystem storage in `data/storage` directory
- Storage adapter pattern (`storageAdapter.ts`) provides unified interface
- Organized into logical buckets/folders: images, thumbnails, exports

**Image Processing Pipeline**
- Sharp library for image resizing, cropping, and format conversion
- SHA-256 hashing for duplicate detection
- Thumbnail generation for UI performance
- Background removal capability (optional)

### External Dependencies

**AI Services**
- OpenAI API for image captioning using GPT-4 Vision (gpt-4o-mini)
- Configurable base URL supports OpenAI-compatible APIs
- Caption generation with detailed prompts optimized for training datasets

**Search Engine Integrations**
- Multi-engine image search: Brave, Bing, Google, Pinterest, Reddit
- User-initiated searches with manual image selection (privacy-focused design)
- Each engine requires separate API credentials
- Results normalized to common interface regardless of source

**Model Training Integration**
- Replicate.com API for automated LoRA training
- Supports Flux Dev LoRA Trainer model
- Configurable training parameters (steps, rank, batch size, learning rate)
- Job status polling and result retrieval

### Desktop Application Framework

**Multi-Framework Support**
- Electron framework with custom main process and preload scripts
- Tauri framework configuration (alternative Rust-based approach)
- Native window controls, file dialogs, and system integration
- Settings persistence via electron-store

**Security Model**
- Context isolation enabled in Electron
- IPC communication via exposed APIs in preload script
- No node integration in renderer process
- Settings stored securely in OS-appropriate locations

### UI/UX Design Patterns

**Windows 11-Inspired Design System**
- Dark theme with glass-effect (backdrop blur) styling
- CSS custom properties for consistent theming
- Desktop-native interactions (disabled text selection, context menus)
- Drag-and-drop file uploads with visual feedback
- Custom title bar for frameless window appearance

**State Management**
- React Query for server state with aggressive caching
- Local React state for UI-only concerns
- Optimistic updates for immediate user feedback
- Query invalidation strategies for data consistency

### Build and Deployment

**Multi-Target Build System**
- Vite builds React frontend
- esbuild bundles Node.js server for production
- Electron-builder packages desktop applications (Windows NSIS, Mac DMG, Linux)
- Tauri CLI provides alternative build path with Rust backend
- Separate development and production server configurations

**Development Workflow**
- Hot module replacement via Vite in development
- Separate dev scripts for cloud vs. desktop modes
- Database migrations via Drizzle Kit
- TypeScript compilation checking without emission