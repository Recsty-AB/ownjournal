import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const condition = false;
    expect(cn('class1', condition && 'class2', 'class3')).toBe('class1 class3');
  });

  it('should handle undefined and null', () => {
    expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2');
  });

  it('should merge tailwind classes correctly', () => {
    // twMerge should handle conflicting tailwind classes
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6');
  });

  it('should handle empty input', () => {
    expect(cn()).toBe('');
  });

  it('should handle arrays of classes', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
  });

  it('should handle objects with boolean values', () => {
    expect(cn({ class1: true, class2: false, class3: true })).toBe('class1 class3');
  });

  it('should merge complex tailwind utilities', () => {
    // Test that conflicting utilities are properly merged
    expect(cn('text-red-500 bg-blue-500', 'text-green-500')).toBe('bg-blue-500 text-green-500');
  });

  it('should handle nested arrays and objects', () => {
    expect(cn(
      'base-class',
      ['array-class-1', 'array-class-2'],
      { 'object-class': true, 'hidden-class': false },
      'final-class'
    )).toBe('base-class array-class-1 array-class-2 object-class final-class');
  });
});
