import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Bank Licensing & Compliance Portal API')
    .setDescription(
      'REST API for the National Bank of Rwanda licensing portal. ' +
        'Supports application submission, review workflow, document management, and audit trail.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Application running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}
void bootstrap();
