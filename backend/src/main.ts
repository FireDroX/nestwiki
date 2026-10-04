import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

const JSON_BODY_LIMIT = '30mb';

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('OpenWiki API')
    .setDescription(
      'Documentation interactive de tous les endpoints exposés par le backend OpenWiki.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Inscription, connexion et gestion des tokens JWT')
    .addTag('Health', "Vérification de l'état du serveur")
    .addTag('Pages', 'Arborescence, contenu, versions et historique des pages')
    .addTag('Media', 'Upload et gestion des fichiers stockés sur Minio')
    .addTag('Users', 'Profil du compte connecté')
    .addTag(
      'Admin — Users',
      'Gestion des comptes utilisateurs (réservé aux admins)',
    )
    .addTag('Tags', 'Gestion des tags et de leur association aux pages')
    .addTag(
      'Meta',
      "Balises Open Graph et composant Discord des pages, pour les robots d'aperçu de lien",
    )
    .addTag(
      'Admin — MCP',
      'Gestion des clés API du serveur MCP (pilotage par IA, réservé aux admins)',
    )
    .addTag(
      'Admin — OAuth',
      'Gestion des clients OAuth MCP et de leurs refresh tokens actifs (réservé aux admins)',
    )
    .addTag(
      'OAuth',
      "Flux d'autorisation OAuth 2.0 (écran de consentement MCP)",
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', {
    extended: true,
    limit: JSON_BODY_LIMIT,
  });
  app.setGlobalPrefix('api', {
    exclude: [
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-authorization-server',
    ],
  });
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    exposedHeaders: ['Retry-After'],
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
