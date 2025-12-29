import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { StorageService } from './storage.service';

@Global()
@Module({
    providers: [EmailService, StorageService],
    exports: [EmailService, StorageService],
})
export class CommonModule {}
