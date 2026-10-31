import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { TypeormUserRepository } from '../users/persistence/typeorm.user.repository.js';
import { SessionUserResolver } from './services/session-user.resolver.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [
    { provide: 'UsersRepository', useClass: TypeormUserRepository },
    SessionUserResolver,
    JwtStrategy,
  ],
  exports: [PassportModule, SessionUserResolver],
})
export class JwtAuthModule {}
