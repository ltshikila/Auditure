import { Injectable } from '@nestjs/common';
import { CreatePodcasterDto } from './dto/create-podcaster.dto';
import { UpdatePodcasterDto } from './dto/update-podcaster.dto';

@Injectable()
export class PodcastersService {
    create(createPodcasterDto: CreatePodcasterDto) {
        return 'This action adds a new podcaster';
    }

    findAll() {
        return `This action returns all podcasters`;
    }

    findOne(id: number) {
        return `This action returns a #${id} podcaster`;
    }

    update(id: number, updatePodcasterDto: UpdatePodcasterDto) {
        return `This action updates a #${id} podcaster`;
    }

    remove(id: number) {
        return `This action removes a #${id} podcaster`;
    }
}
