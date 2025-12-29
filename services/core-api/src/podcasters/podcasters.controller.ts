import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PodcastersService } from './podcasters.service';
import { CreatePodcasterDto } from './dto/create-podcaster.dto';
import { UpdatePodcasterDto } from './dto/update-podcaster.dto';

@Controller('podcasters')
export class PodcastersController {
    constructor(private readonly podcastersService: PodcastersService) {}

    @Post()
    create(@Body() createPodcasterDto: CreatePodcasterDto) {
        return this.podcastersService.create(createPodcasterDto);
    }

    @Get()
    findAll() {
        return this.podcastersService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.podcastersService.findOne(+id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updatePodcasterDto: UpdatePodcasterDto) {
        return this.podcastersService.update(+id, updatePodcasterDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.podcastersService.remove(+id);
    }
}
