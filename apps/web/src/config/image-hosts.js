/**
 * Single source of truth for remote image hosts allowed through next/image.
 * Consumed by next.config.js (images.remotePatterns) and the Avatar
 * component's optimization guard. Plain CommonJS so next.config.js can require it.
 */
const IMAGE_HOSTS = [
  'res.cloudinary.com',
  'images.unsplash.com',
  // Google OAuth profile photos
  'lh3.googleusercontent.com',
]

module.exports = { IMAGE_HOSTS }
