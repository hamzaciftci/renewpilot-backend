import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { PrismaModule } from './common/db/prisma.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AssetsModule } from './modules/assets/assets.module';
import { RenewalsModule } from './modules/renewals/renewals.module';
import { BillingModule } from './modules/billing/billing.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsServerlessModule } from './modules/notifications/notifications-serverless.module';
import { CronModule } from './modules/cron/cron.module';
import { ReminderPoliciesModule } from './modules/reminder-policies/reminder-policies.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRES: Joi.string().default('7d'),
        BCRYPT_ROUNDS: Joi.number().default(12),
        // Notification providers (optional)
        RESEND_API_KEY: Joi.string().optional().allow(''),
        EMAIL_FROM: Joi.string().optional().allow(''),
        TWILIO_ACCOUNT_SID: Joi.string().optional().allow(''),
        TWILIO_AUTH_TOKEN: Joi.string().optional().allow(''),
        TWILIO_FROM_PHONE: Joi.string().optional().allow(''),
        TWILIO_WHATSAPP_FROM: Joi.string().optional().allow(''),
        CRON_SECRET: Joi.string().optional().allow(''),
        FRONTEND_URL: Joi.string().optional().allow(''),
      }),
      validationOptions: { abortEarly: false },
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    AssetsModule,
    RenewalsModule,
    NotificationsServerlessModule,
    ReminderPoliciesModule,
    CronModule,
    BillingModule,
    AuditModule,
  ],
})
export class AppServerlessModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
