import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

/**
 * Google Sign-In, native flow.
 *
 * The native SDK returns a Google ID token, which we hand to Supabase via
 * `signInWithIdToken`. No browser round-trip and no deep-link callback — the
 * user taps their account in the system sheet and is signed in.
 *
 * On Android the app is identified by package name + SHA-1 registered against
 * the *Android* OAuth client, but the token itself is minted for the *Web*
 * client — that is why `webClientId` is required on Android too, and why it
 * must be the same client ID configured in Supabase.
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

let configured = false;

/** True when the build has the client IDs it needs to show a Google button. */
export function isGoogleSignInAvailable() {
  if (Platform.OS === 'web') return false;
  if (!WEB_CLIENT_ID) return false;
  // iOS additionally needs its own client ID; Android does not.
  if (Platform.OS === 'ios' && !IOS_CLIENT_ID) return false;
  return true;
}

function configure() {
  if (configured) return;

  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    // Ignored on Android — only read on iOS.
    iosClientId: IOS_CLIENT_ID || undefined,
    // We only need identity, not Drive/Calendar scopes.
    scopes: ['profile', 'email'],
    // Ask for an ID token; that is the whole point of this flow.
    offlineAccess: false,
  });

  configured = true;
}

export class GoogleSignInCancelled extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelled';
  }
}

export interface GoogleCredential {
  idToken: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Opens the native account picker and returns the Google ID token.
 * Throws `GoogleSignInCancelled` when the user backs out.
 */
export async function signInWithGoogleNative(): Promise<GoogleCredential> {
  if (!isGoogleSignInAvailable()) {
    throw new Error(
      'Google sign-in is not configured for this build. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and rebuild.'
    );
  }

  configure();

  // Android only — surfaces a clear error instead of a crash on devices
  // without a current Play Services version.
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  try {
    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      throw new GoogleSignInCancelled();
    }

    const idToken = response.data?.idToken;
    if (!idToken) {
      throw new Error('Google did not return an ID token. Check your OAuth client setup.');
    }

    const user = response.data?.user;
    return {
      idToken,
      email: user?.email ?? null,
      name: user?.name ?? user?.givenName ?? null,
      avatarUrl: user?.photo ?? null,
    };
  } catch (err) {
    if (err instanceof GoogleSignInCancelled) throw err;

    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleSignInCancelled();
        case statusCodes.IN_PROGRESS:
          throw new Error('A Google sign-in is already in progress.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error('Google Play Services is unavailable or out of date on this device.');
        default:
          break;
      }
    }

    throw err;
  }
}

/**
 * Clears the cached Google account. Without this, the next sign-in silently
 * reuses the previous account instead of showing the picker.
 */
export async function signOutFromGoogle() {
  if (!configured) return;

  try {
    await GoogleSignin.signOut();
  } catch {
    // Never block app sign-out on a Google SDK failure.
  }
}
