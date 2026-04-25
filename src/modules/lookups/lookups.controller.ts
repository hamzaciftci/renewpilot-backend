import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WhoisQueryDto } from './dto/whois-query.dto';
import { LookupsService } from './lookups.service';

@ApiTags('Lookups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get('whois')
  @ApiOperation({
    summary: 'Look up domain registration / expiry via RDAP',
    description:
      'Returns expiry date, registrar, and status for a given domain. ' +
      'Used by the asset-add flow to auto-populate the renewal date for domains. ' +
      'Auth required to prevent anonymous abuse.',
  })
  whois(@Query() query: WhoisQueryDto) {
    return this.lookupsService.whois(query.domain);
  }
}
