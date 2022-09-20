/**
 * Returns a list containing all integers between the given start point and end
 * point. If the values for start and end are equal, an empty list is returned.
 * If the end point is less than the start point, a descending list is returned,
 * otherwise an ascending list is returned.
 *
 * @param start Start point of the range (inclusive)
 * @param end End point of the range (exclusive)
 * @returns A list with all integers between start and end
 */
export function Range(start: number, end: number) {
  if (start === end) {
    return [];
  }

  if (end < start) {
    return new Array(start - end).fill(null).map((_, i) => {
      return start - i;
    });
  }

  return new Array(end - start).fill(null).map((_, i) => {
    return start + i;
  });
}

/**
 * Tries to extract the values of the keys given as parameters from the
 * environment and throws an excaption if one of them cannot be found.
 *
 * @param keys Names of the keys that shall be extracted from the environment
 * @returns The values of the extracted keys as an array of strings
 */
export function getFromEnvironment(...keys: Array<string>): Array<string> {
  return keys.reduce<Array<string>>((values, k) => {
    const value = process.env[k];

    // Throw exception if value is not present in environment
    if (value === undefined) {
      throw new Error(`Environment has no key ${k}`);
    }

    return values.concat(value);
  }, []);
}
