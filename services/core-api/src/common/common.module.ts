import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
    controllers: [StorageController],
    providers: [EmailService, StorageService],
    exports: [EmailService, StorageService],
})
export class CommonModule {}
