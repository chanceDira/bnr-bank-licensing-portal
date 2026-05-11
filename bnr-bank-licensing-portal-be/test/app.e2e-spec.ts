import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from '../src/common/interceptors/request-id.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

describe('App API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new RequestIdInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'ok',
          service: 'bank-licensing-portal-api',
        });
      });
  });

  it('returns 403 for protected endpoints without credentials', () => {
    return request(app.getHttpServer())
      .get('/api/v1/admin/ping')
      .expect(403)
      .expect(({ body }) => {
        const errorBody = body as { code: string; message: string };
        expect(errorBody.code).toBe('FORBIDDEN');
        expect(errorBody.message).toBe('Authentication required');
      });
  });
});
