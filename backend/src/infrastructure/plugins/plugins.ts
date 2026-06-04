import type { Plugin } from '@hapi/hapi';
import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import hapiAuthJwt2 from 'hapi-auth-jwt2';
import * as HapiSwagger from 'hapi-swagger';
import pkg from '../../../package.json';

const swaggerOptions = {
  info: {
    title: 'ninjasset API',
    version: pkg.version,
  },
  documentationPath: '/docs',
  jsonPath: '/docs.json',
  grouping: 'tags',
};

export const plugins: Plugin<unknown>[] = [
  hapiAuthJwt2 as unknown as Plugin<unknown>,
  Inert as unknown as Plugin<unknown>,
  Vision as unknown as Plugin<unknown>,
  { plugin: HapiSwagger, options: swaggerOptions } as unknown as Plugin<unknown>,
];
