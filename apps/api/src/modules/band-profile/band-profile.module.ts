import { Module } from '@nestjs/common';
import { BandProfileController } from './band-profile.controller';
import { BandProfileService } from './band-profile.service';

@Module({
  controllers: [BandProfileController],
  providers: [BandProfileService],
  exports: [BandProfileService],
})
export class BandProfileModule {}
