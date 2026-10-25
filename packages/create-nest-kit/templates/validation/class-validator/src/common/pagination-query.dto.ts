import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { IsOmittable } from './is-omittable.js';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination.js';

/** `?page=1&limit=20`. Extend it for list endpoints that take more filters. */
export class PaginationQuery {
  @IsOmittable()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @IsOmittable()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;
}
