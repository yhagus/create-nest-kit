/** `?page=1&limit=20`: list endpoints default to the first page of `DEFAULT_PAGE_SIZE` items. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** The body of every list endpoint. */
export interface Page<Item> {
  items: Item[];
  total: number;
  page: number;
  limit: number;
}
