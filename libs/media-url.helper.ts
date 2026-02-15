import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Shared helper for constructing full media URLs from relative paths
 * This eliminates code duplication across all services
 */
@Injectable()
export class MediaUrlHelper {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('media.base_url') || 'http://localhost:4000';
  }

  /**
   * Construct full URL from relative path
   * @param relativePath - Relative path or full URL
   * @returns Full URL or null
   */
  constructUrl(relativePath: string | null | undefined): string | null {
    if (!relativePath) return null;
    
    // Backward compatibility: if already full URL, return as is
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    
    // Construct full URL from relative path
    return `${this.baseUrl}/${relativePath}`;
  }

  /**
   * Construct URLs for array of paths
   * @param relativePaths - Array of relative paths
   * @returns Array of full URLs
   */
  constructUrls(relativePaths: string[] | null | undefined): string[] {
    if (!relativePaths || !Array.isArray(relativePaths)) return [];
    return relativePaths.map(path => this.constructUrl(path)).filter(Boolean) as string[];
  }

  /**
   * Construct URLs for object with media fields
   * Handles string fields, array fields, and nested objects
   * 
   * @param obj - Object containing media fields
   * @param fields - Array of field names to process
   * @returns Object with constructed URLs
   * 
   * @example
   * // Simple fields
   * constructObjectUrls(doctor, ['avatarURL', 'licenseUrl'])
   * 
   * // Array fields
   * constructObjectUrls(post, ['media'])
   * 
   * // Nested objects with arrays
   * constructObjectUrls(doctor, ['services']) // handles services[].imageService[]
   */
  constructObjectUrls<T extends Record<string, any>>(
    obj: T | null | undefined,
    fields: (keyof T)[]
  ): T | null {
    if (!obj) return null;
    
    const result = { ...obj };
    
    for (const field of fields) {
      const value = obj[field];
      
      if (!value) continue;
      
      if (typeof value === 'string') {
        // Handle string fields (e.g., avatarURL, icon, licenseUrl)
        result[field] = this.constructUrl(value) as any;
      } else if (Array.isArray(value)) {
        // Check if it's array of strings or array of objects
        if (value.length === 0) continue;
        
        if (typeof value[0] === 'string') {
          // Array of strings (e.g., media[], serviceImages[])
          result[field] = this.constructUrls(value) as any;
        } else if (typeof value[0] === 'object') {
          // Array of objects (e.g., services[] with imageService)
          result[field] = value.map(item => {
            if (item && item.imageService && Array.isArray(item.imageService)) {
              return {
                ...item,
                imageService: this.constructUrls(item.imageService)
              };
            }
            return item;
          }) as any;
        }
      }
    }
    
    return result;
  }

  /**
   * Construct URLs for array of objects
   * @param objects - Array of objects
   * @param fields - Fields to process in each object
   * @returns Array of objects with constructed URLs
   */
  constructArrayUrls<T extends Record<string, any>>(
    objects: T[] | null | undefined,
    fields: (keyof T)[]
  ): T[] {
    if (!objects || !Array.isArray(objects)) return [];
    return objects.map(obj => this.constructObjectUrls(obj, fields)).filter(Boolean) as T[];
  }
}
