# TruckFlowUS Driver App

Native mobile app for drivers built with Expo (React Native). Provides background GPS tracking, job management, photo upload (proof of delivery), and signature capture.

## Features

- **Phone + PIN login** — uses the same auth system as the web driver portal
- **Job list** — view assigned jobs and claim available jobs
- **Job detail** — see route, material, loads, and status
- **Start/Complete jobs** — update job status with one tap
- **Background GPS tracking** — tracks location every 30 seconds while a job is in progress, even when the app is backgrounded
- **Proof of delivery photos** — take photos with the camera or pick from library
- **Signature capture** — sign on screen to confirm delivery
- **Navigate to job** — tap an address to open Apple Maps or Google Maps
- **Pull to refresh** — always see the latest data

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)
- EAS CLI for building (`npm install -g eas-cli`)

### Install & Run

```bash
cd driver-app
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

### Environment

Create a `.env` file (or set in `app.json` > `extra`):

```
EXPO_PUBLIC_API_URL=https://truckflowus.com
```

The app defaults to `https://truckflowus.com` as the API base URL.

### Build for App Stores

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## Backend Changes Required

Before deploying, run the database migration:

```bash
npx prisma migrate deploy
```

This creates the `DriverLocation` and `ProofOfDelivery` tables.

New API endpoints added to the web backend:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/driver/jobs` | GET | List driver's jobs + available jobs |
| `/api/driver/jobs/[id]` | GET | Job detail with assignment status |
| `/api/driver/location` | POST | Receive GPS pings from app |
| `/api/driver/location` | GET | Get location history for a job |
| `/api/driver/pod` | POST | Upload POD photo or signature |
| `/api/driver/pod` | GET | List POD files for a job |
| `/api/tracking` | GET | Dispatcher: get active driver locations |

The driver auth endpoint (`/api/driver/auth`) now also returns the JWT token in the response body when `platform: 'mobile'` is included in the login request, since native apps can't use httpOnly cookies.

## Architecture

```
driver-app/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout (AuthProvider)
│   ├── index.tsx           # Entry: redirect to login or jobs
│   ├── auth/
│   │   └── login.tsx       # Phone + PIN login
│   ├── (tabs)/
│   │   ├── _layout.tsx     # Tab bar (Jobs, Tickets, Upload, Profile)
│   │   ├── jobs.tsx        # Job list
│   │   ├── tickets.tsx     # Ticket list
│   │   ├── camera.tsx      # Quick photo upload
│   │   └── profile.tsx     # Driver profile + logout
│   └── job/
│       └── [id].tsx        # Job detail + start/complete + POD
│           ├── photo.tsx   # POD photo capture
│           └── signature.tsx # Signature capture
├── src/
│   └── lib/
│       ├── api.ts          # HTTP client with JWT auth
│       ├── auth-context.tsx # Auth state management
│       ├── colors.ts       # Brand colors
│       └── location.ts     # Background GPS tracking
├── app.json                # Expo config (permissions, etc.)
└── package.json
```
