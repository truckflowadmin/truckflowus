/**
 * Background GPS tracking using expo-location + expo-task-manager.
 *
 * When a driver starts a job, we begin background location updates.
 * Every ~30 seconds, a batch of coordinates is sent to the backend.
 * Tracking stops when the driver completes/pauses the job.
 *
 * If location services are unavailable (e.g. running in Expo Go without
 * a native rebuild), all functions degrade gracefully — no crash alerts.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getToken, getApiUrl } from './api';

const LOCATION_TASK = 'TRUCKFLOW_BG_LOCATION';

// Store current job context for the background task
let _currentJobId: string | null = null;
let _currentAssignmentId: string | null = null;

/**
 * Check if location services are available on this device/build.
 * Returns false in Expo Go or builds missing Info.plist keys.
 */
async function isLocationAvailable(): Promise<boolean> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) return false;

    // Check current permission status WITHOUT triggering the native prompt.
    // This avoids the NSLocation*UsageDescription crash in Expo Go.
    const { status } = await Location.getForegroundPermissionsAsync();
    // If status is 'undetermined', requesting will trigger native prompt —
    // only safe if Info.plist keys exist (i.e. a proper dev build).
    // We'll attempt the request inside a try/catch in requestLocationPermissions.
    return true;
  } catch {
    return false;
  }
}

/**
 * Define the background task (must be called at module level, outside components).
 */
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('[Location] Background task error:', error);
    return;
  }

  if (data?.locations) {
    const locations = data.locations as Location.LocationObject[];
    await sendLocations(locations);
  }
});

async function sendLocations(locations: Location.LocationObject[]) {
  try {
    const token = await getToken();
    const apiUrl = await getApiUrl();
    if (!token || !_currentJobId) return;

    const payload = locations.map((loc) => ({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      heading: loc.coords.heading,
      altitude: loc.coords.altitude,
      timestamp: new Date(loc.timestamp).toISOString(),
    }));

    await fetch(`${apiUrl}/api/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Platform': 'mobile',
      },
      body: JSON.stringify({
        jobId: _currentJobId,
        assignmentId: _currentAssignmentId,
        locations: payload,
      }),
    });
  } catch (err) {
    console.error('[Location] Failed to send locations:', err);
  }
}

/**
 * Request location permissions (foreground + background).
 * Returns false gracefully if permissions can't be obtained.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const available = await isLocationAvailable();
    if (!available) {
      console.warn('[Location] Location services not available');
      return false;
    }

    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return false;

    // Background permissions — may not be available in all builds
    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      return bgStatus === 'granted';
    } catch {
      // Background location not available (e.g. Expo Go) — foreground-only is OK
      console.warn('[Location] Background permissions unavailable, using foreground only');
      return true;
    }
  } catch (err) {
    console.error('[Location] Permission request failed:', err);
    return false;
  }
}

/**
 * Start background GPS tracking for a job.
 */
export async function startTracking(jobId: string, assignmentId?: string): Promise<boolean> {
  _currentJobId = jobId;
  _currentAssignmentId = assignmentId || null;

  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) return false;

    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isTracking) {
      // Already tracking — just update the job context
      return true;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 30_000, // every 30 seconds
      distanceInterval: 50,  // or every 50 meters
      deferredUpdatesInterval: 30_000,
      deferredUpdatesDistance: 50,
      showsBackgroundLocationIndicator: true, // iOS blue bar
      foregroundService: {
        notificationTitle: 'TruckFlowUS',
        notificationBody: 'Tracking your delivery location',
        notificationColor: '#1E3A5F',
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
    });

    return true;
  } catch (err) {
    console.error('[Location] Failed to start tracking:', err);
    return false;
  }
}

/**
 * Stop background GPS tracking.
 */
export async function stopTracking() {
  _currentJobId = null;
  _currentAssignmentId = null;

  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (err) {
    console.error('[Location] Failed to stop tracking:', err);
  }
}

/**
 * Get current location (one-shot, for displaying on map).
 */
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const available = await isLocationAvailable();
    if (!available) return null;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    return null;
  }
}

/**
 * Check if tracking is currently active.
 */
export async function isTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}
