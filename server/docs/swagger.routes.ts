import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './swagger.document';

export const swaggerRouter = Router();

const customDarkCss = `
  body {
    background-color: #0b0e17 !important;
    color: #e2e8f0 !important;
    font-family: ui-sans-serif, system-ui, sans-serif !important;
  }
  .swagger-ui .topbar { display: none !important; }
  .swagger-ui { color: #cbd5e1 !important; }
  .swagger-ui .info .title { color: #f8fafc !important; }
  .swagger-ui .info p, .swagger-ui .info li { color: #94a3b8 !important; }
  .swagger-ui .scheme-container {
    background: #0f172a !important;
    box-shadow: none !important;
    border-bottom: 1px solid #1e293b !important;
  }
  .swagger-ui .opblock {
    background: #0f172a !important;
    border: 1px solid #1e293b !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2) !important;
  }
  .swagger-ui .opblock.opblock-post { border-color: #4f46e5 !important; background: rgba(79, 70, 229, 0.05) !important; }
  .swagger-ui .opblock.opblock-get { border-color: #0ea5e9 !important; background: rgba(14, 165, 233, 0.05) !important; }
  .swagger-ui .opblock.opblock-patch { border-color: #8b5cf6 !important; background: rgba(139, 92, 246, 0.05) !important; }
  .swagger-ui .opblock-tag { color: #e2e8f0 !important; border-bottom: 1px solid #1e293b !important; }
  .swagger-ui .opblock .opblock-summary-operation-id,
  .swagger-ui .opblock .opblock-summary-path,
  .swagger-ui .opblock .opblock-summary-path__deprecated { color: #f1f5f9 !important; }
  .swagger-ui .opblock .opblock-summary-description { color: #94a3b8 !important; }
  .swagger-ui section.models {
    border: 1px solid #1e293b !important;
    background: #0f172a !important;
    border-radius: 12px !important;
  }
  .swagger-ui section.models h4 { color: #f8fafc !important; }
  .swagger-ui .model-box { background: #0b0e17 !important; }
  .swagger-ui .prop-type { color: #a78bfa !important; }
  .swagger-ui table thead tr th { color: #cbd5e1 !important; border-bottom: 1px solid #334155 !important; }
  .swagger-ui table tbody tr td { border-color: #1e293b !important; }
  .swagger-ui .btn { border-radius: 8px !important; }
  .swagger-ui input[type=text], .swagger-ui input[type=password], .swagger-ui textarea {
    background: #0b0e17 !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
  }
`;

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customCss: customDarkCss,
  customSiteTitle: 'GameHub AI — Documentação da API',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
  },
};

// Serve raw JSON spec
swaggerRouter.get('/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocument);
});

// Serve interactive UI
swaggerRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));
