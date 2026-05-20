import { Linking, Platform } from 'react-native';
import { Tournament } from '~/types';

export function extractCoordinatesFromMapText(text: string | null | undefined) {
  if (!text) return null;

  let value = text.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original value if it is not URI encoded.
  }

  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /\b(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)\b/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (isValidCoordinates(latitude, longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

export function isValidCoordinates(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function getTournamentCoordinates(tournament: Tournament) {
  const latitude = Number(tournament.venue_latitude);
  const longitude = Number(tournament.venue_longitude);
  if (isValidCoordinates(latitude, longitude)) {
    return { latitude, longitude };
  }

  return extractCoordinatesFromMapText(tournament.venue_map_url);
}

export function getTournamentLocationLabel(tournament: Tournament) {
  return [tournament.venue, tournament.venue_address, tournament.city, tournament.state, 'India']
    .filter(Boolean)
    .join(', ');
}

export async function openTournamentMap(tournament: Tournament) {
  if (tournament.venue_map_url) {
    await Linking.openURL(tournament.venue_map_url);
    return;
  }

  const coordinates = getTournamentCoordinates(tournament);
  const label = encodeURIComponent(tournament.venue);

  if (coordinates) {
    const coordinateText = `${coordinates.latitude},${coordinates.longitude}`;
    const nativeUrl =
      Platform.OS === 'ios'
        ? `maps://?q=${coordinateText}`
        : `geo:${coordinateText}?q=${coordinateText}(${label})`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${coordinateText}`;
    await openUrlWithFallback(nativeUrl, webUrl);
    return;
  }

  await openLocationSearch(getTournamentLocationLabel(tournament));
}

export async function openLocationSearch(location: string) {
  const encodedLocation = encodeURIComponent(location);
  const nativeUrl =
    Platform.OS === 'ios' ? `maps://?q=${encodedLocation}` : `geo:0,0?q=${encodedLocation}`;
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
  await openUrlWithFallback(nativeUrl, webUrl);
}

async function openUrlWithFallback(nativeUrl: string, webUrl: string) {
  try {
    const canOpenNative = await Linking.canOpenURL(nativeUrl);
    await Linking.openURL(canOpenNative ? nativeUrl : webUrl);
  } catch {
    await Linking.openURL(webUrl);
  }
}
