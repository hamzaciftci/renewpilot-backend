import { IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  auth!: string;
}

export class PushSubscribeDto {
  // Browsers issue endpoints like https://fcm.googleapis.com/fcm/send/...
  // or https://updates.push.services.mozilla.com/wpush/v2/...
  @IsUrl({ require_tld: true, require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;

  @IsObject()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}

export class PushUnsubscribeDto {
  @IsUrl({ require_tld: true, require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;
}
