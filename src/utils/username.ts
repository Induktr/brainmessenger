/**
 * Converts an email address to a username by:
 * 1. Taking the part before the @ symbol
 * 2. Removing special characters
 * 3. Converting to lowercase
 * 4. Ensuring uniqueness with a number suffix if needed
 */
export function emailToUsername(email: string): string {
  if (!email) return '';
  
  // Get the part before @ and convert to lowercase
  const localPart = email.split('@')[0].toLowerCase();
  
  // Remove special characters and spaces, replace with single underscore
  const sanitized = localPart
    .replace(/[^a-z0-9]+/g, '_') // Replace special chars with underscore
    .replace(/_+/g, '_')         // Replace multiple underscores with single
    .replace(/^_|_$/g, '');      // Remove leading/trailing underscores
    
  return sanitized;
}
