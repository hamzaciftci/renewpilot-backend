import { PartialType } from '@nestjs/swagger';
import { CreateReminderPolicyDto } from './create-reminder-policy.dto';

export class UpdateReminderPolicyDto extends PartialType(CreateReminderPolicyDto) {}
