import { PartialType } from '@nestjs/mapped-types';
import { CreatePodcasterDto } from './create-podcaster.dto';

export class UpdatePodcasterDto extends PartialType(CreatePodcasterDto) {}
