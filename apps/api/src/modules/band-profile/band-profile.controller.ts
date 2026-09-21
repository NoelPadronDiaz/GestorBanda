import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { BandProfileResponseDto, UpdateBandProfileDto } from './band-profile.dto';
import { BandProfileService } from './band-profile.service';

@ApiTags('band-profile')
@ApiBearerAuth()
@Controller('band-profile')
export class BandProfileController {
  constructor(private readonly bandProfile: BandProfileService) {}

  @Get()
  @RequirePermissions('band_profile.read')
  get(): Promise<BandProfileResponseDto> {
    return this.bandProfile.get();
  }

  @Patch()
  @RequirePermissions('band_profile.update')
  update(@Body() dto: UpdateBandProfileDto): Promise<BandProfileResponseDto> {
    return this.bandProfile.update(dto);
  }
}
