/**
 * Contest Status Calculation Utility
 * Calculates contest status based on start and end dates
 */

export type ContestStatus = 'upcoming' | 'live' | 'ended' | 'draft';

/**
 * Calculate contest status based on start and end dates
 * @param startDate - Contest start date (ISO string or Date)
 * @param endDate - Contest end date (ISO string or Date)
 * @returns Calculated status: 'upcoming', 'live', or 'ended'
 */
export function calculateContestStatus(
  startDate: string | Date,
  endDate: string | Date
): 'upcoming' | 'live' | 'ended' {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // If current time is before start date, contest is upcoming
  if (now < start) {
    return 'upcoming';
  }

  // If current time is between start and end date (inclusive), contest is live
  if (now >= start && now <= end) {
    return 'live';
  }

  // If current time is after end date, contest has ended
  if (now > end) {
    return 'ended';
  }

  // Fallback (shouldn't happen)
  return 'upcoming';
}

/**
 * Check if a contest status allows submissions
 * @param status - Contest status
 * @returns true if submissions are allowed
 */
export function allowsSubmissions(status: ContestStatus): boolean {
  return status === 'live';
}

