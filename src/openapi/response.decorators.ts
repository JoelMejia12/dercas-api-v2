import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { PageResponse } from './domain-response.models';

export function ApiPageResponse(itemType: Type<unknown>): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(PageResponse, itemType),
    ApiOkResponse({ schema: {
      type: 'object', required: ['items', 'hasMore'],
      properties: { items: { type: 'array', items: { $ref: getSchemaPath(itemType) } }, hasMore: { type: 'boolean' } },
    } }),
  );
}

export function ApiItemsPaginationResponse(itemType: Type<unknown>): MethodDecorator {
  return applyDecorators(ApiExtraModels(itemType), ApiOkResponse({ schema: {
    type: 'object', required: ['items', 'pagination'],
    properties: { items: { type: 'array', items: { $ref: getSchemaPath(itemType) } }, pagination: { type: 'object', required: ['limit', 'offset', 'hasMore'], properties: { limit: { type: 'integer' }, offset: { type: 'integer' }, hasMore: { type: 'boolean' } } } },
  } }));
}

export function ApiArrayResponse(itemType: Type<unknown>): MethodDecorator {
  return applyDecorators(ApiExtraModels(itemType), ApiOkResponse({ schema: { type: 'array', items: { $ref: getSchemaPath(itemType) } } }));
}

export function ApiModelResponse(model: Type<unknown>, nullable = false, status = 200): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({ status, schema: nullable ? { allOf: [{ $ref: getSchemaPath(model) }], nullable: true } : { $ref: getSchemaPath(model) } }),
  );
}
