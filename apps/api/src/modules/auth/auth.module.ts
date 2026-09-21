import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../../config/env';
import { MembersModule } from '../members/members.module';
import { JWT_ISSUER } from './auth.constants';
import { AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';
import { UsersService } from './users.service';

@Module({
  imports: [
    PassportModule,
    MembersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          expiresIn: config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController, MeController, InvitationsController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    UsersService,
    InvitationsService,
    JwtStrategy,
  ],
  exports: [UsersService],
})
export class AuthModule {}
