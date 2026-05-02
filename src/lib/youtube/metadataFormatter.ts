/**
 * YouTube Video Metadata Formatter
 *
 * This module provides utility functions for formatting video metadata according to
 * YouTube's requirements and constraints.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7
 */

/**
 * YouTube video privacy status options
 */
export type YouTubePrivacyStatus = "PUBLIC" | "UNLISTED" | "PRIVATE";

/**
 * YouTube video category IDs
 * Full list: https://developers.google.com/youtube/v3/docs/videoCategories/list
 */
export enum YouTubeCategory {
  FILM_ANIMATION = 1,
  AUTOS_VEHICLES = 2,
  MUSIC = 10,
  PETS_ANIMALS = 15,
  SPORTS = 17,
  SHORT_MOVIES = 18,
  TRAVEL_EVENTS = 19,
  GAMING = 20,
  VIDEOBLOGGING = 21,
  PEOPLE_BLOGS = 22, // Default
  COMEDY = 23,
  ENTERTAINMENT = 24,
  NEWS_POLITICS = 25,
  HOWTO_STYLE = 26,
  EDUCATION = 27,
  SCIENCE_TECHNOLOGY = 28,
  NONPROFITS_ACTIVISM = 29,
}

/**
 * Parameters for formatting video metadata
 */
export interface FormatMetadataParams {
  title: string;
  description?: string;
  categoryId?: number;
  privacyStatus?: YouTubePrivacyStatus;
}

/**
 * Formatted video metadata ready for YouTube API
 */
export interface FormattedMetadata {
  snippet: {
    title: string;
    description: string;
    categoryId: string;
  };
  status: {
    privacyStatus: YouTubePrivacyStatus;
  };
}

/**
 * Truncates a string to a maximum length
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated text
 *
 * Requirements: 16.1, 16.2
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength);
}

/**
 * Escapes special characters in text for YouTube API
 *
 * YouTube API accepts most characters, but we escape HTML special characters
 * to prevent potential issues with XML/JSON encoding.
 *
 * @param text - The text to escape
 * @returns Escaped text
 *
 * Requirement: 16.3
 */
function escapeSpecialCharacters(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Formats a video title according to YouTube's requirements
 *
 * - Truncates to 100 characters if longer
 * - Escapes special characters
 *
 * @param title - The video title
 * @returns Formatted title
 *
 * Requirements: 16.1, 16.3
 *
 * @example
 * formatTitle('My Amazing Video Title That Is Way Too Long And Needs To Be Truncated Because It Exceeds The Maximum Length Allowed By YouTube API')
 * // Returns: 'My Amazing Video Title That Is Way Too Long And Needs To Be Truncated Because It Exceeds The M'
 */
export function formatTitle(title: string): string {
  // Truncate to 100 characters
  const truncated = truncateText(title, 100);

  // Escape special characters
  return escapeSpecialCharacters(truncated);
}

/**
 * Formats a video description according to YouTube's requirements
 *
 * - Truncates to 5000 characters if longer
 * - Escapes special characters
 * - Returns empty string if description is not provided
 *
 * @param description - The video description (optional)
 * @returns Formatted description
 *
 * Requirements: 16.2, 16.3
 *
 * @example
 * formatDescription('Check out this amazing video! <script>alert("xss")</script>')
 * // Returns: 'Check out this amazing video! &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function formatDescription(description?: string): string {
  if (!description) {
    return "";
  }

  // Truncate to 5000 characters
  const truncated = truncateText(description, 5000);

  // Escape special characters
  return escapeSpecialCharacters(truncated);
}

/**
 * Formats complete video metadata for YouTube API
 *
 * This function combines all metadata formatting rules and applies defaults:
 * - Default category: 22 (People & Blogs)
 * - Default privacy status: PUBLIC
 *
 * @param params - Metadata parameters
 * @returns Formatted metadata object ready for YouTube API
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7
 *
 * @example
 * const metadata = formatVideoMetadata({
 *   title: 'My Video Title',
 *   description: 'This is my video description',
 *   categoryId: 20, // Gaming
 *   privacyStatus: 'UNLISTED'
 * });
 *
 * @example
 * // Using defaults
 * const metadata = formatVideoMetadata({
 *   title: 'My Video Title'
 * });
 * // Returns metadata with category 22 (People & Blogs) and privacy PUBLIC
 */
export function formatVideoMetadata(params: FormatMetadataParams): FormattedMetadata {
  const {
    title,
    description,
    categoryId = YouTubeCategory.PEOPLE_BLOGS, // Requirement: 16.4, 16.6
    privacyStatus = "PUBLIC", // Requirement: 16.5, 16.7
  } = params;

  return {
    snippet: {
      title: formatTitle(title),
      description: formatDescription(description),
      categoryId: categoryId.toString(),
    },
    status: {
      privacyStatus,
    },
  };
}
