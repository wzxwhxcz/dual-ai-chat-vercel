# Dual AI Chat - Claude Code Memory

## Project Overview
A dual AI chat application built with React + Vite, featuring two AI personalities (Cognito for logic, Muse for creativity) that can engage in conversations with users and each other.

## Tech Stack
- **Package Manager**: pnpm
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build Tool**: Vite with SWC
- **UI Components**: shadcn/ui (based on Radix UI primitives)
- **AI Services**: Google Gemini API, OpenAI-compatible APIs
- **Deployment**: Vercel
- **Linting**: ESLint with TypeScript support

## Project Structure
```
dual-ai-chat-vercel/
├── dual-ai-chat/           # Main application
│   ├── components/         # React components
│   │   ├── ui/            # Reusable UI components (shadcn/ui)
│   │   ├── SettingsModal.tsx
│   │   ├── ChatInput.tsx
│   │   ├── SessionManager.tsx
│   │   └── RoleManager.tsx
│   ├── lib/               # Utility functions
│   ├── services/          # API services
│   ├── types.ts           # TypeScript type definitions
│   └── constants.ts       # Application constants
├── vercel.json            # Vercel deployment config
└── CLAUDE.md             # This file
```

## Key Features
- **Dual AI Personalities**: Cognito (logical) and Muse (creative)
- **Multiple Discussion Modes**: Fixed turns or AI-driven conversations
- **Custom API Support**: Gemini API and OpenAI-compatible APIs
- **Session Management**: Save/load conversation sessions
- **Role Management**: Custom AI personas
- **Responsive UI**: Mobile-friendly design
- **Real-time Streaming**: Live response updates

## Development Commands
```bash
# Install dependencies
pnpm install

# Start development server with host access
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Run linting
pnpm run lint

# Run type checking
pnpm run type-check
```

## Recent Fixes & Improvements

### Settings Modal UI Fix (Latest)
- **Issue**: Settings modal had dark gray overlay and incorrect positioning
- **Fix**: 
  - Changed overlay from `bg-black/80` to `bg-black/20 backdrop-blur-sm`
  - Improved modal centering using flexbox layout
  - Added proper responsive sizing with `w-[95vw] max-w-4xl`
- **Files Modified**: 
  - `components/ui/dialog.tsx` (positioning system)
  - `components/SettingsModal.tsx` (responsive sizing)

### Stack Migration to pnpm + Enhanced SWC (Latest)
- **Package Manager**: Migrated to pnpm for better dependency management and workspace support
- **Build Tool**: Enhanced Vite with SWC optimizations and manual chunking
- **Linting**: Added ESLint with TypeScript and React hooks support
- **Development**: Improved dev server with host access and HMR optimizations
- **Performance**: Optimized build process with SWC minification and code splitting
- **Files Modified**: 
  - `package.json` (pnpm configuration, ESLint dependencies)
  - `vite.config.ts` (SWC optimizations, build improvements)
  - `.eslintrc.json` (new ESLint configuration)
  - `pnpm-workspace.yaml` (workspace configuration)

## Environment Variables
```bash
# Google Gemini API (default)
VITE_GEMINI_API_KEY=your_gemini_api_key

# Optional: Custom API endpoints can be configured in settings UI
```

## Deployment
- **Platform**: Vercel
- **Auto-deploy**: Pushes to `main` branch trigger deployment
- **Build Command**: `bun run build`
- **Output Directory**: `dist`

## API Configuration
The app supports multiple AI service providers:

1. **Google Gemini** (default)
   - Uses environment variable or custom API key
   - Supports thinking budget for enhanced responses

2. **OpenAI-Compatible APIs**
   - Supports local services (Ollama, LM Studio)
   - Custom base URL and model IDs
   - Optional API key authentication

## Common Issues & Solutions

### Build Failures
- **Missing Dependencies**: Run `pnpm install` to ensure all packages are installed
- **TypeScript Errors**: Run `pnpm run type-check` and check type definitions in `types.ts`
- **Linting Errors**: Run `pnpm run lint` to identify and fix linting issues
- **Import Errors**: Verify relative paths and file extensions
- **SWC Issues**: Ensure `@vitejs/plugin-react-swc` is properly configured in `vite.config.ts`

### UI Issues
- **Modal Positioning**: Dialog components use flexbox centering
- **Responsive Layout**: Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
- **Theme Consistency**: Follow existing color scheme in components

### API Issues
- **CORS Errors**: Use environment variables for API keys
- **Rate Limiting**: Implement proper error handling in services
- **Authentication**: Store API keys securely, never commit to repo

## Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow React functional component patterns
- Implement proper error boundaries
- Use Tailwind for styling (avoid custom CSS)

### Component Architecture
- Keep components small and focused
- Use composition over inheritance
- Implement proper prop interfaces
- Handle loading and error states

### Performance
- Lazy load components when possible
- Optimize re-renders with React.memo
- Use proper dependency arrays in hooks
- Implement streaming for real-time updates

## Testing
- Manual testing in development mode
- Test all modal dialogs and responsive layouts
- Verify API integrations with different providers
- Check deployment on Vercel staging

## Repository
- **GitHub**: https://github.com/wzxwhxcz/dual-ai-chat-vercel
- **Main Branch**: `main`
- **Deployment**: Auto-deploy on push to main

## Notes for Claude Code
- Use pnpm for all package management and script execution
- Always test settings modal after UI changes
- Verify shadcn/ui components are properly imported
- Check responsive design on multiple screen sizes
- Ensure API keys are handled securely
- Run `pnpm run lint` and `pnpm run type-check` before building
- Run `pnpm run build` before deploying to catch issues early
- SWC provides faster TypeScript compilation and minification than Babel/Terser