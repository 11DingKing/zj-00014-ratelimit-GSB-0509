import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: config.swagger.title,
      version: config.swagger.version,
      description: config.swagger.description
    },
    servers: [
      {
        url: '/'
      }
    ],
    components: {
      securitySchemes: {
        basicAuth: {
          type: 'http',
          scheme: 'basic'
        }
      }
    },
    security: []
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
