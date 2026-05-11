import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from './common/enums/user-role.enum';
import { Roles } from './auth/decorators/roles.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): { status: 'ok'; service: string } {
    return this.appService.getHealth();
  }

  @Get('admin/ping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAdminPing(): { message: string } {
    return { message: 'Admin access granted' };
  }
}
