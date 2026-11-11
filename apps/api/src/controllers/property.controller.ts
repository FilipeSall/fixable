import type { FastifyReply } from 'fastify';
import type { PropertyAttribute } from '@fixable/shared';
import * as propertyService from '../services/property.service.ts';
import type {
  AttributeRequest,
  CreateAttributeRequest,
  PlatformDeps,
  PropertyIdRequest,
  UpdateAttributeRequest,
} from '../types/platform.types.ts';

/** Cria o controller dos dados da residência, com listagem, inclusão, edição e remoção de informações. */
export function createPropertyController({ db }: PlatformDeps) {
  return {
    listAttributes: (request: PropertyIdRequest): Promise<PropertyAttribute[]> => {
      return propertyService.listAttributes(db, request.user!, request.params.id);
    },

    addAttribute: async (request: CreateAttributeRequest, reply: FastifyReply): Promise<PropertyAttribute> => {
      const attribute = await propertyService.addAttribute(db, request.user!, request.params.id, request.body);
      reply.status(201);
      return attribute;
    },

    updateAttribute: (request: UpdateAttributeRequest): Promise<PropertyAttribute> => {
      const { id, attrId } = request.params;
      return propertyService.updateAttribute(db, request.user!, id, attrId, request.body);
    },

    deleteAttribute: async (request: AttributeRequest, reply: FastifyReply): Promise<FastifyReply> => {
      await propertyService.deleteAttribute(db, request.user!, request.params.id, request.params.attrId);
      return reply.status(204).send();
    },
  };
}
